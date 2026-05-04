'use client'

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
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
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useConversations } from '@/hooks/useConversations'
import { useAgentRealtimeListener } from '@/components/realtime/AgentRealtimeProvider'
import { useActiveOrg } from '@/components/org/OrgContext'
import { createClient } from '@/lib/supabase'
import { trpc } from '@/lib/trpc'
import { ConversationListItem } from './ConversationListItem'
import { ConversationRenderer } from './ConversationRenderer'
import { EmptyState } from './EmptyState'
import { InboxSavedViews } from './InboxSavedViews'
import { PendingApprovals } from '@/components/actions/PendingApprovals'
import { INBOX_SAVED_VIEW_IDS, type AgentRealtimeEvent, type InboxSavedViewId } from '@workspace/types'
import type { Conversation, ConversationQueueState } from '@/types/database'

type StatusFilter = 'all' | 'bot' | 'open' | 'pending' | 'resolved'
type ChannelFilter = 'all' | 'chat' | 'email' | 'whatsapp'
type QueueStateValue = 'bot' | 'queued' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved'

function queueStateForConversation(status: StatusFilter | 'closed', assignedTo?: string | null): QueueStateValue {
  if (status === 'resolved' || status === 'closed') return 'resolved'
  if (status === 'bot') return 'bot'
  if (status === 'open') return 'in_progress'
  if (status === 'pending') return assignedTo ? 'assigned' : 'queued'
  return 'queued'
}

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

const EMPTY_CONVERSATION_ID = '00000000-0000-0000-0000-000000000000'
const SAVED_VIEW_IDS = new Set<string>(INBOX_SAVED_VIEW_IDS)

function parseSavedView(value: string | null): InboxSavedViewId {
  return value && SAVED_VIEW_IDS.has(value) ? (value as InboxSavedViewId) : 'all'
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
  const utils = trpc.useUtils()
  const queryConversationId = searchParams.get('conversation')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [savedView, setSavedView] = useState<InboxSavedViewId>(() =>
    parseSavedView(searchParams.get('view'))
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [approvalsOpen, setApprovalsOpen] = useState(false)
  const [approvingLogId, setApprovingLogId] = useState<string | null>(null)
  const [rejectingLogId, setRejectingLogId] = useState<string | null>(null)

  const previousOrgId = useRef(orgId)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const queryView = parseSavedView(searchParams.get('view'))
    setSavedView((prev) => (prev === queryView ? prev : queryView))

    const queryChannel = searchParams.get('channel')
    const allowed = CHANNEL_OPTIONS.find((item) => item.value === queryChannel)
    const nextChannel = queryView === 'all' ? (allowed?.value ?? 'all') : 'all'
    setChannelFilter((prev) => (prev === nextChannel ? prev : nextChannel))

    if (queryView !== 'all') {
      setStatusFilter('all')
    }
  }, [searchParams])

  const {
    conversations,
    totalCount,
    loading,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch,
    patchConversation,
    upsertConversation,
  } = useConversations(orgId, {
    channelFilter,
    statusFilter,
    savedView,
    search: debouncedSearch,
    limit: 10,
    currentUserId: agentId,
  })
  const savedViewCountsQuery = trpc.chat.getSavedViewCounts.useQuery(undefined, {
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  const pendingApprovalsQuery = trpc.actions.getPendingApprovals.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
  const selectedConversationLoaded = conversations.some((conversation) => conversation.id === queryConversationId)
  const deepLinkedConversationQuery = trpc.chat.getConversation.useQuery(
    { conversationId: queryConversationId ?? EMPTY_CONVERSATION_ID },
    {
      enabled: Boolean(queryConversationId && !selectedConversationLoaded),
      staleTime: 30_000,
      retry: false,
    }
  )

  const approveAction = trpc.actions.approveAction.useMutation({
    onSuccess: () => {
      void pendingApprovalsQuery.refetch()
      void refetch()
    },
  })

  const rejectAction = trpc.actions.rejectAction.useMutation({
    onSuccess: () => {
      void pendingApprovalsQuery.refetch()
      void refetch()
    },
  })

  const pendingApprovalItems = (pendingApprovalsQuery.data ?? []).map((item: any) => ({
    id: String(item.id),
    logId: String(item.logId),
    conversationId:
      typeof item.conversationId === 'string' ? item.conversationId : null,
    actionName: String(item.actionName ?? 'Action'),
    parameters:
      item.parameters && typeof item.parameters === 'object'
        ? (item.parameters as Record<string, unknown>)
        : null,
    requestedAt: String(item.requestedAt),
    expiresAt: item.expiresAt ? String(item.expiresAt) : null,
  }))

  const handleInboxSocketMessage = useCallback((payload: AgentRealtimeEvent) => {
    const type = payload.type
    const record = payload as Record<string, unknown>

    if (type === 'conversation:new' && payload.conversation) {
      upsertConversation(payload.conversation)
      utils.chat.getConversation.setData({ conversationId: payload.conversationId }, (previous) =>
        previous ? ({ ...previous, ...payload.conversation } as typeof previous) : previous
      )
    }

    if (
      type === 'visitor:message' ||
      type === 'agent:message' ||
      type === 'ai:response'
    ) {
      const conversationId = typeof record.conversationId === 'string' ? record.conversationId : null
      const content = typeof record.content === 'string' ? record.content : null
      const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString()

      if (conversationId) {
        const patch: Partial<Conversation> = {
          latest_message_content: content,
          latest_message_at: createdAt,
        }

        if (type === 'visitor:message') {
          patch.last_customer_message_at = createdAt
        } else {
          patch.last_agent_reply_at = createdAt
        }

        patchConversation(conversationId, patch)
        utils.chat.getConversation.setData({ conversationId }, (previous) =>
          previous ? ({ ...previous, ...patch } as typeof previous) : previous
        )
      }
    }

    if (type === 'conversation:status_changed') {
      const conversationId = typeof record.conversationId === 'string' ? record.conversationId : null
      if (conversationId) {
        const nextStatus = typeof record.status === 'string' ? record.status : null
        const hasAssignedTo = Object.prototype.hasOwnProperty.call(record, 'assignedTo')
        const nextAssignedTo =
          typeof record.assignedTo === 'string'
            ? record.assignedTo
            : hasAssignedTo
              ? null
              : undefined
        const patch: Partial<Conversation> = {}

        if (nextStatus) {
          patch.status = nextStatus as Conversation['status']
        }
        if (nextAssignedTo !== undefined) {
          patch.assigned_to = nextAssignedTo
        }
        if (nextStatus && nextAssignedTo !== undefined) {
          patch.queue_state = queueStateForConversation(
            nextStatus as StatusFilter | 'closed',
            nextAssignedTo
          )
        } else if (typeof record.queueState === 'string') {
          patch.queue_state = record.queueState as ConversationQueueState
        }

        if (Object.keys(patch).length > 0) {
          patchConversation(conversationId, patch)
          utils.chat.getConversation.setData({ conversationId }, (previous) =>
            previous ? ({ ...previous, ...patch } as typeof previous) : previous
          )
        }
      }
    }

    const shouldRefreshList = [
      'conversation:new',
      'conversation:status_changed',
      'visitor:message',
      'agent:message',
      'ai:response',
      'handoff:requested',
      'contact:updated',
    ].includes(type)

    if (shouldRefreshList) {
      void refetch()
      void utils.dashboard.getHomeOverview.invalidate()
      void utils.chat.getSavedViewCounts.invalidate()
    }

    if (type === 'approval:requested' || type === 'approval:resolved') {
      void pendingApprovalsQuery.refetch()
      void utils.chat.getSavedViewCounts.invalidate()
      void refetch()
    }
  }, [
    patchConversation,
    pendingApprovalsQuery,
    refetch,
    upsertConversation,
    utils.chat.getConversation,
    utils.chat.getSavedViewCounts,
    utils.dashboard.getHomeOverview,
  ])

  useAgentRealtimeListener(agentId ? handleInboxSocketMessage : null)

  useEffect(() => {
    setSelectedId((prev) => (prev === queryConversationId ? prev : queryConversationId))
  }, [queryConversationId])

  useEffect(() => {
    if (previousOrgId.current !== orgId) {
      setSelectedId(null)
      previousOrgId.current = orgId
    }
  }, [orgId])

  const pushQueryState = useCallback(
    (
      nextChannel: ChannelFilter,
      nextConversationId: string | null,
      nextSavedView: InboxSavedViewId = savedView
    ) => {
      const params = new URLSearchParams(searchParams.toString())

      if (nextSavedView === 'all') {
        params.delete('view')
        if (nextChannel === 'all') params.delete('channel')
        else params.set('channel', nextChannel)
      } else {
        params.set('view', nextSavedView)
        params.delete('channel')
      }

      if (nextConversationId) params.set('conversation', nextConversationId)
      else params.delete('conversation')

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, savedView, searchParams]
  )

  const handleSavedViewChange = useCallback(
    (nextView: InboxSavedViewId) => {
      setSavedView(nextView)
      setStatusFilter('all')
      setChannelFilter('all')
      setSelectedId(null)
      pushQueryState('all', null, nextView)
    },
    [pushQueryState]
  )

  const handleChannelChange = useCallback(
    (nextChannel: ChannelFilter) => {
      setSavedView('all')
      setChannelFilter(nextChannel)
      setSelectedId(null)
      pushQueryState(nextChannel, null, 'all')
    },
    [pushQueryState]
  )

  const handleStatusChangeFilter = useCallback(
    (nextStatus: StatusFilter) => {
      setSavedView('all')
      setStatusFilter(nextStatus)
      setSelectedId(null)
      pushQueryState(channelFilter, null, 'all')
    },
    [channelFilter, pushQueryState]
  )

  const handleClearManualFilters = useCallback(() => {
    setSavedView('all')
    setStatusFilter('all')
    setSelectedId(null)
    pushQueryState(channelFilter, null, 'all')
  }, [channelFilter, pushQueryState])

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedId(conversationId)
      pushQueryState(channelFilter, conversationId, savedView)
    },
    [channelFilter, pushQueryState, savedView]
  )

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ??
    ((deepLinkedConversationQuery.data ?? null) as Conversation | null)

  const handleStatusMutation = useCallback((
    id: string,
    status: string,
    patch?: Partial<NonNullable<typeof selectedConversation>>
  ) => {
    const assignedTo = patch && 'assigned_to' in patch
      ? patch.assigned_to
      : selectedConversation?.assigned_to
    const nextQueueState = queueStateForConversation(status as StatusFilter | 'closed', assignedTo ?? null)

    patchConversation(id, {
      ...patch,
      status: status as NonNullable<typeof selectedConversation>['status'],
      queue_state: nextQueueState,
      assigned_to: assignedTo ?? null,
    })

    utils.chat.getConversation.setData({ conversationId: id }, (previous) => previous
      ? {
          ...previous,
          status,
          queue_state: nextQueueState,
          assigned_to: assignedTo ?? null,
          ai_context: patch?.ai_context ?? previous.ai_context,
        }
      : previous
    )
  }, [patchConversation, selectedConversation?.assigned_to, utils.chat.getConversation])

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

  const handleApprove = async (logId: string) => {
    setApprovingLogId(logId)
    try {
      await approveAction.mutateAsync({ logId })
    } finally {
      setApprovingLogId(null)
    }
  }

  const handleReject = async (logId: string) => {
    setRejectingLogId(logId)
    try {
      await rejectAction.mutateAsync({ logId })
    } finally {
      setRejectingLogId(null)
    }
  }

  const hasManualFilters = statusFilter !== 'all'

  return (
    <>
      <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex w-[320px] shrink-0 flex-col border-r">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Unified Inbox</h2>
            <p className="text-xs text-muted-foreground">
              {loading && conversations.length === 0 ? 'Loading...' : `${totalCount} conversations`}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={() => setApprovalsOpen(true)}
          >
            Approvals
            {pendingApprovalItems.length > 0 ? ` (${pendingApprovalItems.length})` : ''}
          </Button>
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

        <div className="border-b px-3 py-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_112px_36px] gap-2">
            <InboxSavedViews
              activeView={savedView}
              counts={savedViewCountsQuery.data}
              loading={savedViewCountsQuery.isLoading}
              onChange={handleSavedViewChange}
            />

            <Select value={channelFilter} onValueChange={(value) => handleChannelChange(value as ChannelFilter)}>
              <SelectTrigger size="sm" className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={hasManualFilters ? 'secondary' : 'outline'}
                  className="relative size-9 shadow-none"
                  aria-label="Advanced inbox filters"
                >
                  <SlidersHorizontalIcon className="size-3.5" />
                  {hasManualFilters && (
                    <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Status
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => handleStatusChangeFilter(value as StatusFilter)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!hasManualFilters}
                  onSelect={handleClearManualFilters}
                  className="gap-2 text-xs"
                >
                  <XIcon className="size-3.5" />
                  Clear advanced filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
        ) : selectedId && deepLinkedConversationQuery.isFetching ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Opening conversation...
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
      </div>

      <Dialog open={approvalsOpen} onOpenChange={setApprovalsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pending Action Approvals</DialogTitle>
            <DialogDescription>
              Review and approve AI action requests queued from conversations.
            </DialogDescription>
          </DialogHeader>
          <PendingApprovals
            items={pendingApprovalItems}
            approvingLogId={approvingLogId}
            rejectingLogId={rejectingLogId}
            onApprove={handleApprove}
            onReject={handleReject}
            emptyMessage="No queued approvals in inbox."
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
