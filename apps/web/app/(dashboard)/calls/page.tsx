'use client'

import { useEffect, useState } from 'react'
import { useActiveOrg, useHasOrgPermission } from '@/components/org/OrgContext'
import { useCalls, useVapiAssistantConfig } from '@/hooks/useCalls'
import { CallLogList, CallDetailPanel } from '@/components/calls/CallLogList'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PhoneCallIcon,
  PhoneIcon,
  TrendingUpIcon,
} from 'lucide-react'
import Link from 'next/link'

function formatCallDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          <Icon className="size-3.5" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function CallsPage() {
  const activeOrg = useActiveOrg()
  const canAccessCalls = useHasOrgPermission('calls')
  const canManageVoice = useHasOrgPermission('voiceAssistant')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

  const {
    calls,
    totalCount,
    stats,
    isLoading,
    statsLoading,
    hasMore,
    isFetchingMore,
    loadMore,
    syncCalls,
  } = useCalls(activeOrg.id, {
    search: debouncedSearch,
    limit: 10,
  })

  const { config: assistantConfig, isLoading: assistantLoading } = useVapiAssistantConfig()

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  if (!canAccessCalls) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to access call logs in this organization.
          </CardContent>
        </Card>
      </div>
    )
  }

  const avgDurationFmt = stats ? formatCallDuration(stats.today.avgDurationSeconds) : '-'
  const voiceIsConfigured =
    !assistantLoading && Boolean(assistantConfig?.vapi_assistant_id && assistantConfig?.is_active)

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 flex-col gap-6 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PhoneCallIcon className="size-6 text-primary" />
            Voice Calls
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">AI voice call logs, transcripts, and recordings</p>
        </div>
        {canManageVoice && (
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
            <Link href="/voice-assistant">Configure Voice</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Calls Today"
          value={statsLoading ? '...' : (stats?.today.count ?? 0)}
          sub="Total incoming"
          icon={PhoneIcon}
          loading={statsLoading}
        />
        <StatCard
          label="This Week"
          value={statsLoading ? '...' : (stats?.thisWeek ?? 0)}
          sub="7-day total"
          icon={TrendingUpIcon}
          loading={statsLoading}
        />
        <StatCard
          label="Avg Duration"
          value={statsLoading ? '...' : avgDurationFmt}
          sub="Today's calls"
          icon={ClockIcon}
          loading={statsLoading}
        />
        <StatCard
          label="All Time"
          value={statsLoading ? '...' : (stats?.allTime ?? 0)}
          sub="Total calls"
          icon={PhoneCallIcon}
          loading={statsLoading}
        />
      </div>

      {!assistantLoading && (
        <Card
          className={
            voiceIsConfigured
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
              : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10'
          }
        >
          <CardContent className="flex items-center gap-3 p-4">
            {voiceIsConfigured ? (
              <CheckCircleIcon className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircleIcon className="size-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  voiceIsConfigured
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {voiceIsConfigured
                  ? `Voice assistant "${assistantConfig!.name}" is active`
                  : 'Voice calling is not yet configured'}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  voiceIsConfigured
                    ? 'text-emerald-700/80 dark:text-emerald-300/80'
                    : 'text-amber-700/80 dark:text-amber-300/80'
                }`}
              >
                {voiceIsConfigured
                  ? `Calls will appear here automatically via webhook. ${totalCount === 0 ? 'No calls yet - share your widget with visitors.' : ''}`
                  : 'Go to Voice Assistant settings to create your AI voice assistant.'}
              </p>
            </div>
            {!voiceIsConfigured && canManageVoice && (
              <Button size="sm" variant="outline" className="shrink-0 border-amber-300" asChild>
                <Link href="/voice-assistant">Set Up Voice</Link>
              </Button>
            )}
            {voiceIsConfigured && (
              <Badge variant="outline" className="shrink-0 border-emerald-300 text-emerald-700">
                <CheckCircleIcon className="mr-1 size-3" /> Active
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-r xl:w-[340px]">
          <CallLogList
            calls={calls}
            totalCount={totalCount}
            loading={isLoading}
            selectedId={selectedCallId}
            onSelect={setSelectedCallId}
            search={searchInput}
            onSearchChange={setSearchInput}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={loadMore}
            onSync={() => syncCalls.mutate({ limit: 20 })}
            syncing={syncCalls.isPending}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CallDetailPanel callId={selectedCallId} orgId={activeOrg.id} />
        </div>
      </div>
    </div>
  )
}
