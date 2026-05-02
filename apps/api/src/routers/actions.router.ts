import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  decryptActionSecret,
  encryptActionSecret,
  executeAction,
  executeApprovedAction,
  formatActionResponse,
  resolveActionOutboundAllowlist,
  type ActionConfig,
  type ActionParameter,
  validateActionUrlTemplate,
} from '@workspace/ai'
import {
  requireAdminFromContext,
  requirePermissionFromContext,
} from '../lib/org-permissions'
import { protectedProcedure, router } from '../trpc/trpc'

const ACTION_NAME_REGEX = /^[a-z][a-z0-9_]*$/
const TEMPLATE_IDENTIFIER_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/

const actionParameterSchema = z.object({
  name: z.string().regex(TEMPLATE_IDENTIFIER_REGEX),
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  description: z.string().min(1).max(500),
  required: z.boolean().default(false),
  enumValues: z.array(z.string().min(1).max(100)).optional().default([]),
  extractionHint: z.string().max(500).optional(),
})

const actionMutationSchema = z.object({
  name: z.string().regex(ACTION_NAME_REGEX),
  displayName: z.string().min(2).max(120),
  description: z.string().min(5).max(1000),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  urlTemplate: z.string().min(5).max(2000),
  headersTemplate: z.record(z.string(), z.string()).default({}),
  bodyTemplate: z.string().max(8000).nullable().optional(),
  responsePath: z.string().max(300).nullable().optional(),
  responseTemplate: z.string().max(2000).nullable().optional(),
  parameters: z.array(actionParameterSchema).max(25).default([]),
  requiresConfirmation: z.boolean().default(false),
  humanApprovalRequired: z.boolean().default(false),
  timeoutSeconds: z.number().int().min(3).max(60).default(10),
  isActive: z.boolean().default(true),
  category: z
    .enum(['ecommerce', 'scheduling', 'account', 'custom'])
    .default('custom'),
})

function normalizeParameters(
  parameters: unknown
): ActionParameter[] {
  if (!Array.isArray(parameters)) return []
  const output: ActionParameter[] = []

  for (const item of parameters) {
    const parsed = actionParameterSchema.safeParse(item)
    if (!parsed.success) continue
    output.push({
      ...parsed.data,
      enumValues: parsed.data.enumValues ?? [],
    })
  }

  return output
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

async function getOrgOutboundAllowlist(
  supabase: any,
  orgId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load organization settings: ${error.message}`,
    })
  }

  return resolveActionOutboundAllowlist(data?.settings ?? null)
}

function validateUrlTemplate(urlTemplate: string, allowlist: string[]): void {
  try {
    validateActionUrlTemplate(urlTemplate, allowlist)
  } catch (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        error instanceof Error ? error.message : 'Invalid URL template.',
    })
  }
}

function toActionResponse(
  action: Record<string, unknown>,
  secretKeys: string[],
  executionCount = 0
): Record<string, unknown> {
  return {
    id: action.id,
    orgId: action.org_id,
    name: action.name,
    displayName: action.display_name,
    description: action.description,
    method: action.method,
    urlTemplate: action.url_template,
    headersTemplate: asRecord(action.headers_template),
    bodyTemplate: asString(action.body_template),
    responsePath: asString(action.response_path),
    responseTemplate: asString(action.response_template),
    parameters: normalizeParameters(action.parameters),
    requiresConfirmation: action.requires_confirmation === true,
    humanApprovalRequired: action.human_approval_required === true,
    timeoutSeconds:
      typeof action.timeout_seconds === 'number' ? action.timeout_seconds : 10,
    isActive: action.is_active !== false,
    category: asString(action.category) ?? 'custom',
    createdAt: action.created_at,
    updatedAt: action.updated_at,
    secretKeys,
    executionCount,
  }
}

async function loadActionWithSecretsForOrg(
  supabase: any,
  orgId: string,
  actionId: string
): Promise<ActionConfig | null> {
  const { data: row, error: rowError } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', actionId)
    .maybeSingle()

  if (rowError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load action: ${rowError.message}`,
    })
  }

  if (!row) return null

  const outboundAllowlist = await getOrgOutboundAllowlist(supabase, orgId)

  const { data: secrets, error: secretError } = await supabase
    .from('ai_action_secrets')
    .select('key_name, key_value')
    .eq('action_id', actionId)

  if (secretError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load action secrets: ${secretError.message}`,
    })
  }

  const secretsMap: Record<string, string> = {}
  for (const secret of (secrets ?? []) as Record<string, unknown>[]) {
    const keyName = asString(secret.key_name)
    const rawValue = typeof secret.key_value === 'string' ? secret.key_value : null
    if (!keyName || !rawValue) continue

    try {
      secretsMap[keyName] = decryptActionSecret(rawValue)
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          error instanceof Error
            ? `Failed to decrypt action secret "${keyName}": ${error.message}`
            : `Failed to decrypt action secret "${keyName}".`,
      })
    }
  }

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string,
    method: row.method as string,
    urlTemplate: row.url_template as string,
    headersTemplate: asRecord(row.headers_template) as Record<string, string>,
    bodyTemplate: asString(row.body_template),
    responsePath: asString(row.response_path),
    responseTemplate: asString(row.response_template),
    parameters: normalizeParameters(row.parameters),
    requiresConfirmation: row.requires_confirmation === true,
    humanApprovalRequired: row.human_approval_required === true,
    timeoutSeconds:
      typeof row.timeout_seconds === 'number' ? row.timeout_seconds : 10,
    isActive: row.is_active !== false,
    category: asString(row.category) ?? 'custom',
    secrets: secretsMap,
    outboundAllowlist,
  }
}

function ensureAdmin(ctx: { userRole: string; userPermissions: any }): void {
  requireAdminFromContext(ctx, 'Admin access is required for AI Actions.')
}

export const actionsRouter = router({
  getActions: protectedProcedure.query(async ({ ctx }) => {
    ensureAdmin(ctx)

    const orgId = ctx.userOrgId

    const [actionsResult, logsResult] = await Promise.all([
      ctx.supabase
        .from('ai_actions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from('ai_action_logs')
        .select('action_id')
        .eq('org_id', orgId)
        .gte(
          'created_at',
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ),
    ])

    if (actionsResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load actions: ${actionsResult.error.message}`,
      })
    }

    if (logsResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load action logs: ${logsResult.error.message}`,
      })
    }

    const rows = (actionsResult.data ?? []) as Record<string, unknown>[]
    const actionIds = rows.map((row) => row.id as string)

    const secretRows: Record<string, unknown>[] = []
    if (actionIds.length > 0) {
      const { data: secrets, error: secretsError } = await ctx.supabase
        .from('ai_action_secrets')
        .select('action_id, key_name')
        .in('action_id', actionIds)

      if (secretsError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load action secrets: ${secretsError.message}`,
        })
      }

      secretRows.push(...((secrets ?? []) as Record<string, unknown>[]))
    }

    const keysByAction = new Map<string, string[]>()
    for (const row of secretRows) {
      const actionId = row.action_id as string
      const current = keysByAction.get(actionId) ?? []
      current.push(row.key_name as string)
      keysByAction.set(actionId, current)
    }

    const logCounts = new Map<string, number>()
    for (const row of (logsResult.data ?? []) as Record<string, unknown>[]) {
      const actionId = row.action_id as string
      logCounts.set(actionId, (logCounts.get(actionId) ?? 0) + 1)
    }

    return rows.map((row) =>
      toActionResponse(
        row,
        keysByAction.get(row.id as string) ?? [],
        logCounts.get(row.id as string) ?? 0
      )
    )
  }),

  getAction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const { data: actionRow, error: actionError } = await ctx.supabase
        .from('ai_actions')
        .select('*')
        .eq('org_id', ctx.userOrgId)
        .eq('id', input.id)
        .maybeSingle()

      if (actionError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load action: ${actionError.message}`,
        })
      }

      if (!actionRow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action not found.',
        })
      }

      const { data: secrets, error: secretError } = await ctx.supabase
        .from('ai_action_secrets')
        .select('key_name')
        .eq('action_id', input.id)

      if (secretError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load action secrets: ${secretError.message}`,
        })
      }

      return toActionResponse(
        actionRow as Record<string, unknown>,
        (secrets ?? []).map((row: Record<string, unknown>) => row.key_name as string)
      )
    }),

  createAction: protectedProcedure
    .input(actionMutationSchema)
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const orgId = ctx.userOrgId

      const outboundAllowlist = await getOrgOutboundAllowlist(ctx.supabase, orgId)
      validateUrlTemplate(input.urlTemplate, outboundAllowlist)

      const { count, error: countError } = await ctx.supabase
        .from('ai_actions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)

      if (countError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to validate action limit: ${countError.message}`,
        })
      }

      if ((count ?? 0) >= 20) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Maximum 20 actions are allowed per organization.',
        })
      }

      const payload = {
        org_id: orgId,
        name: input.name,
        display_name: input.displayName,
        description: input.description,
        method: input.method,
        url_template: input.urlTemplate,
        headers_template: input.headersTemplate,
        body_template: input.bodyTemplate ?? null,
        response_path: input.responsePath ?? null,
        response_template: input.responseTemplate ?? null,
        parameters: input.parameters,
        requires_confirmation: input.requiresConfirmation,
        human_approval_required: input.humanApprovalRequired,
        timeout_seconds: input.timeoutSeconds,
        is_active: input.isActive,
        category: input.category,
      }

      const { data, error } = await ctx.supabase
        .from('ai_actions')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to create action: ${error.message}`,
        })
      }

      return toActionResponse(data as Record<string, unknown>, [])
    }),

  updateAction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: actionMutationSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      if (input.data.urlTemplate) {
        const outboundAllowlist = await getOrgOutboundAllowlist(
          ctx.supabase,
          ctx.userOrgId
        )
        validateUrlTemplate(input.data.urlTemplate, outboundAllowlist)
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (input.data.name !== undefined) payload.name = input.data.name
      if (input.data.displayName !== undefined)
        payload.display_name = input.data.displayName
      if (input.data.description !== undefined)
        payload.description = input.data.description
      if (input.data.method !== undefined) payload.method = input.data.method
      if (input.data.urlTemplate !== undefined)
        payload.url_template = input.data.urlTemplate
      if (input.data.headersTemplate !== undefined)
        payload.headers_template = input.data.headersTemplate
      if (input.data.bodyTemplate !== undefined)
        payload.body_template = input.data.bodyTemplate ?? null
      if (input.data.responsePath !== undefined)
        payload.response_path = input.data.responsePath ?? null
      if (input.data.responseTemplate !== undefined)
        payload.response_template = input.data.responseTemplate ?? null
      if (input.data.parameters !== undefined)
        payload.parameters = input.data.parameters
      if (input.data.requiresConfirmation !== undefined)
        payload.requires_confirmation = input.data.requiresConfirmation
      if (input.data.humanApprovalRequired !== undefined)
        payload.human_approval_required = input.data.humanApprovalRequired
      if (input.data.timeoutSeconds !== undefined)
        payload.timeout_seconds = input.data.timeoutSeconds
      if (input.data.isActive !== undefined)
        payload.is_active = input.data.isActive
      if (input.data.category !== undefined)
        payload.category = input.data.category

      const { data, error } = await ctx.supabase
        .from('ai_actions')
        .update(payload)
        .eq('org_id', ctx.userOrgId)
        .eq('id', input.id)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to update action: ${error.message}`,
        })
      }

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action not found.',
        })
      }

      const { data: secrets } = await ctx.supabase
        .from('ai_action_secrets')
        .select('key_name')
        .eq('action_id', input.id)

      return toActionResponse(
        data as Record<string, unknown>,
        (secrets ?? []).map((row: Record<string, unknown>) => row.key_name as string)
      )
    }),

  deleteAction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const { error } = await ctx.supabase
        .from('ai_actions')
        .delete()
        .eq('org_id', ctx.userOrgId)
        .eq('id', input.id)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete action: ${error.message}`,
        })
      }

      return { success: true }
    }),

  setActionSecret: protectedProcedure
    .input(
      z.object({
        actionId: z.string().uuid(),
        keyName: z.string().regex(TEMPLATE_IDENTIFIER_REGEX),
        keyValue: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const action = await loadActionWithSecretsForOrg(
        ctx.supabase,
        ctx.userOrgId,
        input.actionId
      )

      if (!action) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action not found.',
        })
      }

      let encryptedValue: string
      try {
        encryptedValue = encryptActionSecret(input.keyValue)
      } catch (error) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to encrypt action secret.',
        })
      }

      const { error } = await ctx.supabase.from('ai_action_secrets').upsert(
        {
          action_id: input.actionId,
          key_name: input.keyName,
          key_value: encryptedValue,
        },
        {
          onConflict: 'action_id,key_name',
        }
      )

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save action secret: ${error.message}`,
        })
      }

      return { success: true }
    }),

  deleteActionSecret: protectedProcedure
    .input(
      z.object({
        actionId: z.string().uuid(),
        keyName: z.string().regex(TEMPLATE_IDENTIFIER_REGEX),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const { error } = await ctx.supabase
        .from('ai_action_secrets')
        .delete()
        .eq('action_id', input.actionId)
        .eq('key_name', input.keyName)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete action secret: ${error.message}`,
        })
      }

      return { success: true }
    }),

  testAction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        testParameters: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      const action = await loadActionWithSecretsForOrg(
        ctx.supabase,
        ctx.userOrgId,
        input.id
      )

      if (!action) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action not found.',
        })
      }

      const startedAt = Date.now()
      const result = await executeAction(action, input.testParameters)
      const durationMs = Date.now() - startedAt

      const formattedResult = result.success
        ? await formatActionResponse(action, result.data)
        : null

      return {
        success: result.success,
        responseData: result.data,
        formattedResult,
        error: result.error ?? null,
        durationMs,
        request: result.requestPayload,
      }
    }),

  getActionLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        actionId: z.string().uuid().optional(),
        status: z.string().max(40).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      ensureAdmin(ctx)

      let query = ctx.supabase
        .from('ai_action_logs')
        .select('*, ai_actions(name, display_name)', { count: 'exact' })
        .eq('org_id', ctx.userOrgId)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)

      if (input.actionId) query = query.eq('action_id', input.actionId)
      if (input.status) query = query.eq('status', input.status)

      const { data, error, count } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch action logs: ${error.message}`,
        })
      }

      return {
        items: data ?? [],
        totalCount: count ?? 0,
        limit: input.limit,
        offset: input.offset,
      }
    }),

  getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(
      ctx,
      'inbox',
      'Inbox access is required to view pending approvals.'
    )

    const { data: approvals, error: approvalError } = await ctx.supabase
      .from('ai_action_approvals')
      .select('*')
      .order('requested_at', { ascending: false })

    if (approvalError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch pending approvals: ${approvalError.message}`,
      })
    }

    const approvalRows = (approvals ?? []) as Record<string, unknown>[]
    const logIds = approvalRows.map((row) => row.log_id as string)

    if (logIds.length === 0) return []

    const { data: logs, error: logsError } = await ctx.supabase
      .from('ai_action_logs')
      .select('id, org_id, action_id, conversation_id, contact_id, parameters_used, status, created_at')
      .eq('org_id', ctx.userOrgId)
      .in('id', logIds)

    if (logsError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch approval logs: ${logsError.message}`,
      })
    }

    const logsById = new Map<string, Record<string, unknown>>()
    for (const row of (logs ?? []) as Record<string, unknown>[]) {
      logsById.set(row.id as string, row)
    }

    return approvalRows
      .map((approval) => {
        const log = logsById.get(approval.log_id as string)
        if (!log) return null

        return {
          id: approval.id,
          logId: approval.log_id,
          conversationId: approval.conversation_id,
          actionName: approval.action_name,
          parameters: approval.parameters,
          requestedAt: approval.requested_at,
          expiresAt: approval.expires_at,
          log,
        }
      })
      .filter((row) => row !== null)
  }),

  approveAction: protectedProcedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(
        ctx,
        'inbox',
        'Inbox access is required to approve actions.'
      )

      const outcome = await executeApprovedAction(input.logId, ctx.user.id)

      if (outcome.conversationId && outcome.orgId) {
        await ctx.supabase.from('messages').insert({
          conversation_id: outcome.conversationId,
          org_id: outcome.orgId,
          role: 'assistant',
          content: outcome.message,
          attachments: [],
          ai_metadata: {
            actionLog: {
              logId: input.logId,
              actionName: outcome.actionName,
              status: outcome.success ? 'success' : 'failed',
            },
          },
        })
      }

      return outcome
    }),

  rejectAction: protectedProcedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(
        ctx,
        'inbox',
        'Inbox access is required to reject actions.'
      )

      const { data: logRow, error: logError } = await ctx.supabase
        .from('ai_action_logs')
        .select('id, org_id, conversation_id')
        .eq('id', input.logId)
        .eq('org_id', ctx.userOrgId)
        .maybeSingle()

      if (logError || !logRow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Action log not found.',
        })
      }

      const now = new Date().toISOString()

      await ctx.supabase
        .from('ai_action_logs')
        .update({
          status: 'rejected',
          approved_by: ctx.user.id,
          approved_at: now,
          executed_at: now,
          completed_at: now,
          error_message: 'Rejected by agent.',
        })
        .eq('id', input.logId)

      await ctx.supabase
        .from('ai_action_approvals')
        .delete()
        .eq('log_id', input.logId)

      if (logRow.conversation_id) {
        await ctx.supabase.from('messages').insert({
          conversation_id: logRow.conversation_id,
          org_id: ctx.userOrgId,
          role: 'assistant',
          content: 'This action request was rejected by a support agent.',
          attachments: [],
          ai_metadata: {
            actionLog: {
              logId: input.logId,
              actionName: null,
              status: 'rejected',
            },
          },
        })
      }

      return { success: true }
    }),

  getActionStats: protectedProcedure.query(async ({ ctx }) => {
    ensureAdmin(ctx)

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: logs, error: logsError } = await ctx.supabase
      .from('ai_action_logs')
      .select('action_id, status, request_payload, duration_ms')
      .eq('org_id', ctx.userOrgId)
      .gte('created_at', since)

    if (logsError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load action stats: ${logsError.message}`,
      })
    }

    const { data: actions, error: actionsError } = await ctx.supabase
      .from('ai_actions')
      .select('id, name, display_name')
      .eq('org_id', ctx.userOrgId)

    if (actionsError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load actions for stats: ${actionsError.message}`,
      })
    }

    const statByAction = new Map<
      string,
      { total: number; success: number; durationTotal: number; durationCount: number }
    >()

    for (const log of (logs ?? []) as Record<string, unknown>[]) {
      const actionId = log.action_id as string
      const current =
        statByAction.get(actionId) ??
        { total: 0, success: 0, durationTotal: 0, durationCount: 0 }

      current.total += 1
      if (log.status === 'success') current.success += 1

      const requestPayload = asRecord(log.request_payload)
      const durationMs =
        typeof log.duration_ms === 'number' ? log.duration_ms : requestPayload.durationMs
      if (typeof durationMs === 'number' && !Number.isNaN(durationMs)) {
        current.durationTotal += durationMs
        current.durationCount += 1
      }

      statByAction.set(actionId, current)
    }

    return (actions ?? []).map((action: Record<string, unknown>) => {
      const stat =
        statByAction.get(action.id as string) ??
        { total: 0, success: 0, durationTotal: 0, durationCount: 0 }

      const successRate =
        stat.total > 0 ? Number(((stat.success / stat.total) * 100).toFixed(2)) : 0

      const avgDurationMs =
        stat.durationCount > 0
          ? Math.round(stat.durationTotal / stat.durationCount)
          : null

      return {
        actionId: action.id,
        name: action.name,
        displayName: action.display_name,
        executions: stat.total,
        successRate,
        avgDurationMs,
      }
    })
  }),
})
