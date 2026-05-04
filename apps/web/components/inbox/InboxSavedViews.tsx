'use client'

import * as React from 'react'
import {
  AlertTriangleIcon,
  BotIcon,
  CheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  InboxIcon,
  MailIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
  UserCheckIcon,
  UserIcon,
  UserRoundXIcon,
  ZapOffIcon,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import type { InboxSavedViewId } from '@workspace/types'

interface SavedViewDefinition {
  id: InboxSavedViewId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'warning' | 'danger' | 'success' | 'info'
}

export const INBOX_SAVED_VIEWS: SavedViewDefinition[] = [
  {
    id: 'all',
    label: 'All conversations',
    description: 'Full inbox',
    icon: InboxIcon,
  },
  {
    id: 'my_open',
    label: 'My open',
    description: 'Assigned to you',
    icon: UserIcon,
    tone: 'success',
  },
  {
    id: 'unassigned',
    label: 'Unassigned',
    description: 'No human owner',
    icon: UserRoundXIcon,
    tone: 'warning',
  },
  {
    id: 'sla_at_risk',
    label: 'SLA at risk',
    description: 'Close to breach',
    icon: ClockIcon,
    tone: 'warning',
  },
  {
    id: 'sla_breached',
    label: 'SLA breached',
    description: 'Missed target',
    icon: AlertTriangleIcon,
    tone: 'danger',
  },
  {
    id: 'waiting_customer',
    label: 'Waiting customer',
    description: 'Agent replied',
    icon: CheckCircle2Icon,
    tone: 'info',
  },
  {
    id: 'human_takeover',
    label: 'Human takeover',
    description: 'AI escalated',
    icon: UserCheckIcon,
    tone: 'warning',
  },
  {
    id: 'email_only',
    label: 'Email only',
    description: 'Email channel',
    icon: MailIcon,
    tone: 'info',
  },
  {
    id: 'whatsapp_only',
    label: 'WhatsApp only',
    description: 'WhatsApp channel',
    icon: MessageCircleIcon,
    tone: 'success',
  },
  {
    id: 'ai_handled',
    label: 'AI handled',
    description: 'Bot mode',
    icon: BotIcon,
    tone: 'info',
  },
  {
    id: 'low_confidence',
    label: 'Low confidence',
    description: 'Improve KB',
    icon: ShieldAlertIcon,
    tone: 'warning',
  },
  {
    id: 'actions_failed',
    label: 'Actions failed',
    description: 'Needs review',
    icon: ZapOffIcon,
    tone: 'danger',
  },
]

const DEFAULT_SAVED_VIEW = INBOX_SAVED_VIEWS[0]!

const TONE_STYLES: Record<NonNullable<SavedViewDefinition['tone']>, string> = {
  default: 'text-muted-foreground',
  warning: 'text-amber-600 dark:text-amber-300',
  danger: 'text-red-600 dark:text-red-300',
  success: 'text-emerald-600 dark:text-emerald-300',
  info: 'text-sky-600 dark:text-sky-300',
}

function formatCount(value: number | undefined): string {
  if (typeof value !== 'number') return '...'
  if (value > 999) return '999+'
  return String(value)
}

interface InboxSavedViewsProps {
  activeView: InboxSavedViewId
  counts?: Partial<Record<InboxSavedViewId, number>>
  loading?: boolean
  onChange: (view: InboxSavedViewId) => void
}

export function InboxSavedViews({
  activeView,
  counts,
  loading,
  onChange,
}: InboxSavedViewsProps) {
  const activeDefinition =
    INBOX_SAVED_VIEWS.find((view) => view.id === activeView) ?? DEFAULT_SAVED_VIEW
  const ActiveIcon = activeDefinition.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between gap-2 px-2.5 text-left shadow-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/70',
                activeView === 'all' ? 'text-muted-foreground' : 'text-primary'
              )}
            >
              <ActiveIcon className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {activeDefinition.label}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {loading ? 'Counting...' : `${formatCount(counts?.[activeView])} conversations`}
              </span>
            </span>
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Inbox views
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[360px] overflow-y-auto p-1">
          {INBOX_SAVED_VIEWS.map((view) => {
            const Icon = view.icon
            const isActive = view.id === activeView
            return (
              <DropdownMenuItem
                key={view.id}
                onSelect={() => onChange(view.id)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2"
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/70',
                    isActive ? 'text-primary' : TONE_STYLES[view.tone ?? 'default']
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {view.label}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {view.description}
                  </span>
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {loading ? '...' : formatCount(counts?.[view.id])}
                </span>
                {isActive && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
