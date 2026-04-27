'use client'

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'
import { SearchIcon } from 'lucide-react'
import { useConversations } from '@/hooks/useConversations'
import { useActiveOrg } from '@/components/org/OrgContext'
import { createClient } from '@/lib/supabase'
import { ConversationListItem } from './ConversationListItem'
import { ConversationRenderer } from './ConversationRenderer'
import { EmptyState } from './EmptyState'

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

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const previousOrgId = useRef(orgId)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const queryChannel = searchParams.get('channel')
    const allowed = CHANNEL_OPTIONS.find((item) => item.value === queryChannel)
    const nextChannel = allowed?.value ?? 'all'
    setChannelFilter((prev) => (prev === nextChannel ? prev : nextChannel))
  }, [searchParams])

  const {
    conversations,
    totalCount,
    loading,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch,
  } = useConversations(orgId, {
    channelFilter,
    statusFilter,
    search: debouncedSearch,
    limit: 10,
  })

  useEffect(() => {
    const queryConversationId = searchParams.get('conversation')
    if (!queryConversationId) return
    if (!conversations.some((conversation) => conversation.id === queryConversationId)) return

    setSelectedId((prev) => (prev === queryConversationId ? prev : queryConversationId))
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

  const handleStatusChangeFilter = useCallback((nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus)
    setSelectedId(null)
  }, [])

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedId(conversationId)
      pushQueryState(channelFilter, conversationId)
    },
    [channelFilter, pushQueryState]
  )

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null

  const handleStatusMutation = useCallback(() => {
    void refetch()
  }, [refetch])

  const handleListScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasMore || isFetchingMore || loading) return

      const node = event.currentTarget
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
      if (distanceFromBottom <= 120) {
        loadMore()
      }
    },
    [hasMore, isFetchingMore, loadMore, loading]
  )

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
            {loading && conversations.length === 0 ? 'Loading...' : `${totalCount} conversations`}
          </p>
        </div>

        <div className="border-b px-3 py-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
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
                onClick={() => handleStatusChangeFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <select
            value={channelFilter}
            onChange={(event) => handleChannelChange(event.target.value as ChannelFilter)}
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" onScroll={handleListScroll}>
          {loading && conversations.length === 0 ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            <>
              <div className="space-y-1.5 p-2">
                {conversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    onSelect={() => handleSelectConversation(conversation.id)}
                  />
                ))}
              </div>

              {(isFetchingMore || hasMore) && (
                <div className="flex items-center justify-center gap-2 px-3 pb-4 pt-2 text-xs text-muted-foreground">
                  {isFetchingMore ? (
                    <>
                      <Spinner className="size-3.5" />
                      Loading more...
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

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedConversation ? (
          <ConversationRenderer
            conversation={selectedConversation}
            orgId={orgId}
            agentId={agentId}
            onStatusChange={handleStatusMutation}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
