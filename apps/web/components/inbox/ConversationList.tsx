'use client'

import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { SearchIcon, BotIcon, InboxIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState } from 'react'
import type { Conversation } from '@/types/database'

const STATUS_CONFIG = {
  bot: { label: 'Bot', variant: 'secondary' as const, dot: 'bg-blue-400' },
  pending: { label: 'Pending', variant: 'outline' as const, dot: 'bg-amber-400' },
  open: { label: 'Open', variant: 'default' as const, dot: 'bg-emerald-400' },
  resolved: { label: 'Done', variant: 'secondary' as const, dot: 'bg-muted-foreground' },
  closed: { label: 'Closed', variant: 'secondary' as const, dot: 'bg-muted-foreground' },
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

function getLastMessage(conv: Conversation) {
  const msgs = conv.messages
  if (!msgs?.length) return 'No messages yet'
  const last = msgs[msgs.length - 1]
  return last?.content?.slice(0, 72) || ''
}

interface Props {
  conversations: Conversation[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')

  const filtered = conversations.filter(c => {
    const matchTab = tab === 'all' || c.status === tab
    const name = c.contacts?.name || c.contacts?.email || ''
    const matchSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      getLastMessage(c).toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const pendingCount = conversations.filter(c => c.status === 'pending').length
  const openCount = conversations.filter(c => c.status === 'open').length

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? '...' : `${conversations.length} conversations`}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm">
          <SlidersHorizontalIcon className="size-3.5" />
          <span className="sr-only">Filter</span>
        </Button>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2.5">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0 focus-visible:bg-muted"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b px-3 py-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-7 w-full bg-muted/50">
            <TabsTrigger value="all" className="flex-1 text-xs h-6">All</TabsTrigger>
            <TabsTrigger value="pending" className="relative flex-1 text-xs h-6">
              Pending
              {pendingCount > 0 && (
                <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open" className="flex-1 text-xs h-6">
              Open
              {openCount > 0 && (
                <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex-1 text-xs h-6">Bot</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex flex-col gap-0.5 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
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
            <div>
              <p className="text-sm font-medium text-muted-foreground">No conversations</p>
              <p className="text-xs text-muted-foreground/70">
                {search ? 'Try a different search' : 'Nothing here yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.map(conv => {
              const status = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.bot
              const isSelected = conv.id === selectedId
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
                    isSelected
                      ? 'bg-primary/8 ring-1 ring-primary/15 hover:bg-primary/10'
                      : ''
                  )}
                >
                  {/* Avatar with status dot */}
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
                      status.dot
                    )} />
                  </div>

                  {/* Content */}
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
                    <div className="flex items-center gap-1.5">
                      {conv.channel === 'chat' && (
                        <BotIcon className="size-3 text-muted-foreground/50" />
                      )}
                      <Badge
                        variant={status.variant}
                        className="h-3.5 px-1 text-[9px] font-semibold uppercase tracking-wide"
                      >
                        {status.label}
                      </Badge>
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