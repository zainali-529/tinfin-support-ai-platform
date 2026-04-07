export interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  createdAt: Date
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
  primaryColor?: string
  welcomeMessage?: string
  companyName?: string
  logoUrl?: string
  position?: 'bottom-right' | 'bottom-left'
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
  }>>

  // Backward compatibility with older widget storage shape.
  conversationId?: string | null
  messages?: Array<{
    id: string
    role: 'user' | 'assistant' | 'agent'
    content: string
    createdAt: string
  }>
}