'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Trash2Icon, PlusIcon, PencilIcon, FlaskConicalIcon, BotIcon } from 'lucide-react'
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

export function AIActionsAdminPage() {
  const {
    actions,
    actionStats,
    actionLogs,
    pendingApprovals,
    loading,
    createAction,
    updateAction,
    deleteAction,
    testAction,
    approveAction,
    rejectAction,
  } = useActions()

  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [builderSeed, setBuilderSeed] = useState<ActionConfig | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testTarget, setTestTarget] = useState<ActionConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvingLogId, setApprovingLogId] = useState<string | null>(null)
  const [rejectingLogId, setRejectingLogId] = useState<string | null>(null)

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
    if (!testTarget || !testTarget.id || testTarget.id === '__template__') {
      throw new Error('Save the action first, then run a test.')
    }
    const result = await testAction.mutateAsync({
      id: testTarget.id,
      testParameters: parameters,
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BotIcon className="size-6 text-primary" />
            AI Actions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Actions let your AI take real steps for customers.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <PlusIcon className="size-4" />
          New Action
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Executions
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.totalExecutions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Success Rate
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {aggregateStats.successRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
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
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading actions...
              </CardContent>
            </Card>
          ) : filteredActions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No actions found for this filter.
              </CardContent>
            </Card>
          ) : (
            filteredActions.map((action) => {
              const actionStat = statByAction.get(action.id) ?? {
                executions: action.executionCount ?? 0,
                successRate: 0,
                avgDurationMs: null,
              }

              return (
                <Card key={action.id}>
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
                      <span>
                        {actionStat.avgDurationMs === null
                          ? '--'
                          : `${(actionStat.avgDurationMs / 1000).toFixed(2)}s avg`}
                      </span>
                      <span>{action.secretKeys.length} secret keys</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTest(action)}
                        className="gap-1.5"
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
                        onClick={async () => {
                          if (!confirm(`Delete action "${action.displayName}"?`)) {
                            return
                          }
                          await deleteAction.mutateAsync({ id: action.id })
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Executions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(actionLogs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No execution logs yet.</p>
              ) : (
                actionLogs.slice(0, 10).map((log: ActionLogItem) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {log.ai_actions?.display_name ?? log.ai_actions?.name ?? 'Action'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge className={statusTone(log.status)}>
                      {log.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <PendingApprovals
            items={pendingApprovalItems}
            approvingLogId={approvingLogId}
            rejectingLogId={rejectingLogId}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          <ActionTemplates onImport={importTemplate} />
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
      />
    </div>
  )
}
