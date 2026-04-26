'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@workspace/ui/components/input'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { SearchIcon } from 'lucide-react'
import { useConversations } from '@/hooks/useConversations'
import { useActiveOrg } from '@/components/org/OrgContext'
import { createClient } from '@/lib/supabase'
import { ConversationListItem } from './ConversationListItem'
import { ConversationRenderer } from './ConversationRenderer'
import { EmptyState } from './EmptyState'
import type { Conversation } from '@/types/database'

type StatusFilter = 'all' | 'bot' | 'open' | 'pending' | 'resolved'
type ChannelFilter = 'all' | 'chat' | 'email' | 'whatsapp'

const CHANNEL_OPTIONS: Array<{ value: ChannelFilter; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'bot', label: 'Bot' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
]

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function previewText(conversation: Conversation): string {
  if (conversation.channel === 'email') {
    const emailMessages = conversation.email_messages ?? []
    if (emailMessages.length > 0) {
      const latest = emailMessages.reduce((acc, current) => {
        if (!acc) return current
        return new Date(current.created_at).getTime() >=
          new Date(acc.created_at).getTime()
          ? current
          : acc
      }, emailMessages[0])
      if (latest.subject) return latest.subject
    }
  }

  const messages = conversation.messages ?? []
  if (messages.length === 0) return ''
  const latest = messages.reduce((acc, current) => {
    if (!acc) return current
    return new Date(current.created_at).getTime() >=
      new Date(acc.created_at).getTime()
      ? current
      : acc
  }, messages[0])
  return latest.content ?? ''
}

function useAgentId() {
  const [agentId, setAgentId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id
      if (userId) setAgentId(userId)
    })
  }, [])

  return agentId
}

export function UnifiedInbox() {
  const activeOrg = useActiveOrg()
  const orgId = activeOrg.id
  const agentId = useAgentId()

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const previousOrgId = useRef(orgId)

  useEffect(() => {
    const queryChannel = searchParams.get('channel')
    const allowed = CHANNEL_OPTIONS.find((item) => item.value === queryChannel)
    const nextChannel = allowed?.value ?? 'all'
    setChannelFilter((prev) => (prev === nextChannel ? prev : nextChannel))
  }, [searchParams])

  const { conversations, loading, refetch } = useConversations(orgId, {
    channelFilter: channelFilter === 'all' ? null : channelFilter,
  })

  useEffect(() => {
    const queryConversationId = searchParams.get('conversation')
    if (!queryConversationId) return
    if (!conversations.some((conversation) => conversation.id === queryConversationId))
      return

    setSelectedId((prev) =>
      prev === queryConversationId ? prev : queryConversationId
    )
  }, [conversations, searchParams])

  useEffect(() => {
    if (previousOrgId.current !== orgId) {
      setSelectedId(null)
      previousOrgId.current = orgId
    }
  }, [orgId])

  const pushQueryState = useCallback(
    (nextChannel: ChannelFilter, nextConversationId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())

      if (nextChannel === 'all') params.delete('channel')
      else params.set('channel', nextChannel)

      if (nextConversationId) params.set('conversation', nextConversationId)
      else params.delete('conversation')

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const handleChannelChange = useCallback(
    (nextChannel: ChannelFilter) => {
      setChannelFilter(nextChannel)
      setSelectedId(null)
      pushQueryState(nextChannel, null)
    },
    [pushQueryState]
  )

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedId(conversationId)
      pushQueryState(channelFilter, conversationId)
    },
    [channelFilter, pushQueryState]
  )

  const filteredConversations = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search)

    return conversations.filter((conversation) => {
      if (statusFilter === 'bot' && conversation.status !== 'bot') return false
      if (statusFilter === 'open' && conversation.status !== 'open') return false
      if (statusFilter === 'pending' && conversation.status !== 'pending') return false
      if (
        statusFilter === 'resolved' &&
        conversation.status !== 'resolved' &&
        conversation.status !== 'closed'
      ) {
        return false
      }

      if (!normalizedSearch) return true

      const name = (
        conversation.contacts?.name ??
        conversation.contacts?.email ??
        conversation.contacts?.phone ??
        ''
      ).toLowerCase()
      const preview = previewText(conversation).toLowerCase()

      return (
        name.includes(normalizedSearch) || preview.includes(normalizedSearch)
      )
    })
  }, [conversations, search, statusFilter])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const counts = useMemo(
    () => ({
      all: conversations.length,
      bot: conversations.filter((conversation) => conversation.status === 'bot')
        .length,
      open: conversations.filter((conversation) => conversation.status === 'open')
        .length,
      pending: conversations.filter(
        (conversation) => conversation.status === 'pending'
      ).length,
      resolved: conversations.filter(
        (conversation) =>
          conversation.status === 'resolved' || conversation.status === 'closed'
      ).length,
    }),
    [conversations]
  )

  const handleStatusChange = useCallback(() => {
    void refetch()
  }, [refetch])

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex w-[320px] shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Unified Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? 'Loading...' : `${counts.all} conversations`}
          </p>
        </div>

        <div className="border-b px-3 py-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="space-y-2 border-b px-3 py-2.5">
          <div className="grid grid-cols-5 gap-1">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={statusFilter === option.value ? 'secondary' : 'ghost'}
                className="h-7 px-2 text-[10px]"
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <select
            value={channelFilter}
            onChange={(event) =>
              handleChannelChange(event.target.value as ChannelFilter)
            }
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            <div className="space-y-1.5 p-2">
              {filteredConversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedId === conversation.id}
                  onSelect={() => handleSelectConversation(conversation.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedConversation ? (
          <ConversationRenderer
            conversation={selectedConversation}
            orgId={orgId}
            agentId={agentId}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
