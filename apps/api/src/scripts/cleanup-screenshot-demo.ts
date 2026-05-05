import {
  deleteByColumn,
  deleteByIds,
  demoActionNames,
  getSupabaseAdmin,
  maybeDeleteByColumn,
  readCliOptions,
  selectIdsByJsonMarker,
} from './screenshot-demo-seed-utils'

export async function cleanupScreenshotDemo(params?: { orgId?: string; seedId?: string }) {
  const cli = params?.orgId && params?.seedId ? null : readCliOptions()
  const orgId = params?.orgId ?? cli?.orgId
  const seedId = params?.seedId ?? cli?.seedId

  if (!orgId || !seedId) {
    throw new Error('Missing org id or seed id for screenshot demo cleanup.')
  }

  const supabase = getSupabaseAdmin()

  console.log(`[screenshot-demo] cleanup started org=${orgId} seed=${seedId}`)

  const [
    conversationIds,
    contactIds,
    callIds,
    actionLogIds,
    noteIds,
    timelineEventIds,
    feedbackIds,
    notificationIds,
    kbIds,
    sourceIds,
    chunkIds,
  ] = await Promise.all([
    selectIdsByJsonMarker(supabase, 'conversations', 'ai_context', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'contacts', 'meta', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'calls', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'ai_action_logs', 'request_payload', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'conversation_internal_notes', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'conversation_timeline_events', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'conversation_feedback', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'notifications', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'knowledge_bases', 'settings', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'kb_sources', 'metadata', seedId, orgId),
    selectIdsByJsonMarker(supabase, 'kb_chunks', 'metadata', seedId, orgId),
  ])

  const { data: actionRows, error: actionError } = await supabase
    .from('ai_actions')
    .select('id')
    .eq('org_id', orgId)
    .in('name', demoActionNames(seedId))

  if (actionError) throw new Error(`Failed to select demo actions: ${actionError.message}`)
  const actionIds = ((actionRows ?? []) as Array<{ id: string }>).map((row) => row.id)

  if (actionLogIds.length > 0) {
    await maybeDeleteByColumn(supabase, 'ai_action_approvals', 'log_id', actionLogIds)
  }

  if (conversationIds.length > 0) {
    await maybeDeleteByColumn(supabase, 'email_messages', 'conversation_id', conversationIds)
    await maybeDeleteByColumn(supabase, 'whatsapp_messages', 'conversation_id', conversationIds)
    await maybeDeleteByColumn(supabase, 'messages', 'conversation_id', conversationIds)
    await maybeDeleteByColumn(supabase, 'inbox_routing_events', 'conversation_id', conversationIds)
  }

  if (actionIds.length > 0) {
    await maybeDeleteByColumn(supabase, 'ai_action_secrets', 'action_id', actionIds)
  }

  const deleted = {
    notifications: await deleteByIds(supabase, 'notifications', notificationIds),
    timelineEvents: await deleteByIds(supabase, 'conversation_timeline_events', timelineEventIds),
    internalNotes: await deleteByIds(supabase, 'conversation_internal_notes', noteIds),
    feedback: await deleteByIds(supabase, 'conversation_feedback', feedbackIds),
    actionLogs: await deleteByIds(supabase, 'ai_action_logs', actionLogIds),
    calls: await deleteByIds(supabase, 'calls', callIds),
    conversations: await deleteByIds(supabase, 'conversations', conversationIds),
    contacts: await deleteByIds(supabase, 'contacts', contactIds),
    kbChunks: await deleteByIds(supabase, 'kb_chunks', chunkIds),
    kbSources: await deleteByIds(supabase, 'kb_sources', sourceIds),
    knowledgeBases: await deleteByIds(supabase, 'knowledge_bases', kbIds),
    actions: await deleteByIds(supabase, 'ai_actions', actionIds),
  }

  console.log('[screenshot-demo] cleanup complete')
  console.table({ ...deleted, seedId })
  return deleted
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('cleanup-screenshot-demo.ts')) {
  cleanupScreenshotDemo().catch((error) => {
    console.error('[screenshot-demo] cleanup failed:', error)
    process.exit(1)
  })
}
