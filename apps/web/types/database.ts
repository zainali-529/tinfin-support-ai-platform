export interface Attachment {
  url: string
  name: string
  size: number   // bytes
  type: string   // MIME type
}

export interface Conversation {
  id: string
  org_id: string
  contact_id: string | null
  status: 'bot' | 'pending' | 'open' | 'resolved' | 'closed'
  assigned_to: string | null
  channel: string
  started_at: string
  resolved_at: string | null
  contacts?: Contact | null
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  org_id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  created_at: string
  ai_metadata?: Record<string, unknown> | null
  attachments?: Attachment[]
}

export interface Contact {
  id: string
  org_id: string
  email: string | null
  name: string | null
  phone: string | null
  created_at: string
}