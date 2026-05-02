'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Textarea } from '@workspace/ui/components/textarea'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import {
  SendIcon, BotIcon, CheckCircleIcon, PhoneIcon, MailIcon,
  ZapIcon, MoreHorizontalIcon, TagIcon,
  ArrowUpRightIcon, SmileIcon, PaperclipIcon, UserCheckIcon, RefreshCwIcon,
  FileIcon, ImageIcon, XIcon, Loader2Icon, DownloadIcon,
} from 'lucide-react'
import { useMessages } from '@/hooks/useMessages'
import { useAgentWebSocket } from '@/hooks/useAgentWebSocket'
import { createClient } from '@/lib/supabase'
import { trpc } from '@/lib/trpc'
import type { Conversation, Attachment } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const REPLYING_PRESENCE_TTL_MS = 10_000

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/wav', 'video/mp4',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMsgTime(date: Date) {
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function isImageType(type: string): boolean {
  return type.startsWith('image/')
}

const STATUS_STYLES: Record<string, string> = {
  bot: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  open: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground border-border',
  closed: 'bg-muted text-muted-foreground border-border',
}

interface ActionLogMetadata {
  logId: string | null
  actionName: string | null
  status: string | null
}

function readActionLogMetadata(value: unknown): ActionLogMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const meta = value as Record<string, unknown>
  const actionLog = meta.actionLog
  if (!actionLog || typeof actionLog !== 'object' || Array.isArray(actionLog)) {
    return null
  }

  const log = actionLog as Record<string, unknown>
  return {
    logId: typeof log.logId === 'string' ? log.logId : null,
    actionName: typeof log.actionName === 'string' ? log.actionName : null,
    status: typeof log.status === 'string' ? log.status : null,
  }
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readConversationLabels(conversation: Conversation): string[] {
  const context = safeMetadata(conversation.ai_context ?? conversation.meta)
  const labels = context.inboxLabels
  if (!Array.isArray(labels)) return []
  return labels
    .filter((label): label is string => typeof label === 'string')
    .map((label) => label.trim())
    .filter(Boolean)
}

function readAgentIdFromMetadata(value: unknown): string | null {
  const agentId = safeMetadata(value).agentId
  return typeof agentId === 'string' && agentId.trim().length > 0 ? agentId : null
}

function actionStatusLabel(status: string | null): string {
  if (!status) return 'Unknown'
  if (status === 'pending_approval') return 'Awaiting Approval'
  if (status === 'pending_confirmation') return 'Awaiting Confirmation'
  if (status === 'success') return 'Success'
  if (status === 'failed') return 'Failed'
  if (status === 'timeout') return 'Timeout'
  if (status === 'rejected') return 'Rejected'
  if (status === 'cancelled') return 'Cancelled'
  return status.replace(/_/g, ' ')
}

function actionStatusStyle(status: string | null): string {
  if (status === 'success') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (status === 'pending_confirmation') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (status === 'failed' || status === 'timeout') {
    return 'bg-rose-100 text-rose-700 border-rose-200'
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'bg-muted text-muted-foreground border-border'
  }
  return 'bg-muted text-muted-foreground border-border'
}

function makeRealtimeMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function toIsoString(value: unknown): string {
  if (typeof value !== 'string') return new Date().toISOString()
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return new Date().toISOString()
  return new Date(ms).toISOString()
}

// ── Attachment Display ────────────────────────────────────────────────────────

function AttachmentDisplay({ attachment, isAgent }: { attachment: Attachment; isAgent?: boolean }) {
  const isImage = isImageType(attachment.type)

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1.5 max-w-[200px] overflow-hidden rounded-lg border border-border/50 hover:opacity-90 transition-opacity"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="w-full max-h-48 object-cover"
          loading="lazy"
        />
        <div className="px-2 py-1 bg-muted/50 text-[10px] text-muted-foreground truncate font-medium">
          {attachment.name}
        </div>
      </a>
    )
  }

  const fileEmoji = attachment.type === 'application/pdf' ? '📄'
    : attachment.type.includes('word') ? '📝'
    : attachment.type.includes('excel') || attachment.type.includes('spreadsheet') ? '📊'
    : attachment.type.startsWith('audio') ? '🎵'
    : attachment.type.startsWith('video') ? '🎬'
    : '📎'

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-1.5 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors max-w-[220px]',
        isAgent
          ? 'border-emerald-200/60 bg-emerald-600/10 hover:bg-emerald-600/20 dark:border-emerald-800/60'
          : 'border-border bg-muted/50 hover:bg-muted'
      )}
    >
      <span className="text-xl flex-shrink-0">{fileEmoji}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold truncate', isAgent ? 'text-emerald-800 dark:text-emerald-200' : 'text-foreground')}>
          {attachment.name}
        </p>
        <p className={cn('text-[10px]', isAgent ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <DownloadIcon className="size-3.5 flex-shrink-0 text-muted-foreground" />
    </a>
  )
}

// ── Pending Upload Item ───────────────────────────────────────────────────────

interface PendingFile {
  id: string
  file: File
  previewUrl?: string
  uploading: boolean
  uploaded?: Attachment
  error?: string
}

function PendingFileItem({ pf, onRemove }: { pf: PendingFile; onRemove: () => void }) {
  const isImage = isImageType(pf.file.type)

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs max-w-[180px]',
      pf.error ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/50',
      pf.uploading && 'opacity-70'
    )}>
      {isImage && pf.previewUrl ? (
        <img src={pf.previewUrl} alt="" className="size-7 rounded object-cover flex-shrink-0" />
      ) : (
        <FileIcon className="size-4 flex-shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate font-medium min-w-0">{pf.file.name}</span>
      {pf.uploading && <Loader2Icon className="size-3.5 animate-spin text-primary flex-shrink-0" />}
      {pf.error && <span className="text-destructive font-bold flex-shrink-0">!</span>}
      {!pf.uploading && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Agent WS ──────────────────────────────────────────────────────────────────

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string, patch?: Partial<Conversation>) => void
}

interface TeamMember {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'agent'
  isCurrentUser: boolean
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ConversationView({ conversation, orgId, agentId, onStatusChange }: Props) {
  const router = useRouter()
  const { messages, loading, sending, sendMessage, refetch, appendMessage } = useMessages(conversation.id, orgId)
  const [aiTypingConversationId, setAiTypingConversationId] = useState<string | null>(null)
  const [replyingAgents, setReplyingAgents] = useState<Record<string, number>>({})
  const [isLocalReplying, setIsLocalReplying] = useState(false)
  const localReplyingRef = useRef(false)
  const handleAgentSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const type = typeof payload.type === 'string' ? payload.type : ''
    const payloadConversationId =
      typeof payload.conversationId === 'string' ? payload.conversationId : null
    if (payloadConversationId && payloadConversationId !== conversation.id) return
    if (
      (type === 'visitor:message' || type === 'agent:message' || type === 'ai:response') &&
      !payloadConversationId
    ) {
      return
    }

    const source = typeof payload.source === 'string' ? payload.source : ''

    if (type === 'typing:start' && source === 'ai') {
      if (payloadConversationId) {
        setAiTypingConversationId(payloadConversationId)
      }
      return
    }

    if (type === 'typing:stop' && source === 'ai') {
      if (!payloadConversationId || payloadConversationId === conversation.id) {
        setAiTypingConversationId(null)
      }
      return
    }

    if (type === 'agent:replying') {
      const senderId = typeof payload.agentId === 'string' ? payload.agentId : null
      const isReplying = payload.isReplying === true
      if (!senderId || senderId === agentId) return

      setReplyingAgents((previous) => {
        if (!isReplying) {
          if (!Object.prototype.hasOwnProperty.call(previous, senderId)) return previous
          const next = { ...previous }
          delete next[senderId]
          return next
        }
        return {
          ...previous,
          [senderId]: Date.now(),
        }
      })
      return
    }

    if (type === 'visitor:message') {
      appendMessage({
        id: makeRealtimeMessageId('ws_user'),
        conversation_id: conversation.id,
        org_id: orgId,
        role: 'user',
        content: typeof payload.content === 'string' ? payload.content : '',
        attachments: Array.isArray(payload.attachments) ? (payload.attachments as Attachment[]) : [],
        ai_metadata: null,
        created_at: toIsoString(payload.createdAt),
      })
      return
    }

    if (type === 'agent:message') {
      const senderId = typeof payload.agentId === 'string' ? payload.agentId : null
      const clientNonce = typeof payload.clientNonce === 'string' ? payload.clientNonce : null
      const aiMetadata =
        senderId || clientNonce
          ? {
              ...(senderId ? { agentId: senderId } : {}),
              ...(clientNonce ? { clientNonce } : {}),
            }
          : null
      appendMessage({
        id: makeRealtimeMessageId('ws_agent'),
        conversation_id: conversation.id,
        org_id: orgId,
        role: 'agent',
        content: typeof payload.content === 'string' ? payload.content : '',
        attachments: Array.isArray(payload.attachments) ? (payload.attachments as Attachment[]) : [],
        ai_metadata: aiMetadata,
        created_at: toIsoString(payload.createdAt),
      })
      if (senderId && senderId !== agentId) {
        setReplyingAgents((previous) => {
          if (!Object.prototype.hasOwnProperty.call(previous, senderId)) return previous
          const next = { ...previous }
          delete next[senderId]
          return next
        })
      }
      return
    }

    if (type === 'ai:response') {
      setAiTypingConversationId(null)
      const actionLog =
        payload.actionLog && typeof payload.actionLog === 'object' && !Array.isArray(payload.actionLog)
          ? (payload.actionLog as Record<string, unknown>)
          : null
      const aiMetadata =
        actionLog || typeof payload.confidence === 'number'
          ? {
              ...(typeof payload.confidence === 'number' ? { confidence: payload.confidence } : {}),
              ...(actionLog ? { actionLog } : {}),
            }
          : null
      appendMessage({
        id: makeRealtimeMessageId('ws_ai'),
        conversation_id: conversation.id,
        org_id: orgId,
        role: 'assistant',
        content: typeof payload.content === 'string' ? payload.content : '',
        attachments: [],
        ai_metadata: aiMetadata,
        created_at: toIsoString(payload.createdAt),
      })
      return
    }

    if (type === 'conversation:resolved') {
      setAiTypingConversationId(null)
    }
  }, [agentId, appendMessage, conversation.id, orgId])
  const { send: wsSend } = useAgentWebSocket(orgId, agentId, handleAgentSocketMessage)
  const emitReplyingState = useCallback((next: boolean) => {
    if (localReplyingRef.current === next) return
    localReplyingRef.current = next
    setIsLocalReplying(next)
    wsSend({
      type: 'agent:replying',
      conversationId: conversation.id,
      isReplying: next,
    })
  }, [conversation.id, wsSend])
  const approveAction = trpc.actions.approveAction.useMutation({
    onSuccess: () => {
      void refetch()
    },
  })
  const rejectAction = trpc.actions.rejectAction.useMutation({
    onSuccess: () => {
      void refetch()
    },
  })
  const teamMembersQuery = trpc.team.getMembers.useQuery(undefined, {
    staleTime: 60_000,
  })
  const updateConversationStatus = trpc.chat.updateStatus.useMutation({
    onSuccess: () => {
      void refetch()
    },
  })
  const updateConversationLabels = trpc.chat.updateLabels.useMutation()
  const [reply, setReply] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [resolvingActionKey, setResolvingActionKey] = useState<string | null>(null)
  const [assigningAgentValue, setAssigningAgentValue] = useState<string | null>(null)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const [labels, setLabels] = useState<string[]>(() => readConversationLabels(conversation))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contact = conversation.contacts
  const status = conversation.status
  const isAgentMode = status === 'open'
  const isBotMode = status === 'bot'
  const isResolved = status === 'resolved' || status === 'closed'
  const canReply = isAgentMode && !isResolved
  const aiTyping = aiTypingConversationId === conversation.id
  const assignableMembers = useMemo(() => {
    const raw = (teamMembersQuery.data ?? []) as TeamMember[]
    return raw
      .filter((member) => Boolean(member.id))
      .sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1
        if (!a.isCurrentUser && b.isCurrentUser) return 1
        return (a.name ?? a.email).localeCompare(b.name ?? b.email)
      })
  }, [teamMembersQuery.data])
  const selectedAssigneeValue = conversation.assigned_to ?? 'unassigned'
  const teamMembersById = useMemo(() => {
    const map = new Map<string, TeamMember>()
    for (const member of assignableMembers) {
      map.set(member.id, member)
    }
    return map
  }, [assignableMembers])
  const remoteReplyingAgentNames = useMemo(() => {
    return Object.keys(replyingAgents)
      .filter((id) => id !== agentId)
      .map((id) => {
        const member = teamMembersById.get(id)
        if (!member) return 'Another agent'
        return member.isCurrentUser ? 'You' : (member.name ?? member.email)
      })
  }, [agentId, replyingAgents, teamMembersById])
  const replyingSummary = useMemo(() => {
    if (remoteReplyingAgentNames.length === 0) return ''
    if (remoteReplyingAgentNames.length === 1) {
      return `${remoteReplyingAgentNames[0]} is replying...`
    }
    if (remoteReplyingAgentNames.length === 2) {
      return `${remoteReplyingAgentNames[0]} and ${remoteReplyingAgentNames[1]} are replying...`
    }
    return `${remoteReplyingAgentNames[0]} +${remoteReplyingAgentNames.length - 1} others are replying...`
  }, [remoteReplyingAgentNames])

  const assignedAgentLabel = useMemo(() => {
    if (!conversation.assigned_to) return 'Unassigned'

    const assignedMember = teamMembersById.get(conversation.assigned_to)
    if (assignedMember) {
      const base = assignedMember.name ?? assignedMember.email
      return assignedMember.isCurrentUser ? `${base} (You)` : base
    }

    if (conversation.assigned_agent_name?.trim()) {
      return conversation.assigned_agent_name.trim()
    }

    if (conversation.assigned_agent_email?.trim()) {
      return conversation.assigned_agent_email.trim()
    }

    return 'Assigned'
  }, [
    conversation.assigned_agent_email,
    conversation.assigned_agent_name,
    conversation.assigned_to,
    teamMembersById,
  ])

  const getAgentMessageLabel = useCallback((metadata: unknown): string => {
    const senderId = readAgentIdFromMetadata(metadata)
    if (senderId) {
      const sender = teamMembersById.get(senderId)
      if (sender) {
        if (sender.isCurrentUser) return 'You'
        return sender.name ?? sender.email
      }
      if (senderId === agentId) return 'You'
    }

    if (conversation.assigned_to) {
      const assigned = teamMembersById.get(conversation.assigned_to)
      if (assigned) {
        if (assigned.isCurrentUser) return 'You'
        return assigned.name ?? assigned.email
      }
    }

    if (conversation.assigned_agent_name?.trim()) return conversation.assigned_agent_name.trim()
    if (conversation.assigned_agent_email?.trim()) return conversation.assigned_agent_email.trim()
    return 'Agent'
  }, [
    agentId,
    conversation.assigned_agent_email,
    conversation.assigned_agent_name,
    conversation.assigned_to,
    teamMembersById,
  ])

  // ── Revoke object URLs on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl) })
    }
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  useEffect(() => {
    setReplyingAgents({})
    setLabels(readConversationLabels(conversation))
    if (localReplyingRef.current) {
      localReplyingRef.current = false
      setIsLocalReplying(false)
    }
  }, [conversation.ai_context, conversation.id, conversation.meta])

  useEffect(() => {
    const timer = setInterval(() => {
      setReplyingAgents((previous) => {
        const now = Date.now()
        let changed = false
        const next: Record<string, number> = {}

        for (const [id, updatedAt] of Object.entries(previous)) {
          if (now - updatedAt <= REPLYING_PRESENCE_TTL_MS) {
            next[id] = updatedAt
          } else {
            changed = true
          }
        }

        return changed ? next : previous
      })
    }, 2_000)

    return () => clearInterval(timer)
  }, [])

  // ── File upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, conversationId: string): Promise<Attachment> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = reader.result as string
          const res = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({
              file: base64,
              filename: file.name,
              mimeType: file.type,
              orgId,
              conversationId,
            }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string }
            throw new Error(err.error ?? 'Upload failed')
          }
          const data = await res.json() as Attachment
          resolve(data)
        } catch (err) { reject(err) }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [orgId])

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newPending: PendingFile[] = []
    for (const file of Array.from(files)) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue

      const pf: PendingFile = { id: Math.random().toString(36).slice(2), file, uploading: false }
      if (isImageType(file.type)) pf.previewUrl = URL.createObjectURL(file)
      newPending.push(pf)
    }

    if (newPending.length === 0) return

    const uploadingPending = newPending.map(pf => ({ ...pf, uploading: true }))
    setPendingFiles(prev => [...prev, ...uploadingPending])

    for (const pf of uploadingPending) {
      try {
        const attachment = await uploadFile(pf.file, conversation.id)
        setPendingFiles(prev => prev.map(p => p.id === pf.id ? { ...p, uploading: false, uploaded: attachment } : p))
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Upload failed'
        setPendingFiles(prev => prev.map(p => p.id === pf.id ? { ...p, uploading: false, error: errMsg } : p))
      }
    }
  }, [conversation.id, uploadFile])

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const pf = prev.find(p => p.id === id)
      if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = reply.trim()
    const uploadedAttachments = pendingFiles.filter(pf => pf.uploaded && !pf.error).map(pf => pf.uploaded!)

    if ((!text && uploadedAttachments.length === 0) || sending || !canReply) return
    if (pendingFiles.some(pf => pf.uploading)) return
    const clientNonce = makeRealtimeMessageId('client_msg')
    const optimisticMetadata = { agentId, clientNonce }

    appendMessage({
      id: makeRealtimeMessageId('optimistic_agent'),
      conversation_id: conversation.id,
      org_id: orgId,
      role: 'agent',
      content: text,
      attachments: uploadedAttachments,
      ai_metadata: optimisticMetadata,
      created_at: new Date().toISOString(),
    })

    setReply('')
    emitReplyingState(false)
    setPendingFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const sentOverWs = wsSend({
      type: 'agent:message',
      conversationId: conversation.id,
      content: text,
      attachments: uploadedAttachments,
      clientNonce,
    })

    if (!sentOverWs) {
      await sendMessage(text, agentId, uploadedAttachments, optimisticMetadata)
    }
  }, [
    reply,
    sending,
    canReply,
    appendMessage,
    conversation.id,
    orgId,
    wsSend,
    sendMessage,
    agentId,
    emitReplyingState,
    pendingFiles,
  ])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const handleTakeover = useCallback(async () => {
    const previousStatus = status
    const previousAssignedTo = conversation.assigned_to ?? null
    onStatusChange?.(conversation.id, 'open', { assigned_to: agentId })
    const sentOverWs = wsSend({ type: 'agent:takeover', conversationId: conversation.id })
    if (!sentOverWs) {
      try {
        await updateConversationStatus.mutateAsync({
          conversationId: conversation.id,
          status: 'open',
          assignedTo: agentId,
        })
      } catch {
        onStatusChange?.(conversation.id, previousStatus, { assigned_to: previousAssignedTo })
      }
    }
  }, [
    agentId,
    conversation.assigned_to,
    conversation.id,
    onStatusChange,
    status,
    updateConversationStatus,
    wsSend,
  ])

  const handleRelease = useCallback(async () => {
    const previousStatus = status
    const previousAssignedTo = conversation.assigned_to ?? null
    onStatusChange?.(conversation.id, 'bot', { assigned_to: null })
    const sentOverWs = wsSend({ type: 'agent:release', conversationId: conversation.id })
    if (!sentOverWs) {
      try {
        await updateConversationStatus.mutateAsync({
          conversationId: conversation.id,
          status: 'bot',
        })
      } catch {
        onStatusChange?.(conversation.id, previousStatus, { assigned_to: previousAssignedTo })
      }
    }
  }, [
    conversation.assigned_to,
    conversation.id,
    onStatusChange,
    status,
    updateConversationStatus,
    wsSend,
  ])

  const handleResolve = useCallback(async () => {
    const previousStatus = status
    const previousAssignedTo = conversation.assigned_to ?? null
    onStatusChange?.(conversation.id, 'resolved', { assigned_to: conversation.assigned_to })
    const sentOverWs = wsSend({ type: 'agent:resolve', conversationId: conversation.id })
    if (!sentOverWs) {
      try {
        await updateConversationStatus.mutateAsync({
          conversationId: conversation.id,
          status: 'resolved',
          assignedTo: conversation.assigned_to ?? undefined,
        })
      } catch {
        onStatusChange?.(conversation.id, previousStatus, { assigned_to: previousAssignedTo })
      }
    }
  }, [
    conversation.assigned_to,
    conversation.id,
    onStatusChange,
    status,
    updateConversationStatus,
    wsSend,
  ])

  const handleViewContact = useCallback(() => {
    if (!contact?.id) return
    router.push(`/contacts?contact=${contact.id}`)
  }, [contact?.id, router])

  const persistLabels = useCallback(async (nextLabels: string[]) => {
    setLabels(nextLabels)
    const optimisticContext = {
      ...safeMetadata(conversation.ai_context ?? conversation.meta),
      inboxLabels: nextLabels,
    }
    onStatusChange?.(conversation.id, status, { ai_context: optimisticContext })
    const result = await updateConversationLabels.mutateAsync({
      conversationId: conversation.id,
      labels: nextLabels,
    })
    setLabels(result.labels)
    onStatusChange?.(conversation.id, status, { ai_context: result.aiContext })
  }, [
    conversation.ai_context,
    conversation.id,
    conversation.meta,
    onStatusChange,
    status,
    updateConversationLabels,
  ])

  const handleAddLabel = useCallback(async () => {
    const nextLabel = labelInput.trim().replace(/\s+/g, ' ')
    if (!nextLabel) return
    const exists = labels.some((label) => label.toLowerCase() === nextLabel.toLowerCase())
    const nextLabels = exists ? labels : [...labels, nextLabel]

    await persistLabels(nextLabels)
    setLabelInput('')
    setLabelDialogOpen(false)
  }, [labelInput, labels, persistLabels])

  const handleRemoveLabel = useCallback(async (labelToRemove: string) => {
    await persistLabels(labels.filter((label) => label !== labelToRemove))
  }, [labels, persistLabels])

  const handleAssignAgent = useCallback(async (value: string) => {
    const nextAssignedTo = value === 'unassigned' ? null : value
    if (nextAssignedTo === conversation.assigned_to) return

    const previousAssignedTo = conversation.assigned_to ?? null
    setAssigningAgentValue(value)
    onStatusChange?.(conversation.id, status, { assigned_to: nextAssignedTo })
    try {
      await updateConversationStatus.mutateAsync({
        conversationId: conversation.id,
        status,
        assignedTo: nextAssignedTo ?? undefined,
      })
    } catch {
      onStatusChange?.(conversation.id, status, { assigned_to: previousAssignedTo })
    } finally {
      setAssigningAgentValue(null)
    }
  }, [
    conversation.assigned_to,
    conversation.id,
    onStatusChange,
    status,
    updateConversationStatus,
  ])

  const handleActionDecision = useCallback(async (params: { logId: string; approve: boolean }) => {
    const key = `${params.logId}:${params.approve ? 'approve' : 'reject'}`
    setResolvingActionKey(key)

    try {
      const sentOverWs = wsSend({
        type: params.approve ? 'action:approve' : 'action:reject',
        logId: params.logId,
      })

      if (!sentOverWs) {
        if (params.approve) {
          await approveAction.mutateAsync({ logId: params.logId })
        } else {
          await rejectAction.mutateAsync({ logId: params.logId })
        }
      }

      void refetch()
    } finally {
      setResolvingActionKey(null)
    }
  }, [approveAction, rejectAction, refetch, wsSend])

  const isUploading = pendingFiles.some(pf => pf.uploading)
  const hasReadyFiles = pendingFiles.some(pf => pf.uploaded && !pf.error)
  const canSendNow = canReply && (reply.trim().length > 0 || hasReadyFiles) && !isUploading && !sending
  const isAssigningAgent = assigningAgentValue !== null || updateConversationStatus.isPending
  const hasReplyCollision = canReply && reply.trim().length > 0 && remoteReplyingAgentNames.length > 0

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.resolved

  useEffect(() => {
    const shouldBroadcastReplying = canReply && reply.trim().length > 0
    emitReplyingState(shouldBroadcastReplying)
  }, [canReply, emitReplyingState, reply])

  useEffect(() => {
    if (!isLocalReplying) return

    const heartbeat = setInterval(() => {
      wsSend({
        type: 'agent:replying',
        conversationId: conversation.id,
        isReplying: true,
      })
    }, 4_000)

    return () => clearInterval(heartbeat)
  }, [conversation.id, isLocalReplying, wsSend])

  useEffect(() => {
    return () => {
      if (!localReplyingRef.current) return
      wsSend({
        type: 'agent:replying',
        conversationId: conversation.id,
        isReplying: false,
      })
      localReplyingRef.current = false
    }
  }, [conversation.id, wsSend])

  return (
    <>
    <div className="flex h-full flex-col bg-background">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(',')}
        className="hidden"
        onChange={e => {
          void handleFileSelect(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card/50 px-5 py-3 shrink-0">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-sm font-semibold">
            {contact?.name?.slice(0, 2).toUpperCase() ||
              contact?.email?.slice(0, 2).toUpperCase() || '??'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-semibold">
              {contact?.name || contact?.email || 'Anonymous Visitor'}
            </p>
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', statusStyle)}>
              {status === 'bot' && <ZapIcon className="mr-1 size-2.5" />}
              {status === 'open' && <UserCheckIcon className="mr-1 size-2.5" />}
              {status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {contact?.email && (
              <span className="flex items-center gap-1 truncate max-w-[160px]">
                <MailIcon className="size-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </span>
            )}
            {contact?.phone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {contact.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
              <UserCheckIcon className="size-3 shrink-0" />
              <span className="truncate">Assigned: {assignedAgentLabel}</span>
            </span>
          </div>
          {labels.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {labels.map((label) => (
                <Badge key={label} variant="outline" className="h-5 px-1.5 text-[10px]">
                  <TagIcon className="mr-1 size-2.5" />
                  {label}
                </Badge>
              ))}
            </div>
          )}
          {replyingSummary && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <Loader2Icon className="size-3 animate-spin" />
              <span>{replyingSummary}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TooltipProvider delayDuration={0}>
            {(isBotMode || status === 'pending') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={handleTakeover}
                    className="h-7 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0">
                    <UserCheckIcon className="size-3.5" />
                    Take Over
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Take over from AI</TooltipContent>
              </Tooltip>
            )}
            {isAgentMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleRelease} className="h-7 gap-1.5 text-xs">
                    <RefreshCwIcon className="size-3.5" />
                    Release to AI
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hand back to AI assistant</TooltipContent>
              </Tooltip>
            )}
            {!isResolved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleResolve} className="h-7 gap-1.5 text-xs">
                    <CheckCircleIcon className="size-3.5" />
                    Resolve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as resolved</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                Assign Agent
              </DropdownMenuLabel>
              {assignableMembers.length === 0 ? (
                <DropdownMenuItem disabled>
                  {teamMembersQuery.isLoading
                    ? 'Loading team members...'
                    : 'No team members found'}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuRadioGroup
                  value={selectedAssigneeValue}
                  onValueChange={(value) => {
                    void handleAssignAgent(value)
                  }}
                >
                  <DropdownMenuRadioItem
                    value="unassigned"
                    disabled={isAssigningAgent}
                  >
                    Unassigned
                  </DropdownMenuRadioItem>
                  {assignableMembers.map((member) => (
                    <DropdownMenuRadioItem
                      key={member.id}
                      value={member.id}
                      disabled={isAssigningAgent}
                    >
                      {member.name ?? member.email}
                      {member.isCurrentUser ? ' (You)' : ''}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLabelDialogOpen(true)}>
                <TagIcon className="mr-2 size-3.5" /> Add label
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!contact?.id} onClick={handleViewContact}>
                <ArrowUpRightIcon className="mr-2 size-3.5" /> View contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mode Banners */}
      {isBotMode && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <ZapIcon className="size-3.5" />
            AI is handling this conversation.
          </p>
          <Button size="sm" onClick={handleTakeover} className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white border-0">
            Take Over
          </Button>
        </div>
      )}
      {status === 'pending' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <UserCheckIcon className="size-3.5" />
            Visitor requested human support.
          </p>
          <Button size="sm" onClick={handleTakeover} className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
            Take Over
          </Button>
        </div>
      )}
      {isResolved && (
        <div className="bg-muted/50 border-b px-4 py-2 shrink-0">
          <p className="text-xs text-muted-foreground text-center">This conversation is resolved.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-1 px-4 py-4 min-h-full">
          {loading ? (
            <MessageSkeletons />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <BotIcon className="size-5 text-muted-foreground opacity-40" />
              </div>
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const isAgentMsg = msg.role === 'agent'
              const isOutbound = isUser || isAgentMsg
              const prevMsg = messages[idx - 1]
              const showTimeDivider = !prevMsg ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300_000

              const messageMetadata = safeMetadata(msg.ai_metadata)
              const isSystem = messageMetadata.system === true
              const actionLog = readActionLogMetadata(msg.ai_metadata)
              const senderLabel =
                msg.role === 'assistant' ? 'AI Assistant' : getAgentMessageLabel(msg.ai_metadata)
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex items-center justify-center py-2">
                    <span className="text-[11px] text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                )
              }

              return (
                <div key={msg.id}>
                  {showTimeDivider && (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                        {formatMsgTime(new Date(msg.created_at))}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className={cn('flex gap-2 py-0.5', isOutbound ? 'flex-row-reverse' : '')}>
                    {!isOutbound && (
                      <Avatar className="mt-auto size-6 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {msg.role === 'assistant' ? <BotIcon className="size-3" /> : 'S'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn('flex max-w-[75%] flex-col gap-0.5', isOutbound ? 'items-end' : 'items-start')}>
                      {!isUser && (
                        <span className="px-0.5 text-[10px] font-medium text-muted-foreground/60">
                          {senderLabel}
                        </span>
                      )}

                      {/* Text bubble */}
                      {msg.content && (
                        <div className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
                          isUser ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : isAgentMsg ? 'rounded-br-sm bg-emerald-600 text-white'
                            : 'rounded-bl-sm bg-muted/80 text-foreground ring-1 ring-border/50'
                        )}>
                          {msg.content}
                        </div>
                      )}

                      {/* Attachments */}
                      {(msg.attachments ?? []).map((att, i) => (
                        <AttachmentDisplay key={i} attachment={att} isAgent={isAgentMsg} />
                      ))}

                      {actionLog && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                            <ZapIcon className="size-3" />
                            Action: {actionLog.actionName ?? 'action'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('h-5 text-[10px]', actionStatusStyle(actionLog.status))}
                          >
                            {actionStatusLabel(actionLog.status)}
                          </Badge>
                        </div>
                      )}

                      {actionLog?.status === 'pending_approval' && actionLog.logId && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={Boolean(resolvingActionKey)}
                            onClick={() =>
                              void handleActionDecision({
                                logId: actionLog.logId!,
                                approve: true,
                              })
                            }
                          >
                            {resolvingActionKey === `${actionLog.logId}:approve`
                              ? 'Approving...'
                              : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={Boolean(resolvingActionKey)}
                            onClick={() =>
                              void handleActionDecision({
                                logId: actionLog.logId!,
                                approve: false,
                              })
                            }
                          >
                            {resolvingActionKey === `${actionLog.logId}:reject`
                              ? 'Rejecting...'
                              : 'Reject'}
                          </Button>
                        </div>
                      )}

                      <span className="px-0.5 text-[10px] tabular-nums text-muted-foreground/50">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          {aiTyping && (
            <div className="flex gap-2 py-1">
              <Avatar className="mt-auto size-6 shrink-0">
                <AvatarFallback className="text-[10px]">
                  <BotIcon className="size-3" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl rounded-bl-sm bg-muted/80 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border/50">
                AI is typing...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Reply Box */}
      <div className="border-t bg-card/50 p-3 shrink-0">
        {!canReply ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              {isBotMode ? '🤖 AI is handling this — take over to reply'
                : status === 'pending' ? '⏳ Take over to reply'
                : isResolved ? '✅ This conversation is resolved'
                : 'Reply disabled'}
            </p>
          </div>
        ) : (
          <div className="relative rounded-xl border bg-background ring-1 ring-border/50 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
            {hasReplyCollision && (
              <div className="mx-3 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                Another teammate is already typing in this conversation. Please coordinate before sending.
              </div>
            )}

            {/* Pending files strip */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-0">
                {pendingFiles.map(pf => (
                  <PendingFileItem key={pf.id} pf={pf} onRemove={() => removePendingFile(pf.id)} />
                ))}
              </div>
            )}

            <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <PaperclipIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file (max 10MB)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                      <SmileIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Emoji</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <span className="text-[11px] text-muted-foreground/60">Reply as Agent</span>
            </div>

            <Textarea
              ref={textareaRef}
              placeholder="Type your reply… (⌘+Enter to send)"
              className="min-h-[72px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKey}
            />

            <div className="flex items-center justify-between px-3 pb-2.5">
              <p className="text-[11px] text-muted-foreground/50">
                ⌘+Enter to send
                {isUploading && <span className="ml-2 text-primary animate-pulse">Uploading…</span>}
              </p>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSendNow}
                className="h-7 gap-1.5 px-3 text-xs"
              >
                {(sending || isUploading) ? (
                  <>
                    <div className="size-3 animate-spin rounded-full border border-primary-foreground/30 border-t-primary-foreground" />
                    {isUploading ? 'Uploading…' : 'Sending…'}
                  </>
                ) : (
                  <>
                    <SendIcon className="size-3" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add label</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Label</Label>
            <Input
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAddLabel()
                }
              }}
              placeholder="VIP, Billing, Follow up"
              className="h-8 text-sm"
              disabled={updateConversationLabels.isPending}
            />
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void handleRemoveLabel(label)}
                  disabled={updateConversationLabels.isPending}
                  className="inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {label}
                  <XIcon className="size-3" />
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLabelDialogOpen(false)}
            disabled={updateConversationLabels.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleAddLabel()}
            disabled={!labelInput.trim() || updateConversationLabels.isPending}
          >
            {updateConversationLabels.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function MessageSkeletons() {
  return (
    <div className="flex flex-col gap-4 py-2">
      {[{ side: 'left', width: 'w-52' }, { side: 'right', width: 'w-40' }, { side: 'left', width: 'w-64' }].map((item, i) => (
        <div key={i} className={cn('flex gap-2', item.side === 'right' ? 'flex-row-reverse' : '')}>
          {item.side === 'left' && <Skeleton className="size-6 shrink-0 rounded-full" />}
          <Skeleton className={cn('h-10 rounded-2xl', item.width)} />
        </div>
      ))}
    </div>
  )
}
