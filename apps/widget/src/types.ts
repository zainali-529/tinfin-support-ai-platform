export interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  createdAt: Date
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
  conversationId: string | null
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'agent'
    content: string
    createdAt: string
  }>
}