import {
  deleteByColumn,
  deleteByIds,
  demoActionNames,
  getSupabaseAdmin,
  readCliOptions,
} from './analytics-demo-seed-utils'

async function selectIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  seedId: string,
  orgId: string
) {
  const ids: string[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('org_id', orgId)
      .eq(`${column}->>analyticsDemoSeedId`, seedId)
      .range(from, from + 999)

    if (error) throw new Error(`Failed to select ${table}: ${error.message}`)

    const rows = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
    ids.push(...rows)
    if (rows.length < 1000) break
  }

  return ids
}

async function main() {
  const { orgId, seedId } = readCliOptions()
  const supabase = getSupabaseAdmin()

  console.log(`[analytics-demo] cleanup started org=${orgId} seed=${seedId}`)

  const [conversationIds, contactIds, callIds, actionLogIds] = await Promise.all([
    selectIds(supabase, 'conversations', 'ai_context', seedId, orgId),
    selectIds(supabase, 'contacts', 'meta', seedId, orgId),
    selectIds(supabase, 'calls', 'metadata', seedId, orgId),
    selectIds(supabase, 'ai_action_logs', 'request_payload', seedId, orgId),
  ])

  const { data: actionRows, error: actionError } = await supabase
    .from('ai_actions')
    .select('id')
    .eq('org_id', orgId)
    .in('name', demoActionNames(seedId))

  if (actionError) throw new Error(`Failed to select demo actions: ${actionError.message}`)
  const actionIds = ((actionRows ?? []) as Array<{ id: string }>).map((row) => row.id)

  if (actionLogIds.length > 0) {
    await deleteByColumn(supabase, 'ai_action_approvals', 'log_id', actionLogIds)
  }

  const deletedActionLogs = await deleteByIds(supabase, 'ai_action_logs', actionLogIds)
  const deletedCalls = await deleteByIds(supabase, 'calls', callIds)

  if (conversationIds.length > 0) {
    await deleteByColumn(supabase, 'messages', 'conversation_id', conversationIds)
  }

  const deletedConversations = await deleteByIds(supabase, 'conversations', conversationIds)
  const deletedContacts = await deleteByIds(supabase, 'contacts', contactIds)
  const deletedActions = await deleteByIds(supabase, 'ai_actions', actionIds)

  console.log('[analytics-demo] cleanup complete')
  console.table({
    actionLogs: deletedActionLogs,
    actions: deletedActions,
    calls: deletedCalls,
    contacts: deletedContacts,
    conversations: deletedConversations,
  })
}

main().catch((error) => {
  console.error('[analytics-demo] cleanup failed:', error)
  process.exit(1)
})
