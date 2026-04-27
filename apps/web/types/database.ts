/**
 * apps/web/types/database.ts
 *
 * Shared database row types for the frontend.
 * These mirror the Supabase DB schema without generics.
 */

// ─── Contact ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  org_id: string
  name: string | null
  email: string | null
  phone: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

export interface Message {
  id: string
  conversation_id: string
  org_id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  attachments: Attachment[]
  ai_metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export type ConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'
export type ConversationChannel =
  | 'chat'
  | 'email'
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'sms'
  | 'telegram'
  | 'voice'

export interface EmailMessagePreview {
  id: string
  subject: string
  created_at: string
}

export interface Conversation {
  id: string
  org_id: string
  contact_id: string | null
  status: ConversationStatus
  /** 'chat' | 'email' | 'whatsapp' | future channels */
  channel: ConversationChannel
  assigned_to: string | null
  started_at: string
  resolved_at?: string | null
  meta?: Record<string, unknown> | null
  /** Joined contact record */
  contacts: Contact | null
  /** Joined message records (subset — for last message preview) */
  messages?: Message[]
  /** Joined email message previews for subject-based list snippets */
  email_messages?: EmailMessagePreview[]
  /** Precomputed preview fields from API list endpoints */
  latest_message_content?: string | null
  latest_message_at?: string | null
  latest_email_subject?: string | null
  latest_email_at?: string | null
}

// ─── Email Message ────────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  org_id: string
  conversation_id: string
  message_id: string | null
  external_message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  subject: string
  from_email: string
  from_name: string | null
  to_emails: string[]
  cc_emails: string[]
  html_body: string | null
  text_body: string | null
  direction: 'inbound' | 'outbound'
  status: 'received' | 'sent' | 'failed'
  error_message: string | null
  raw_headers: Record<string, string>
  created_at: string
}

// ─── Email Account ────────────────────────────────────────────────────────────

export interface EmailAccountConfig {
  id: string
  orgId: string
  fromEmail: string
  fromName: string
  inboundAddress: string | null
  inboundProvider: string
  isActive: boolean
  aiAutoReply: boolean
  emailSignature: string | null
  settings: Record<string, unknown>
  hasResendKey: boolean
  resendApiKeyMasked: string | null
  inboundWebhookToken: string | null
  createdAt: string
  updatedAt: string
}

// ─── Canned Responses ──────────────────────────────────────────────────────────

export type CannedResponseCategory = string

export interface CannedResponse {
  id: string
  orgId: string
  title: string
  category: CannedResponseCategory
  shortcut: string | null
  content: string
  tags: string[]
  isActive: boolean
  usageCount: number
  lastUsedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CannedResponseSuggestion extends CannedResponse {
  score: number
  reason: string
}
