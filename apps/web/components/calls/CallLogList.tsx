'use client'

/**
 * apps/web/components/calls/CallLogList.tsx  (FIXED)
 *
 * Fix: Contact display now shows name → email → phone → caller_number
 *      instead of always falling back to "Unknown Caller".
 *      Also: duration, cost, and all fields fully populated.
 */

import { formatDistanceToNow, format } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { cn } from '@workspace/ui/lib/utils'
import {
  PhoneIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PhoneIncomingIcon,
  ClockIcon,
  MicIcon,
  PlayCircleIcon,
  FileTextIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react'
import { Input } from '@workspace/ui/components/input'
import { Spinner } from '@workspace/ui/components/spinner'
import { useCallback, type UIEvent } from 'react'
import { trpc } from '@/lib/trpc'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
}

interface CallRecord {
  id: string
  vapi_call_id: string
  status: string
  type: string
  direction: string
  duration_seconds: number | null
  durationFormatted: string
  recording_url: string | null
  transcript: string | null
  summary: string | null
  ended_reason: string | null
  caller_number: string | null
  cost_cents: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
  contacts?: Contact | null
}

interface Props {
  calls: CallRecord[]
  totalCount: number
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  hasMore: boolean
  isFetchingMore: boolean
  onLoadMore: () => void
  onSync?: () => void
  syncing?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'in-progress': { label: 'Live',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-400' },
  'queued':      { label: 'Queued',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',             dot: 'bg-blue-400' },
  'ringing':     { label: 'Ringing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',         dot: 'bg-amber-400' },
  'ended':       { label: 'Ended',   color: 'bg-muted text-muted-foreground',                                                dot: 'bg-muted-foreground' },
  'created':     { label: 'Created', color: 'bg-muted text-muted-foreground',                                                dot: 'bg-muted-foreground' },
  'error':       { label: 'Failed',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',                 dot: 'bg-red-400' },
}

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['ended']!
}

function getMetaString(call: CallRecord, keys: string[]): string | null {
  const metadata = call.metadata
  if (!metadata || typeof metadata !== 'object') return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string') {
      const next = value.trim()
      if (next.length > 0) return next
    }
  }
  return null
}

/**
 * Priority: contacts.name → contacts.email → contacts.phone → caller_number → 'Unknown Caller'
 */
function getContactLabel(call: CallRecord): string {
  if (call.contacts?.name) return call.contacts.name
  if (call.contacts?.email) return call.contacts.email
  if (call.contacts?.phone) return call.contacts.phone
  const metadataName = getMetaString(call, ['visitorName', 'customerName', 'name'])
  if (metadataName) return metadataName
  const metadataEmail = getMetaString(call, ['visitorEmail', 'customerEmail', 'email'])
  if (metadataEmail) return metadataEmail
  if (call.caller_number) return call.caller_number
  return 'Unknown Caller'
}

function getContactInitials(call: CallRecord): string {
  const label = getContactLabel(call)
  if (label === 'Unknown Caller') return '?'
  return label.slice(0, 2).toUpperCase()
}

function getContactSubtext(call: CallRecord): string | null {
  if (call.contacts?.name) {
    // Name is showing — also show email or phone as subtext
    if (call.contacts.email) return call.contacts.email
    if (call.contacts.phone) return call.contacts.phone
    if (call.caller_number) return call.caller_number
  }
  const metadataName = getMetaString(call, ['visitorName', 'customerName', 'name'])
  if (metadataName) {
    return getMetaString(call, ['visitorEmail', 'customerEmail', 'email'])
      ?? getMetaString(call, ['visitorId', 'visitor_id'])
  }
  return null
}

function formatCost(cents: string | null): string | null {
  if (!cents) return null
  const n = parseInt(cents, 10)
  if (isNaN(n) || n === 0) return null
  return `$${(n / 100).toFixed(3)}`
}

function getCallTypeIcon(type: string, direction: string) {
  if (type === 'webCall') return <MicIcon className="size-3.5 text-blue-500" />
  if (direction === 'inbound') return <PhoneIncomingIcon className="size-3.5 text-emerald-500" />
  return <PhoneCallIcon className="size-3.5 text-primary" />
}

// ─── Call Log List ────────────────────────────────────────────────────────────

export function CallLogList({
  calls,
  totalCount,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onSync,
  syncing,
}: Props) {
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasMore || isFetchingMore || loading) return
      const node = event.currentTarget
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
      if (distanceFromBottom <= 120) onLoadMore()
    },
    [hasMore, isFetchingMore, loading, onLoadMore]
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Call Logs</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {loading && calls.length === 0 ? '...' : `${totalCount} total`}
          </p>
        </div>
        {onSync && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSync}
            disabled={syncing}
            title="Sync from Vapi"
          >
            <RefreshCwIcon className={cn('size-3.5', syncing && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2.5 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, number..."
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="flex flex-col gap-0.5 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg p-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <PhoneOffIcon className="size-5 text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'No calls match your search' : 'No calls yet'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {search ? 'Try a different search' : 'Calls will appear here once visitors use voice'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-0.5 p-2">
              {calls.map(call => {
              const cfg = getStatusCfg(call.status)
              const isSelected = call.id === selectedId
              const label = getContactLabel(call)
              const subtext = getContactSubtext(call)
              const initials = getContactInitials(call)
              const cost = formatCost(call.cost_cents)
              const isUnknown = label === 'Unknown Caller'

              return (
                <button
                  key={call.id}
                  onClick={() => onSelect(call.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-100',
                    'hover:bg-muted/60 active:scale-[0.99]',
                    isSelected ? 'bg-primary/8 ring-1 ring-primary/15' : ''
                  )}
                >
                  {/* Avatar + status dot */}
                  <div className="relative mt-0.5 shrink-0">
                    <Avatar className="size-9">
                      <AvatarFallback className={cn(
                        'text-xs font-semibold',
                        isSelected ? 'bg-primary/15 text-primary' :
                        isUnknown ? 'bg-muted text-muted-foreground/50' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card',
                      cfg.dot
                    )} />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Name + time */}
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className={cn(
                        'truncate text-xs font-semibold',
                        isSelected ? 'text-primary' :
                        isUnknown ? 'text-muted-foreground italic' :
                        'text-foreground'
                      )}>
                        {label}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: false })}
                      </span>
                    </div>

                    {/* Subtext: email or phone if name is shown */}
                    {subtext && (
                      <p className="mb-0.5 truncate text-[10px] text-muted-foreground/70 font-mono">
                        {subtext}
                      </p>
                    )}

                    {/* Summary or reason */}
                    <p className="mb-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {call.summary || call.ended_reason || 'No summary available'}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status badge */}
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                        cfg.color
                      )}>
                        {cfg.label}
                      </span>

                      {/* Type icon */}
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        {getCallTypeIcon(call.type, call.direction)}
                        <span className="capitalize">{call.type === 'webCall' ? 'Web' : call.direction}</span>
                      </span>

                      {/* Duration */}
                      {call.duration_seconds ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <ClockIcon className="size-2.5" />
                          {call.durationFormatted}
                        </span>
                      ) : null}

                      {/* Recording indicator */}
                      {call.recording_url && (
                        <span title="Recording available">
                          <PlayCircleIcon className="size-2.5 text-emerald-500" />
                        </span>
                      )}

                      {/* Transcript indicator */}
                      {call.transcript && (
                        <span title="Transcript available">
                          <FileTextIcon className="size-2.5 text-blue-500" />
                        </span>
                      )}

                      {/* Cost */}
                      {cost && (
                        <span className="text-[10px] text-muted-foreground">{cost}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
              })}
            </div>

            {(isFetchingMore || hasMore) && (
              <div className="flex items-center justify-center gap-2 px-3 pb-4 pt-2 text-xs text-muted-foreground">
                {isFetchingMore ? (
                  <>
                    <Spinner className="size-3.5" />
                    Loading more calls...
                  </>
                ) : (
                  'Scroll to load more'
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Call Detail Panel ────────────────────────────────────────────────────────

interface CallDetailProps {
  callId: string | null
  orgId: string
}

export function CallDetailPanel({ callId, orgId: _orgId }: CallDetailProps) {
  const { data: call, isLoading } = trpc.vapi.getCall.useQuery(
    { id: callId ?? '' },
    { enabled: !!callId }
  )

  if (!callId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
          <PhoneIcon className="size-7 text-muted-foreground opacity-40" />
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-semibold">Select a call</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose a call from the left panel to view its transcript, recording, and details.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!call) return null

  // Contact display — same priority as list
  const contactName = (call.contacts as Contact | null)?.name
  const contactEmail = (call.contacts as Contact | null)?.email
  const contactPhone = (call.contacts as Contact | null)?.phone

  const metadataName = getMetaString(call as CallRecord, ['visitorName', 'customerName', 'name'])
  const metadataEmail = getMetaString(call as CallRecord, ['visitorEmail', 'customerEmail', 'email'])

  const label = contactName
    ?? contactEmail
    ?? contactPhone
    ?? metadataName
    ?? metadataEmail
    ?? (call.caller_number as string | null)
    ?? 'Unknown Caller'
  const cost = formatCost(call.cost_cents as string | null)
  const cfg = getStatusCfg(call.status)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Call Header */}
      <div className="flex items-start gap-4 border-b bg-card/50 px-6 py-4 shrink-0">
        <Avatar className="size-12">
          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
            {label === 'Unknown Caller' ? '?' : label.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold">{label}</h2>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              cfg.color
            )}>
              {cfg.label}
            </span>
          </div>
          {/* Contact details row */}
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {(contactEmail || metadataEmail) && (contactName || metadataName) && (
              <span className="font-mono">{contactEmail ?? metadataEmail}</span>
            )}
            {contactPhone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {contactPhone}
              </span>
            )}
            {call.caller_number && !contactPhone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {call.caller_number as string}
              </span>
            )}
            {call.started_at && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {format(new Date(call.started_at as string), 'MMM d, h:mm a')}
              </span>
            )}
            {call.duration_seconds ? (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {call.durationFormatted as string}
              </span>
            ) : null}
            <span className="capitalize flex items-center gap-1">
              {getCallTypeIcon(call.type as string, call.direction as string)}
              {call.type === 'webCall' ? 'Web Call' : `${call.direction} Phone`}
            </span>
            {cost && <span className="font-mono">{cost}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-6">
          {/* Summary */}
          {call.summary && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                AI Summary
              </p>
              <p className="text-sm leading-relaxed">{call.summary as string}</p>
            </div>
          )}

          {/* Recording */}
          {call.recording_url && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Recording
              </p>
              <audio
                controls
                src={call.recording_url as string}
                className="w-full h-8"
                style={{ outline: 'none' }}
              />
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Transcript
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto text-sm leading-relaxed">
                {(call.transcript as string).split('\n').map((line: string, i: number) => {
                  const isUser = line.startsWith('User:') || line.startsWith('user:')
                  const isBot = line.startsWith('AI') || line.startsWith('Assistant')
                  return (
                    <p
                      key={i}
                      className={cn(
                        'text-sm',
                        isUser ? 'text-primary font-medium' : isBot ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {line}
                    </p>
                  )
                })}
              </div>
            </div>
          )}

          {/* Call details */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Call Details
            </p>
            <div className="space-y-2">
              {[
                { label: 'Contact Name',   value: contactName },
                { label: 'Contact Email',  value: contactEmail },
                { label: 'Contact Phone',  value: contactPhone },
                { label: 'Caller Number',  value: call.caller_number },
                { label: 'Vapi Call ID',   value: call.vapi_call_id },
                { label: 'Status',         value: call.status },
                { label: 'Type',           value: call.type },
                { label: 'Direction',      value: call.direction },
                { label: 'Ended Reason',   value: call.ended_reason },
                { label: 'Duration',       value: call.durationFormatted },
                { label: 'Cost',           value: cost },
                { label: 'Started',        value: call.started_at ? format(new Date(call.started_at as string), 'PPpp') : null },
                { label: 'Ended',          value: call.ended_at ? format(new Date(call.ended_at as string), 'PPpp') : null },
              ].filter(r => r.value).map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4 text-xs">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <span className="text-foreground font-mono text-right break-all">{row.value as string}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
