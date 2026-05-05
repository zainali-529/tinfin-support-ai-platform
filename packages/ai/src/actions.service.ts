import OpenAI from 'openai'
import {
  aiChannelMaxTokens,
  buildAiChannelBehaviorPrompt,
  normalizeAiChannelBehaviorConfig,
  normalizeAiResponseChannel,
  type AiChannelBehaviorConfig,
  type AiResponseChannel,
} from '@workspace/types'
import { getSupabaseAdmin } from './lib/supabase'
import { createOpenAIClient } from './providers/openai.provider'
import { queryRAG, type RAGSource } from './rag.service'
import {
  assertActionOutboundUrlAllowed,
  decryptActionSecret,
  resolveActionOutboundAllowlist,
} from './action-security'

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
  orgId: string
  name: string
  displayName: string
  description: string
  method: string
  urlTemplate: string
  headersTemplate: Record<string, string>
  bodyTemplate: string | null
  responseTemplate: string | null
  responsePath: string | null
  parameters: ActionParameter[]
  requiresConfirmation: boolean
  humanApprovalRequired: boolean
  timeoutSeconds: number
  category: string
  isActive: boolean
  secrets: Record<string, string>
  outboundAllowlist: string[]
}

export interface ActionExecutionResult {
  success: boolean
  data: unknown
  error?: string
  requestPayload?: {
    method: string
    url: string
    headers: Record<string, string>
    body: unknown
  }
  durationMs?: number
  statusCode?: number
}

export interface QueryWithActionsParams {
  query: string
  orgId: string
  kbId?: string
  conversationId?: string
  contactId?: string
  conversationHistory?: Array<{ role: string; content: string }>
  channel?: string
  threshold?: number
  maxChunks?: number
  openaiApiKey?: string
  simulateActions?: boolean
}

export type QueryWithActionsType =
  | 'answer'
  | 'action'
  | 'action_clarification'
  | 'action_confirmation'
  | 'action_pending_approval'
  | 'handoff'
  | 'ask_handoff'
  | 'casual'

export interface QueryWithActionsResult {
  type: QueryWithActionsType
  message: string
  confidence: number
  sources: RAGSource[]
  actionLog?: {
    logId: string
    actionName: string
    status: string
  }
  tokensUsed?: number
}

interface ActionLogInsert {
  orgId: string
  actionId: string
  conversationId?: string
  contactId?: string
  parametersUsed?: Record<string, unknown>
  requestPayload?: unknown
  responseRaw?: unknown
  responseParsed?: string
  status:
    | 'pending_confirmation'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'success'
    | 'failed'
    | 'timeout'
    | 'cancelled'
  errorMessage?: string
  approvedBy?: string
  approvedAt?: string
  executedAt?: string
  durationMs?: number | null
  statusCode?: number | null
  retryCount?: number | null
  completedAt?: string | null
}

interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

interface ActionOutcome {
  resultText: string
  actionLog: {
    logId: string
    actionName: string
    status: string
  }
  resultType: 'action' | 'action_confirmation' | 'action_pending_approval'
}

interface ActionOrgContext {
  displayName: string | null
  channelBehavior: AiChannelBehaviorConfig
}

const TOOL_NAME_SEARCH_KB = 'searchKnowledgeBase'
const TOOL_NAME_ASK_ACTION_DETAILS = 'askActionDetails'
const TOOL_NAME_REQUEST_HUMAN = 'requestHumanAgent'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TIMEOUT_SECONDS = 10
const ACTIONS_ENABLED_PLANS = new Set(['pro', 'scale'])

interface ActionIntentPlan {
  actionName: string | null
  confidence: number
  parameters: Record<string, unknown>
  missingRequiredParameters: string[]
  clarifyingQuestion: string | null
  reason: string | null
  tokensUsed?: number
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value
}

function findCaseInsensitiveKey(
  source: Record<string, unknown>,
  key: string
): string | null {
  const target = key.toLowerCase()
  let match: string | null = null

  for (const candidate of Object.keys(source)) {
    if (candidate.toLowerCase() !== target) continue
    if (match && match !== candidate) {
      // Ambiguous casing match; avoid guessing.
      return null
    }
    match = candidate
  }

  return match
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function isValidHeaderName(value: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)
}

function normalizeHeaderTemplateRecord(
  value: unknown
): Record<string, string> {
  const input = asRecord(value)
  const headers: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const keyWithPossibleValue = stripWrappingQuotes(rawKey)
    let headerName = keyWithPossibleValue
    let headerValue =
      typeof rawValue === 'string'
        ? rawValue.trim()
        : rawValue === null || rawValue === undefined
          ? ''
          : String(rawValue).trim()

    const colonIndex = keyWithPossibleValue.indexOf(':')
    if (colonIndex > 0) {
      headerName = keyWithPossibleValue.slice(0, colonIndex).trim()
      if (!headerValue) {
        headerValue = keyWithPossibleValue.slice(colonIndex + 1).trim()
      }
    }

    headerName = stripWrappingQuotes(headerName)
    headerValue = stripWrappingQuotes(headerValue).replace(/[\r\n]+/g, ' ')

    if (!headerName || !isValidHeaderName(headerName)) continue

    headers[headerName] = headerValue
  }

  return headers
}

function getPathValue(input: unknown, path: string | null): unknown {
  if (!path) return input
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let current: unknown = input
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function normalizeParamType(param: ActionParameter): { type: string; description: string; enum?: string[] } {
  if (param.type === 'enum') {
    return {
      type: 'string',
      description: param.description,
      ...(param.enumValues && param.enumValues.length > 0
        ? { enum: param.enumValues }
        : {}),
    }
  }

  return {
    type: param.type,
    description: param.description,
  }
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (!raw) return {}

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return asRecord(parsed)
    } catch {
      return {}
    }
  }

  return asRecord(raw)
}

function parseToolCalls(
  message: OpenAI.Chat.Completions.ChatCompletionMessage
): ParsedToolCall[] {
  const calls = message.tool_calls ?? []

  return calls
    .filter((call) => call.type === 'function')
    .map((call) => ({
      id: call.id,
      name: call.function.name,
      args: parseToolArguments(call.function.arguments),
    }))
}

function toConversationHistoryMessages(
  history?: Array<{ role: string; content: string }>
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  if (!history || history.length === 0) return []

  return history
    .slice(-10)
    .map((entry) => {
      const role =
        entry.role === 'assistant' || entry.role === 'system' || entry.role === 'user'
          ? entry.role
          : 'user'

      return {
        role,
        content: entry.content,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam
    })
}

function escapeTemplateValue(value: unknown, encode = false): string {
  if (value === null || value === undefined) return ''
  const base = String(value)
  if (!encode) return base
  return encodeURIComponent(base)
}

function looksLikeJson(input: string): boolean {
  const trimmed = input.trim()
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  )
}

function tryParseJson(input: string): unknown {
  try {
    return JSON.parse(input) as unknown
  } catch {
    return input
  }
}

function maskSecretsInText(input: string, secrets: Record<string, string>): string {
  let output = input
  for (const secretValue of Object.values(secrets)) {
    if (!secretValue) continue
    output = output.split(secretValue).join('[REDACTED]')
  }
  return output
}

function maskSecrets(value: unknown, secrets: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return maskSecretsInText(value, secrets)
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSecrets(item, secrets))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        maskSecrets(child, secrets),
      ])
    )
  }

  return value
}

function withExecutionMetadata(requestPayload: unknown, durationMs?: number): unknown {
  const base = asRecord(requestPayload)
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) {
    return base
  }

  return {
    ...base,
    durationMs,
  }
}

function getExecutionStatus(
  execution: ActionExecutionResult
): 'success' | 'failed' | 'timeout' {
  if (execution.success) return 'success'

  const errorText = (execution.error ?? '').toLowerCase()
  if (errorText.includes('timeout') || errorText.includes('aborted')) {
    return 'timeout'
  }

  return 'failed'
}

function buildParameterSummary(parameter: ActionParameter): string {
  const parts = [
    parameter.required ? 'required' : 'optional',
    parameter.type,
    parameter.description ? `description="${parameter.description}"` : null,
    parameter.extractionHint ? `extraction_hint="${parameter.extractionHint}"` : null,
    parameter.enumValues && parameter.enumValues.length > 0
      ? `allowed=${parameter.enumValues.join('|')}`
      : null,
  ].filter(Boolean)

  return `${parameter.name} (${parts.join(', ')})`
}

function buildActionSummary(actions: ActionConfig[]): string {
  if (actions.length === 0) {
    return 'No custom actions are configured for this organization.'
  }

  return actions
    .map((action) => {
      const flags = [
        action.requiresConfirmation ? 'requires_confirmation=true' : null,
        action.humanApprovalRequired ? 'human_approval_required=true' : null,
      ]
        .filter(Boolean)
        .join(', ')
      const params = action.parameters.length > 0
        ? ` parameters: ${action.parameters.map(buildParameterSummary).join('; ')}`
        : ' parameters: none'

      return `- ${action.name}: ${action.displayName}. ${action.description}.${params}${flags ? ` (${flags})` : ''}`
    })
    .join('\n')
}

async function insertActionLog(input: ActionLogInsert): Promise<string> {
  const supabase = getSupabaseAdmin()

  const payload = {
    org_id: input.orgId,
    action_id: input.actionId,
    conversation_id: input.conversationId ?? null,
    contact_id: input.contactId ?? null,
    parameters_used: input.parametersUsed ?? null,
    request_payload: input.requestPayload ?? null,
    response_raw: input.responseRaw ?? null,
    response_parsed: input.responseParsed ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
    duration_ms: input.durationMs ?? null,
    status_code: input.statusCode ?? null,
    retry_count: input.retryCount ?? 0,
    approved_by: input.approvedBy ?? null,
    approved_at: input.approvedAt ?? null,
    executed_at: input.executedAt ?? null,
    completed_at: input.completedAt ?? input.executedAt ?? null,
  }

  const { data, error } = await supabase
    .from('ai_action_logs')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create action log: ${error?.message ?? 'Unknown error'}`)
  }

  return data.id as string
}

async function updateActionLog(
  logId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('ai_action_logs')
    .update(patch)
    .eq('id', logId)

  if (error) {
    throw new Error(`Failed to update action log: ${error.message}`)
  }
}

async function getOrgSettings(
  orgId: string
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch organization settings: ${error.message}`)
  }

  return asRecord(data?.settings ?? null)
}

async function getOrgOutboundAllowlist(orgId: string): Promise<string[]> {
  const settings = await getOrgSettings(orgId)
  return resolveActionOutboundAllowlist(settings)
}

async function orgAllowsAiActions(orgId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan,status')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch organization subscription: ${error.message}`)
  }

  let plan = typeof data?.plan === 'string' ? data.plan : null
  if (!plan) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .maybeSingle()

    if (orgError) {
      throw new Error(`Failed to fetch organization plan: ${orgError.message}`)
    }

    plan = typeof org?.plan === 'string' ? org.plan : 'free'
  }

  const status = typeof data?.status === 'string' ? data.status : 'active'
  return ACTIONS_ENABLED_PLANS.has(plan) && ['active', 'trialing'].includes(status)
}

function decodeActionSecrets(rows: Array<{ key_name: unknown; key_value: unknown }>): Record<string, string> {
  const secrets: Record<string, string> = {}

  for (const row of rows) {
    const keyName = asString(row.key_name)
    if (!keyName) continue

    const rawValue = typeof row.key_value === 'string' ? row.key_value : null
    if (!rawValue) continue

    const decryptedValue = decryptActionSecret(rawValue)
    secrets[keyName] = decryptedValue
  }

  return secrets
}

async function fetchActionById(actionId: string): Promise<ActionConfig | null> {
  const supabase = getSupabaseAdmin()

  const { data: actionRow, error: actionError } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle()

  if (actionError) {
    throw new Error(`Failed to fetch action: ${actionError.message}`)
  }

  if (!actionRow) return null

  if (!(await orgAllowsAiActions(actionRow.org_id as string))) {
    return null
  }

  const outboundAllowlist = await getOrgOutboundAllowlist(actionRow.org_id as string)

  const { data: secretRows, error: secretError } = await supabase
    .from('ai_action_secrets')
    .select('key_name, key_value')
    .eq('action_id', actionId)

  if (secretError) {
    throw new Error(`Failed to fetch action secrets: ${secretError.message}`)
  }

  const secrets = decodeActionSecrets(
    (secretRows ?? []) as Array<{ key_name: unknown; key_value: unknown }>
  )

  return {
    id: actionRow.id as string,
    orgId: actionRow.org_id as string,
    name: actionRow.name as string,
    displayName: actionRow.display_name as string,
    description: actionRow.description as string,
    method: actionRow.method as string,
    urlTemplate: actionRow.url_template as string,
    headersTemplate: normalizeHeaderTemplateRecord(actionRow.headers_template),
    bodyTemplate: asString(actionRow.body_template),
    responseTemplate: asString(actionRow.response_template),
    responsePath: asString(actionRow.response_path),
    parameters: ((actionRow.parameters as ActionParameter[] | null) ?? []).map((parameter) => ({
      ...parameter,
      enumValues: Array.isArray(parameter.enumValues)
        ? parameter.enumValues
        : [],
    })),
    requiresConfirmation: asBoolean(actionRow.requires_confirmation),
    humanApprovalRequired: asBoolean(actionRow.human_approval_required),
    timeoutSeconds: asNumber(actionRow.timeout_seconds, DEFAULT_TIMEOUT_SECONDS),
    category: asString(actionRow.category) ?? 'custom',
    isActive: asBoolean(actionRow.is_active, true),
    secrets,
    outboundAllowlist,
  }
}

export async function getOrgActions(orgId: string): Promise<ActionConfig[]> {
  const supabase = getSupabaseAdmin()
  if (!(await orgAllowsAiActions(orgId))) {
    return []
  }

  const outboundAllowlist = await getOrgOutboundAllowlist(orgId)

  const { data: actionRows, error: actionError } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (actionError) {
    throw new Error(`Failed to fetch actions: ${actionError.message}`)
  }

  const rows = actionRows ?? []
  if (rows.length === 0) return []

  const actionIds = rows.map((row) => row.id as string)

  const { data: secretRows, error: secretError } = await supabase
    .from('ai_action_secrets')
    .select('action_id, key_name, key_value')
    .in('action_id', actionIds)

  if (secretError) {
    throw new Error(`Failed to fetch action secrets: ${secretError.message}`)
  }

  const secretsByAction = new Map<string, Record<string, string>>()

  for (const row of secretRows ?? []) {
    const actionId = row.action_id as string
    const current = secretsByAction.get(actionId) ?? {}
    const keyName = asString(row.key_name)
    const encryptedValue =
      typeof row.key_value === 'string' ? row.key_value : null

    if (!keyName || !encryptedValue) continue

    current[keyName] = decryptActionSecret(encryptedValue)
    secretsByAction.set(actionId, current)
  }

  return rows.map((row) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string,
    method: row.method as string,
    urlTemplate: row.url_template as string,
    headersTemplate: normalizeHeaderTemplateRecord(row.headers_template),
    bodyTemplate: asString(row.body_template),
    responseTemplate: asString(row.response_template),
    responsePath: asString(row.response_path),
    parameters: ((row.parameters as ActionParameter[] | null) ?? []).map((parameter) => ({
      ...parameter,
      enumValues: Array.isArray(parameter.enumValues)
        ? parameter.enumValues
        : [],
    })),
    requiresConfirmation: asBoolean(row.requires_confirmation),
    humanApprovalRequired: asBoolean(row.human_approval_required),
    timeoutSeconds: asNumber(row.timeout_seconds, DEFAULT_TIMEOUT_SECONDS),
    category: asString(row.category) ?? 'custom',
    isActive: asBoolean(row.is_active, true),
    secrets: secretsByAction.get(row.id as string) ?? {},
    outboundAllowlist,
  }))
}

export function buildOpenAITools(
  actions: ActionConfig[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: TOOL_NAME_SEARCH_KB,
        description:
          'Search the knowledge base for factual questions about products, pricing, policies, and procedures.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Question to search in the knowledge base',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAME_ASK_ACTION_DETAILS,
        description:
          'Use this when the customer is asking for a configured action but required details are missing and cannot be inferred from the recent conversation.',
        parameters: {
          type: 'object',
          properties: {
            actionName: {
              type: 'string',
              description: 'The configured action name the customer is trying to use.',
            },
            missingParameters: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required parameter names that are still missing.',
            },
            question: {
              type: 'string',
              description: 'A concise, natural follow-up question for the customer.',
            },
          },
          required: ['actionName', 'missingParameters', 'question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAME_REQUEST_HUMAN,
        description:
          'Use this only when the customer explicitly asks for a human agent or no configured action/knowledge flow can reasonably help.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Short reason for handoff',
            },
          },
          required: [],
        },
      },
    },
  ]

  for (const action of actions) {
    tools.push({
      type: 'function',
      function: {
        name: action.name,
        description: action.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            action.parameters.map((parameter) => [
              parameter.name,
              normalizeParamType(parameter),
            ])
          ),
          required: action.parameters
            .filter((parameter) => parameter.required)
            .map((parameter) => parameter.name),
        },
      },
    })
  }

  return tools
}

export async function resolveTemplate(
  template: string,
  parameters: Record<string, unknown>,
  secrets: Record<string, string>,
  options?: { encodeUriComponent?: boolean }
): Promise<string> {
  const encode = options?.encodeUriComponent === true

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    if (Object.prototype.hasOwnProperty.call(parameters, key)) {
      return escapeTemplateValue(parameters[key], encode)
    }

    const parameterFallbackKey = findCaseInsensitiveKey(parameters, key)
    if (parameterFallbackKey) {
      return escapeTemplateValue(parameters[parameterFallbackKey], encode)
    }

    if (Object.prototype.hasOwnProperty.call(secrets, key)) {
      return escapeTemplateValue(secrets[key], encode)
    }

    const secretFallbackKey = findCaseInsensitiveKey(
      secrets as Record<string, unknown>,
      key
    )
    if (secretFallbackKey) {
      return escapeTemplateValue(secrets[secretFallbackKey], encode)
    }

    return ''
  })
}

export async function executeAction(
  action: ActionConfig,
  parameters: Record<string, unknown>
): Promise<ActionExecutionResult> {
  const method = action.method.toUpperCase()
  const startedAt = Date.now()

  try {
    const url = await resolveTemplate(
      action.urlTemplate,
      parameters,
      action.secrets,
      { encodeUriComponent: true }
    )
    assertActionOutboundUrlAllowed(url, action.outboundAllowlist)

    const headers = Object.fromEntries(
      await Promise.all(
        Object.entries(normalizeHeaderTemplateRecord(action.headersTemplate)).map(async ([key, value]) => [
          key,
          await resolveTemplate(String(value), parameters, action.secrets),
        ])
      )
    ) as Record<string, string>

    let body: unknown = undefined

    if (
      action.bodyTemplate &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    ) {
      const renderedBody = await resolveTemplate(
        action.bodyTemplate,
        parameters,
        action.secrets
      )

      body = looksLikeJson(renderedBody)
        ? tryParseJson(renderedBody)
        : renderedBody
    }

    const timeoutMs = Math.max(
      1,
      (action.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000
    )

    const hasBody = body !== undefined && body !== null
    const requestHeaders: Record<string, string> = { ...headers }
    if (hasBody && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: hasBody
        ? typeof body === 'string'
          ? body
          : JSON.stringify(body)
        : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })

    const durationMs = Date.now() - startedAt
    const responseText = await response.text()
    const parsedResponse = responseText ? tryParseJson(responseText) : null

    if (!response.ok) {
      return {
        success: false,
        data: parsedResponse,
        error: `HTTP ${response.status}: ${response.statusText}`,
        requestPayload: {
          method,
          url: maskSecretsInText(url, action.secrets),
          headers: maskSecrets(requestHeaders, action.secrets) as Record<string, string>,
          body: maskSecrets(body, action.secrets),
        },
        durationMs,
        statusCode: response.status,
      }
    }

    const data = getPathValue(parsedResponse, action.responsePath)

    return {
      success: true,
      data,
      requestPayload: {
        method,
        url: maskSecretsInText(url, action.secrets),
        headers: maskSecrets(requestHeaders, action.secrets) as Record<string, string>,
        body: maskSecrets(body, action.secrets),
      },
      durationMs,
      statusCode: response.status,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown action execution error'

    return {
      success: false,
      data: null,
      error: errorMessage,
      requestPayload: {
        method,
        url: maskSecretsInText(action.urlTemplate, action.secrets),
        headers: {},
        body: null,
      },
      durationMs: Date.now() - startedAt,
    }
  }
}

export async function formatActionResponse(
  action: ActionConfig,
  rawResponse: unknown
): Promise<string> {
  if (!action.responseTemplate) {
    if (typeof rawResponse === 'string') return rawResponse

    try {
      return JSON.stringify(rawResponse, null, 2)
    } catch {
      return String(rawResponse)
    }
  }

  const data = asRecord(rawResponse)

  return action.responseTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = getPathValue(data, key)
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

async function createPendingApproval(
  logId: string,
  conversationId: string | undefined,
  actionName: string,
  parameters: Record<string, unknown>
): Promise<void> {
  if (!conversationId) return

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('ai_action_approvals')
    .insert({
      log_id: logId,
      conversation_id: conversationId,
      action_name: actionName,
      parameters,
    })

  if (error) {
    throw new Error(`Failed to create approval queue item: ${error.message}`)
  }
}

async function executeAndLogAction(input: {
  action: ActionConfig
  parameters: Record<string, unknown>
  orgId: string
  conversationId?: string
  contactId?: string
}): Promise<ActionOutcome> {
  const { action, parameters } = input

  if (action.requiresConfirmation) {
    const logId = await insertActionLog({
      orgId: input.orgId,
      actionId: action.id,
      conversationId: input.conversationId,
      contactId: input.contactId,
      parametersUsed: parameters,
      status: 'pending_confirmation',
    })

    const summary = formatActionParameterSummary(parameters)

    return {
      resultType: 'action_confirmation',
      resultText: summary
        ? `I can ${action.displayName} with ${summary}. Should I proceed?`
        : `I can ${action.displayName}. Should I proceed?`,
      actionLog: {
        logId,
        actionName: action.name,
        status: 'pending_confirmation',
      },
    }
  }

  if (action.humanApprovalRequired) {
    const logId = await insertActionLog({
      orgId: input.orgId,
      actionId: action.id,
      conversationId: input.conversationId,
      contactId: input.contactId,
      parametersUsed: parameters,
      status: 'pending_approval',
    })

    await createPendingApproval(
      logId,
      input.conversationId,
      action.displayName,
      parameters
    )

    return {
      resultType: 'action_pending_approval',
      resultText:
        "I've requested agent approval for this action. You'll be notified once it is approved.",
      actionLog: {
        logId,
        actionName: action.name,
        status: 'pending_approval',
      },
    }
  }

  const execution = await executeAction(action, parameters)

  const responseText = execution.success
    ? await formatActionResponse(action, execution.data)
    : `Action failed: ${execution.error ?? 'Unknown error'}`

  const status = getExecutionStatus(execution)

  const logId = await insertActionLog({
    orgId: input.orgId,
    actionId: action.id,
    conversationId: input.conversationId,
    contactId: input.contactId,
    parametersUsed: parameters,
    requestPayload: withExecutionMetadata(
      execution.requestPayload,
      execution.durationMs
    ),
    responseRaw: execution.data,
    responseParsed: responseText,
    status,
    errorMessage: execution.error,
    executedAt: new Date().toISOString(),
    durationMs: execution.durationMs ?? null,
    statusCode: execution.statusCode ?? null,
    retryCount: 0,
    completedAt: new Date().toISOString(),
  })

  return {
    resultType: 'action',
    resultText: responseText,
    actionLog: {
      logId,
      actionName: action.name,
      status,
    },
  }
}

async function getActionOrgContext(orgId: string): Promise<ActionOrgContext> {
  const supabase = getSupabaseAdmin()
  const [orgResult, widgetResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('widget_configs')
      .select('company_name')
      .eq('org_id', orgId)
      .maybeSingle(),
  ])

  const widgetName = typeof widgetResult.data?.company_name === 'string' ? widgetResult.data.company_name.trim() : ''
  const orgName = typeof orgResult.data?.name === 'string' ? orgResult.data.name.trim() : ''
  const settings = asRecord(orgResult.data?.settings)

  return {
    displayName: widgetName || orgName || null,
    channelBehavior: normalizeAiChannelBehaviorConfig(settings.aiChannelBehavior),
  }
}

const ACTION_PLANNING_STOPWORDS = new Set([
  'about',
  'action',
  'actions',
  'and',
  'api',
  'can',
  'could',
  'customer',
  'details',
  'for',
  'from',
  'help',
  'into',
  'please',
  'request',
  'status',
  'that',
  'the',
  'this',
  'with',
  'your',
])

function normalizePlanningText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPlanningKeywords(value: string): string[] {
  return normalizePlanningText(value)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !ACTION_PLANNING_STOPWORDS.has(word))
}

function couldNeedActionPlanning(
  query: string,
  actions: ActionConfig[]
): boolean {
  if (actions.length === 0 || isCasualInput(query)) return false

  const normalizedQuery = normalizePlanningText(query)
  if (!normalizedQuery) return false

  const operationalPattern =
    /\b(check|lookup|look up|find|track|status|cancel|update|change|create|book|schedule|send|refund|return|order|appointment|reservation|ticket|invoice|payment|subscription|account|profile|customer|delivery|shipping|tracking)\b/i

  if (operationalPattern.test(query)) return true

  const actionKeywords = new Set<string>()
  for (const action of actions) {
    for (const keyword of extractPlanningKeywords(
      [
        action.name,
        action.displayName,
        action.description,
        action.category,
        ...action.parameters.map((parameter) => `${parameter.name} ${parameter.description} ${parameter.extractionHint ?? ''}`),
      ].join(' ')
    )) {
      actionKeywords.add(keyword)
    }
  }

  return [...actionKeywords].some((keyword) => normalizedQuery.includes(keyword))
}

function actionPlanningHistory(
  history?: Array<{ role: string; content: string }>
): string {
  if (!history || history.length === 0) return '(no previous messages)'

  return history
    .slice(-8)
    .map((message) => {
      const role = message.role === 'assistant' || message.role === 'user'
        ? message.role
        : 'user'
      const content = message.content.trim().replace(/\s+/g, ' ').slice(0, 700)
      return `${role}: ${content}`
    })
    .join('\n')
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item))
  }

  const single = asString(value)
  if (!single) return []

  return single
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseActionPlanJson(value: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(value) as unknown)
  } catch {
    return {}
  }
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizeActionParameterValue(
  parameter: ActionParameter,
  value: unknown
): { value: unknown; valid: boolean; missing: boolean } {
  if (value === null || value === undefined) {
    return { value: undefined, valid: true, missing: true }
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return { value: undefined, valid: true, missing: true }
  }

  if (parameter.type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { value, valid: true, missing: false }
    }

    if (typeof value === 'string') {
      const numeric = Number(value.trim())
      return Number.isFinite(numeric)
        ? { value: numeric, valid: true, missing: false }
        : { value, valid: false, missing: false }
    }

    return { value, valid: false, missing: false }
  }

  if (parameter.type === 'boolean') {
    if (typeof value === 'boolean') {
      return { value, valid: true, missing: false }
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', 'yes', 'y', '1'].includes(normalized)) {
        return { value: true, valid: true, missing: false }
      }
      if (['false', 'no', 'n', '0'].includes(normalized)) {
        return { value: false, valid: true, missing: false }
      }
    }

    return { value, valid: false, missing: false }
  }

  if (parameter.type === 'enum') {
    const stringValue = String(value).trim()
    if (!parameter.enumValues || parameter.enumValues.length === 0) {
      return { value: stringValue, valid: true, missing: false }
    }

    const match = parameter.enumValues.find(
      (candidate) => candidate.toLowerCase() === stringValue.toLowerCase()
    )

    return match
      ? { value: match, valid: true, missing: false }
      : { value: stringValue, valid: false, missing: false }
  }

  return { value: String(value).trim(), valid: true, missing: false }
}

function validateActionParameters(
  action: ActionConfig,
  rawParameters: Record<string, unknown>
): {
  parameters: Record<string, unknown>
  missing: string[]
  invalid: string[]
} {
  const parameters: Record<string, unknown> = { ...rawParameters }
  const missing: string[] = []
  const invalid: string[] = []

  for (const parameter of action.parameters) {
    const rawKey = Object.prototype.hasOwnProperty.call(rawParameters, parameter.name)
      ? parameter.name
      : findCaseInsensitiveKey(rawParameters, parameter.name)
    const normalized = normalizeActionParameterValue(
      parameter,
      rawKey ? rawParameters[rawKey] : undefined
    )

    if (normalized.missing) {
      if (parameter.required) missing.push(parameter.name)
      delete parameters[parameter.name]
      continue
    }

    if (!normalized.valid) {
      invalid.push(parameter.name)
      continue
    }

    parameters[parameter.name] = normalized.value
  }

  return {
    parameters,
    missing: [...new Set(missing)],
    invalid: [...new Set(invalid)],
  }
}

function normalizeParameterEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s@.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function conversationEvidenceText(
  query: string,
  history?: Array<{ role: string; content: string }>
): string {
  const parts = [
    ...(history ?? []).slice(-8).map((entry) => entry.content),
    query,
  ]

  return normalizeParameterEvidenceText(parts.join('\n'))
}

function parameterValueHasEvidence(value: unknown, evidenceText: string): boolean {
  if (value === null || value === undefined) return false

  const rawValue = String(value).trim()
  if (!rawValue) return false

  const normalizedValue = normalizeParameterEvidenceText(rawValue)
  if (!normalizedValue) return false

  if (evidenceText.includes(normalizedValue)) return true

  const compactNeedle = normalizedValue.replace(/\s+/g, '')
  const compactHaystack = evidenceText.replace(/\s+/g, '')
  return compactNeedle.length >= 4 && compactHaystack.includes(compactNeedle)
}

function findUngroundedRequiredParameters(input: {
  action: ActionConfig
  parameters: Record<string, unknown>
  query: string
  conversationHistory?: Array<{ role: string; content: string }>
}): string[] {
  const evidenceText = conversationEvidenceText(
    input.query,
    input.conversationHistory
  )
  const ungrounded: string[] = []

  for (const parameter of input.action.parameters) {
    if (!parameter.required || parameter.type === 'boolean') continue

    const value = input.parameters[parameter.name]
    if (!parameterValueHasEvidence(value, evidenceText)) {
      ungrounded.push(parameter.name)
    }
  }

  return ungrounded
}

function friendlyParameterName(parameterName: string): string {
  return parameterName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
}

function formatActionParameterSummary(parameters: Record<string, unknown>): string {
  const entries = Object.entries(parameters)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .slice(0, 6)

  if (entries.length === 0) return ''

  return entries
    .map(([key, value]) => `${friendlyParameterName(key)}: ${String(value)}`)
    .join(', ')
}

function buildActionClarificationMessage(
  action: ActionConfig,
  missingParameters: string[],
  plannerQuestion?: string | null
): string {
  const question = plannerQuestion?.trim()
  if (question) return question

  const missingText = missingParameters
    .map(friendlyParameterName)
    .join(missingParameters.length === 2 ? ' and ' : ', ')

  return `I can help with ${action.displayName}. Could you share ${missingText || 'the required details'} so I can continue?`
}

async function inferActionIntentPlan(input: {
  client: OpenAI
  actions: ActionConfig[]
  query: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<ActionIntentPlan | null> {
  const { actions, client, query, conversationHistory } = input
  if (!couldNeedActionPlanning(query, actions)) return null

  try {
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an action intent router for a customer support AI.

Return one JSON object only.

Available configured actions:
${buildActionSummary(actions)}

Routing rules:
- Select an action only when the customer is asking to perform, check, retrieve, update, cancel, create, book, send, or manage something that matches a configured action.
- Do not select an action for general company questions, policies, educational questions, or casual chat.
- Reuse unambiguous identifiers and details from recent conversation history for follow-up requests like "this order", "that booking", or "cancel it".
- Never invent identifiers, amounts, dates, emails, or other parameter values.
- If a matching action exists but a required parameter is missing and cannot be inferred, return that action with missingRequiredParameters and a natural clarifyingQuestion.
- If required parameters are available, return them in parameters exactly using the configured parameter names.

JSON schema:
{
  "actionName": "configured_action_name or null",
  "confidence": 0.0,
  "parameters": {},
  "missingRequiredParameters": [],
  "clarifyingQuestion": "string or null",
  "reason": "short internal reason"
}`,
        },
        {
          role: 'user',
          content: `Recent conversation:
${actionPlanningHistory(conversationHistory)}

Current customer message:
${query}`,
        },
      ],
      max_tokens: 500,
      temperature: 0,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = parseActionPlanJson(raw)
    const plan: ActionIntentPlan = {
      actionName: asString(parsed.actionName),
      confidence: normalizeConfidence(parsed.confidence),
      parameters: asRecord(parsed.parameters),
      missingRequiredParameters: parseStringArray(parsed.missingRequiredParameters),
      clarifyingQuestion: asString(parsed.clarifyingQuestion),
      reason: asString(parsed.reason),
      tokensUsed: completion.usage?.total_tokens ?? 0,
    }

    if (!plan.actionName) return null
    return plan
  } catch (error) {
    console.warn(
      '[actions] action intent planner failed:',
      error instanceof Error ? error.message : error
    )
    return null
  }
}

async function executePlannedAction(input: {
  action: ActionConfig
  parameters: Record<string, unknown>
  orgId: string
  conversationId?: string
  contactId?: string
  tokensUsed?: number
}): Promise<QueryWithActionsResult> {
  const outcome = await executeAndLogAction({
    action: input.action,
    parameters: input.parameters,
    orgId: input.orgId,
    conversationId: input.conversationId,
    contactId: input.contactId,
  })

  return {
    type: outcome.resultType,
    message: outcome.resultText,
    confidence: 0.9,
    sources: [],
    actionLog: outcome.actionLog,
    tokensUsed: input.tokensUsed ?? 0,
  }
}

async function maybeResolveActionBeforeRag(input: {
  client: OpenAI
  actions: ActionConfig[]
  query: string
  orgId: string
  conversationId?: string
  contactId?: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<QueryWithActionsResult | null> {
  const plan = await inferActionIntentPlan({
    client: input.client,
    actions: input.actions,
    query: input.query,
    conversationHistory: input.conversationHistory,
  })

  if (!plan || plan.confidence < 0.55) return null

  const action = input.actions.find(
    (candidate) => candidate.name.toLowerCase() === plan.actionName?.toLowerCase()
  )
  if (!action) return null

  const validation = validateActionParameters(action, plan.parameters)
  const ungrounded = findUngroundedRequiredParameters({
    action,
    parameters: validation.parameters,
    query: input.query,
    conversationHistory: input.conversationHistory,
  })
  const missingOrInvalid = [
    ...validation.missing,
    ...validation.invalid,
    ...plan.missingRequiredParameters,
    ...ungrounded,
  ].filter((value, index, values) => values.indexOf(value) === index)

  if (missingOrInvalid.length > 0) {
    return {
      type: 'action_clarification',
      message: buildActionClarificationMessage(
        action,
        missingOrInvalid,
        plan.clarifyingQuestion
      ),
      confidence: Math.max(0.6, Math.min(plan.confidence, 0.9)),
      sources: [],
      tokensUsed: plan.tokensUsed ?? 0,
    }
  }

  if (plan.confidence < 0.65) return null

  return executePlannedAction({
    action,
    parameters: validation.parameters,
    orgId: input.orgId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    tokensUsed: plan.tokensUsed,
  })
}

function buildSystemPrompt(
  actions: ActionConfig[],
  orgDisplayName: string | null,
  channel: AiResponseChannel,
  channelBehavior: AiChannelBehaviorConfig
): string {
  const actionSummary = buildActionSummary(actions)
  const organizationLine = orgDisplayName
    ? `You represent the current organization: ${orgDisplayName}.`
    : 'You represent the current organization that owns this support workspace.'

  return `You are a helpful customer support AI assistant.
${organizationLine}

${buildAiChannelBehaviorPrompt(channel, channelBehavior)}

## Available Actions
${actionSummary}

## Rules
1. Use searchKnowledgeBase for factual questions.
2. Use actions for operational requests only when the relevant action is configured.
3. If an action needs confirmation or approval, ask clearly before execution and do not bypass the safety gate.
4. After action execution, report the result clearly.
5. Before using requestHumanAgent, check whether a configured action can help. If an action matches but required details are missing, use askActionDetails instead of handoff.
6. Never fabricate data. Use tools for real information.
7. Respond in English by default.
8. Put the direct answer first. Use bullets only when they make the answer easier to scan.
9. Format longer answers with clean Markdown: short paragraphs, numbered steps, bullets, and fenced code blocks for commands/code.
10. Never send a long answer as one giant paragraph. Do not wrap step titles or code fences in quotation marks.
11. When the customer asks "who are you", "what can you do", "how can you help", or "what do you do" without explicitly asking about the company/services/products, answer as the AI support assistant for the current organization. Do not turn that into a company service catalog.
12. When the customer asks about "your company", "your services", "your products", company overview, pricing, policies, or factual business details, use searchKnowledgeBase first. Do not ask "which company?" unless they clearly mean an unrelated third-party company.
13. For factual questions, use searchKnowledgeBase before answering. If no verified answer is available, do not answer from general model knowledge.
14. Reuse clear identifiers and details from recent conversation for follow-up actions like "cancel this", "check it", or "send that again". Do not ask again when the detail is unambiguous.
15. Do not route operational action requests to a human agent just because a parameter is missing; ask one concise follow-up question for the missing detail.`
}

function isCasualInput(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/[!.?]+$/g, '')
  if (!normalized) return true

  return [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good afternoon',
    'good evening',
    'thanks',
    'thank you',
    'ok',
    'okay',
    'cool',
    'great',
  ].includes(normalized)
}

async function fallbackToGroundedRag(params: QueryWithActionsParams, tokenOffset: number): Promise<QueryWithActionsResult> {
  const ragResult = await queryRAG({
    query: params.query,
    orgId: params.orgId,
    kbId: params.kbId,
    conversationId: params.conversationId,
    channel: params.channel,
    threshold: params.threshold,
    maxChunks: params.maxChunks,
    openaiApiKey: params.openaiApiKey,
  })

  return {
    type: ragResult.type,
    message: ragResult.message,
    confidence: ragResult.confidence,
    sources: ragResult.sources,
    tokensUsed: (ragResult.tokensUsed ?? 0) + tokenOffset,
  }
}

async function callOpenAIWithTools(input: {
  client: OpenAI
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  channel: AiResponseChannel
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return input.client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: input.messages,
    tools: input.tools,
    tool_choice: 'auto',
    max_tokens: aiChannelMaxTokens(input.channel),
    temperature: 0.3,
  })
}

export async function queryWithActions(
  params: QueryWithActionsParams
): Promise<QueryWithActionsResult> {
  const actions = await getOrgActions(params.orgId)
  const tools = buildOpenAITools(actions)
  const client = createOpenAIClient(params.openaiApiKey)
  const channel = normalizeAiResponseChannel(params.channel)
  const { displayName: orgDisplayName, channelBehavior } = await getActionOrgContext(params.orgId)
  const trimmedQuery = params.query.trim()
  const conversationHistory = (params.conversationHistory ?? []).filter((entry, index, history) => {
    const isLast = index === history.length - 1
    return !(
      isLast &&
      entry.role === 'user' &&
      entry.content.trim() === trimmedQuery
    )
  })

  async function finish(
    result: QueryWithActionsResult
  ): Promise<QueryWithActionsResult> {
    return result
  }

  const plannedActionResult = await maybeResolveActionBeforeRag({
    client,
    actions,
    query: trimmedQuery,
    orgId: params.orgId,
    conversationId: params.conversationId,
    contactId: params.contactId,
    conversationHistory,
  })
  if (plannedActionResult) {
    return finish(plannedActionResult)
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt(actions, orgDisplayName, channel, channelBehavior),
    },
    ...toConversationHistoryMessages(conversationHistory),
    {
      role: 'user',
      content: trimmedQuery,
    },
  ]

  const completion = await callOpenAIWithTools({ client, messages, tools, channel })
  const firstChoice = completion.choices[0]
  const totalTokens = completion.usage?.total_tokens ?? 0

  if (!firstChoice || !firstChoice.message) {
    return finish({
      type: 'casual',
      message: "I'm sorry, I couldn't process that request right now.",
      confidence: 0,
      sources: [],
      tokensUsed: totalTokens,
    })
  }

  const assistantMessage = firstChoice.message
  const assistantText = asString(assistantMessage.content) ?? ''

  if (firstChoice.finish_reason !== 'tool_calls') {
    if (!isCasualInput(params.query)) {
      return finish(await fallbackToGroundedRag(params, totalTokens))
    }

    return finish({
      type: 'casual',
      message: assistantText || "I'm here to help. Could you share a bit more detail?",
      confidence: 1,
      sources: [],
      tokensUsed: totalTokens,
    })
  }

  const parsedCalls = parseToolCalls(assistantMessage)
  if (parsedCalls.length === 0) {
    if (!isCasualInput(params.query)) {
      return finish(await fallbackToGroundedRag(params, totalTokens))
    }

    return finish({
      type: 'casual',
      message: assistantText || "I'm not sure what to do next. Could you rephrase that?",
      confidence: 0,
      sources: [],
      tokensUsed: totalTokens,
    })
  }

  const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  let sources: RAGSource[] = []
  let latestActionLog:
    | {
        logId: string
        actionName: string
        status: string
      }
    | undefined
  let executedCustomAction = false

  for (const call of parsedCalls) {
    if (call.name === TOOL_NAME_REQUEST_HUMAN) {
      return finish({
        type: 'handoff',
        message: assistantText || 'I will connect you with a human agent right away.',
        confidence: 1,
        sources: [],
        tokensUsed: totalTokens,
      })
    }

    if (call.name === TOOL_NAME_ASK_ACTION_DETAILS) {
      const requestedActionName = asString(call.args.actionName)
      const action = actions.find(
        (candidate) => candidate.name.toLowerCase() === requestedActionName?.toLowerCase()
      )
      const missingParameters = parseStringArray(call.args.missingParameters)
      const question = asString(call.args.question)

      return finish({
        type: 'action_clarification',
        message: action
          ? buildActionClarificationMessage(action, missingParameters, question)
          : question || "I can help with that. Could you share the required details so I can continue?",
        confidence: 0.8,
        sources: [],
        tokensUsed: totalTokens,
      })
    }

    if (call.name === TOOL_NAME_SEARCH_KB) {
      const kbQuery = asString(call.args.query) ?? params.query
      const ragResult = await queryRAG({
        query: kbQuery,
        orgId: params.orgId,
        kbId: params.kbId,
        conversationId: params.conversationId,
        channel,
        threshold: params.threshold,
        maxChunks: params.maxChunks,
        openaiApiKey: params.openaiApiKey,
      })

      sources = ragResult.sources

      if (ragResult.type === 'handoff' || ragResult.type === 'ask_handoff') {
        return finish({
          type: ragResult.type,
          message: ragResult.message,
          confidence: ragResult.confidence,
          sources,
          tokensUsed: (ragResult.tokensUsed ?? 0) + totalTokens,
        })
      }

      const kbText =
        ragResult.message

      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: kbText,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam)

      continue
    }

    const action = actions.find((candidate) => candidate.name === call.name)

    if (!action) {
      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: 'Action not found for this organization.',
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      continue
    }

    const validation = validateActionParameters(action, call.args)
    const ungrounded = findUngroundedRequiredParameters({
      action,
      parameters: validation.parameters,
      query: trimmedQuery,
      conversationHistory,
    })
    const missingOrInvalid = [
      ...validation.missing,
      ...validation.invalid,
      ...ungrounded,
    ].filter((value, index, values) => values.indexOf(value) === index)
    if (missingOrInvalid.length > 0) {
      return finish({
        type: 'action_clarification',
        message: buildActionClarificationMessage(action, missingOrInvalid),
        confidence: 0.8,
        sources,
        tokensUsed: totalTokens,
      })
    }

    if (params.simulateActions) {
      const safeArgs = JSON.stringify(validation.parameters ?? {})
      executedCustomAction = true
      latestActionLog = {
        logId: `simulated_${call.id}`,
        actionName: action.name,
        status: 'simulated',
      }
      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: `SIMULATED_ACTION ${action.displayName}: ${safeArgs}`,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      continue
    }

    const outcome = await executeAndLogAction({
      action,
      parameters: validation.parameters,
      orgId: params.orgId,
      conversationId: params.conversationId,
      contactId: params.contactId,
    })
    latestActionLog = outcome.actionLog

    if (outcome.resultType === 'action_confirmation') {
      return finish({
        type: 'action_confirmation',
        message: outcome.resultText,
        confidence: 0.9,
        sources,
        actionLog: outcome.actionLog,
        tokensUsed: totalTokens,
      })
    }

    if (outcome.resultType === 'action_pending_approval') {
      return finish({
        type: 'action_pending_approval',
        message: outcome.resultText,
        confidence: 0.9,
        sources,
        actionLog: outcome.actionLog,
        tokensUsed: totalTokens,
      })
    }

    executedCustomAction = true
    toolMessages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: outcome.resultText,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
  }

  const followUpMessages = [
    ...messages,
    {
      role: 'assistant',
      content: assistantText,
      tool_calls: assistantMessage.tool_calls,
    } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    ...toolMessages,
  ]

  const secondCompletion = await callOpenAIWithTools({
    client,
    messages: followUpMessages,
    tools,
    channel,
  })

  const secondChoice = secondCompletion.choices[0]
  const secondText = asString(secondChoice?.message?.content)

  return finish({
    type: executedCustomAction ? 'action' : 'answer',
    message:
      secondText ||
      assistantText ||
      'Action executed. Let me know if you need anything else.',
    confidence: 0.9,
    sources,
    actionLog: latestActionLog,
    tokensUsed: (secondCompletion.usage?.total_tokens ?? 0) + totalTokens,
  })
}

export async function executeApprovedAction(
  logId: string,
  approvedBy: string
): Promise<{
  success: boolean
  message: string
  orgId: string | null
  conversationId: string | null
  actionName: string | null
}> {
  const supabase = getSupabaseAdmin()

  const { data: logRow, error: logError } = await supabase
    .from('ai_action_logs')
    .select('*')
    .eq('id', logId)
    .maybeSingle()

  if (logError || !logRow) {
    throw new Error(`Approval log not found: ${logError?.message ?? 'missing row'}`)
  }

  const action = await fetchActionById(logRow.action_id as string)
  if (!action) {
    throw new Error('Linked action not found for this approval log')
  }

  await updateActionLog(logId, {
    status: 'approved',
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  })

  const parameters = asRecord(logRow.parameters_used)
  const execution = await executeAction(action, parameters)
  const responseText = execution.success
    ? await formatActionResponse(action, execution.data)
    : `Action failed: ${execution.error ?? 'Unknown error'}`
  const executionStatus = getExecutionStatus(execution)

  await updateActionLog(logId, {
    status: executionStatus,
    request_payload: withExecutionMetadata(
      execution.requestPayload,
      execution.durationMs
    ),
    response_raw: execution.data,
    response_parsed: responseText,
    error_message: execution.error ?? null,
    executed_at: new Date().toISOString(),
    duration_ms: execution.durationMs ?? null,
    status_code: execution.statusCode ?? null,
    retry_count: 0,
    completed_at: new Date().toISOString(),
  })

  await supabase.from('ai_action_approvals').delete().eq('log_id', logId)

  return {
    success: execution.success,
    message: responseText,
    orgId: asString(logRow.org_id),
    conversationId: asString(logRow.conversation_id),
    actionName: action.name,
  }
}

export async function handleConfirmedAction(
  logId: string,
  confirmed: boolean
): Promise<string> {
  if (!confirmed) {
    await updateActionLog(logId, {
      status: 'cancelled',
      executed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    return 'No problem, I cancelled that action. Let me know if you need anything else.'
  }

  const supabase = getSupabaseAdmin()
  const { data: logRow, error: logError } = await supabase
    .from('ai_action_logs')
    .select('*')
    .eq('id', logId)
    .maybeSingle()

  if (logError || !logRow) {
    throw new Error(`Action confirmation log not found: ${logError?.message ?? 'missing row'}`)
  }

  const action = await fetchActionById(logRow.action_id as string)
  if (!action) {
    throw new Error('Linked action not found for confirmation log')
  }

  const parameters = asRecord(logRow.parameters_used)
  if (action.humanApprovalRequired) {
    await updateActionLog(logId, {
      status: 'pending_approval',
      approved_at: null,
      approved_by: null,
      completed_at: null,
    })

    await createPendingApproval(
      logId,
      asString(logRow.conversation_id) ?? undefined,
      action.displayName,
      parameters
    )

    return "I've requested agent approval for this action. You'll be notified once it is approved."
  }

  const execution = await executeAction(action, parameters)

  const responseText = execution.success
    ? await formatActionResponse(action, execution.data)
    : `Action failed: ${execution.error ?? 'Unknown error'}`
  const executionStatus = getExecutionStatus(execution)

  await updateActionLog(logId, {
    status: executionStatus,
    request_payload: withExecutionMetadata(
      execution.requestPayload,
      execution.durationMs
    ),
    response_raw: execution.data,
    response_parsed: responseText,
    error_message: execution.error ?? null,
    executed_at: new Date().toISOString(),
    duration_ms: execution.durationMs ?? null,
    status_code: execution.statusCode ?? null,
    retry_count: 0,
    completed_at: new Date().toISOString(),
  })

  return responseText
}
