import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_AI_IDENTITY_EVAL_CASES,
  getOrganizationAIContext,
  queryRAG,
} from '@workspace/ai'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), '../../.env') })

interface EvalCaseRow {
  id: string
  name: string
  input_message: string
  expected_intent: string
  expected_contains: unknown
  forbidden_contains: unknown
  required_source_type: string | null
}

function readArg(name: string): string | null {
  const flag = `--${name}=`
  const raw = process.argv.find((entry) => entry.startsWith(flag))
  return raw ? raw.slice(flag.length).trim() || null : null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function score(params: {
  output: string
  actualIntent: string
  expectedIntent: string
  expectedContains: string[]
  forbiddenContains: string[]
  requiredSourceType: string | null
  sourceTypes: string[]
  companyName: string
}) {
  const output = params.output.toLowerCase()
  const expectedTerms = params.expectedContains.length > 0
    ? params.expectedContains
    : [params.companyName].filter(Boolean)
  const intentPassed =
    params.actualIntent === params.expectedIntent ||
    (params.expectedIntent === 'company_identity' && params.actualIntent === 'product_overview')
  const containsPassed =
    expectedTerms.length === 0 ||
    expectedTerms.some((term) => output.includes(term.toLowerCase()))
  const forbiddenHits = params.forbiddenContains.filter((term) =>
    output.includes(term.toLowerCase())
  )
  const forbiddenPassed = forbiddenHits.length === 0
  const sourcePassed =
    !params.requiredSourceType ||
    params.sourceTypes.includes(params.requiredSourceType)

  let value = 100
  if (!intentPassed) value -= 25
  if (!containsPassed) value -= 30
  if (!forbiddenPassed) value -= 35
  if (!sourcePassed) value -= 10

  return {
    passed: intentPassed && containsPassed && forbiddenPassed && sourcePassed,
    score: Math.max(0, value),
    diagnostics: {
      actualIntent: params.actualIntent,
      expectedIntent: params.expectedIntent,
      intentPassed,
      containsPassed,
      forbiddenPassed,
      forbiddenHits,
      sourcePassed,
      sourceTypes: params.sourceTypes,
    },
  }
}

async function main() {
  const orgId = readArg('orgId')
  if (!orgId) throw new Error('Missing required --orgId=<uuid>')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const context = await getOrganizationAIContext(orgId)

  if (hasFlag('seed')) {
    const { data: existing } = await supabase
      .from('ai_eval_cases')
      .select('name')
      .eq('org_id', orgId)
    const existingNames = new Set(((existing ?? []) as Array<{ name: string }>).map((row) => row.name))
    const rows = DEFAULT_AI_IDENTITY_EVAL_CASES
      .filter((item) => !existingNames.has(item.name))
      .map((item) => ({
        org_id: orgId,
        name: item.name,
        input_message: item.inputMessage,
        expected_intent: item.expectedIntent,
        expected_contains: context.profile.companyName ? [context.profile.companyName] : item.expectedContains,
        forbidden_contains: item.forbiddenContains,
        required_source_type: item.requiredSourceType ?? null,
        language: item.language,
        channel: item.channel,
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('ai_eval_cases').insert(rows)
      if (error) throw new Error(`Failed to seed eval cases: ${error.message}`)
      console.log(`[ai-identity-eval] Seeded ${rows.length} default cases`)
    }
  }

  const { data, error } = await supabase
    .from('ai_eval_cases')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load eval cases: ${error.message}`)
  const cases = (data ?? []) as EvalCaseRow[]
  if (cases.length === 0) throw new Error('No active eval cases found. Run with --seed first.')

  const outcomes = []
  for (const item of cases) {
    const result = await queryRAG({
      query: item.input_message,
      orgId,
      channel: 'eval',
      threshold: 0.25,
      maxChunks: 6,
    })
    const sourceTypes = result.sources
      .map((source) => source.sourceType)
      .filter((sourceType): sourceType is string => Boolean(sourceType))
    const scored = score({
      output: result.message,
      actualIntent: result.debug?.intent ?? 'unknown',
      expectedIntent: item.expected_intent,
      expectedContains: asStringArray(item.expected_contains),
      forbiddenContains: asStringArray(item.forbidden_contains),
      requiredSourceType: item.required_source_type,
      sourceTypes,
      companyName: context.profile.companyName,
    })

    await supabase
      .from('ai_eval_cases')
      .update({
        last_run_at: new Date().toISOString(),
        last_passed: scored.passed,
        last_score: scored.score,
        last_output: result.message,
        last_diagnostics: scored.diagnostics,
      })
      .eq('id', item.id)
      .eq('org_id', orgId)

    outcomes.push({
      id: item.id,
      name: item.name,
      input: item.input_message,
      output: result.message,
      ...scored,
    })
  }

  const outputDir = path.resolve(process.cwd(), 'eval-reports')
  await mkdir(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(outputDir, `ai-identity-${timestamp}.json`)
  const mdPath = path.join(outputDir, `ai-identity-${timestamp}.md`)
  const summary = {
    orgId,
    companyName: context.profile.companyName,
    total: outcomes.length,
    passed: outcomes.filter((item) => item.passed).length,
    failed: outcomes.filter((item) => !item.passed).length,
    outcomes,
  }

  await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf8')
  await writeFile(
    mdPath,
    [
      `# AI Identity Eval Report`,
      ``,
      `- Organization: ${context.profile.companyName}`,
      `- Total: ${summary.total}`,
      `- Passed: ${summary.passed}`,
      `- Failed: ${summary.failed}`,
      ``,
      ...outcomes.map((item) => [
        `## ${item.passed ? 'PASS' : 'FAIL'} - ${item.name}`,
        ``,
        `Score: ${item.score}`,
        ``,
        `Input: ${item.input}`,
        ``,
        `Output: ${item.output}`,
        ``,
      ].join('\n')),
    ].join('\n'),
    'utf8'
  )

  console.log(`[ai-identity-eval] Completed: ${summary.passed}/${summary.total} passed`)
  console.log(`[ai-identity-eval] JSON: ${jsonPath}`)
  console.log(`[ai-identity-eval] Markdown: ${mdPath}`)
}

main().catch((error) => {
  console.error('[ai-identity-eval] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

