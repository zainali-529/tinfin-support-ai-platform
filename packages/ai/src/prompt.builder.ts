import type { KBChunk } from '@workspace/types'

export interface OrgAIConfig {
  name: string
  aiName?: string
  aiPersona?: string
  handoffTriggers?: string[]
  language?: string
}

export function buildSystemPrompt(org: OrgAIConfig, chunks: KBChunk[]): string {
  const sources = chunks
    .map((c, i) => `[SOURCE ${i + 1}] ${c.sourceTitle || 'KB'}: ${c.content}`)
    .join('\n\n')

  const triggers = org.handoffTriggers?.join(', ') || 'speak to agent, human, urgent, complaint'

  return `You are ${org.aiName || 'Support Assistant'} for ${org.name}.
${org.aiPersona || ''}

## Knowledge Base (ONLY answer from this)
${sources || 'No knowledge base loaded.'}

## Rules
1. ONLY use information from the knowledge base above.
2. If answer is not in KB: "I don't have that information. Let me connect you to a human agent."
3. Be concise: 1-3 sentences unless more detail needed.
4. Never make up prices, policies, or features.
5. Respond in the same language the user is writing in.
6. For account actions or sensitive issues, hand off to human immediately.

## Handoff Triggers (immediately escalate)
${triggers}`.trim()
}