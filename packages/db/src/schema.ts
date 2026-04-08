import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  customType,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── pgvector custom type ─────────────────────────────────────────────────────
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

// ─── Tables ───────────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  plan: text('plan').default('free').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  // NEW: tracks which org the user is currently "working in"
  activeOrgId: uuid('active_org_id').references(() => organizations.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('agent').notNull(),
  avatarUrl: text('avatar_url'),
  isOnline: boolean('is_online').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// NEW: many-to-many join table — one user can belong to many orgs
export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('agent').notNull(), // 'admin' | 'agent'
  isDefault: boolean('is_default').default(false).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
})

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text('email'),
  name: text('name'),
  phone: text('phone'),
  meta: jsonb('meta').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id),
  status: text('status').default('bot').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  aiContext: jsonb('ai_context').default({}).notNull(),
  channel: text('channel').default('chat').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  attachments: jsonb('attachments').default([]).notNull(),
  aiMetadata: jsonb('ai_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  sourceType: text('source_type'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const widgetConfigs = pgTable('widget_configs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  primaryColor: text('primary_color').default('#6366f1').notNull(),
  textColor: text('text_color').default('#ffffff').notNull(),
  bgColor: text('bg_color').default('#ffffff').notNull(),
  position: text('position').default('bottom-right').notNull(),
  welcomeMessage: text('welcome_message').default('Hi 👋 How can we help?').notNull(),
  companyName: text('company_name'),
  logoUrl: text('logo_url'),
  showBranding: boolean('show_branding').default(true).notNull(),
  settings: jsonb('settings').default({}).notNull(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  stripeSubId: text('stripe_sub_id'),
  plan: text('plan').default('free').notNull(),
  status: text('status').default('active').notNull(),
  currentPeriodEnd: timestamp('current_period_end'),
})

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  period: text('period').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const orgApiKeys = pgTable('org_api_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').unique().references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  openaiKeyEncrypted: text('openai_key_encrypted'),
  claudeKeyEncrypted: text('claude_key_encrypted'),
  vapiKeyEncrypted: text('vapi_key_encrypted'),
})