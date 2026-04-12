// ── Attachment ────────────────────────────────────────────────────────────────

export interface Attachment {
  url: string
  name: string
  size: number   // bytes
  type: string   // MIME type
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  createdAt: Date
  attachments?: Attachment[]
}

export type ConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'

export interface WidgetConversation {
  id: string
  status: ConversationStatus
  startedAt: string
  resolvedAt: string | null
  contactName: string | null
  contactEmail: string | null
  lastMessage: string
  lastMessageAt: string
}

export interface WidgetConfig {
  orgId: string
  // Basic — direct DB columns
  primaryColor?: string
  welcomeMessage?: string
  companyName?: string
  logoUrl?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showBranding?: boolean
  // Advanced — from settings JSONB
  botName?: string
  inputPlaceholder?: string
  responseTimeText?: string
  launcherSize?: 'sm' | 'md' | 'lg'
  borderRadius?: number
  widgetWidth?: number
  headerStyle?: 'gradient' | 'solid'
  userBubbleColor?: string | null
  autoOpen?: boolean
  autoOpenDelay?: number
  showTypingIndicator?: boolean
  offlineMessage?: string | null
  // ── Voice / Vapi ────────────────────────────────────────────────────────────
  vapiPublicKey?: string | null
  vapiAssistantId?: string | null
  voiceEnabled?: boolean
  callButtonLabel?: string
}

export interface VisitorInfo {
  name: string
  email: string
}

export interface StoredChat {
  visitorId: string
  visitorInfo: VisitorInfo | null
  activeConversationId: string | null
  conversations: WidgetConversation[]
  messagesByConversation: Record<string, Array<{
    id: string
    role: 'user' | 'assistant' | 'agent'
    content: string
    createdAt: string
    attachments?: Attachment[]
  }>>
  // Backward compatibility
  conversationId?: string | null
  messages?: Array<{
    id: string
    role: 'user' | 'assistant' | 'agent'
    content: string
    createdAt: string
    attachments?: Attachment[]
  }>
}