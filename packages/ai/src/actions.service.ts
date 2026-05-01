import OpenAI from 'openai'
import { getSupabaseAdmin } from './lib/supabase'
import { createOpenAIClient } from './providers/openai.provider'
import { queryRAG, type RAGSource } from './rag.service'
import {
  assertActionOutboundUrlAllowed,
  decryptActionSecret,
  resolveActionOutboundAllowlist,
} from './action-security'
import {
  buildGuidancePrompt,
  buildOrganizationPrompt,
  classifyAIIntent,
  getOrganizationAIContext,
  recordAIAnswerTrace,
  rewriteQueryForIntent,
  type AIContextBundle,
} from './identity.service'

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
  threshold?: number
  maxChunks?: number
  openaiApiKey?: string
  simulateActions?: boolean
}

export type QueryWithActionsType =
  | 'answer'
  | 'action'
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

const TOOL_NAME_SEARCH_KB = 'searchKnowledgeBase'
const TOOL_NAME_REQUEST_HUMAN = 'requestHumanAgent'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TIMEOUT_SECONDS = 10

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

      return `- ${action.name}: ${action.description}${flags ? ` (${flags})` : ''}`
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
    headersTemplate: asRecord(actionRow.headers_template) as Record<string, string>,
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
    headersTemplate: asRecord(row.headers_template) as Record<string, string>,
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
        name: TOOL_NAME_REQUEST_HUMAN,
        description: 'Use this when the customer needs a human agent handoff.',
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
        Object.entries(action.headersTemplate ?? {}).map(async ([key, value]) => [
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

    const summary = Object.keys(parameters).length
      ? JSON.stringify(parameters)
      : 'the provided details'

    return {
      resultType: 'action_confirmation',
      resultText: `I can ${action.displayName} using ${summary}. Should I proceed?`,
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

function buildSystemPrompt(actions: ActionConfig[], aiContext: AIContextBundle): string {
  const actionSummary = buildActionSummary(actions)
  const organizationSection = buildOrganizationPrompt(aiContext)
  const guidanceSection = buildGuidancePrompt(aiContext.guidance)

  return `You are a helpful customer support AI assistant.

${organizationSection}

${guidanceSection ? `${guidanceSection}\n` : ''}

## Available Actions
${actionSummary}

## Rules
1. Use searchKnowledgeBase for factual questions.
2. Use custom actions for operational requests (orders, bookings, account changes).
3. If an action needs confirmation, ask clearly before execution.
4. After action execution, report the result clearly.
5. If you cannot help, use requestHumanAgent.
6. Never fabricate data. Use tools for real information.
7. Respond in the same language as the customer.
8. If the customer says "your company", "who are you", "what do you do", or "aapki company", treat it as a question about ${aiContext.profile.companyName}. Do not ask which company unless they clearly mean a different third-party company.
9. Put the direct answer first. Use bullets only when they make the answer easier to scan.`
}

async function callOpenAIWithTools(input: {
  client: OpenAI
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return input.client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: input.messages,
    tools: input.tools,
    tool_choice: 'auto',
    max_tokens: 700,
    temperature: 0.3,
  })
}

export async function queryWithActions(
  params: QueryWithActionsParams
): Promise<QueryWithActionsResult> {
  const startedAt = Date.now()
  const actions = await getOrgActions(params.orgId)
  const tools = buildOpenAITools(actions)
  const client = createOpenAIClient(params.openaiApiKey)
  const aiContext = await getOrganizationAIContext(params.orgId)
  const intentResult = classifyAIIntent(params.query)
  const rewrittenQuery = rewriteQueryForIntent(params.query, intentResult, aiContext.profile)

  async function finish(
    result: QueryWithActionsResult,
    metadata: Record<string, unknown> = {}
  ): Promise<QueryWithActionsResult> {
    await recordAIAnswerTrace({
      orgId: params.orgId,
      conversationId: params.conversationId ?? null,
      channel: 'chat',
      query: params.query,
      detectedIntent: intentResult.intent,
      rewrittenQuery,
      responseType: result.type,
      responsePreview: result.message,
      sourcesUsed: result.sources,
      guidanceUsed: aiContext.guidance.map((rule) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
      })),
      actionsUsed: result.actionLog ? [result.actionLog] : [],
      confidence: result.confidence,
      latencyMs: Date.now() - startedAt,
      tokensUsed: result.tokensUsed ?? 0,
      model: DEFAULT_MODEL,
      metadata: {
        route: 'actions',
        languageHint: intentResult.languageHint,
        intentConfidence: intentResult.confidence,
        ...metadata,
      },
    })

    return result
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt(actions, aiContext),
    },
    ...toConversationHistoryMessages(params.conversationHistory),
    {
      role: 'user',
      content: params.query,
    },
  ]

  const completion = await callOpenAIWithTools({ client, messages, tools })
  const firstChoice = completion.choices[0]
  const totalTokens = completion.usage?.total_tokens ?? 0

  if (!firstChoice || !firstChoice.message) {
    return finish({
      type: 'casual',
      message: "I'm sorry, I couldn't process that request right now.",
      confidence: 0,
      sources: [],
      tokensUsed: totalTokens,
    }, { reason: 'missing_first_choice' })
  }

  const assistantMessage = firstChoice.message
  const assistantText = asString(assistantMessage.content) ?? ''

  if (firstChoice.finish_reason !== 'tool_calls') {
    return finish({
      type: 'answer',
      message: assistantText || "I'm here to help. Could you share a bit more detail?",
      confidence: 0.9,
      sources: [],
      tokensUsed: totalTokens,
    }, { finishReason: firstChoice.finish_reason })
  }

  const parsedCalls = parseToolCalls(assistantMessage)
  if (parsedCalls.length === 0) {
    return finish({
      type: 'casual',
      message: assistantText || "I'm not sure what to do next. Could you rephrase that?",
      confidence: 0,
      sources: [],
      tokensUsed: totalTokens,
    }, { finishReason: firstChoice.finish_reason, parsedToolCalls: 0 })
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
      }, { toolCall: TOOL_NAME_REQUEST_HUMAN })
    }

    if (call.name === TOOL_NAME_SEARCH_KB) {
      const kbQuery = asString(call.args.query) ?? params.query
      const ragResult = await queryRAG({
        query: kbQuery,
        orgId: params.orgId,
        kbId: params.kbId,
        conversationId: params.conversationId,
        channel: 'chat',
        threshold: params.threshold,
        maxChunks: params.maxChunks,
        openaiApiKey: params.openaiApiKey,
      })

      sources = ragResult.sources

      const kbText =
        ragResult.type === 'handoff' || ragResult.type === 'ask_handoff'
          ? '__HANDOFF__'
          : ragResult.message

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

    if (params.simulateActions) {
      const safeArgs = JSON.stringify(call.args ?? {})
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
      parameters: call.args,
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
      }, { toolCall: action.name, status: outcome.actionLog.status })
    }

    if (outcome.resultType === 'action_pending_approval') {
      return finish({
        type: 'action_pending_approval',
        message: outcome.resultText,
        confidence: 0.9,
        sources,
        actionLog: outcome.actionLog,
        tokensUsed: totalTokens,
      }, { toolCall: action.name, status: outcome.actionLog.status })
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
  }, {
    executedCustomAction,
    toolCallCount: parsedCalls.length,
    secondFinishReason: secondChoice?.finish_reason,
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
