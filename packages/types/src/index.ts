// ============ Existing types (unchanged) ============
export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'scale' | 'enterprise'
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

export interface WidgetConfig {
  primaryColor: string
  textColor: string
  bgColor: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  offsetX: number
  offsetY: number
  welcomeMessage: string
  companyName: string
  logoUrl?: string
  showBranding: boolean
  autoOpen: boolean
  autoOpenDelay: number
  suggestions?: Array<{ label: string; message: string }>
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