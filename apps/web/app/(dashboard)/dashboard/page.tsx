import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import {
  MessageSquareIcon,
  UsersIcon,
  CheckCircleIcon,
  ZapIcon,
  ArrowUpRightIcon,
  ArrowRightIcon,
  TrendingUpIcon,
  ClockIcon,
  CircleDotIcon,
} from 'lucide-react'

const stats = [
  {
    label: 'Open Conversations',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: MessageSquareIcon,
    badge: 'Live',
    badgeVariant: 'default' as const,
    description: 'Active right now',
  },
  {
    label: 'Total Contacts',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: UsersIcon,
    description: 'Unique visitors',
  },
  {
    label: 'Resolved Today',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: CheckCircleIcon,
    description: 'Since midnight',
  },
  {
    label: 'AI Handled',
    value: '0%',
    change: '+0%',
    trend: 'up',
    icon: ZapIcon,
    description: 'Automation rate',
  },
]

const recentActivity = [
  { type: 'info', message: 'No recent activity yet', time: 'Just now' },
]

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const greeting = getGreeting()

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting},{' '}
            <span className="text-muted-foreground">
              {user?.email?.split('@')[0] ?? 'Agent'}
            </span>{' '}
            👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening with your support today.
          </p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5">
          <MessageSquareIcon className="size-3.5" />
          New Conversation
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="group relative overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {stat.label}
                </CardDescription>
                <div className="flex items-center gap-1.5">
                  {stat.badge && (
                    <Badge variant={stat.badgeVariant} className="h-4 px-1.5 text-[10px]">
                      {stat.badge}
                    </Badge>
                  )}
                  <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <stat.icon className="size-3.5" />
                  </div>
                </div>
              </div>
              <CardTitle className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUpIcon className="size-3 text-emerald-500" />
                <span className="font-medium text-emerald-600">{stat.change}</span>
                <span>{stat.description}</span>
              </div>
            </CardContent>
            {/* Subtle gradient accent */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Conversations */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Conversations</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Latest support conversations
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
              <a href="/inbox">
                View all
                <ArrowRightIcon className="size-3" />
              </a>
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="pt-0">
            <EmptyConversations />
          </CardContent>
        </Card>

        {/* Sidebar Widgets */}
        <div className="flex flex-col gap-4">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Overview</CardTitle>
              <CardDescription className="text-xs">Response metrics</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="space-y-3">
                {[
                  { label: 'Avg. First Response', value: '—', icon: ClockIcon },
                  { label: 'Resolution Rate', value: '—', icon: CheckCircleIcon },
                  { label: 'CSAT Score', value: '—', icon: TrendingUpIcon },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <item.icon className="size-3.5" />
                      {item.label}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Feed</CardTitle>
              <CardDescription className="text-xs">Recent events</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <CircleDotIcon className="size-4 text-muted-foreground opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground">No activity yet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Getting Started Banner */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ZapIcon className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Get started with Tinfin</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Install the widget on your website to start receiving conversations.
              </p>
            </div>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5">
            Install Widget
            <ArrowUpRightIcon className="size-3.5" />
          </Button>
        </CardContent>
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/5" />
        <div className="pointer-events-none absolute -bottom-4 right-24 size-16 rounded-full bg-primary/5" />
      </Card>
    </div>
  )
}

function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <MessageSquareIcon className="size-6 text-muted-foreground opacity-40" />
      </div>
      <div>
        <p className="text-sm font-medium">No conversations yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Install the widget on your site to start receiving messages
        </p>
      </div>
      <Button variant="outline" size="sm" className="mt-1 gap-1.5">
        <ZapIcon className="size-3.5" />
        Set up widget
      </Button>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}