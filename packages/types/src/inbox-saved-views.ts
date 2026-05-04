export const INBOX_SAVED_VIEW_IDS = [
  'all',
  'my_open',
  'unassigned',
  'sla_at_risk',
  'sla_breached',
  'waiting_customer',
  'human_takeover',
  'email_only',
  'whatsapp_only',
  'ai_handled',
  'actions_failed',
] as const

export type InboxSavedViewId = (typeof INBOX_SAVED_VIEW_IDS)[number]
