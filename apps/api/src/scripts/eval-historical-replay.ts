import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'
import { queryWithActions } from '@workspace/ai'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), '../../.env') })

interface ConversationRow {
  id: string
  contact_id: string | null
}

interface MessageRow {
  conversation_id: string
  role: string
  content: string | null
  created_at: string
}

interface EvalSample {
  conversationId: string
  contactId: string | null
  query: string
  expectedReply: string | null
  history: Array<{ role: string; content: string }>
}

interface EvalOutcome {
  sample: EvalSample
  responseType: string
  responseMessage: string
  confidence: number
  latencyMs: number
  tokenUsage: number
  overlapScore: number | null
  error?: string
}

function readArg(name: string): string | null {
  const flag = `--${name}=`
  const raw = process.argv.find((entry) => entry.startsWith(flag))
  if (!raw) return null
  const value = raw.slice(flag.length).trim()
  return value.length > 0 ? value : null
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function normalizeRole(role: string): 'user' | 'assistant' | 'system' {
  if (role === 'assistant' || role === 'system' || role === 'user') return role
  if (role === 'agent') return 'assistant'
  return 'user'
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

function jaccardOverlap(left: string, right: string): number | null {
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return null

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)

  let intersection = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection++
  }
  const union = new Set([...leftSet, ...rightSet]).size
  if (union === 0) return null
  return intersection / union
}

function buildSamples(
  conversations: ConversationRow[],
  messages: MessageRow[],
  maxSamples: number
): EvalSample[] {
  const conversationById = new Map<string, ConversationRow>()
  for (const row of conversations) {
    conversationById.set(row.id, row)
  }

  const grouped = new Map<string, MessageRow[]>()
  for (const message of messages) {
    if (!grouped.has(message.conversation_id)) grouped.set(message.conversation_id, [])
    grouped.get(message.conversation_id)!.push(message)
  }

  const samples: EvalSample[] = []
  for (const [conversationId, list] of grouped.entries()) {
    const contactId = conversationById.get(conversationId)?.contact_id ?? null

    for (let index = 0; index < list.length; index++) {
      const current = list[index]
      if (!current) continue
      if (current.role !== 'user') continue
      const query = (current.content ?? '').trim()
      if (!query) continue

      const expectedReply = list
        .slice(index + 1)
        .find((candidate) => candidate.role === 'assistant' || candidate.role === 'agent')
      const expectedText = (expectedReply?.content ?? '').trim() || null

      const history = list
        .slice(Math.max(0, index - 8), index)
        .map((entry) => ({
          role: normalizeRole(entry.role),
          content: (entry.content ?? '').trim(),
        }))
        .filter((entry) => entry.content.length > 0)

      samples.push({
        conversationId,
        contactId,
        query,
        expectedReply: expectedText,
        history,
      })

      if (samples.length >= maxSamples) {
        return samples
      }
    }
  }

  return samples
}

async function main() {
  const orgId = readArg('orgId')
  if (!orgId) {
    throw new Error('Missing required argument --orgId=<uuid>')
  }

  const conversationLimit = toPositiveInt(readArg('conversationLimit'), 50)
  const sampleLimit = toPositiveInt(readArg('sampleLimit'), 120)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: conversationRows, error: conversationError } = await supabase
    .from('conversations')
    .select('id, contact_id')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(conversationLimit)

  if (conversationError) {
    throw new Error(`Failed to load conversations: ${conversationError.message}`)
  }

  const conversations = (conversationRows ?? []) as ConversationRow[]
  if (conversations.length === 0) {
    throw new Error('No conversations found for this organization.')
  }

  const conversationIds = conversations.map((row) => row.id)
  const { data: messageRows, error: messageError } = await supabase
    .from('messages')
    .select('conversation_id, role, content, created_at')
    .eq('org_id', orgId)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  if (messageError) {
    throw new Error(`Failed to load messages: ${messageError.message}`)
  }

  const samples = buildSamples(
    conversations,
    ((messageRows ?? []) as MessageRow[]).filter((row) => typeof row.content === 'string'),
    sampleLimit
  )

  if (samples.length === 0) {
    throw new Error('No usable user-message samples found for replay.')
  }

  const outcomes: EvalOutcome[] = []
  for (const sample of samples) {
    const start = performance.now()
    try {
      const result = await queryWithActions({
        query: sample.query,
        orgId,
        conversationId: sample.conversationId,
        contactId: sample.contactId ?? undefined,
        conversationHistory: sample.history,
        threshold: 0.3,
        maxChunks: 5,
        simulateActions: true,
      })

      const latencyMs = performance.now() - start
      outcomes.push({
        sample,
        responseType: result.type,
        responseMessage: result.message,
        confidence: result.confidence,
        latencyMs,
        tokenUsage: result.tokensUsed ?? 0,
        overlapScore: sample.expectedReply
          ? jaccardOverlap(result.message, sample.expectedReply)
          : null,
      })
    } catch (error) {
      outcomes.push({
        sample,
        responseType: 'error',
        responseMessage: '',
        confidence: 0,
        latencyMs: performance.now() - start,
        tokenUsage: 0,
        overlapScore: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const successful = outcomes.filter((item) => item.responseType !== 'error')
  const avgLatencyMs =
    successful.length > 0
      ? successful.reduce((sum, item) => sum + item.latencyMs, 0) / successful.length
      : 0
  const avgConfidence =
    successful.length > 0
      ? successful.reduce((sum, item) => sum + item.confidence, 0) / successful.length
      : 0
  const avgTokenUsage =
    successful.length > 0
      ? successful.reduce((sum, item) => sum + item.tokenUsage, 0) / successful.length
      : 0
  const overlapScores = successful
    .map((item) => item.overlapScore)
    .filter((value): value is number => typeof value === 'number')
  const avgOverlap =
    overlapScores.length > 0
      ? overlapScores.reduce((sum, value) => sum + value, 0) / overlapScores.length
      : null

  const typeBreakdown: Record<string, number> = {}
  for (const item of outcomes) {
    typeBreakdown[item.responseType] = (typeBreakdown[item.responseType] ?? 0) + 1
  }

  const report = {
    generatedAt: new Date().toISOString(),
    orgId,
    replayConfig: {
      conversationLimit,
      sampleLimit,
      actualSamples: samples.length,
      simulateActions: true,
    },
    summary: {
      successCount: successful.length,
      errorCount: outcomes.length - successful.length,
      avgLatencyMs,
      avgConfidence,
      avgTokenUsage,
      avgOverlap,
      typeBreakdown,
    },
    outcomes: outcomes.map((item) => ({
      conversationId: item.sample.conversationId,
      query: item.sample.query,
      expectedReply: item.sample.expectedReply,
      responseType: item.responseType,
      responseMessage: item.responseMessage,
      confidence: item.confidence,
      latencyMs: item.latencyMs,
      tokenUsage: item.tokenUsage,
      overlapScore: item.overlapScore,
      error: item.error,
    })),
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = path.resolve(process.cwd(), 'eval-reports')
  const jsonPath = path.join(outputDir, `historical-replay-${ts}.json`)
  const mdPath = path.join(outputDir, `historical-replay-${ts}.md`)

  await mkdir(outputDir, { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const topErrors = outcomes
    .filter((item) => item.error)
    .slice(0, 10)
    .map((item) => `- ${item.sample.conversationId}: ${item.error}`)
    .join('\n')

  const markdown = [
    '# Historical Conversation Replay Report',
    '',
    `- Generated At: ${report.generatedAt}`,
    `- Org ID: ${orgId}`,
    `- Samples Replayed: ${samples.length}`,
    `- Successful: ${report.summary.successCount}`,
    `- Failed: ${report.summary.errorCount}`,
    `- Avg Latency: ${avgLatencyMs.toFixed(1)} ms`,
    `- Avg Confidence: ${avgConfidence.toFixed(3)}`,
    `- Avg Token Usage: ${avgTokenUsage.toFixed(1)}`,
    `- Avg Overlap (Jaccard): ${avgOverlap === null ? 'n/a' : avgOverlap.toFixed(3)}`,
    '',
    '## Response Type Breakdown',
    ...Object.entries(typeBreakdown).map(([type, count]) => `- ${type}: ${count}`),
    '',
    '## Top Errors',
    topErrors || '- None',
    '',
    `JSON report: ${jsonPath}`,
  ].join('\n')

  await writeFile(mdPath, `${markdown}\n`, 'utf8')

  console.log('[eval-harness] Completed successfully')
  console.log(`[eval-harness] JSON: ${jsonPath}`)
  console.log(`[eval-harness] Markdown: ${mdPath}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[eval-harness] Failed:', message)
  process.exitCode = 1
})
