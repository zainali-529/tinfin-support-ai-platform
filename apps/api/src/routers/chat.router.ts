import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

const statusFilterSchema = z.enum(['all', 'bot', 'open', 'pending', 'resolved'])
const channelFilterSchema = z.enum(['all', 'chat', 'email', 'whatsapp'])

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

type ConversationListItem = {
  id: string
  org_id: string
  contact_id: string | null
  status: string
  channel: string
  assigned_to: string | null
  started_at: string
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
      const rawSearch = input?.search?.trim() ?? ''
      const search = rawSearch.length > 0 ? cleanSearchValue(rawSearch) : ''
      const offset = (page - 1) * limit

      let query = ctx.supabase
        .from('conversations')
        .select('id, org_id, contact_id, status, channel, assigned_to, started_at, contacts(id, name, email, phone)', {
          count: 'exact',
        })
        .eq('org_id', orgId)

      if (channel !== 'all') {
        query = query.eq('channel', channel)
      }

      if (status === 'resolved') {
        query = query.in('status', ['resolved', 'closed'])
      } else if (status !== 'all') {
        query = query.eq('status', status)
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

      const rows = (baseRows ?? []) as Array<{
        id: string
        org_id: string
        contact_id: string | null
        status: string
        channel: string
        assigned_to: string | null
        started_at: string
        contacts: unknown
      }>

      const conversationIds = rows.map((row) => row.id)
      const latestMessageByConversation = new Map<string, { content: string | null; created_at: string }>()
      const latestEmailByConversation = new Map<string, { subject: string | null; created_at: string }>()

      if (conversationIds.length > 0) {
        const messageLimit = Math.min(Math.max(conversationIds.length * 25, 80), 1200)
        const emailLimit = Math.min(Math.max(conversationIds.length * 10, 40), 600)

        const [messagesResult, emailsResult] = await Promise.all([
          ctx.supabase
            .from('messages')
            .select('conversation_id, content, created_at')
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(messageLimit),
          ctx.supabase
            .from('email_messages')
            .select('conversation_id, subject, created_at')
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(emailLimit),
        ])

        if (messagesResult.error || emailsResult.error) {
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
      }

      const totalCount = count ?? 0
      const hasMore = page * limit < totalCount

      const items: ConversationListItem[] = rows.map((row) => {
        const latestMessage = latestMessageByConversation.get(row.id)
        const latestEmail = latestEmailByConversation.get(row.id)

        return {
          id: row.id,
          org_id: row.org_id,
          contact_id: row.contact_id,
          status: row.status,
          channel: row.channel,
          assigned_to: row.assigned_to,
          started_at: row.started_at,
          contacts: normalizeContact(row.contacts),
          latest_message_content: latestMessage?.content ?? null,
          latest_message_at: latestMessage?.created_at ?? null,
          latest_email_subject: latestEmail?.subject ?? null,
          latest_email_at: latestEmail?.created_at ?? null,
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

      const { data } = await ctx.supabase
        .from('conversations')
        .update({ status: input.status, assigned_to: input.assignedTo ?? null })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .select()
        .single()

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      return data
    }),
})
