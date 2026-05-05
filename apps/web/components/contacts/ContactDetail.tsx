'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  useAddContactNote,
  useContact,
  useDeleteContactNote,
  useUpdateContactIntelligence,
} from '@/hooks/useContacts'
import { EditContactDialog } from './EditContactDialog'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@workspace/ui/components/tabs'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/sonner'
import { cn } from '@workspace/ui/lib/utils'
import {
  ActivityIcon,
  ArrowLeftIcon,
  BotIcon,
  CheckCircleIcon,
  ClockIcon,
  EditIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  InboxIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  UserCheckIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const STATUS_CLASSES: Record<string, string> = {
  bot: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  timeout: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  pending_approval: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
}

const CHANNEL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  chat: { label: 'Chat', icon: MessageSquareIcon, className: 'text-sky-500' },
  email: { label: 'Email', icon: MailIcon, className: 'text-amber-500' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircleIcon, className: 'text-emerald-500' },
  voice: { label: 'Voice', icon: PhoneCallIcon, className: 'text-teal-500' },
}

interface ConversationRow {
  id: string
  status: string
  channel: string
  startedAt: string
  resolvedAt: string | null
  assignedTo: string | null
  lastMessagePreview: string
}

interface ContactNote {
  id: string
  body: string
  createdAt: string
  authorUserId: string | null
  authorName: string | null
}

interface TimelineItem {
  id: string
  type: 'conversation' | 'message' | 'call' | 'email' | 'whatsapp' | 'action' | 'note' | 'rating' | 'feedback'
  title: string
  body: string | null
  channel: string | null
  status: string | null
  href: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

interface ContactProfile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  meta: Record<string, unknown> | null
  tags: string[]
  customFields: Record<string, string>
  contactNotes: ContactNote[]
  company: Record<string, unknown>
  traits: Record<string, unknown>
  customAttributes: Record<string, unknown>
  currentPage: Record<string, unknown>
  lastSeenAt: string | null
  createdAt: string
  conversations: ConversationRow[]
  calls: Array<{
    id: string
    status: string
    type: string
    durationSeconds: number | null
    startedAt: string | null
    summary: string | null
    endedReason: string | null
    callerNumber: string | null
  }>
  emailThreads: Array<{
    conversationId: string
    subject: string
    direction: string
    createdAt: string
    fromEmail: string
  }>
  whatsappThreads: Array<{
    conversationId: string
    direction: string
    status: string
    messageType: string
    createdAt: string
    waContactId: string | null
  }>
  timeline: TimelineItem[]
  satisfactionHistory: Array<{
    messageId: string
    conversationId: string
    rating: 'helpful' | 'not_helpful'
    createdAt: string
    preview: string
  }>
  conversationFeedback: Array<{
    id: string
    conversationId: string
    rating: number
    comment: string | null
    source: string
    channel: string
    handledBy: string
    createdAt: string
  }>
  aiActionsUsed: Array<{
    id: string
    name: string
    displayName: string
    status: string
    durationMs: number | null
    createdAt: string
    summary: string
  }>
  stats: {
    totalConversations: number
    totalChats: number
    resolvedConversations: number
    totalCalls: number
    totalEmails: number
    totalWhatsApp: number
    channelCounts: Record<string, number>
    satisfactionRatings: number
    csatResponses: number
    avgCsatRating: number | null
    aiActionsUsed: number
  }
}

interface Props {
  contactId: string
  onBack?: () => void
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(value: string | null | undefined): string {
  const date = safeDate(value)
  return date ? format(date, 'MMM d, yyyy h:mm a') : 'Not available'
}

function relativeTime(value: string | null | undefined): string {
  const date = safeDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true }) : 'Not seen yet'
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function displayNameFor(contact: ContactProfile): string {
  return contact.name || contact.email || contact.phone || 'Anonymous'
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readableKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function recordEntries(record: Record<string, unknown> | Record<string, string>, limit = 8) {
  return Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .slice(0, limit)
}

function EmptyTabState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-background">
        <Icon className="size-5 text-muted-foreground opacity-50" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  helper,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  helper?: string
}) {
  return (
    <div className="rounded-2xl border bg-muted/15 px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <Badge variant="outline" className={cn('h-5 rounded-full px-2 text-[10px] capitalize', STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground')}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function ChannelBadge({ channel }: { channel: string | null }) {
  if (!channel) return null
  const meta = CHANNEL_META[channel] ?? { label: channel, icon: InboxIcon, className: 'text-muted-foreground' }
  const Icon = meta.icon
  return (
    <Badge variant="outline" className="h-5 gap-1 rounded-full px-2 text-[10px] capitalize">
      <Icon className={cn('size-3', meta.className)} />
      {meta.label}
    </Badge>
  )
}

function TimelineIcon({ type, channel }: { type: TimelineItem['type']; channel: string | null }) {
  const Icon =
    type === 'action'
      ? WorkflowIcon
      : type === 'call'
        ? PhoneCallIcon
        : type === 'email'
          ? MailIcon
          : type === 'whatsapp'
            ? MessageCircleIcon
            : type === 'note'
              ? FileTextIcon
              : type === 'rating' || type === 'feedback'
                ? StarIcon
                : channel && CHANNEL_META[channel]
                  ? CHANNEL_META[channel].icon
                  : ActivityIcon

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
      <Icon className="size-4 text-muted-foreground" />
    </div>
  )
}

export function ContactDetailEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border bg-muted/25">
        <UsersIcon className="size-8 text-muted-foreground/40" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Select a contact</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Open a customer profile to see channel history, notes, AI actions, and timeline context.
        </p>
      </div>
    </div>
  )
}

function MobileContactBackButton({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null

  return (
    <div className="flex shrink-0 items-center border-b px-3 py-2 lg:hidden">
      <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5 px-2 text-xs">
        <ArrowLeftIcon className="size-3.5" />
        Contacts
      </Button>
    </div>
  )
}

export function ContactDetail({ contactId, onBack }: Props) {
  const { contact: rawContact, isLoading } = useContact(contactId)
  const contact = rawContact as ContactProfile | undefined
  const router = useRouter()
  const updateIntelligence = useUpdateContactIntelligence()
  const addNote = useAddContactNote()
  const deleteNote = useDeleteContactNote()

  const [editOpen, setEditOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [fieldKey, setFieldKey] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [noteBody, setNoteBody] = useState('')

  useEffect(() => {
    if (!contact) return
    setCustomFields(contact.customFields ?? {})
    setTagInput('')
    setFieldKey('')
    setFieldValue('')
    setNoteBody('')
  }, [contact?.id])

  const displayName = contact ? displayNameFor(contact) : 'Contact'
  const initials = displayName.slice(0, 2).toUpperCase()

  const channelRows = useMemo(() => {
    if (!contact) return []
    return Object.entries({
      chat: contact.stats.totalChats,
      email: contact.stats.totalEmails,
      whatsapp: contact.stats.totalWhatsApp,
      voice: contact.stats.totalCalls,
    }).filter(([, count]) => count > 0)
  }, [contact])

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <MobileContactBackButton onBack={onBack} />
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!contact) return null

  const editContact = {
    id: contact.id ?? contactId,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
  }

  const saveTags = async (nextTags: string[]) => {
    await updateIntelligence.mutateAsync({ id: contact.id, tags: nextTags })
    toast.success('Contact tags updated')
  }

  const addTag = async () => {
    const nextTag = tagInput.trim()
    if (!nextTag) return
    const nextTags = Array.from(new Set([...(contact.tags ?? []), nextTag])).slice(0, 30)
    setTagInput('')
    await saveTags(nextTags)
  }

  const removeTag = async (tag: string) => {
    await saveTags((contact.tags ?? []).filter((item) => item !== tag))
  }

  const saveCustomFields = async (nextFields = customFields) => {
    await updateIntelligence.mutateAsync({ id: contact.id, customFields: nextFields })
    toast.success('Custom fields updated')
  }

  const addCustomField = async () => {
    const key = fieldKey.trim()
    const value = fieldValue.trim()
    if (!key || !value) return
    const next = { ...customFields, [key]: value }
    setCustomFields(next)
    setFieldKey('')
    setFieldValue('')
    await saveCustomFields(next)
  }

  const removeCustomField = async (key: string) => {
    const next = Object.fromEntries(Object.entries(customFields).filter(([item]) => item !== key))
    setCustomFields(next)
    await saveCustomFields(next)
  }

  const handleAddNote = async () => {
    const body = noteBody.trim()
    if (!body) return
    await addNote.mutateAsync({ id: contact.id, body })
    setNoteBody('')
    toast.success('Contact note saved')
  }

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote.mutateAsync({ id: contact.id, noteId })
    toast.success('Contact note deleted')
  }

  const currentPageUrl = readText(contact.currentPage?.url)
  const currentPageTitle = readText(contact.currentPage?.title)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <MobileContactBackButton onBack={onBack} />

      <div className="shrink-0 border-b px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar className="size-12 shrink-0 sm:size-14">
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{displayName}</h2>
              {contact.lastSeenAt && (
                <Badge variant="outline" className="h-6 gap-1 rounded-full px-2 text-[10px]">
                  <MousePointerClickIcon className="size-3" />
                  Last seen {relativeTime(contact.lastSeenAt)}
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {contact.email && (
                <span className="flex items-center gap-1">
                  <MailIcon className="size-3.5" />
                  <span className="truncate">{contact.email}</span>
                </span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1">
                  <PhoneCallIcon className="size-3.5" />
                  {contact.phone}
                </span>
              )}
              <span>Added {relativeTime(contact.createdAt)}</span>
            </div>
            {currentPageUrl && (
              <a
                href={currentPageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLinkIcon className="size-3" />
                <span className="truncate">{currentPageTitle || currentPageUrl}</span>
              </a>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="h-8 gap-1.5 text-xs">
              <EditIcon className="size-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-b px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:grid-cols-4">
        <StatTile label="Conversations" value={contact.stats.totalConversations} icon={MessageSquareIcon} helper={`${contact.stats.resolvedConversations} resolved`} />
        <StatTile label="Channels" value={channelRows.length} icon={InboxIcon} helper={channelRows.map(([channel]) => CHANNEL_META[channel]?.label ?? channel).join(', ') || 'No activity yet'} />
        <StatTile label="AI Actions" value={contact.stats.aiActionsUsed} icon={WorkflowIcon} helper="Executed or requested" />
        <StatTile
          label="CSAT"
          value={contact.stats.avgCsatRating ? `${contact.stats.avgCsatRating}/5` : 'n/a'}
          icon={StarIcon}
          helper={`${contact.stats.csatResponses ?? 0} customer responses`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="flex h-full flex-col">
          <div className="shrink-0 overflow-x-auto border-b px-3 pt-3 sm:px-6">
            <TabsList className="h-9 min-w-max bg-muted/40 p-1">
              <TabsTrigger value="overview" className="h-7 text-xs">Overview</TabsTrigger>
              <TabsTrigger value="timeline" className="h-7 text-xs">Timeline</TabsTrigger>
              <TabsTrigger value="conversations" className="h-7 text-xs">Conversations</TabsTrigger>
              <TabsTrigger value="notes" className="h-7 text-xs">Notes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="grid gap-4 p-3 sm:p-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="space-y-4">
                  <div className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Customer context</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Tags, custom fields, widget page, and identity metadata.</p>
                      </div>
                      <TagIcon className="size-4 text-muted-foreground" />
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {(contact.tags ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">No tags yet.</span>
                          ) : (
                            contact.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="gap-1 rounded-full">
                                {tag}
                                <button type="button" onClick={() => void removeTag(tag)} disabled={updateIntelligence.isPending}>
                                  <XIcon className="size-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') void addTag()
                            }}
                            placeholder="Add tag, e.g. VIP"
                            className="h-8 text-xs"
                          />
                          <Button size="sm" variant="outline" onClick={() => void addTag()} disabled={updateIntelligence.isPending || !tagInput.trim()}>
                            Add
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Custom fields</p>
                        <div className="space-y-2">
                          {Object.keys(customFields).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No custom fields saved.</p>
                          ) : (
                            Object.entries(customFields).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold">{readableKey(key)}</p>
                                  <p className="truncate text-xs text-muted-foreground">{value}</p>
                                </div>
                                <Button size="icon-sm" variant="ghost" onClick={() => void removeCustomField(key)} disabled={updateIntelligence.isPending}>
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[0.8fr_1fr_auto]">
                          <Input value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="Field" className="h-8 text-xs" />
                          <Input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="Value" className="h-8 text-xs" />
                          <Button size="sm" variant="outline" onClick={() => void addCustomField()} disabled={updateIntelligence.isPending || !fieldKey.trim() || !fieldValue.trim()}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <WorkflowIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">AI actions used</h3>
                    </div>
                    {contact.aiActionsUsed.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No AI actions have been used for this contact yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {contact.aiActionsUsed.slice(0, 6).map((action) => (
                          <div key={action.id} className="rounded-xl border bg-muted/15 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-xs font-semibold">{action.displayName}</p>
                              <StatusBadge status={action.status} />
                            </div>
                            {action.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{action.summary}</p>}
                            <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(action.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <MousePointerClickIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Widget activity</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <InfoRow label="Last seen" value={contact.lastSeenAt ? `${relativeTime(contact.lastSeenAt)} (${formatDateTime(contact.lastSeenAt)})` : 'Not seen yet'} />
                      <InfoRow label="Current page" value={currentPageTitle || currentPageUrl || 'Not available'} href={currentPageUrl} />
                      <InfoRow label="Visitor ID" value={readText(contact.meta?.visitorId) ?? 'Not available'} mono />
                      <InfoRow label="External user ID" value={readText(contact.meta?.externalUserId) ?? 'Not available'} mono />
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <UsersIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Company and attributes</h3>
                    </div>
                    <MetadataList title="Company" data={contact.company} />
                    <MetadataList title="Traits" data={contact.traits} />
                    <MetadataList title="Custom attributes" data={contact.customAttributes} />
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <StarIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Satisfaction history</h3>
                    </div>
                    {contact.conversationFeedback.length === 0 && contact.satisfactionHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No CSAT or AI quality signals captured yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {contact.conversationFeedback.length > 0 && (
                          <div className="space-y-2">
                            {contact.conversationFeedback.slice(0, 4).map((item) => (
                              <button
                                key={item.id}
                                className="w-full rounded-xl border bg-muted/15 px-3 py-2 text-left hover:bg-muted/35"
                                onClick={() => router.push(`/inbox?conversation=${item.conversationId}`)}
                              >
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={item.rating >= 4 ? 'success' : item.rating <= 2 ? 'failed' : 'pending'} />
                                  <span className="text-xs font-semibold">CSAT {item.rating}/5</span>
                                  <span className="text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                                </div>
                                {item.comment && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.comment}</p>}
                                <p className="mt-1 text-[10px] text-muted-foreground capitalize">{item.channel} - {item.handledBy}</p>
                              </button>
                            ))}
                          </div>
                        )}

                        {contact.satisfactionHistory.slice(0, 3).map((item) => (
                          <button
                            key={item.messageId}
                            className="w-full rounded-xl border bg-muted/15 px-3 py-2 text-left hover:bg-muted/35"
                            onClick={() => router.push(`/inbox?conversation=${item.conversationId}`)}
                          >
                            <div className="flex items-center gap-2">
                              <StatusBadge status={item.rating === 'helpful' ? 'success' : 'failed'} />
                              <span className="text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.preview}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3 sm:p-6">
                {contact.timeline.length === 0 ? (
                  <EmptyTabState icon={ActivityIcon} title="No timeline yet" description="Messages, calls, notes, and AI actions will appear here as this customer interacts with support." />
                ) : (
                  <div className="relative space-y-3 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                    {contact.timeline.map((item) => (
                      <div key={item.id} className="relative flex gap-3">
                        <TimelineIcon type={item.type} channel={item.channel} />
                        <button
                          type="button"
                          disabled={!item.href}
                          onClick={() => item.href && router.push(item.href)}
                          className={cn(
                            'min-w-0 flex-1 rounded-2xl border bg-background px-4 py-3 text-left',
                            item.href ? 'hover:bg-muted/35' : ''
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</p>
                            <ChannelBadge channel={item.channel} />
                            <StatusBadge status={item.status} />
                          </div>
                          {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.body}</p>}
                          <p className="mt-2 text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="conversations" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-3 sm:p-6">
                <div className="grid gap-3 md:grid-cols-4">
                  <ChannelSummary channel="chat" count={contact.stats.totalChats} />
                  <ChannelSummary channel="email" count={contact.stats.totalEmails} />
                  <ChannelSummary channel="whatsapp" count={contact.stats.totalWhatsApp} />
                  <ChannelSummary channel="voice" count={contact.stats.totalCalls} />
                </div>

                {contact.conversations.length === 0 && contact.calls.length === 0 ? (
                  <EmptyTabState icon={InboxIcon} title="No conversations yet" description="Chat, email, WhatsApp, and voice history will be grouped here by channel." />
                ) : (
                  <div className="space-y-2">
                    {contact.conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => router.push(`/inbox?conversation=${conversation.id}`)}
                        className="group flex w-full items-start gap-3 rounded-2xl border bg-background px-4 py-3 text-left hover:bg-muted/35"
                      >
                        <TimelineIcon type="conversation" channel={conversation.channel} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ChannelBadge channel={conversation.channel} />
                            <StatusBadge status={conversation.status} />
                            <span className="ml-auto text-[10px] text-muted-foreground">{formatDateTime(conversation.startedAt)}</span>
                          </div>
                          {conversation.lastMessagePreview && <p className="mt-2 truncate text-xs text-muted-foreground">{conversation.lastMessagePreview}</p>}
                        </div>
                        <ExternalLinkIcon className="mt-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    ))}

                    {contact.calls.map((call) => (
                      <div key={call.id} className="flex items-start gap-3 rounded-2xl border bg-background px-4 py-3">
                        <TimelineIcon type="call" channel="voice" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ChannelBadge channel="voice" />
                            <StatusBadge status={call.status} />
                            <span className="text-[10px] text-muted-foreground">Duration {formatDuration(call.durationSeconds)}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{formatDateTime(call.startedAt)}</span>
                          </div>
                          {call.summary && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{call.summary}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="m-0 min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="grid gap-4 p-3 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Add contact note</h3>
                  </div>
                  <Textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Add account context, preferences, risks, or follow-up notes. Customers cannot see this."
                    rows={7}
                  />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">{noteBody.length}/2000</p>
                    <Button size="sm" onClick={() => void handleAddNote()} disabled={addNote.isPending || !noteBody.trim()}>
                      <PlusIcon className="mr-1.5 size-3.5" />
                      Save note
                    </Button>
                  </div>
                </section>

                <section className="space-y-2">
                  {contact.contactNotes.length === 0 ? (
                    <EmptyTabState icon={FileTextIcon} title="No contact notes" description="Keep private customer context here: preferences, escalation history, account notes, or renewal context." />
                  ) : (
                    contact.contactNotes.map((note) => (
                      <div key={note.id} className="rounded-2xl border bg-background px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/20">
                            <FileTextIcon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm leading-6">{note.body}</p>
                            <p className="mt-2 text-[10px] text-muted-foreground">
                              {note.authorName ?? 'Team note'} · {formatDateTime(note.createdAt)}
                            </p>
                          </div>
                          <Button size="icon-sm" variant="ghost" onClick={() => void handleDeleteNote(note.id)} disabled={deleteNote.isPending}>
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {editOpen && (
        <EditContactDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          contact={editContact}
        />
      )}

    </div>
  )
}

function InfoRow({
  label,
  value,
  href,
  mono,
}: {
  label: string
  value: string
  href?: string | null
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border bg-muted/15 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-1 flex min-w-0 items-center gap-1 text-xs hover:text-primary">
          <span className="truncate">{value}</span>
          <ExternalLinkIcon className="size-3" />
        </a>
      ) : (
        <p className={cn('mt-1 truncate text-xs', mono ? 'font-mono' : '')}>{value}</p>
      )}
    </div>
  )
}

function MetadataList({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = recordEntries(data, 6)

  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No {title.toLowerCase()} data.</p>
      ) : (
        <div className="grid gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border bg-muted/15 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{readableKey(key)}</p>
              <p className="mt-1 truncate text-xs">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChannelSummary({ channel, count }: { channel: string; count: number }) {
  const meta = CHANNEL_META[channel] ?? { label: channel, icon: HashIcon, className: 'text-muted-foreground' }
  const Icon = meta.icon

  return (
    <div className="rounded-2xl border bg-muted/15 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{count} item{count === 1 ? '' : 's'}</p>
        </div>
        <Icon className={cn('size-5', meta.className)} />
      </div>
    </div>
  )
}
