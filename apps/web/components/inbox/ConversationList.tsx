'use client'

import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import {
  SearchIcon, InboxIcon, ZapIcon, UserCheckIcon, ClockIcon, CheckCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { Conversation } from '@/types/database'

const STATUS_CONFIG = {
  bot:      { label: 'AI',      dot: 'bg-blue-400',         dim: false },
  pending:  { label: 'Pending', dot: 'bg-amber-400',        dim: false },
  open:     { label: 'Agent',   dot: 'bg-emerald-400',      dim: false },
  resolved: { label: 'Resolved',dot: 'bg-muted-foreground', dim: true  },
  closed:   { label: 'Closed',  dot: 'bg-muted-foreground', dim: true  },
} as const

type StatusKey = keyof typeof STATUS_CONFIG

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

function getLastMessage(conv: Conversation) {
  const msgs = conv.messages
  if (!msgs?.length) return 'No messages yet'
  const latest = msgs.reduce((acc, msg) => {
    if (!acc) return msg
    return new Date(msg.created_at).getTime() >= new Date(acc.created_at).getTime() ? msg : acc
  }, msgs[0])
  return latest?.content?.slice(0, 72) || ''
}

interface Props {
  conversations: Conversation[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('active')

  const filtered = conversations.filter(c => {
    const isResolved = c.status === 'resolved' || c.status === 'closed'
    if (tab === 'active' && isResolved) return false
    if (tab === 'resolved' && !isResolved) return false
    if (tab === 'pending' && c.status !== 'pending') return false
    if (tab === 'open' && c.status !== 'open') return false

    const name = c.contacts?.name || c.contacts?.email || ''
    if (!search) return true
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      getLastMessage(c).toLowerCase().includes(search.toLowerCase())
    )
  })

  const counts = {
    pending:  conversations.filter(c => c.status === 'pending').length,
    open:     conversations.filter(c => c.status === 'open').length,
    active:   conversations.filter(c => c.status !== 'resolved' && c.status !== 'closed').length,
    resolved: conversations.filter(c => c.status === 'resolved' || c.status === 'closed').length,
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? '...' : `${counts.active} active · ${counts.resolved} resolved`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2.5 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or message..."
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-3 py-2 shrink-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-7 w-full bg-muted/50 grid grid-cols-4">
            <TabsTrigger value="active" className="text-[10px] h-6">
              Active
              {counts.active > 0 && (
                <span className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {counts.active > 99 ? '99' : counts.active}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-[10px] h-6">
              Pending
              {counts.pending > 0 && (
                <span className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open" className="text-[10px] h-6">
              Agent
              {counts.open > 0 && (
                <span className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                  {counts.open}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-[10px] h-6">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-col gap-0.5 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
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
              <InboxIcon className="size-5 text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {tab === 'resolved' ? 'No resolved conversations' : 'No conversations'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {search ? 'Try a different search' : 'Nothing here yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.map(conv => {
              const cfg = STATUS_CONFIG[conv.status as StatusKey] ?? STATUS_CONFIG.bot
              const isSelected = conv.id === selectedId
              const isDim = cfg.dim
              const lastMsg = getLastMessage(conv)
              const contact = conv.contacts
              const name = contact?.name || contact?.email || 'Anonymous'
              const initials = getInitials(contact?.name, contact?.email)

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-100',
                    'hover:bg-muted/60 active:scale-[0.99]',
                    isSelected ? 'bg-primary/8 ring-1 ring-primary/15' : '',
                    isDim ? 'opacity-60' : ''
                  )}
                >
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
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className={cn(
                        'truncate text-xs font-semibold',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                        {formatDistanceToNow(new Date(conv.started_at), { addSuffix: false })}
                      </span>
                    </div>
                    <p className="mb-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {lastMsg}
                    </p>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                      conv.status === 'bot'      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      conv.status === 'pending'  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      conv.status === 'open'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {conv.status === 'bot'     && <ZapIcon className="size-2.5" />}
                      {conv.status === 'pending' && <ClockIcon className="size-2.5" />}
                      {conv.status === 'open'    && <UserCheckIcon className="size-2.5" />}
                      {(conv.status === 'resolved' || conv.status === 'closed') && <CheckCircleIcon className="size-2.5" />}
                      {cfg.label}
                    </span>
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