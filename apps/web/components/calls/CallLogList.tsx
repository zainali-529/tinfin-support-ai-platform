'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { cn } from '@workspace/ui/lib/utils'
import {
  PhoneIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PhoneIncomingIcon,
  PhoneMissedIcon,
  ClockIcon,
  MicIcon,
  PlayCircleIcon,
  FileTextIcon,
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react'
import { Input } from '@workspace/ui/components/input'
import { useState } from 'react'

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
  contacts?: Contact | null
}

interface Props {
  calls: CallRecord[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onSync?: () => void
  syncing?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'in-progress': { label: 'Live',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-400' },
  'queued':      { label: 'Queued',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',             dot: 'bg-blue-400' },
  'ringing':     { label: 'Ringing',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',         dot: 'bg-amber-400' },
  'ended':       { label: 'Ended',    color: 'bg-muted text-muted-foreground',                                                dot: 'bg-muted-foreground' },
  'created':     { label: 'Created',  color: 'bg-muted text-muted-foreground',                                                dot: 'bg-muted-foreground' },
  'error':       { label: 'Failed',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',                 dot: 'bg-red-400' },
}

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['ended']!
}

function getContactLabel(call: CallRecord) {
  if (call.contacts?.name) return call.contacts.name
  if (call.contacts?.email) return call.contacts.email
  if (call.caller_number) return call.caller_number
  return 'Unknown Caller'
}

function getContactInitials(call: CallRecord) {
  const label = getContactLabel(call)
  return label.slice(0, 2).toUpperCase()
}

function formatCost(cents: string | null) {
  if (!cents) return null
  const n = parseInt(cents, 10)
  if (isNaN(n)) return null
  return `$${(n / 100).toFixed(3)}`
}

function getCallTypeIcon(type: string, direction: string) {
  if (type === 'webCall') return <MicIcon className="size-3.5 text-blue-500" />
  if (direction === 'inbound') return <PhoneIncomingIcon className="size-3.5 text-emerald-500" />
  return <PhoneCallIcon className="size-3.5 text-primary" />
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CallLogList({ calls, loading, selectedId, onSelect, onSync, syncing }: Props) {
  const [search, setSearch] = useState('')

  const filtered = calls.filter(call => {
    if (!search) return true
    const q = search.toLowerCase()
    const label = getContactLabel(call).toLowerCase()
    return (
      label.includes(q) ||
      call.caller_number?.includes(q) ||
      call.status.includes(q)
    )
  })

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Call Logs</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {loading ? '...' : `${calls.length} call${calls.length !== 1 ? 's' : ''}`}
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
            placeholder="Search by caller or status..."
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="min-h-0 flex-1">
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
        ) : filtered.length === 0 ? (
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
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.map(call => {
              const cfg = getStatusCfg(call.status)
              const isSelected = call.id === selectedId
              const label = getContactLabel(call)
              const initials = getContactInitials(call)
              const cost = formatCost(call.cost_cents)

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
                        isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
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
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {label}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: false })}
                      </span>
                    </div>

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
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Call Detail Panel ────────────────────────────────────────────────────────

interface CallDetailProps {
  callId: string | null
  orgId: string
}

export function CallDetailPanel({ callId, orgId: _orgId }: CallDetailProps) {
  const { data: call, isLoading } = trpc_useCallDetail(callId ?? '')

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

  const label = call.contacts?.name || call.contacts?.email || call.caller_number || 'Unknown Caller'
  const cost = formatCost(call.cost_cents as string | null)
  const cfg = getStatusCfg(call.status)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Call Header */}
      <div className="flex items-start gap-4 border-b bg-card/50 px-6 py-4 shrink-0">
        <Avatar className="size-12">
          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
            {label.slice(0, 2).toUpperCase()}
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
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {call.started_at && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {format(new Date(call.started_at), 'MMM d, h:mm a')}
              </span>
            )}
            {call.duration_seconds ? (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {call.durationFormatted}
              </span>
            ) : null}
            <span className="capitalize flex items-center gap-1">
              {getCallTypeIcon(call.type, call.direction)}
              {call.type === 'webCall' ? 'Web Call' : `${call.direction} Phone`}
            </span>
            {cost && <span>{cost}</span>}
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
              <p className="text-sm leading-relaxed">{call.summary}</p>
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
                src={call.recording_url}
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
                {call.transcript.split('\n').map((line: string, i: number) => {
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
                { label: 'Vapi Call ID', value: call.vapi_call_id },
                { label: 'Status', value: call.status },
                { label: 'Type', value: call.type },
                { label: 'Direction', value: call.direction },
                { label: 'Ended Reason', value: call.ended_reason },
                { label: 'Caller Number', value: call.caller_number },
                { label: 'Duration', value: call.durationFormatted },
                { label: 'Cost', value: cost },
                { label: 'Started', value: call.started_at ? format(new Date(call.started_at), 'PPpp') : null },
                { label: 'Ended', value: call.ended_at ? format(new Date(call.ended_at), 'PPpp') : null },
              ].filter(r => r.value).map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4 text-xs">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <span className="text-foreground font-mono text-right break-all">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// Hook import at module level to avoid React rules violation
import { trpc } from '@/lib/trpc'

function trpc_useCallDetail(id: string) {
  return trpc.vapi.getCall.useQuery({ id }, { enabled: !!id })
}