import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'
import { routePendingConversation } from '../services/inbox-ops.service'
import {
  deriveInboxBacklog,
  deriveInboxSla,
  normalizeQueueState,
  type BacklogState,
  type SlaStage,
  type SlaState,
} from '../lib/inbox-metrics'

const statusFilterSchema = z.enum(['all', 'bot', 'open', 'pending', 'resolved'])
const channelFilterSchema = z.enum(['all', 'chat', 'email', 'whatsapp'])
const queueFilterSchema = z.enum([
  'all',
  'bot',
  'queued',
  'assigned',
  'in_progress',
  'waiting_customer',
  'resolved',
])

function cleanSearchValue(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim()
}

function toCsv(values: string[]): string {
  return values.join(',')
}

function normalizeContact(value: unknown): {
  id: string
  name: string | null
  email: string | null
  phone: string | null
} | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null

  const contact = row as {
    id?: string
    name?: string | null
    email?: string | null
    phone?: string | null
  }

  if (!contact.id) return null

  return {
    id: contact.id,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const label of labels) {
    const next = label.trim().replace(/\s+/g, ' ').slice(0, 32)
    if (!next) continue
    const key = next.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(next)
    if (output.length >= 12) break
  }

  return output
}

type ConversationListItem = {
  id: string
  org_id: string
  contact_id: string | null
  status: string
  queue_state: string
  channel: string
  assigned_to: string | null
  started_at: string
  queue_entered_at: string
  first_response_due_at: string | null
  next_response_due_at: string | null
  resolution_due_at: string | null
  first_response_at: string | null
  last_customer_message_at: string | null
  last_agent_reply_at: string | null
  routing_assigned_at: string | null
  backlog_minutes: number | null
  backlog_state: BacklogState
  sla_target_at: string | null
  sla_state: SlaState
  sla_remaining_seconds: number | null
  sla_stage: SlaStage
  sla_is_live: boolean
  contacts: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  latest_message_content: string | null
  latest_message_at: string | null
  latest_email_subject: string | null
  latest_email_at: string | null
  resolved_at: string | null
  assigned_agent_name: string | null
  assigned_agent_email: string | null
  ai_context: Record<string, unknown>
}

export const chatRouter = router({
  getConversations: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().uuid().optional(),
          search: z.string().max(120).optional(),
          status: statusFilterSchema.default('all'),
          channel: channelFilterSchema.default('all'),
          queue: queueFilterSchema.default('all'),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const page = input?.page ?? 1
      const limit = input?.limit ?? 10
      const status = input?.status ?? 'all'
      const channel = input?.channel ?? 'all'
      const queue = input?.queue ?? 'all'
      const rawSearch = input?.search?.trim() ?? ''
      const search = rawSearch.length > 0 ? cleanSearchValue(rawSearch) : ''
      const offset = (page - 1) * limit

      let query = ctx.supabase
        .from('conversations')
        .select(
          [
            'id',
            'org_id',
            'contact_id',
            'status',
            'queue_state',
            'queue_entered_at',
            'channel',
            'assigned_to',
            'ai_context',
            'started_at',
            'resolved_at',
            'first_response_due_at',
            'next_response_due_at',
            'resolution_due_at',
            'first_response_at',
            'last_customer_message_at',
            'last_agent_reply_at',
            'routing_assigned_at',
            'contacts(id, name, email, phone)',
          ].join(','),
          { count: 'exact' }
        )
        .eq('org_id', orgId)

      if (channel !== 'all') {
        query = query.eq('channel', channel)
      }

      if (status === 'resolved') {
        query = query.in('status', ['resolved', 'closed'])
      } else if (status !== 'all') {
        query = query.eq('status', status)
      }

      if (queue === 'resolved') {
        query = query.in('queue_state', ['resolved'])
      } else if (queue !== 'all') {
        query = query.eq('queue_state', queue)
      }

      if (search) {
        const [contactMatchResult, messageMatchResult, emailMatchResult] = await Promise.all([
          ctx.supabase
            .from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
            .limit(250),
          ctx.supabase
            .from('messages')
            .select('conversation_id')
            .eq('org_id', orgId)
            .ilike('content', `%${search}%`)
            .limit(350),
          ctx.supabase
            .from('email_messages')
            .select('conversation_id')
            .eq('org_id', orgId)
            .ilike('subject', `%${search}%`)
            .limit(350),
        ])

        if (contactMatchResult.error || messageMatchResult.error || emailMatchResult.error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to search conversations.',
          })
        }

        const contactIds = Array.from(
          new Set((contactMatchResult.data ?? []).map((row) => row.id).filter(Boolean))
        ) as string[]

        const conversationIds = Array.from(
          new Set(
            [...(messageMatchResult.data ?? []), ...(emailMatchResult.data ?? [])]
              .map((row) => row.conversation_id)
              .filter(Boolean)
          )
        ) as string[]

        if (contactIds.length === 0 && conversationIds.length === 0) {
          return {
            items: [] as ConversationListItem[],
            totalCount: 0,
            page,
            limit,
            hasMore: false,
          }
        }

        if (contactIds.length > 0 && conversationIds.length > 0) {
          query = query.or(`contact_id.in.(${toCsv(contactIds)}),id.in.(${toCsv(conversationIds)})`)
        } else if (contactIds.length > 0) {
          query = query.in('contact_id', contactIds)
        } else {
          query = query.in('id', conversationIds)
        }
      }

      const { data: baseRows, error: baseError, count } = await query
        .order('started_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1)

      if (baseError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversations: ${baseError.message}`,
        })
      }

      const rows = ((baseRows ?? []) as unknown) as Array<{
        id: string
        org_id: string
        contact_id: string | null
        status: string
        queue_state: string | null
        queue_entered_at: string | null
        channel: string
        assigned_to: string | null
        ai_context: Record<string, unknown> | null
        started_at: string
        resolved_at: string | null
        first_response_due_at: string | null
        next_response_due_at: string | null
        resolution_due_at: string | null
        first_response_at: string | null
        last_customer_message_at: string | null
        last_agent_reply_at: string | null
        routing_assigned_at: string | null
        contacts: unknown
      }>

      const conversationIds = rows.map((row) => row.id)
      const assignedAgentIds = Array.from(
        new Set(rows.map((row) => row.assigned_to).filter((value): value is string => Boolean(value)))
      )
      const latestMessageByConversation = new Map<string, { content: string | null; created_at: string }>()
      const latestEmailByConversation = new Map<string, { subject: string | null; created_at: string }>()
      const assignedAgentById = new Map<string, { name: string | null; email: string | null }>()

      if (conversationIds.length > 0 || assignedAgentIds.length > 0) {
        const messageLimit = Math.min(Math.max(conversationIds.length * 25, 80), 1200)
        const emailLimit = Math.min(Math.max(conversationIds.length * 10, 40), 600)
        const [
          messagesResult,
          emailsResult,
          assignedMembersResult,
        ] = await Promise.all([
          conversationIds.length > 0
            ? ctx.supabase
                .from('messages')
                .select('conversation_id, content, created_at')
                .eq('org_id', orgId)
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false })
                .limit(messageLimit)
            : Promise.resolve({ data: [], error: null }),
          conversationIds.length > 0
            ? ctx.supabase
                .from('email_messages')
                .select('conversation_id, subject, created_at')
                .eq('org_id', orgId)
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false })
                .limit(emailLimit)
            : Promise.resolve({ data: [], error: null }),
          assignedAgentIds.length > 0
            ? ctx.supabase
                .from('user_organizations')
                .select('user_id, users(name, email)')
                .eq('org_id', orgId)
                .in('user_id', assignedAgentIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (messagesResult.error || emailsResult.error || assignedMembersResult.error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to load conversation previews.',
          })
        }

        for (const row of (messagesResult.data ?? []) as Array<{
          conversation_id: string
          content: string | null
          created_at: string
        }>) {
          if (!latestMessageByConversation.has(row.conversation_id)) {
            latestMessageByConversation.set(row.conversation_id, {
              content: row.content,
              created_at: row.created_at,
            })
          }
        }

        for (const row of (emailsResult.data ?? []) as Array<{
          conversation_id: string
          subject: string | null
          created_at: string
        }>) {
          if (!latestEmailByConversation.has(row.conversation_id)) {
            latestEmailByConversation.set(row.conversation_id, {
              subject: row.subject,
              created_at: row.created_at,
            })
          }
        }

        for (const row of (assignedMembersResult.data ?? []) as Array<{
          user_id: string
          users:
            | {
                name: string | null
                email: string | null
              }
            | Array<{
                name: string | null
                email: string | null
              }>
            | null
        }>) {
          const user = Array.isArray(row.users) ? row.users[0] : row.users
          assignedAgentById.set(row.user_id, {
            name: user?.name ?? null,
            email: user?.email ?? null,
          })
        }
      }

      const totalCount = count ?? 0
      const hasMore = page * limit < totalCount
      const nowMs = Date.now()

      const items: ConversationListItem[] = rows.map((row) => {
        const latestMessage = latestMessageByConversation.get(row.id)
        const latestEmail = latestEmailByConversation.get(row.id)
        const metricRow = {
          status: row.status,
          queue_state: row.queue_state,
          assigned_to: row.assigned_to,
          started_at: row.started_at,
          queue_entered_at: row.queue_entered_at,
          first_response_due_at: row.first_response_due_at,
          next_response_due_at: row.next_response_due_at,
          resolution_due_at: row.resolution_due_at,
          first_response_at: row.first_response_at,
          last_customer_message_at: row.last_customer_message_at,
          last_agent_reply_at: row.last_agent_reply_at,
          resolved_at: row.resolved_at,
        }
        const normalizedQueueState = normalizeQueueState(metricRow)
        const backlog = deriveInboxBacklog(metricRow, nowMs)
        const sla = deriveInboxSla(metricRow, nowMs)

        const assignedAgent = row.assigned_to
          ? assignedAgentById.get(row.assigned_to) ?? null
          : null

        return {
          id: row.id,
          org_id: row.org_id,
          contact_id: row.contact_id,
          status: row.status,
          queue_state: normalizedQueueState,
          channel: row.channel,
          assigned_to: row.assigned_to,
          ai_context: asRecord(row.ai_context),
          started_at: row.started_at,
          queue_entered_at: row.queue_entered_at ?? row.started_at,
          resolved_at: row.resolved_at,
          first_response_due_at: row.first_response_due_at,
          next_response_due_at: row.next_response_due_at,
          resolution_due_at: row.resolution_due_at,
          first_response_at: row.first_response_at,
          last_customer_message_at: row.last_customer_message_at,
          last_agent_reply_at: row.last_agent_reply_at,
          routing_assigned_at: row.routing_assigned_at,
          backlog_minutes: backlog.backlogMinutes,
          backlog_state: backlog.backlogState,
          sla_target_at: sla.slaTargetAt,
          sla_state: sla.slaState,
          sla_remaining_seconds: sla.slaRemainingSeconds,
          sla_stage: sla.slaStage,
          sla_is_live: sla.slaIsLive,
          contacts: normalizeContact(row.contacts),
          latest_message_content: latestMessage?.content ?? null,
          latest_message_at: latestMessage?.created_at ?? null,
          latest_email_subject: latestEmail?.subject ?? null,
          latest_email_at: latestEmail?.created_at ?? null,
          assigned_agent_name: assignedAgent?.name ?? null,
          assigned_agent_email: assignedAgent?.email ?? null,
        }
      })

      return {
        items,
        totalCount,
        page,
        limit,
        hasMore,
      }
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const { data } = await ctx.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
      return data ?? []
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        status: z.enum(['bot', 'pending', 'open', 'resolved', 'closed']),
        assignedTo: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      if (input.assignedTo) {
        const { data: membership, error: membershipError } = await ctx.supabase
          .from('user_organizations')
          .select('id')
          .eq('org_id', orgId)
          .eq('user_id', input.assignedTo)
          .maybeSingle()

        if (membershipError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to validate assignee: ${membershipError.message}`,
          })
        }

        if (!membership?.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Assigned user is not a member of this organization.',
          })
        }
      }

      const { data: updatedRow, error: updateError } = await ctx.supabase
        .from('conversations')
        .update({ status: input.status, assigned_to: input.assignedTo ?? null })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update conversation: ${updateError.message}`,
        })
      }

      if (!updatedRow?.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      if (input.status === 'pending' && !input.assignedTo) {
        try {
          await routePendingConversation({
            supabase: ctx.supabase,
            orgId,
            conversationId: input.conversationId,
            reason: 'manual_pending',
          })
        } catch (routingError) {
          console.error(
            '[chat.updateStatus] routing failed:',
            routingError instanceof Error ? routingError.message : routingError
          )
        }
      }

      const { data: finalData, error: finalError } = await ctx.supabase
        .from('conversations')
        .select('*')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (finalError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch updated conversation: ${finalError.message}`,
        })
      }

      if (!finalData) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      return finalData
    }),

  updateLabels: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        labels: z.array(z.string().min(1).max(64)).max(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const labels = normalizeLabels(input.labels)

      const { data: existing, error: existingError } = await ctx.supabase
        .from('conversations')
        .select('ai_context')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversation labels: ${existingError.message}`,
        })
      }

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      const aiContext = {
        ...asRecord(existing.ai_context),
        inboxLabels: labels,
      }

      const { error: updateError } = await ctx.supabase
        .from('conversations')
        .update({ ai_context: aiContext })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update labels: ${updateError.message}`,
        })
      }

      return { labels, aiContext }
    }),
})
