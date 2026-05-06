â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CONTEXT & EXISTING STACK
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Tinfiz is an AI-powered customer support SaaS (Turborepo monorepo):
  apps/api   â†’ Express + tRPC v11, Supabase JS, BullMQ, ioredis
  apps/web   â†’ Next.js 16 App Router, Tailwind v4, shadcn/ui
  packages/ai â†’ queryRAG() RAG pipeline (OpenAI gpt-4o-mini + pgvector)
  packages/ui â†’ Full shadcn component library

EXISTING AI flow (apps/api/src/ws/wsServer.ts):
  Customer message â†’ queryRAG() â†’ response
  queryRAG returns: { type: 'answer'|'handoff'|'ask_handoff'|'casual', message, confidence }

EXISTING voice flow (Vapi tool-calls):
  Customer speaks â†’ vapi-webhook tool-calls â†’ searchKnowledgeBase â†’ response

GOAL:
  AI can now TAKE ACTIONS during conversations â€” not just answer.
  Same tools architecture as searchKnowledgeBase but org-configurable.

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WHAT "AI ACTIONS" MEANS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Examples of what AI can now DO (not just say):

  Customer: "What's my order status?"
  AI: [calls getOrderStatus tool with orderId extracted from conversation]
  AI: "Your order #12345 is out for delivery, arriving today by 6pm."

  Customer: "Can you cancel my subscription?"
  AI: [needs confirmation]
  AI: "I can cancel your subscription ending Dec 31st. Should I proceed?"
  Customer: "Yes"
  AI: [calls cancelSubscription] â†’ "Done, your subscription has been cancelled."

  Customer: "Book me an appointment for tomorrow 3pm"
  AI: [calls bookAppointment with parsed date/time]
  AI: "Appointment confirmed for tomorrow at 3:00 PM. Check your email."

This is what Intercom calls "Fin AI Actions" (they charge $99+/seat for this).

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DATABASE SCHEMA
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Run this SQL migration:

-- Action definitions (what org configures)
CREATE TABLE ai_actions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,         -- snake_case, used as function name
  display_name             TEXT NOT NULL,         -- human label
  description              TEXT NOT NULL,         -- AI reads this to know when to use
  method                   TEXT NOT NULL DEFAULT 'GET',  -- GET|POST|PUT|PATCH|DELETE
  url_template             TEXT NOT NULL,         -- "https://api.shop.com/orders/{orderId}"
  headers_template         JSONB DEFAULT '{}',    -- {"Authorization": "Bearer {apiKey}"}
  body_template            TEXT,                  -- JSON string with {variable} placeholders
  response_path            TEXT,                  -- dot path to extract: "data.order.status"
  response_template        TEXT,                  -- "Order status: {status}, ETA: {eta}"
  parameters               JSONB NOT NULL DEFAULT '[]',  -- ActionParameter[]
  requires_confirmation    BOOLEAN DEFAULT false,
  human_approval_required  BOOLEAN DEFAULT false,
  timeout_seconds          INT DEFAULT 10,
  is_active                BOOLEAN DEFAULT true,
  category                 TEXT DEFAULT 'custom', -- 'ecommerce'|'scheduling'|'account'|'custom'
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Secrets stored separately from action definitions
CREATE TABLE ai_action_secrets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  key_name   TEXT NOT NULL,     -- variable name used in templates: "apiKey"
  key_value  TEXT NOT NULL,     -- encrypted value (use pgp_sym_encrypt or store as-is for MVP)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(action_id, key_name)
);

-- Execution log â€” full audit trail
CREATE TABLE ai_action_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  action_id       UUID NOT NULL REFERENCES ai_actions(id),
  conversation_id UUID REFERENCES conversations(id),
  contact_id      UUID REFERENCES contacts(id),
  parameters_used JSONB,              -- what AI extracted
  request_payload JSONB,              -- actual HTTP request we made
  response_raw    JSONB,              -- raw API response
  response_parsed TEXT,               -- formatted response sent back to AI
  status          TEXT NOT NULL,      -- 'pending_confirmation'|'pending_approval'
                                      -- |'approved'|'rejected'|'success'|'failed'
                                      -- |'timeout'|'cancelled'
  error_message   TEXT,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Pending human approvals queue
CREATE TABLE ai_action_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL UNIQUE REFERENCES ai_action_logs(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  action_name     TEXT NOT NULL,
  parameters      JSONB,
  requested_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + interval '30 minutes')
);

-- Indexes
CREATE INDEX idx_ai_actions_org          ON ai_actions (org_id) WHERE is_active = true;
CREATE INDEX idx_ai_action_logs_conv     ON ai_action_logs (conversation_id);
CREATE INDEX idx_ai_action_logs_org_date ON ai_action_logs (org_id, created_at DESC);
CREATE INDEX idx_ai_action_approvals_conv ON ai_action_approvals (conversation_id);

-- ActionParameter JSONB structure (stored in parameters column):
-- [
--   {
--     "name": "orderId",
--     "type": "string",          -- "string"|"number"|"boolean"|"enum"
--     "description": "The order ID mentioned by the customer",
--     "required": true,
--     "enumValues": [],          -- for type: "enum"
--     "extractionHint": "Look for patterns like #12345 or ORDER-12345"
--   }
-- ]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PACKAGES/AI â€” CORE ENGINE
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

FILE: packages/ai/src/actions.service.ts

  This is the core execution engine. It:
  1. Fetches active actions for an org
  2. Builds OpenAI tool definitions from action configs
  3. Runs AI with tools available
  4. Executes HTTP calls when AI triggers a tool
  5. Returns results back to AI for natural language response

  Interfaces:

    interface ActionParameter {
      name: string
      type: 'string' | 'number' | 'boolean' | 'enum'
      description: string
      required: boolean
      enumValues?: string[]
      extractionHint?: string
    }

    interface ActionConfig {
      id: string
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
      secrets: Record<string, string>  // resolved from ai_action_secrets
    }

    interface ActionExecutionResult {
      type: 'success' | 'confirmation_needed' | 'approval_needed' | 'error'
      actionId: string
      actionName: string
      parameters: Record<string, unknown>
      result?: string          // formatted result for AI to relay
      rawResponse?: unknown    // for logging
      confirmationMessage?: string  // if type === 'confirmation_needed'
      logId?: string
    }

    interface QueryWithActionsParams {
      query: string
      orgId: string
      kbId?: string
      conversationId?: string
      contactId?: string
      conversationHistory?: Array<{ role: string; content: string }>
      threshold?: number
      maxChunks?: number
    }

    interface QueryWithActionsResult {
      type: 'answer' | 'action' | 'action_confirmation' | 'action_pending_approval'
            | 'handoff' | 'ask_handoff' | 'casual'
      message: string
      confidence: number
      sources: Array<{ title: string | null; url: string | null; similarity: number }>
      actionLog?: { logId: string; actionName: string; status: string }
      tokensUsed?: number
    }

  Export these functions:

  async function getOrgActions(orgId: string): Promise<ActionConfig[]>
    - SELECT from ai_actions + ai_action_secrets WHERE org_id = orgId AND is_active = true
    - Merge secrets into ActionConfig.secrets
    - Return array

  function buildOpenAITools(actions: ActionConfig[]): OpenAI.Chat.Tool[]
    - Map each ActionConfig to OpenAI function definition
    - Also include: searchKnowledgeBase (from existing RAG)
    - Also include: requestHumanAgent
    - Return array for OpenAI completions API

  async function resolveTemplate(
    template: string,
    parameters: Record<string, unknown>,
    secrets: Record<string, string>
  ): Promise<string>
    - Replace {paramName} with parameters[paramName]
    - Replace {secretName} with secrets[secretName]
    - Handle URL encoding for URL templates
    - Example: "https://api.shop.com/orders/{orderId}" + {orderId: "12345"}
      â†’ "https://api.shop.com/orders/12345"

  async function executeAction(
    action: ActionConfig,
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; data: unknown; error?: string }>
    - Build URL from urlTemplate + parameters + secrets
    - Build headers from headersTemplate + secrets
    - Build body from bodyTemplate + parameters (if method is POST/PUT/PATCH)
    - Fetch with AbortSignal.timeout(action.timeoutSeconds * 1000)
    - Parse JSON response
    - If responsePath â†’ extract nested value (use lodash.get or simple dot-path resolver)
    - Return { success, data, error }

  async function formatActionResponse(
    action: ActionConfig,
    rawResponse: unknown
  ): Promise<string>
    - If action.responseTemplate exists â†’ fill template with response fields
    - Else â†’ JSON.stringify(rawResponse, null, 2) (let AI figure it out)

  async function queryWithActions(params: QueryWithActionsParams): Promise<QueryWithActionsResult>
    
    This is the main function that replaces queryRAG() for chat.
    
    Flow:
    
    1. Fetch org's active actions: await getOrgActions(params.orgId)
    
    2. Embed query + search KB chunks (same as queryRAG)
    
    3. Build messages array for OpenAI:
       - System prompt (includes KB context + actions instructions)
       - Conversation history (last 10 messages for context)
       - Current user message
    
    4. First OpenAI call WITH tools:
       const completion = await openai.chat.completions.create({
         model: 'gpt-4o-mini',
         messages,
         tools: buildOpenAITools(actions),
         tool_choice: 'auto',
         max_tokens: 512,
         temperature: 0.3,
       })
    
    5. Check completion.choices[0].finish_reason:
    
       If 'stop' â†’ AI answered without tools â†’ return answer as-is
    
       If 'tool_calls' â†’ AI wants to use a tool:
         For each tool call in completion.choices[0].message.tool_calls:
         
         a) If toolName === 'requestHumanAgent':
            â†’ return { type: 'handoff', message: AI's message }
         
         b) If toolName === 'searchKnowledgeBase':
            â†’ call queryRAG with the query parameter
            â†’ add result as tool_result message
            â†’ make SECOND OpenAI call with tool result
            â†’ return final answer
         
         c) If it's a custom action:
            - Get ActionConfig by name
            - If action.requiresConfirmation:
              â†’ DON'T execute yet
              â†’ Log with status='pending_confirmation'
              â†’ return { type: 'action_confirmation', 
                         message: "Should I [action description] with [params]?",
                         confirmationMessage: "...",
                         actionLog: { logId, actionName } }
            
            - If action.humanApprovalRequired:
              â†’ Log with status='pending_approval'
              â†’ Insert into ai_action_approvals
              â†’ return { type: 'action_pending_approval',
                         message: "I've requested agent approval for this. 
                                  You'll be notified once approved." }
            
            - Else: execute immediately:
              â†’ const result = await executeAction(action, parameters)
              â†’ Log with status = result.success ? 'success' : 'failed'
              â†’ Add tool_result to messages
              â†’ Make second OpenAI call to get natural language response
              â†’ return { type: 'action', message: naturalResponse }
    
    System prompt for queryWithActions:
    
    "You are a helpful customer support AI assistant.
    
    ## Knowledge Base
    {kbContext}
    
    ## Available Actions
    You have tools to TAKE ACTIONS for customers. Use them when appropriate.
    Before using any action that modifies data, check if requiresConfirmation is true.
    
    ## Rules
    1. Search the knowledge base for factual questions.
    2. Use actions for operational requests (orders, bookings, account changes).
    3. If an action needs confirmation, describe what you'll do and ask first.
    4. After executing an action, report the result clearly.
    5. If you cannot help, use requestHumanAgent.
    6. Never fabricate information â€” always use tools for real data.
    7. Respond in the same language as the customer."

  async function executeApprovedAction(logId: string, approvedBy: string): Promise<void>
    - Get log from ai_action_logs
    - Get action from ai_actions
    - executeAction(action, log.parameters_used)
    - Update log status to 'success' or 'failed'
    - Delete from ai_action_approvals
    - Broadcast via WebSocket to conversation: { type: 'action:executed', result }

  async function handleConfirmedAction(
    logId: string,
    confirmed: boolean
  ): Promise<string>
    - If !confirmed â†’ update log status = 'cancelled' â†’ return "No problem, let me know if you need anything else."
    - If confirmed â†’ executeAction â†’ update log â†’ return formatted result

Export: getOrgActions, queryWithActions, executeApprovedAction, handleConfirmedAction

Update packages/ai/src/index.ts to export from actions.service.ts

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BACKEND API
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

FILE: apps/api/src/routers/actions.router.ts

  All procedures require protectedProcedure.

  getActions â†’ SELECT all ai_actions for userOrgId
    Returns: ActionConfig[] (WITHOUT secrets values, just key names)
    Include: execution count from ai_action_logs in last 30 days per action

  getAction({ id }) â†’ Single action with parameter details
    Admin only

  createAction({ ...ActionConfig fields }) â†’ INSERT
    Admin only
    Validate: name must be unique per org, snake_case only
    Validate: urlTemplate must be valid URL after variable replacement
    Validate: max 20 actions per org (plan limit)

  updateAction({ id, ...fields }) â†’ UPDATE
    Admin only
    Can update any field except org_id

  deleteAction({ id }) â†’ DELETE (cascade deletes secrets and logs)
    Admin only

  setActionSecret({ actionId, keyName, keyValue }) â†’ UPSERT ai_action_secrets
    Admin only
    keyValue is stored as-is for MVP (add encryption in v2)

  deleteActionSecret({ actionId, keyName }) â†’ DELETE from ai_action_secrets

  testAction({ id, testParameters }) â†’ Execute action with test params
    Admin only
    Does NOT log to ai_action_logs
    Returns { success, responseData, error, durationMs }
    Use this in UI to let admins test before enabling

  getActionLogs({ limit, offset, actionId?, status? }) â†’ Paginated logs
    Admin only
    Returns recent executions with status, parameters, response

  getPendingApprovals â†’ SELECT from ai_action_approvals JOIN logs
    Returns pending approvals for this org
    Show in agent dashboard as notifications

  approveAction({ logId }) â†’ calls executeApprovedAction
    Agent or admin
    Broadcasts result via WebSocket

  rejectAction({ logId }) â†’ Update log status = 'rejected', delete approval
    Agent or admin

  getActionStats â†’ Execution counts, success rates, avg duration by action
    Admin only

Add to apps/api/src/trpc/router.ts:
  import { actionsRouter } from './routers/actions.router'
  actions: actionsRouter

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WEBSOCKET UPDATES
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

In apps/api/src/ws/wsServer.ts:

1. Replace queryRAG call with queryWithActions:

   // OLD:
   const ragResult = await queryRAG({ query, orgId, threshold: 0.3, maxChunks: 5 })

   // NEW:
   const ragResult = await queryWithActions({
     query,
     orgId,
     conversationId,
     contactId: contact?.id,
     conversationHistory: recentMessages,  // last 10 messages for context
     threshold: 0.3,
     maxChunks: 5,
   })

2. Handle new result types:

   switch (ragResult.type) {
     case 'answer':
     case 'casual':
       // same as before
       send(socket, { type: 'ai:response', content: ragResult.message, ... })
       break

     case 'action':
       send(socket, {
         type: 'ai:response',
         content: ragResult.message,
         actionLog: ragResult.actionLog,  // show action badge in UI
         ...
       })
       break

     case 'action_confirmation':
       // AI needs customer to confirm before executing
       socket.pendingActionLogId = ragResult.actionLog?.logId
       send(socket, {
         type: 'ai:response',
         content: ragResult.message,
         requiresConfirmation: true,
         ...
       })
       break

     case 'action_pending_approval':
       // Human agent needs to approve
       broadcastToAgents(orgId, {
         type: 'approval:requested',
         logId: ragResult.actionLog?.logId,
         actionName: ragResult.actionLog?.actionName,
         conversationId,
       })
       send(socket, { type: 'ai:response', content: ragResult.message, ... })
       break

     case 'handoff':
       await triggerHandoff(socket, conversationId, orgId)
       break

     case 'ask_handoff':
       socket.awaitingHandoffConfirm = true
       send(socket, { type: 'ai:response', content: ragResult.message, ... })
       break
   }

3. Handle confirmation responses:

   When socket.pendingActionLogId is set and next message arrives:
   - If isHandoffConfirmation(content) â†’ execute the pending action
   - Else â†’ cancel action, respond normally

4. Add new message type handler:
   case 'action:approve':
     if (!socket.isAgent) break
     await approveAction(msg.logId, socket.agentId)
     break

   case 'action:reject':
     if (!socket.isAgent) break
     await rejectAction(msg.logId)
     break

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
VAPI INTEGRATION (Voice Actions)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

In apps/api/src/routes/vapi-webhook.route.ts,
in the tool-calls handler, add action execution:

async function handleToolCalls(supabase, orgId, assistantId, toolCalls):
  results = []
  for each toolCall:
    if toolCall.function.name === 'searchKnowledgeBase':
      // existing code
    else:
      // It's a custom action!
      const actions = await getOrgActions(orgId)
      const action = actions.find(a => a.name === toolCall.function.name)
      if (!action) {
        results.push({ toolCallId, result: 'Action not found.' })
        continue
      }
      if (action.humanApprovalRequired) {
        // Cannot do approval during voice â€” gracefully decline
        results.push({ toolCallId, result: 'This action requires human approval. An agent will follow up.' })
        // Create approval log in DB for agent to handle
        continue
      }
      if (action.requiresConfirmation) {
        // For voice: AI will ask customer verbally (no separate confirm step needed
        // because voice is back-and-forth naturally)
        // Just execute if AI called the tool â€” assume it asked already
      }
      const result = await executeAction(action, toolCall.function.arguments)
      results.push({
        toolCallId,
        result: result.success ? await formatActionResponse(action, result.data)
                               : `Failed: ${result.error}`
      })
  return results

In buildOrgAssistantPayload (vapi.service.ts):
  When building model.tools, also include active org actions:
  const orgActions = await getOrgActions(orgId)
  const actionTools = orgActions.map(action => ({
    type: 'function',
    function: {
      name: action.name,
      description: action.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          action.parameters.map(p => [p.name, { type: p.type, description: p.description }])
        ),
        required: action.parameters.filter(p => p.required).map(p => p.name)
      }
    },
    server: { url: webhookBaseUrl + '/api/vapi-webhook', secret: webhookSecret }
  }))
  model.tools = [...existingTools, ...actionTools]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
FRONTEND â€” AI ACTIONS MANAGEMENT
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ROUTE: apps/web/app/(dashboard)/ai-actions/page.tsx
  Admin only gate (server component)
  
MAIN PAGE LAYOUT:

  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚  AI Actions                              [+ New Action] â”‚
  â”‚  "Actions let your AI take real steps for customers"    â”‚
  â”‚                                                         â”‚
  â”‚  â”Œâ”€â”€â”€ Stats bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
  â”‚  â”‚ 234 executions  â”‚  96% success  â”‚  1.2s avg     â”‚   â”‚
  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
  â”‚                                                         â”‚
  â”‚  Filter: [All] [E-commerce] [Scheduling] [Account]     â”‚
  â”‚          [Custom]                                       â”‚
  â”‚                                                         â”‚
  â”‚  â”Œâ”€â”€ ActionCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
  â”‚  â”‚  ðŸ“¦ Get Order Status              âœ… Active       â”‚  â”‚
  â”‚  â”‚  "Looks up real-time order status"               â”‚  â”‚
  â”‚  â”‚  GET api.shop.com/orders/{orderId}               â”‚  â”‚
  â”‚  â”‚  Used 156 times Â· 98% success Â· 0.8s avg        â”‚  â”‚
  â”‚  â”‚                          [Test] [Edit] [Delete]  â”‚  â”‚
  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
  â”‚                                                         â”‚
  â”‚  â”Œâ”€â”€ ActionCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
  â”‚  â”‚  âŒ Cancel Order               âœ… Active + âš ï¸ Approvalâ”‚
  â”‚  â”‚  "Cancels a customer order by ID"                â”‚  â”‚
  â”‚  â”‚  POST api.shop.com/orders/{orderId}/cancel       â”‚  â”‚
  â”‚  â”‚  Used 23 times Â· 100% success Â· 1.1s avg        â”‚  â”‚
  â”‚  â”‚                          [Test] [Edit] [Delete]  â”‚  â”‚
  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

COMPONENTS:

FILE: apps/web/components/actions/ActionBuilder.tsx
  (Used for both create and edit â€” Dialog/Sheet form)
  
  Section 1: Basic Info
    Display Name (text input)
    Name (auto-generated from display name, editable, snake_case validation)
    Category (select: E-commerce / Scheduling / Account / Custom)
    Description (textarea â€” IMPORTANT label: "AI reads this to decide when to use")
    Is Active toggle
  
  Section 2: API Configuration  
    Method (GET / POST / PUT / PATCH / DELETE) â€” select
    URL Template (text input with variable hint)
      Show: "Use {variableName} for dynamic values"
      Example placeholder: "https://api.yoursite.com/orders/{orderId}"
    Headers (key-value pairs editor)
      Show lock icon for values that are secrets
      [+ Add Header] button
    Request Body (textarea, shown only for POST/PUT/PATCH)
      JSON template with {variable} support
  
  Section 3: Parameters
    "Parameters are values the AI extracts from the customer conversation"
    
    For each parameter:
      Name (snake_case)
      Type (string / number / boolean / enum)
      Description (how AI should extract this)
      Required (checkbox)
      Enum values (shown only if type=enum, comma-separated input)
      [Remove] button
    
    [+ Add Parameter] button
  
  Section 4: Behavior
    Require customer confirmation (toggle)
      If ON, show: AI will ask customer "Should I [action] with [params]?" before executing
    Require agent approval (toggle)
      If ON, show: Action will wait for an agent to approve before executing
    Timeout (slider: 5-60 seconds)
  
  Section 5: Response Formatting
    Response path (optional, dot notation)
      Example: "data.order.status"
    Response template (optional)
      Example: "Your order status is: {status}. Expected delivery: {estimatedDelivery}"
  
  Footer:
    [Test Action] â†’ opens test panel
    [Cancel] [Save Action]

FILE: apps/web/components/actions/ActionTestPanel.tsx
  
  Sheet/Dialog that appears when clicking Test:
  
  Shows each parameter as an input field
  [Run Test] button â†’ trpc.actions.testAction.mutate()
  
  Results:
    Status: Success âœ… / Failed âŒ
    Duration: 1.23s
    Request sent: { method, url, headers (masked), body }
    Response received: (JSON formatted)
    Formatted result: "Order status is: Shipped"

FILE: apps/web/components/actions/ActionTemplates.tsx

  Pre-built templates users can import:
  
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚  Quick Start Templates                                  â”‚
  â”‚                                                         â”‚
  â”‚  ðŸ“¦ Shopify                                             â”‚
  â”‚  â”œâ”€â”€ Get Order Status      [Import]                     â”‚
  â”‚  â”œâ”€â”€ Cancel Order          [Import]                     â”‚
  â”‚  â””â”€â”€ Track Shipment        [Import]                     â”‚
  â”‚                                                         â”‚
  â”‚  ðŸ“… Calendly                                            â”‚
  â”‚  â”œâ”€â”€ Check Availability    [Import]                     â”‚
  â”‚  â””â”€â”€ Book Appointment      [Import]                     â”‚
  â”‚                                                         â”‚
  â”‚  ðŸ”” Generic Webhook                                     â”‚
  â”‚  â””â”€â”€ Trigger Webhook       [Import]                     â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
  
  Templates are hardcoded JSON in the frontend.
  Import pre-fills the ActionBuilder form.
  User still needs to add their API keys/secrets.

FILE: apps/web/components/actions/PendingApprovals.tsx
  
  Shows in agent inbox as a notification panel:
  
  âš ï¸ Action Approval Required
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Conversation: Ahmed Hassan (WhatsApp)
  Action: Cancel Order
  Parameters: { orderId: "12345" }
  Customer said: "Yes please cancel my order"
  Requested: 2 minutes ago (expires in 28 minutes)
  
  [âœ… Approve & Execute]  [âŒ Reject]
  
  On approve â†’ trpc.actions.approveAction â†’ WebSocket broadcasts result to conversation

SIDEBAR UPDATE:
  Add "AI Actions" link in sidebar under a new "Automation" section:
  
  Automation
  â”œâ”€â”€ AI Actions         (new)
  â””â”€â”€ [Knowledge Base already here]

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INBOX â€” ACTION BADGES IN CONVERSATION VIEW
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

In ConversationView / WhatsAppConversationView,
when a message has actionLog metadata, show a badge:

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ðŸ¤– AI                                       â”‚
â”‚  "Your order #12345 is out for delivery,     â”‚
â”‚   arriving today by 6pm."                    â”‚
â”‚                                              â”‚
â”‚  [âš¡ Action: getOrderStatus] [Success âœ…]   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

And for pending approvals:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ðŸ¤– AI                                       â”‚
â”‚  "I've sent a cancellation request for order â”‚
â”‚   #12345 for agent approval."                â”‚
â”‚                                              â”‚
â”‚  [âš¡ Cancel Order] [â³ Awaiting Approval]   â”‚
â”‚  [âœ… Approve]  [âŒ Reject]                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CODE QUALITY REQUIREMENTS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

- All existing chat, email, voice, KB features continue working unchanged
- Action execution is fully async â€” never block WebSocket or webhook response
- All HTTP calls to external APIs have timeout enforcement
- Secrets NEVER logged or returned to frontend
- Full audit trail in ai_action_logs for every execution attempt
- Graceful failure: if action fails, AI apologizes and offers human handoff
- TypeScript strict throughout
- Maximum 20 actions per org (enforced in createAction)
- Template variable injection sanitizes values (no injection attacks)
- Test action endpoint only callable by admins, not during real conversations
- Prettier: singleQuote: false, printWidth: 80, semi: false

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DELIVERABLES CHECKLIST
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

SQL:
[ ] ai_actions table
[ ] ai_action_secrets table  
[ ] ai_action_logs table
[ ] ai_action_approvals table
[ ] All indexes

Backend:
[ ] packages/ai/src/actions.service.ts (core engine)
[ ] packages/ai/src/index.ts (export new functions)
[ ] apps/api/src/routers/actions.router.ts
[ ] apps/api/src/trpc/router.ts (register actions router)
[ ] apps/api/src/ws/wsServer.ts (integrate queryWithActions)
[ ] apps/api/src/routes/vapi-webhook.route.ts (action tool calls)
[ ] apps/api/src/routers/vapi.router.ts (inject org actions into assistant)

Frontend:
[ ] apps/web/components/actions/ActionBuilder.tsx
[ ] apps/web/components/actions/ActionTestPanel.tsx
[ ] apps/web/components/actions/ActionTemplates.tsx
[ ] apps/web/components/actions/PendingApprovals.tsx
[ ] apps/web/app/(dashboard)/ai-actions/page.tsx
[ ] Update inbox ConversationView (action badges)
[ ] Update sidebar navigation
[ ] apps/web/hooks/useActions.ts (tRPC hooks)
