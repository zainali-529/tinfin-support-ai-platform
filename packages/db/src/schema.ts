import {
  pgSchema,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`
    },
    fromDriver(value: unknown): number[] {
      return (value as string)
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(Number)
    },
  })(name)

const auth = pgSchema('auth')
export const authUsers = auth.table('users', {
  id: uuid('id').primaryKey(),
})

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  plan: text('plan').default('free').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  activeOrgId: uuid('active_org_id').references(() => organizations.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('agent').notNull(),
  avatarUrl: text('avatar_url'),
  isOnline: boolean('is_online').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userOrganizations = pgTable(
  'user_organizations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').default('agent').notNull(),
    isOwner: boolean('is_owner').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    permissions: jsonb('permissions').default({}).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userOrgUnique: uniqueIndex('user_organizations_user_org_unique').on(table.userId, table.orgId),
  })
)

export const orgInvitations = pgTable(
  'org_invitations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    email: text('email').notNull(),
    role: text('role').default('agent').notNull(),
    token: uuid('token').default(sql`gen_random_uuid()`).notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    permissions: jsonb('permissions').default({}).notNull(),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .default(sql`(now() + interval '7 days')`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('org_invitations_token_unique').on(table.token),
  })
)

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text('email'),
  name: text('name'),
  phone: text('phone'),
  meta: jsonb('meta').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  status: text('status').default('bot').notNull(),
  queueState: text('queue_state').default('bot').notNull(),
  queueEnteredAt: timestamp('queue_entered_at', { withTimezone: true }).defaultNow().notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  firstResponseDueAt: timestamp('first_response_due_at', { withTimezone: true }),
  nextResponseDueAt: timestamp('next_response_due_at', { withTimezone: true }),
  resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  lastCustomerMessageAt: timestamp('last_customer_message_at', { withTimezone: true }),
  lastAgentReplyAt: timestamp('last_agent_reply_at', { withTimezone: true }),
  routingAssignedAt: timestamp('routing_assigned_at', { withTimezone: true }),
  aiContext: jsonb('ai_context').default({}).notNull(),
  channel: text('channel').default('chat').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export const inboxSlaPolicies = pgTable(
  'inbox_sla_policies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    channel: text('channel').default('all').notNull(),
    firstResponseTargetSeconds: integer('first_response_target_seconds').default(600).notNull(),
    nextResponseTargetSeconds: integer('next_response_target_seconds').default(900).notNull(),
    resolutionTargetSeconds: integer('resolution_target_seconds').default(14400).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgChannelUnique: uniqueIndex('inbox_sla_policies_org_channel_unique').on(table.orgId, table.channel),
    orgIndex: index('idx_inbox_sla_policies_org_id').on(table.orgId),
  })
)

export const inboxRoutingState = pgTable(
  'inbox_routing_state',
  {
    orgId: uuid('org_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
    lastAssignedUserId: uuid('last_assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
    lastAssignedAt: timestamp('last_assigned_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lastAssignedUserIndex: index('idx_inbox_routing_state_last_assigned_user_id').on(table.lastAssignedUserId),
  })
)

export const inboxRoutingEvents = pgTable('inbox_routing_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').default('auto').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  attachments: jsonb('attachments').default([]).notNull(),
  aiMetadata: jsonb('ai_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  sourceType: text('source_type'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const kbChunks = pgTable('kb_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  kbId: uuid('kb_id').references(() => knowledgeBases.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', 1536),
  sourceUrl: text('source_url'),
  sourceTitle: text('source_title'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const widgetConfigs = pgTable('widget_configs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  primaryColor: text('primary_color').default('#6366f1').notNull(),
  textColor: text('text_color').default('#ffffff').notNull(),
  bgColor: text('bg_color').default('#ffffff').notNull(),
  position: text('position').default('bottom-right').notNull(),
  welcomeMessage: text('welcome_message').default('Hi! How can we help?').notNull(),
  companyName: text('company_name'),
  logoUrl: text('logo_url'),
  showBranding: boolean('show_branding').default(true).notNull(),
  settings: jsonb('settings').default({}).notNull(),
})

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    stripeSubId: text('stripe_sub_id'),
    stripeCustomerId: text('stripe_customer_id'),
    plan: text('plan').default('free').notNull(),
    status: text('status').default('active').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  },
  (table) => ({
    orgUnique: uniqueIndex('subscriptions_org_id_key').on(table.orgId),
    stripeCustomerUnique: uniqueIndex('subscriptions_stripe_customer_id_key').on(table.stripeCustomerId),
  })
)

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  period: text('period').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const orgApiKeys = pgTable('org_api_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  openaiKeyEncrypted: text('openai_key_encrypted'),
  claudeKeyEncrypted: text('claude_key_encrypted'),
  vapiKeyEncrypted: text('vapi_key_encrypted'),
})

export const emailAccounts = pgTable('email_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  resendApiKey: text('resend_api_key'),
  fromEmail: text('from_email').default('').notNull(),
  fromName: text('from_name').default('Support').notNull(),
  inboundAddress: text('inbound_address'),
  inboundProvider: text('inbound_provider').default('postmark').notNull(),
  inboundWebhookToken: text('inbound_webhook_token'),
  isActive: boolean('is_active').default(false).notNull(),
  aiAutoReply: boolean('ai_auto_reply').default(false).notNull(),
  emailSignature: text('email_signature'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  externalMessageId: text('external_message_id'),
  inReplyTo: text('in_reply_to'),
  referencesHeader: text('references_header'),
  subject: text('subject').default('').notNull(),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name'),
  toEmails: text('to_emails').array().default(sql`'{}'::text[]`).notNull(),
  ccEmails: text('cc_emails').array().default(sql`'{}'::text[]`),
  htmlBody: text('html_body'),
  textBody: text('text_body'),
  direction: text('direction').default('inbound').notNull(),
  status: text('status').default('received').notNull(),
  errorMessage: text('error_message'),
  rawHeaders: jsonb('raw_headers').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vapiAssistants = pgTable('vapi_assistants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  vapiAssistantId: text('vapi_assistant_id'),
  name: text('name').default('Support Assistant').notNull(),
  firstMessage: text('first_message').default('Hello! How can I help you today?').notNull(),
  systemPrompt: text('system_prompt'),
  voice: text('voice').default('jennifer-playht').notNull(),
  model: text('model').default('gpt-4o-mini').notNull(),
  language: text('language').default('en').notNull(),
  maxDurationSeconds: integer('max_duration_seconds').default(600).notNull(),
  backgroundSound: text('background_sound').default('off').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  phoneNumberId: text('phone_number_id'),
  kbIds: text('kb_ids').array().default(sql`'{}'::text[]`).notNull(),
  toolsEnabled: boolean('tools_enabled').default(true).notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  vapiCallId: text('vapi_call_id').unique().notNull(),
  vapiAssistantId: text('vapi_assistant_id'),
  phoneNumberId: text('phone_number_id'),
  status: text('status').default('created').notNull(),
  type: text('type').default('webCall').notNull(),
  direction: text('direction').default('inbound').notNull(),
  durationSeconds: integer('duration_seconds'),
  recordingUrl: text('recording_url'),
  stereoRecordingUrl: text('stereo_recording_url'),
  transcript: text('transcript'),
  summary: text('summary'),
  costCents: text('cost_cents'),
  costBreakdown: jsonb('cost_breakdown'),
  endedReason: text('ended_reason'),
  callerNumber: text('caller_number'),
  calledNumber: text('called_number'),
  visitorId: text('visitor_id'),
  metadata: jsonb('metadata').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const whatsappAccounts = pgTable('whatsapp_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  phoneNumberId: text('phone_number_id').notNull(),
  whatsappBusinessId: text('whatsapp_business_id').notNull(),
  accessToken: text('access_token').notNull(),
  displayPhoneNumber: text('display_phone_number'),
  displayName: text('display_name'),
  webhookVerifyToken: text('webhook_verify_token').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  aiAutoReply: boolean('ai_auto_reply').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  waMessageId: text('wa_message_id').unique(),
  waContactId: text('wa_contact_id'),
  direction: text('direction').notNull(),
  status: text('status').default('sent').notNull(),
  messageType: text('message_type').default('text').notNull(),
  mediaUrl: text('media_url'),
  mediaMimeType: text('media_mime_type'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiActions = pgTable(
  'ai_actions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    method: text('method').default('GET').notNull(),
    urlTemplate: text('url_template').notNull(),
    headersTemplate: jsonb('headers_template').default({}).notNull(),
    bodyTemplate: text('body_template'),
    responsePath: text('response_path'),
    responseTemplate: text('response_template'),
    parameters: jsonb('parameters').default([]).notNull(),
    requiresConfirmation: boolean('requires_confirmation').default(false).notNull(),
    humanApprovalRequired: boolean('human_approval_required').default(false).notNull(),
    timeoutSeconds: integer('timeout_seconds').default(10).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    category: text('category').default('custom').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgNameUnique: uniqueIndex('ai_actions_org_name_unique').on(table.orgId, table.name),
  })
)

export const aiActionSecrets = pgTable(
  'ai_action_secrets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    actionId: uuid('action_id').references(() => aiActions.id, { onDelete: 'cascade' }).notNull(),
    keyName: text('key_name').notNull(),
    keyValue: text('key_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    actionKeyUnique: uniqueIndex('ai_action_secrets_action_key_unique').on(table.actionId, table.keyName),
  })
)

export const aiActionLogs = pgTable('ai_action_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  actionId: uuid('action_id').references(() => aiActions.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  parametersUsed: jsonb('parameters_used'),
  requestPayload: jsonb('request_payload'),
  responseRaw: jsonb('response_raw'),
  responseParsed: text('response_parsed'),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  statusCode: integer('status_code'),
  retryCount: integer('retry_count').default(0).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiActionApprovals = pgTable(
  'ai_action_approvals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    logId: uuid('log_id').references(() => aiActionLogs.id, { onDelete: 'cascade' }).notNull(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    actionName: text('action_name').notNull(),
    parameters: jsonb('parameters'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .default(sql`(now() + interval '30 minutes')`)
      .notNull(),
  },
  (table) => ({
    logUnique: uniqueIndex('ai_action_approvals_log_unique').on(table.logId),
  })
)
