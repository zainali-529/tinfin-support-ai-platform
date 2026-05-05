'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/sonner'
import {
  AlertTriangleIcon,
  BarChart3Icon,
  ClockIcon,
  GlobeLockIcon,
  KeyRoundIcon,
  RotateCwIcon,
  Trash2Icon,
  PlusIcon,
  PencilIcon,
  FlaskConicalIcon,
  BotIcon,
  LockIcon,
} from 'lucide-react'
import { LaunchErrorState, LaunchInlineError } from '@/components/launch/LaunchState'
import {
  ActionBuilder,
  type ActionBuilderPayload,
} from '@/components/actions/ActionBuilder'
import {
  ActionTestPanel,
  type ActionTestResult,
} from '@/components/actions/ActionTestPanel'
import { ActionTemplates } from '@/components/actions/ActionTemplates'
import {
  PendingApprovals,
  type PendingApprovalItem,
} from '@/components/actions/PendingApprovals'
import {
  useActions,
  type ActionCategory,
  type ActionConfig,
  type ActionLogItem,
  type ActionStat,
  type PendingApproval,
} from '@/hooks/useActions'
import { usePlan } from '@/hooks/usePlan'

type CategoryFilter = 'all' | ActionCategory

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'account', label: 'Account' },
  { value: 'custom', label: 'Custom' },
]

function templateToAction(payload: ActionBuilderPayload): ActionConfig {
  return {
    id: '__template__',
    name: payload.name,
    displayName: payload.displayName,
    description: payload.description,
    method: payload.method,
    urlTemplate: payload.urlTemplate,
    headersTemplate: payload.headersTemplate,
    bodyTemplate: payload.bodyTemplate,
    responsePath: payload.responsePath,
    responseTemplate: payload.responseTemplate,
    parameters: payload.parameters,
    requiresConfirmation: payload.requiresConfirmation,
    humanApprovalRequired: payload.humanApprovalRequired,
    timeoutSeconds: payload.timeoutSeconds,
    isActive: payload.isActive,
    category: payload.category,
    secretKeys: [],
    executionCount: 0,
  }
}

function statusTone(status: string): string {
  if (status === 'success') return 'bg-emerald-100 text-emerald-700'
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700'
  if (status === 'pending_confirmation') return 'bg-blue-100 text-blue-700'
  if (status === 'timeout') return 'bg-orange-100 text-orange-700'
  if (status === 'failed') return 'bg-rose-100 text-rose-700'
  if (status === 'rejected') return 'bg-zinc-200 text-zinc-700'
  return 'bg-muted text-muted-foreground'
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatMs(value: number | null | undefined): string {
  if (typeof value !== 'number') return '--'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(2)}s`
}

function readableStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

function failureReason(log: ActionLogItem): string | null {
  return log.failureReason ?? log.error_message ?? null
}

function SecretRotationPanel({
  action,
  disabled,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  action: ActionConfig
  disabled: boolean
  saving: boolean
  deleting: boolean
  onSave: (input: { actionId: string; keyName: string; keyValue: string }) => Promise<void>
  onDelete: (input: { actionId: string; keyName: string }) => Promise<void>
}) {
  const [keyName, setKeyName] = useState(action.secretKeys[0] ?? 'apiKey')
  const [keyValue, setKeyValue] = useState('')

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <KeyRoundIcon className="size-3.5 text-primary" />
            Secrets
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Values are encrypted. Existing values are never displayed.
          </p>
        </div>
        <Badge variant="outline">{action.secretKeys.length} key(s)</Badge>
      </div>

      {action.secretKeys.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {action.secretKeys.map((key) => (
            <Badge key={key} variant="secondary" className="gap-1">
              {key}
              <button
                type="button"
                disabled={disabled || deleting}
                onClick={() => void onDelete({ actionId: action.id, keyName: key })}
                className="ml-1 rounded-sm text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Delete ${key}`}
              >
                x
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-[0.85fr_1fr_auto]">
        <Input
          value={keyName}
          onChange={(event) => setKeyName(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
          placeholder="apiKey"
          disabled={disabled}
          className="h-8 text-xs"
        />
        <Input
          value={keyValue}
          onChange={(event) => setKeyValue(event.target.value)}
          placeholder="Paste new secret value"
          type="password"
          disabled={disabled}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          disabled={disabled || saving || !keyName.trim() || !keyValue.trim()}
          onClick={async () => {
            await onSave({ actionId: action.id, keyName, keyValue })
            setKeyValue('')
          }}
          className="h-8"
        >
          {saving ? 'Saving...' : 'Rotate'}
        </Button>
      </div>
    </div>
  )
}

function OutboundAllowlistCard({
  entries,
  effectiveEntries,
  envManagedCount,
  disabled,
  saving,
  onSave,
}: {
  entries: string[]
  effectiveEntries: string[]
  envManagedCount: number
  disabled: boolean
  saving: boolean
  onSave: (entries: string[]) => Promise<void>
}) {
  const [draft, setDraft] = useState(entries.join('\n'))

  useEffect(() => {
    setDraft(entries.join('\n'))
  }, [entries])

  const parsedEntries = draft
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GlobeLockIcon className="size-4 text-primary" />
          Domain Allowlist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          Restrict outbound action requests to trusted domains. Use one host per line,
          for example <span className="font-mono">api.yourapp.com</span> or{' '}
          <span className="font-mono">*.stripe.com</span>.
        </p>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          disabled={disabled}
          placeholder="api.yourapp.com&#10;api.stripe.com"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {effectiveEntries.length === 0 ? (
            <Badge variant="outline">No custom allowlist</Badge>
          ) : (
            effectiveEntries.slice(0, 8).map((entry) => (
              <Badge key={entry} variant="outline">{entry}</Badge>
            ))
          )}
          {envManagedCount > 0 && (
            <Badge variant="secondary">{envManagedCount} env-managed</Badge>
          )}
        </div>
        <Button
          size="sm"
          disabled={disabled || saving}
          onClick={() => void onSave(parsedEntries)}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Allowlist'}
        </Button>
      </CardContent>
    </Card>
  )
}

function ActionUsageAnalytics({ stats }: { stats: ActionStat[] }) {
  const totals = stats.reduce(
    (acc, stat) => {
      acc.executions += stat.executions ?? 0
      acc.success += stat.success ?? 0
      acc.failed += stat.failed ?? 0
      acc.timeout += stat.timeout ?? 0
      acc.pending += stat.pending ?? 0
      acc.retryCount += stat.retryCount ?? 0
      return acc
    },
    { executions: 0, success: 0, failed: 0, timeout: 0, pending: 0, retryCount: 0 }
  )

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3Icon className="size-4 text-primary" />
          Usage Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Success', totals.success],
            ['Failed', totals.failed],
            ['Timeout', totals.timeout],
            ['Pending', totals.pending],
            ['Retries', totals.retryCount],
            ['Total', totals.executions],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-muted/20 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {stats.slice(0, 5).map((stat) => (
            <div key={stat.actionId} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium">{stat.displayName}</p>
                <Badge variant="outline">{stat.successRate}%</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {stat.executions} runs · {formatMs(stat.avgDurationMs)} avg
                {stat.lastRunAt ? ` · last ${formatDistanceToNow(new Date(stat.lastRunAt), { addSuffix: true })}` : ''}
              </p>
            </div>
          ))}
          {stats.length === 0 && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              No action usage yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ExecutionLogsPanel({
  logs,
  retryingLogId,
  disabled,
  onRetry,
}: {
  logs: ActionLogItem[]
  retryingLogId: string | null
  disabled: boolean
  onRetry: (logId: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Execution Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No execution logs yet.</p>
        ) : (
          logs.slice(0, 12).map((log) => {
            const expanded = expandedId === log.id
            const reason = failureReason(log)
            const retrying = retryingLogId === log.id

            return (
              <div key={log.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {log.ai_actions?.display_name ?? log.ai_actions?.name ?? 'Action'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="size-3" />
                        {formatMs(log.durationMs)}
                      </span>
                      {log.statusCode && <span>HTTP {log.statusCode}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusTone(log.status)}>{readableStatus(log.status)}</Badge>
                    {log.retryable && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled || retrying}
                        onClick={() => void onRetry(log.id)}
                        className="h-7 gap-1"
                      >
                        <RotateCwIcon className="size-3" />
                        {retrying ? 'Retrying...' : 'Retry'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      className="h-7"
                    >
                      {expanded ? 'Hide' : 'Details'}
                    </Button>
                  </div>
                </div>

                {reason && (
                  <div className="mt-2 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>{reason}</span>
                  </div>
                )}

                {expanded && (
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Request</Label>
                      <Textarea
                        readOnly
                        value={prettyJson(log.request_payload ?? {})}
                        className="min-h-[150px] font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Response</Label>
                      <Textarea
                        readOnly
                        value={prettyJson(log.response_raw ?? log.response_parsed ?? log.error_message ?? null)}
                        className="min-h-[150px] font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export function AIActionsAdminPage() {
  const { canUse, isPlanLoading } = usePlan()
  const canUseActions = canUse('aiActions')
  const actionsEnabled = !isPlanLoading
  const isPreviewMode = !isPlanLoading && !canUseActions
  const {
    actions,
    actionStats,
    actionLogs,
    pendingApprovals,
    outboundAllowlist,
    loading,
    createAction,
    updateAction,
    deleteAction,
    setActionSecret,
    deleteActionSecret,
    testAction,
    previewActionExecution,
    retryActionLog,
    updateOutboundAllowlist,
    approveAction,
    rejectAction,
    isError,
    error: loadError,
    refetch,
  } = useActions({ enabled: actionsEnabled })

  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [builderSeed, setBuilderSeed] = useState<ActionConfig | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testTarget, setTestTarget] = useState<ActionConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvingLogId, setApprovingLogId] = useState<string | null>(null)
  const [rejectingLogId, setRejectingLogId] = useState<string | null>(null)
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null)

  const filteredActions = useMemo(() => {
    if (filter === 'all') return actions
    return actions.filter((action) => action.category === filter)
  }, [actions, filter])

  const statByAction = useMemo(() => {
    return new Map(
      actionStats.map((stat: ActionStat) => [
        stat.actionId,
        {
          executions: stat.executions ?? 0,
          success: stat.success ?? 0,
          failed: stat.failed ?? 0,
          timeout: stat.timeout ?? 0,
          pending: stat.pending ?? 0,
          retryCount: stat.retryCount ?? 0,
          lastRunAt: stat.lastRunAt ?? null,
          lastStatus: stat.lastStatus ?? null,
          successRate: stat.successRate ?? 0,
          avgDurationMs:
            typeof stat.avgDurationMs === 'number' ? stat.avgDurationMs : null,
        },
      ])
    )
  }, [actionStats])

  const aggregateStats = useMemo(() => {
    const totalExecutions = actionStats.reduce(
      (sum: number, stat: ActionStat) => sum + (stat.executions ?? 0),
      0
    )

    const weightedSuccessTotal = actionStats.reduce(
      (sum: number, stat: ActionStat) =>
        sum + (stat.executions ?? 0) * (stat.successRate ?? 0),
      0
    )
    const successRate =
      totalExecutions > 0
        ? Number((weightedSuccessTotal / totalExecutions).toFixed(2))
        : 0

    const withDuration = actionStats.filter(
      (stat: ActionStat) => typeof stat.avgDurationMs === 'number'
    ) as Array<ActionStat & { avgDurationMs: number }>
    const avgDurationMs =
      withDuration.length > 0
        ? Math.round(
            withDuration.reduce((sum, stat) => sum + stat.avgDurationMs, 0) /
              withDuration.length
          )
        : null

    return {
      totalExecutions,
      successRate,
      avgDurationMs,
      failedExecutions: actionStats.reduce(
        (sum: number, stat: ActionStat) => sum + (stat.failed ?? 0) + (stat.timeout ?? 0),
        0
      ),
    }
  }, [actionStats])

  const pendingApprovalItems = useMemo(() => {
    return (pendingApprovals ?? []).map((item: PendingApproval) => ({
      id: item.id,
      logId: item.logId,
      conversationId: item.conversationId,
      actionName: item.actionName || 'Action',
      parameters:
        item.parameters && typeof item.parameters === 'object'
          ? (item.parameters as Record<string, unknown>)
          : null,
      requestedAt: item.requestedAt,
      expiresAt: item.expiresAt ? item.expiresAt : null,
    })) as PendingApprovalItem[]
  }, [pendingApprovals])

  const currentBuilderAction = useMemo(() => {
    if (!builderSeed) return null
    return builderSeed
  }, [builderSeed])

  const openCreate = () => {
    setError(null)
    setEditingActionId(null)
    setBuilderSeed(null)
    setBuilderOpen(true)
  }

  const openEdit = (action: ActionConfig) => {
    setError(null)
    setEditingActionId(action.id)
    setBuilderSeed(action)
    setBuilderOpen(true)
  }

  const openTest = (action: ActionConfig) => {
    setTestTarget(action)
    setTestOpen(true)
  }

  const importTemplate = (payload: ActionBuilderPayload) => {
    setError(null)
    setEditingActionId(null)
    setBuilderSeed(templateToAction(payload))
    setBuilderOpen(true)
  }

  const handleSave = async (payload: ActionBuilderPayload) => {
    if (isPreviewMode) {
      setError('AI Actions are in preview mode on this plan. Upgrade to Pro to save and run actions.')
      return
    }

    setError(null)
    try {
      if (editingActionId) {
        await updateAction.mutateAsync({
          id: editingActionId,
          data: payload,
        })
      } else {
        await createAction.mutateAsync(payload)
      }
      toast.success(editingActionId ? 'Action updated' : 'Action created', {
        description: 'The AI assistant will use this action when it matches a customer request.',
      })
      setBuilderSeed(null)
      setEditingActionId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save action.')
      throw err
    }
  }

  const runTest = async (
    parameters: Record<string, unknown>
  ): Promise<ActionTestResult> => {
    if (isPreviewMode) {
      throw new Error('AI Actions are in preview mode on this plan. Upgrade to Pro to run tests.')
    }

    if (!testTarget || !testTarget.id || testTarget.id === '__template__') {
      throw new Error('Save the action first, then run a test.')
    }
    const result = await testAction.mutateAsync({
      id: testTarget.id,
      testParameters: parameters,
    })
    toast.success(result.success ? 'Action test completed' : 'Action test returned an error', {
      description: result.success ? 'Review the rendered request and response before enabling it.' : result.error ?? 'The endpoint responded but did not pass validation.',
    })
    return {
      success: result.success,
      responseData: result.responseData,
      formattedResult: result.formattedResult,
      error: result.error,
      durationMs: result.durationMs,
      request: result.request,
    }
  }

  const previewTest = async (
    parameters: Record<string, unknown>
  ): Promise<ActionTestResult> => {
    if (isPreviewMode) {
      throw new Error('AI Actions are in preview mode on this plan. Upgrade to Pro to preview live saved actions.')
    }

    if (!testTarget || !testTarget.id || testTarget.id === '__template__') {
      throw new Error('Save the action first, then preview execution.')
    }

    const result = await previewActionExecution.mutateAsync({
      id: testTarget.id,
      testParameters: parameters,
    })

    return {
      success: true,
      responseData: result.safety,
      formattedResult: 'Execution preview generated. No network request was sent.',
      error: null,
      durationMs: 0,
      request: result.request,
    }
  }

  const handleRetryLog = async (logId: string) => {
    if (isPreviewMode) {
      setError('AI Actions are in preview mode on this plan. Upgrade to Pro to retry failed executions.')
      return
    }

    setRetryingLogId(logId)
    try {
      const result = await retryActionLog.mutateAsync({ logId })
      toast.success(result.success ? 'Action retry succeeded' : 'Action retry failed', {
        description: result.message,
      })
    } finally {
      setRetryingLogId(null)
    }
  }

  const handleRotateSecret = async (input: {
    actionId: string
    keyName: string
    keyValue: string
  }) => {
    if (isPreviewMode) {
      setError('AI Actions are in preview mode on this plan. Upgrade to Pro to rotate secrets.')
      return
    }

    await setActionSecret.mutateAsync(input)
    toast.success('Secret rotated', {
      description: `${input.keyName} was encrypted and saved.`,
    })
  }

  const handleDeleteSecret = async (input: {
    actionId: string
    keyName: string
  }) => {
    if (isPreviewMode) return
    if (!confirm(`Delete secret "${input.keyName}"?`)) return

    await deleteActionSecret.mutateAsync(input)
    toast.success('Secret deleted')
  }

  const handleSaveAllowlist = async (entries: string[]) => {
    if (isPreviewMode) {
      setError('AI Actions are in preview mode on this plan. Upgrade to Pro to update the allowlist.')
      return
    }

    await updateOutboundAllowlist.mutateAsync({ entries })
    toast.success('Outbound allowlist saved')
  }

  const handleApprove = async (logId: string) => {
    if (isPreviewMode) {
      setError('AI Actions are in preview mode on this plan. Upgrade to Pro to approve executions.')
      return
    }

    setApprovingLogId(logId)
    try {
      await approveAction.mutateAsync({ logId })
      toast.success('Action approved')
    } finally {
      setApprovingLogId(null)
    }
  }

  const handleReject = async (logId: string) => {
    setRejectingLogId(logId)
    try {
      await rejectAction.mutateAsync({ logId })
      toast.success('Action rejected')
    } finally {
      setRejectingLogId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BotIcon className="size-6 text-primary" />
            AI Actions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure single-step API actions for the AI assistant with secrets,
            confirmations, approval gates, and execution logs.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">Single-step APIs</Badge>
            <Badge variant="outline">Encrypted secrets</Badge>
            <Badge variant="outline">Approval gates</Badge>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <PlusIcon className="size-4" />
          {isPreviewMode ? 'Preview Builder' : 'New Action'}
        </Button>
      </div>

      {isPreviewMode && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
          <LockIcon className="size-4 text-amber-700 dark:text-amber-300" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            AI Actions are in preview mode on Free and Starter. You can explore templates and existing setup, but saving, testing, deleting, and approvals require Pro.
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <LaunchErrorState
          error={loadError}
          title="AI Actions could not be loaded"
          onRetry={() => void refetch()}
          docsHref="/docs/ai/actions-v1"
        />
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Executions
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.totalExecutions}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Success Rate
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.successRate}%
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Avg Duration
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.avgDurationMs === null
                ? '--'
                : `${(aggregateStats.avgDurationMs / 1000).toFixed(2)}s`}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Failed / Timeout
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.failedExecutions}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? 'default' : 'outline'}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error && (
        <LaunchInlineError error={error} docsHref="/docs/ai/actions-v1" />
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {loading ? (
            <Card className="shadow-none">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading actions...
              </CardContent>
            </Card>
          ) : filteredActions.length === 0 ? (
            <Card className="shadow-none">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No actions found for this filter.
              </CardContent>
            </Card>
          ) : (
            filteredActions.map((action) => {
              const actionStat = statByAction.get(action.id) ?? {
                executions: action.executionCount ?? 0,
                success: 0,
                failed: 0,
                timeout: 0,
                pending: 0,
                retryCount: 0,
                lastRunAt: null,
                lastStatus: null,
                successRate: 0,
                avgDurationMs: null,
              }

              return (
                <Card
                  key={action.id}
                  className="shadow-none transition-colors hover:border-primary/30"
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {action.displayName}
                          </h3>
                          <Badge
                            variant={action.isActive ? 'default' : 'secondary'}
                            className="h-5 text-[10px]"
                          >
                            {action.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {action.humanApprovalRequired && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              Approval
                            </Badge>
                          )}
                          {action.requiresConfirmation && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              Confirmation
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="uppercase">
                        {action.category}
                      </Badge>
                    </div>

                    <div className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs">
                      <span className="font-semibold">{action.method}</span>{' '}
                      {action.urlTemplate}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{actionStat.executions} executions</span>
                      <span>{actionStat.successRate}% success</span>
                      <span>{actionStat.failed ?? 0} failed</span>
                      <span>{actionStat.timeout ?? 0} timed out</span>
                      <span>
                        {actionStat.avgDurationMs === null
                          ? '--'
                          : `${(actionStat.avgDurationMs / 1000).toFixed(2)}s avg`}
                      </span>
                      <span>{action.secretKeys.length} secret keys</span>
                    </div>

                    <SecretRotationPanel
                      action={action}
                      disabled={isPreviewMode}
                      saving={setActionSecret.isPending}
                      deleting={deleteActionSecret.isPending}
                      onSave={handleRotateSecret}
                      onDelete={handleDeleteSecret}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTest(action)}
                        className="gap-1.5"
                        disabled={isPreviewMode}
                      >
                        <FlaskConicalIcon className="size-3.5" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(action)}
                        className="gap-1.5"
                      >
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        disabled={isPreviewMode}
                        onClick={async () => {
                          if (!confirm(`Delete action "${action.displayName}"?`)) {
                            return
                          }
                          await deleteAction.mutateAsync({ id: action.id })
                          toast.success('Action deleted')
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}

          <ExecutionLogsPanel
            logs={actionLogs ?? []}
            retryingLogId={retryingLogId}
            disabled={isPreviewMode}
            onRetry={handleRetryLog}
          />
        </div>

        <div className="space-y-4">
          <OutboundAllowlistCard
            entries={outboundAllowlist.orgEntries}
            effectiveEntries={outboundAllowlist.effectiveEntries}
            envManagedCount={outboundAllowlist.envManagedCount}
            disabled={isPreviewMode}
            saving={updateOutboundAllowlist.isPending}
            onSave={handleSaveAllowlist}
          />

          <ActionUsageAnalytics stats={actionStats} />

          <PendingApprovals
            items={pendingApprovalItems}
            approvingLogId={approvingLogId}
            rejectingLogId={rejectingLogId}
            onApprove={handleApprove}
            onReject={handleReject}
            disabled={isPreviewMode}
          />

          <ActionTemplates onImport={importTemplate} importLabel={isPreviewMode ? 'Preview' : 'Import'} />
        </div>
      </div>

      <ActionBuilder
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open)
          if (!open) {
            setBuilderSeed(null)
            setEditingActionId(null)
          }
        }}
        initialAction={currentBuilderAction}
        loading={createAction.isPending || updateAction.isPending}
        onSave={handleSave}
        readOnly={isPreviewMode}
        onTest={() => {
          if (editingActionId) {
            const existing = actions.find((action) => action.id === editingActionId)
            if (existing) {
              openTest(existing)
              return
            }
          }
          setError('Save this action first, then run tests.')
        }}
      />

      <ActionTestPanel
        open={testOpen}
        onOpenChange={setTestOpen}
        actionName={testTarget?.displayName ?? 'Action'}
        parameters={testTarget?.parameters ?? []}
        onRunTest={runTest}
        onPreview={previewTest}
      />
    </div>
  )
}
