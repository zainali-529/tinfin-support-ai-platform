'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import {
  SendIcon, BotIcon, CheckCircleIcon, PhoneIcon, MailIcon,
  ZapIcon, MoreHorizontalIcon, UserIcon, TagIcon,
  ArrowUpRightIcon, SmileIcon, PaperclipIcon, UserCheckIcon, RefreshCwIcon,
  FileIcon, ImageIcon, XIcon, Loader2Icon, DownloadIcon,
} from 'lucide-react'
import { useMessages } from '@/hooks/useMessages'
import { createClient } from '@/lib/supabase'
import type { Conversation, Attachment } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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

function useAgentWS(orgId: string, agentId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!orgId || !agentId) return
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003'
    const supabase = createClient()
    let ws: WebSocket | null = null
    let cancelled = false

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (cancelled || !token) { setConnected(false); return }

      const params = new URLSearchParams({ orgId, type: 'agent', agentId, token })
      ws = new WebSocket(`${wsUrl}?${params.toString()}`)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onclose = () => setConnected(false)
      ws.onerror = () => setConnected(false)
    }

    void connect()
    return () => {
      cancelled = true
      setConnected(false)
      ws?.close()
    }
  }, [orgId, agentId])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false
    wsRef.current.send(JSON.stringify(data))
    return true
  }, [])

  return { send, connected }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string) => void
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ConversationView({ conversation, orgId, agentId, onStatusChange }: Props) {
  const { messages, loading, sending, sendMessage } = useMessages(conversation.id, orgId)
  const { send: wsSend } = useAgentWS(orgId, agentId)
  const [reply, setReply] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contact = conversation.contacts
  const status = conversation.status
  const isAgentMode = status === 'open'
  const isBotMode = status === 'bot'
  const isResolved = status === 'resolved' || status === 'closed'
  const canReply = isAgentMode && !isResolved

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

    setReply('')
    setPendingFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const sentOverWs = wsSend({
      type: 'agent:message',
      conversationId: conversation.id,
      content: text,
      attachments: uploadedAttachments,
    })

    if (!sentOverWs) {
      await sendMessage(text, agentId)
    }
  }, [reply, sending, canReply, wsSend, conversation.id, sendMessage, agentId, pendingFiles])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const handleTakeover = async () => {
    const supabase = createClient()
    await supabase.from('conversations').update({ status: 'open', assigned_to: agentId }).eq('id', conversation.id)
    wsSend({ type: 'agent:takeover', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'open')
  }

  const handleRelease = async () => {
    const supabase = createClient()
    await supabase.from('conversations').update({ status: 'bot', assigned_to: null }).eq('id', conversation.id)
    wsSend({ type: 'agent:release', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'bot')
  }

  const handleResolve = async () => {
    const supabase = createClient()
    await supabase.from('conversations').update({ status: 'resolved' }).eq('id', conversation.id)
    wsSend({ type: 'agent:resolve', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'resolved')
  }

  const isUploading = pendingFiles.some(pf => pf.uploading)
  const hasReadyFiles = pendingFiles.some(pf => pf.uploaded && !pf.error)
  const canSendNow = canReply && (reply.trim().length > 0 || hasReadyFiles) && !isUploading && !sending

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.resolved

  return (
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
          </div>
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <UserIcon className="mr-2 size-3.5" /> Assign agent
              </DropdownMenuItem>
              <DropdownMenuItem>
                <TagIcon className="mr-2 size-3.5" /> Add label
              </DropdownMenuItem>
              <DropdownMenuItem>
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

              const isSystem = msg.ai_metadata && (msg.ai_metadata as Record<string, unknown>).system === true
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
                        <span className="px-0.5 text-[10px] font-medium text-muted-foreground/60 capitalize">
                          {msg.role === 'assistant' ? 'AI Assistant' : 'Agent'}
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

                      <span className="px-0.5 text-[10px] tabular-nums text-muted-foreground/50">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
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
          <div className="rounded-xl border bg-background ring-1 ring-border/50 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
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
              onChange={e => setReply(e.target.value)}
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