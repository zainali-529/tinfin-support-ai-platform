'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import {
  BotIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  UserIcon,
} from 'lucide-react'
import type { DashboardActivityItem } from '@/hooks/useDashboard'

interface DashboardActivityFeedProps {
  items: DashboardActivityItem[]
  isLoading: boolean
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'

  const deltaMs = Date.now() - date.getTime()
  const deltaMinutes = Math.round(deltaMs / 60_000)

  if (deltaMinutes < 1) return 'just now'
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`

  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours}h ago`

  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays}d ago`
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'agent_reply') return <UserIcon className="size-4" />
  if (type === 'ai_reply') return <BotIcon className="size-4" />
  if (type === 'call_event') return <PhoneCallIcon className="size-4" />
  return <MessageCircleIcon className="size-4" />
}

export function DashboardActivityFeed({
  items,
  isLoading,
}: DashboardActivityFeedProps) {
  return (
    <Card className="h-full shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Activity Feed</CardTitle>
        <CardDescription className="text-xs">
          Recent support events in your org
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading &&
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg border p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
          ))}

        {!isLoading && items.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New messages and conversation updates will appear here.
            </p>
          </div>
        )}

        {!isLoading &&
          items.map((item) => {
            const content = (
              <div className="rounded-xl border px-3 py-3 transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
                    <ActivityIcon type={item.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="shrink-0 text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.timestamp)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            )

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} className="block">
                  {content}
                </Link>
              )
            }

            return <div key={item.id}>{content}</div>
          })}
      </CardContent>
    </Card>
  )
}
