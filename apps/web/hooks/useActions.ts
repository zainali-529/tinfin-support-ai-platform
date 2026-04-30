'use client'

import { trpc } from '@/lib/trpc'

export type ActionCategory = 'ecommerce' | 'scheduling' | 'account' | 'custom'

export interface ActionParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  description: string
  required: boolean
  enumValues?: string[]
  extractionHint?: string
}

export interface ActionConfig {
  id: string
  name: string
  displayName: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  urlTemplate: string
  headersTemplate: Record<string, string>
  bodyTemplate: string | null
  responsePath: string | null
  responseTemplate: string | null
  parameters: ActionParameter[]
  requiresConfirmation: boolean
  humanApprovalRequired: boolean
  timeoutSeconds: number
  isActive: boolean
  category: ActionCategory
  secretKeys: string[]
  executionCount: number
}

export interface ActionStat {
  actionId: string
  name: string
  displayName: string
  executions: number
  successRate: number
  avgDurationMs: number | null
}

export interface ActionLogItem {
  id: string
  action_id: string
  conversation_id: string | null
  contact_id: string | null
  status: string
  response_parsed: string | null
  error_message: string | null
  created_at: string
  ai_actions?: {
    name?: string
    display_name?: string
  } | null
}

export interface PendingApproval {
  id: string
  logId: string
  conversationId: string | null
  actionName: string
  parameters: Record<string, unknown> | null
  requestedAt: string
  expiresAt: string | null
  log?: Record<string, unknown>
}

export function useActions() {
  const utils = trpc.useUtils()

  const actionsQuery = trpc.actions.getActions.useQuery(undefined, {
    staleTime: 20_000,
  })

  const statsQuery = trpc.actions.getActionStats.useQuery(undefined, {
    staleTime: 20_000,
  })

  const logsQuery = trpc.actions.getActionLogs.useQuery(
    { limit: 50, offset: 0 },
    { staleTime: 20_000 }
  )

  const pendingApprovalsQuery = trpc.actions.getPendingApprovals.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const invalidate = async () => {
    await Promise.all([
      utils.actions.getActions.invalidate(),
      utils.actions.getActionStats.invalidate(),
      utils.actions.getActionLogs.invalidate(),
      utils.actions.getPendingApprovals.invalidate(),
    ])
  }

  const createAction = trpc.actions.createAction.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const updateAction = trpc.actions.updateAction.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const deleteAction = trpc.actions.deleteAction.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const setActionSecret = trpc.actions.setActionSecret.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const deleteActionSecret = trpc.actions.deleteActionSecret.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const testAction = trpc.actions.testAction.useMutation()

  const approveAction = trpc.actions.approveAction.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  const rejectAction = trpc.actions.rejectAction.useMutation({
    onSuccess: () => {
      void invalidate()
    },
  })

  return {
    actions: (actionsQuery.data ?? []) as unknown as ActionConfig[],
    actionStats: (statsQuery.data ?? []) as ActionStat[],
    actionLogs: (logsQuery.data?.items ?? []) as ActionLogItem[],
    pendingApprovals: (pendingApprovalsQuery.data ?? []) as PendingApproval[],
    loading:
      actionsQuery.isLoading ||
      statsQuery.isLoading ||
      logsQuery.isLoading ||
      pendingApprovalsQuery.isLoading,
    createAction,
    updateAction,
    deleteAction,
    setActionSecret,
    deleteActionSecret,
    testAction,
    approveAction,
    rejectAction,
    refetch: invalidate,
  }
}
