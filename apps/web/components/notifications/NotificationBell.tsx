'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BellIcon,
  BellRingIcon,
  CheckCheckIcon,
  ExternalLinkIcon,
  MailIcon,
  ShieldAlertIcon,
  UserCheckIcon,
  ZapIcon,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import { useActiveOrg } from '@/components/org/OrgContext'

type BrowserNotificationState = 'unsupported' | 'default' | 'denied' | 'granted'

type NotificationItem = {
  id: string
  type: string
  severity: string
  title: string
  body: string
  href: string | null
  readAt: string | null
  createdAt: string
  emailStatus: string
}

function permissionState(): BrowserNotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as BrowserNotificationState
}

function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ''

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function notificationIcon(type: string) {
  if (type === 'conversation_assigned') return UserCheckIcon
  if (type === 'sla_at_risk' || type === 'sla_breached') return ShieldAlertIcon
  if (type === 'action_approval_requested') return ZapIcon
  if (type === 'ai_handoff_requested') return BellRingIcon
  if (type === 'conversation_new') return MailIcon
  return BellIcon
}

function severityClass(severity: string, unread: boolean): string {
  if (severity === 'critical') return unread ? 'bg-red-500' : 'bg-red-500/45'
  if (severity === 'warning') return unread ? 'bg-amber-500' : 'bg-amber-500/45'
  if (severity === 'success') return unread ? 'bg-emerald-500' : 'bg-emerald-500/45'
  return unread ? 'bg-sky-500' : 'bg-sky-500/45'
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem
  onOpen: (item: NotificationItem) => void
}) {
  const Icon = notificationIcon(item.type)
  const unread = !item.readAt

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'group flex w-full gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-border hover:bg-muted/45',
        unread && 'bg-primary/5'
      )}
    >
      <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
        <Icon className="size-4" />
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-popover',
            severityClass(item.severity, unread)
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={cn('text-sm font-medium leading-5', unread ? 'text-foreground' : 'text-muted-foreground')}>
            {item.title}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(item.createdAt)}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {item.body}
        </span>
        {item.href ? (
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open workspace
            <ExternalLinkIcon className="size-3" />
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function NotificationBell() {
  const activeOrg = useActiveOrg()
  const router = useRouter()
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [browserState, setBrowserState] = useState<BrowserNotificationState>('unsupported')

  const unreadCountQuery = trpc.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const listQuery = trpc.notifications.list.useQuery(
    { limit: 20 },
    {
      enabled: open,
      refetchInterval: open ? 15_000 : false,
      staleTime: 5_000,
    }
  )

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.getUnreadCount.invalidate()
      void utils.notifications.list.invalidate()
    },
  })

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.getUnreadCount.invalidate()
      void utils.notifications.list.invalidate()
    },
  })

  useEffect(() => {
    setBrowserState(permissionState())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id
      if (!userId || cancelled) return

      channel = supabase
        .channel(`notifications:${activeOrg.id}:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>
            if (row.org_id !== activeOrg.id) return

            void utils.notifications.getUnreadCount.invalidate()
            void utils.notifications.list.invalidate()

            if (permissionState() === 'granted') {
              const title = typeof row.title === 'string' ? row.title : 'Tinfin AI notification'
              const body = typeof row.body === 'string' ? row.body : ''
              const tag = typeof row.id === 'string' ? row.id : undefined
              new Notification(title, {
                body,
                tag,
                icon: '/favicon.ico',
              })
            }
          }
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [activeOrg.id, utils.notifications.getUnreadCount, utils.notifications.list])

  const notifications = useMemo(
    () => ((listQuery.data ?? []) as NotificationItem[]),
    [listQuery.data]
  )

  const unreadCount = unreadCountQuery.data?.count ?? 0
  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  async function requestBrowserNotifications() {
    if (permissionState() === 'unsupported') return
    const result = await Notification.requestPermission()
    setBrowserState(result as BrowserNotificationState)
  }

  function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      markRead.mutate({ id: item.id })
    }
    if (item.href) {
      setOpen(false)
      router.push(item.href)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-9 rounded-xl"
          aria-label="Open notifications"
        >
          <BellIcon className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">
              {countLabel}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="rounded-2xl border bg-popover p-0 shadow-none"
        style={{ width: 'min(430px, calc(100vw - 2rem))' }}
      >
        <div className="flex items-start justify-between gap-4 px-4 py-4">
          <div>
            <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold text-foreground">
              Notifications
            </DropdownMenuLabel>
            <p className="mt-1 text-xs text-muted-foreground">
              Assignments, SLA alerts, handoffs, and approvals.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheckIcon className="mr-1.5 size-3.5" />
            Read all
          </Button>
        </div>

        {browserState === 'default' ? (
          <>
            <div className="mx-4 rounded-xl border border-dashed bg-muted/35 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Enable browser alerts for urgent notifications.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={requestBrowserNotifications}
                >
                  Enable
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator className="mx-4 my-3" />
          </>
        ) : browserState === 'denied' ? (
          <>
            <div className="mx-4 rounded-xl border bg-muted/35 px-3 py-2.5 text-xs text-muted-foreground">
              Browser alerts are blocked. You can re-enable them from browser site settings.
            </div>
            <DropdownMenuSeparator className="mx-4 my-3" />
          </>
        ) : (
          <DropdownMenuSeparator className="mx-4 my-0" />
        )}

        <ScrollArea className="max-h-[440px]">
          <div className="p-2">
            {listQuery.isLoading ? (
              <div className="space-y-2 p-2">
                <div className="h-14 rounded-xl bg-muted/50" />
                <div className="h-14 rounded-xl bg-muted/40" />
                <div className="h-14 rounded-xl bg-muted/30" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="space-y-1">
                {notifications.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onOpen={openNotification}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-2xl border bg-muted/30 text-muted-foreground">
                  <BellIcon className="size-4" />
                </div>
                <p className="mt-3 text-sm font-medium">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New assignments and SLA alerts will show here.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
