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

export interface WidgetSuggestion {
  label: string
  message: string
}

export type WidgetPosition = 'bottom-right' | 'bottom-left'
export type WidgetThemeMode = 'light' | 'dark' | 'system'

export interface WidgetThemeColors {
  backgroundColor?: string
  surfaceColor?: string
  textColor?: string
  mutedTextColor?: string
  borderColor?: string
  assistantBubbleColor?: string
  assistantTextColor?: string
  userBubbleTextColor?: string
  inputBackgroundColor?: string
  headerTextColor?: string
}

export interface WidgetHelpItem {
  id?: string
  question: string
  answer: string
  actionLabel?: string
  actionMessage?: string
}

export interface WidgetUser {
  id?: string
  email?: string
  name?: string
  phone?: string
  userHash?: string
  traits?: Record<string, unknown>
}

export interface WidgetCompany {
  id?: string
  name?: string
  plan?: string
  website?: string
  traits?: Record<string, unknown>
}

export interface WidgetPageContext {
  url?: string
  title?: string
  referrer?: string
}

export interface WidgetConfig {
  orgId: string
  // Basic — direct DB columns
  primaryColor?: string
  welcomeMessage?: string
  companyName?: string
  logoUrl?: string
  position?: WidgetPosition
  showBranding?: boolean
  // Advanced — from settings JSONB
  themeMode?: WidgetThemeMode
  lightTheme?: WidgetThemeColors
  darkTheme?: WidgetThemeColors
  botName?: string
  inputPlaceholder?: string
  responseTimeText?: string
  launcherSize?: 'sm' | 'md' | 'lg'
  borderRadius?: number
  widgetWidth?: number
  widgetHeight?: number
  expandedWidth?: number
  expandedHeight?: number
  headerStyle?: 'gradient' | 'solid'
  userBubbleColor?: string | null
  autoOpen?: boolean
  autoOpenDelay?: number
  showTypingIndicator?: boolean
  offlineMessage?: string | null
  // Quick replies
  suggestions?: WidgetSuggestion[]
  helpItems?: WidgetHelpItem[]
  talkToHumanLabel?: string
  talkToHumanMessage?: string
  // ── Voice / Vapi ────────────────────────────────────────────────────────────
  vapiPublicKey?: string | null
  vapiAssistantId?: string | null
  voiceEnabled?: boolean
  callButtonLabel?: string
  // Runtime identity and context passed through the JS API.
  user?: WidgetUser
  company?: WidgetCompany
  page?: WidgetPageContext
  customAttributes?: Record<string, unknown>
}

export interface VisitorInfo {
  name: string
  email: string
  id?: string
  phone?: string
  userHash?: string
  company?: WidgetCompany
  traits?: Record<string, unknown>
  page?: WidgetPageContext
  customAttributes?: Record<string, unknown>
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
