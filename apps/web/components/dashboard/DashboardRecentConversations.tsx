'use client'

import Link from 'next/link'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { ArrowRightIcon } from 'lucide-react'
import type { DashboardConversationItem } from '@/hooks/useDashboard'

interface DashboardRecentConversationsProps {
  conversations: DashboardConversationItem[]
  isLoading: boolean
}

const CHANNEL_LABELS: Record<string, string> = {
  chat: 'Chat',
  email: 'Email',
  whatsapp: 'WhatsApp',
  voice: 'Voice',
}

const STATUS_LABELS: Record<string, string> = {
  bot: 'Bot',
  pending: 'Pending',
  open: 'Open',
  resolved: 'Resolved',
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function DashboardRecentConversations({
  conversations,
  isLoading,
}: DashboardRecentConversationsProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Recent Conversations</CardTitle>
          <CardDescription className="text-xs">
            Latest threads across all channels
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
          <Link href="/inbox">
            Open Inbox
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-3 pt-4">
        {isLoading &&
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-lg border p-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}

        {!isLoading && conversations.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Install your widget or connect channels to start receiving support
              requests.
            </p>
          </div>
        )}

        {!isLoading &&
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={conversation.href}
              className="block rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {conversation.contactName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conversation.previewText}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] text-muted-foreground">
                  {formatTime(conversation.startedAt)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {CHANNEL_LABELS[conversation.channel] ?? conversation.channel}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_LABELS[conversation.status] ?? conversation.status}
                </Badge>
                {conversation.isUnassigned && (
                  <Badge variant="outline" className="text-[10px]">
                    Unassigned
                  </Badge>
                )}
              </div>
            </Link>
          ))}
      </CardContent>
    </Card>
  )
}
