// ============ Existing types (unchanged) ============
export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'starter' | 'pro' | 'scale' | 'enterprise'
  settings: Record<string, unknown>
  createdAt: string
}

export interface User {
  id: string
  orgId: string
  email: string
  name: string | null
  role: 'admin' | 'agent'
  isOnline: boolean
  createdAt: string
}

export interface Contact {
  id: string
  orgId: string
  email: string | null
  name: string | null
  phone: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export type ConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'
export type ConversationChannel = 'chat' | 'email' | 'whatsapp' | 'voice'

export interface Conversation {
  id: string
  orgId: string
  contactId: string
  status: ConversationStatus
  assignedTo: string | null
  channel: ConversationChannel
  aiContext: Record<string, unknown>
  startedAt: string
  resolvedAt: string | null
}

export type MessageRole = 'user' | 'assistant' | 'agent' | 'system'

export interface Message {
  id: string
  conversationId: string
  orgId: string
  role: MessageRole
  content: string
  attachments: Attachment[]
  aiMetadata: AIMetadata | null
  createdAt: string
}

export interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

export interface AIMetadata {
  model?: string
  confidence?: number
  sources?: string[]
  tokensUsed?: number
  shouldHandoff?: boolean
}

export type WidgetPosition = 'bottom-right' | 'bottom-left'
export type WidgetThemeMode = 'light' | 'dark' | 'system'

export interface WidgetThemeColors {
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  borderColor: string
  assistantBubbleColor: string
  assistantTextColor: string
  userBubbleTextColor: string
  inputBackgroundColor: string
  headerTextColor: string
}

export interface WidgetHelpItem {
  id: string
  question: string
  answer: string
  actionLabel?: string
  actionMessage?: string
}

export interface WidgetConfig {
  primaryColor: string
  textColor: string
  bgColor: string
  position: WidgetPosition
  offsetX: number
  offsetY: number
  welcomeMessage: string
  companyName: string
  logoUrl?: string
  showBranding: boolean
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
  userBubbleColor?: string
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator?: boolean
  offlineMessage?: string
  suggestions?: Array<{ label: string; message: string }>
  helpItems?: WidgetHelpItem[]
  talkToHumanLabel?: string
  talkToHumanMessage?: string
}

export interface KBChunk {
  id: string
  orgId: string
  kbId: string
  content: string
  sourceUrl: string | null
  sourceTitle: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

// ============ NEW: RAG Pipeline types ============

/**
 * RawChunk — crawler/parser se nikla raw data
 * DB me save hone se PEHLE ka format
 */
export interface RawChunk {
  content: string
  sourceUrl?: string
  sourceTitle?: string
  metadata?: Record<string, unknown>
}

/**
 * EmbeddedChunk — RawChunk + vector embedding
 */
export interface EmbeddedChunk extends RawChunk {
  embedding: number[]
}

/**
 * CrawlJobData — BullMQ job ka payload
 */
export interface CrawlJobData {
  kbId: string
  orgId: string
  type: 'url' | 'site' | 'pdf' | 'docx'
  url?: string
  fileBase64?: string
}

export interface APIResponse<T> {
  data: T
  error: null
}

export interface APIError {
  data: null
  error: {
    message: string
    code: string
  }
}

export * from './team-permissions'
