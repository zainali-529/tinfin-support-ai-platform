'use client'

/**
 * apps/web/app/(dashboard)/email/page.tsx
 *
 * Dedicated Email Inbox — separate from the main chat inbox.
 * Shows only email-channel conversations with full email thread UI.
 * Left panel: email conversation list filtered to channel='email'
 * Right panel: EmailConversationView with full HTML thread + reply composer
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useActiveOrg } from '@/components/org/OrgContext'
import { EmailConversationView } from '@/components/email/EmailConversationView'
import { EmailThreadView } from '@/components/email/EmailThreadView'
import { createClient } from '@/lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { cn } from '@workspace/ui/lib/utils'
import {
  MailIcon,
  SearchIcon,
  InboxIcon,
  ClockIcon,
  CheckCircleIcon,
  UserCheckIcon,
} from 'lucide-react'
import type { Conversation } from '@/types/database'

// ─── Agent ID ──────────────────────────────────────────────────────────────────

function useAgentId() {
  const [agentId, setAgentId] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (uid) setAgentId(uid)
    })
  }, [])
  return agentId
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  bot:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  open:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground',
  closed:   'bg-muted text-muted-foreground',
}

function getSubject(conv: Conversation): string {
  const msgs = conv.messages
  if (!msgs?.length) return 'No messages'
  const latest = msgs.reduce((a, b) =>
    new Date(b.created_at) >= new Date(a.created_at) ? b : a
  )
  return latest.content?.slice(0, 64) || 'Email'
}

// https://flighty-spindliest-ivory.ngrok-free.dev

// ─── Email Conversation List Item ─────────────────────────────────────────────

function EmailListItem({
  conv,
  selected,
  onSelect,
}: {
  conv: Conversation
  selected: boolean
  onSelect: () => void
}) {
  const contact = conv.contacts
  const name = contact?.name ?? contact?.email ?? 'Anonymous'
  const initials = name.slice(0, 2).toUpperCase()
  const isUnread = conv.status === 'pending' || conv.status === 'bot'

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-all',
        'hover:bg-muted/50 active:scale-[0.99]',
        selected ? 'bg-primary/8 border-r-2 border-primary' : '',
      )}
    >
      <Avatar className="size-9 shrink-0 mt-0.5">
        <AvatarFallback className={cn(
          'text-xs font-semibold',
          selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-0.5 gap-2">
          <span className={cn(
            'truncate text-sm',
            isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
          )}>
            {name}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {formatDistanceToNow(new Date(conv.started_at), { addSuffix: false })}
          </span>
        </div>

        <p className={cn(
          'truncate text-xs mb-1.5',
          isUnread ? 'text-foreground/70' : 'text-muted-foreground'
        )}>
          {getSubject(conv)}
        </p>

        <div className="flex items-center gap-1.5">
          {isUnread && (
            <span className="size-1.5 rounded-full bg-primary shrink-0" />
          )}
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            STATUS_CLASSES[conv.status] ?? STATUS_CLASSES.resolved
          )}>
            {conv.status === 'pending' && <ClockIcon className="size-2.5" />}
            {conv.status === 'open' && <UserCheckIcon className="size-2.5" />}
            {(conv.status === 'resolved' || conv.status === 'closed') && <CheckCircleIcon className="size-2.5" />}
            {conv.status === 'bot' && <MailIcon className="size-2.5" />}
            {conv.status}
          </span>
          {contact?.email && (
            <span className="truncate text-[9px] text-muted-foreground/60 max-w-[120px]">
              {contact.email}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Email List Panel ──────────────────────────────────────────────────────────

function EmailListPanel({
  conversations,
  loading,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')

  // Filter to email channel only
  const emailConvs = conversations.filter((c) => c.channel === 'email')

  const filtered = emailConvs.filter((c) => {
    if (tab === 'pending' && c.status !== 'pending' && c.status !== 'bot') return false
    if (tab === 'open' && c.status !== 'open') return false
    if (tab === 'resolved' && c.status !== 'resolved' && c.status !== 'closed') return false

    if (!search) return true
    const name = c.contacts?.name ?? c.contacts?.email ?? ''
    return name.toLowerCase().includes(search.toLowerCase()) ||
      getSubject(c).toLowerCase().includes(search.toLowerCase())
  })

  const counts = {
    all: emailConvs.length,
    pending: emailConvs.filter((c) => c.status === 'pending' || c.status === 'bot').length,
    open: emailConvs.filter((c) => c.status === 'open').length,
  }

  return (
    <div className="flex h-full flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3.5 shrink-0">
        <MailIcon className="size-4 text-primary shrink-0" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Email Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? '…' : `${counts.all} email conversation${counts.all !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2.5 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or subject…"
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-3 py-2 shrink-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-7 w-full bg-muted/50 grid grid-cols-4">
            <TabsTrigger value="all" className="text-[10px] h-6">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-[10px] h-6">
              New
              {counts.pending > 0 && (
                <span className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open" className="text-[10px] h-6">Open</TabsTrigger>
            <TabsTrigger value="resolved" className="text-[10px] h-6">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <MailIcon className="size-5 text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'No matching emails' : tab === 'resolved' ? 'No resolved emails' : 'No emails yet'}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {!search && tab === 'all' ? 'Emails from customers will appear here' : ''}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((conv) => (
              <EmailListItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onSelect={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Empty panel ──────────────────────────────────────────────────────────────

function NoEmailSelected() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
        <MailIcon className="size-8 text-muted-foreground/40" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Select an email</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Click an email from the list to view the full thread and reply to the customer.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailPage() {
  const activeOrg = useActiveOrg()
  const orgId = activeOrg.id
  const agentId = useAgentId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conversations, loading, refetch } = useConversations(orgId)

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const handleStatusChange = useCallback(() => {
    void refetch()
  }, [refetch])

  const prevOrgId = useRef(orgId)
  useEffect(() => {
    if (prevOrgId.current !== orgId) {
      setSelectedId(null)
      prevOrgId.current = orgId
    }
  }, [orgId])

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Left: Email list */}
      <div className="w-[300px] xl:w-[340px] shrink-0 min-h-0 overflow-hidden flex flex-col">
        <EmailListPanel
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right: Email thread view */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        {selected ? (
          <EmailConversationView
            conversation={selected}
            orgId={orgId}
            agentId={agentId}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <NoEmailSelected />
        )}
      </div>
    </div>
  )
}