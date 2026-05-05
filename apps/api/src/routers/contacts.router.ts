/**
 * apps/api/src/routers/contacts.router.ts
 *
 * Contacts management router.
 *
 * Procedures:
 *   getContacts    — paginated list with search + stats
 *   getContact     — full contact detail with conversations, calls, emails
 *   updateContact  — update name/email/phone
 *   deleteContact  — hard delete (admin only)
 *   createContact  — manual contact creation
 *   importContacts — bulk upsert (admin only, max 500)
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { randomUUID } from 'node:crypto'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'
import { safeRecordConversationTimelineEvent } from '../services/conversation-timeline.service'

const VISITOR_TOMBSTONE_LIMIT = 500
const VISITOR_TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const CONTACT_NOTE_LIMIT = 80
const CONTACT_TIMELINE_LIMIT = 120

type VisitorTombstone = {
  visitorId: string
  deletedAt: string
}

type ContactNote = {
  id: string
  body: string
  createdAt: string
  authorUserId: string | null
  authorName: string | null
}

type ContactTimelineItem = {
  id: string
  type:
    | 'conversation'
    | 'message'
    | 'call'
    | 'email'
    | 'whatsapp'
    | 'action'
    | 'note'
    | 'rating'
  title: string
  body: string | null
  channel: string | null
  status: string | null
  href: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

const contactNoteInput = z.string().trim().min(1).max(2000)
const tagInput = z.string().trim().min(1).max(40)
const customFieldKeyInput = z.string().trim().min(1).max(60)
const customFieldValueInput = z.string().trim().max(500)

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
        .map((item) => item.slice(0, 40))
    )
  ).slice(0, 30)
}

function normalizeCustomFields(value: unknown): Record<string, string> {
  const input = asRecord(value)
  const output: Record<string, string> = {}

  for (const [key, rawValue] of Object.entries(input)) {
    const cleanKey = key.trim().slice(0, 60)
    if (!cleanKey) continue

    const value = typeof rawValue === 'string'
      ? rawValue.trim()
      : rawValue === null || rawValue === undefined
        ? ''
        : String(rawValue).trim()

    if (!value) continue
    output[cleanKey] = value.slice(0, 500)
  }

  return output
}

function normalizeContactNotes(value: unknown): ContactNote[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const note = asRecord(item)
      const id = asString(note.id)
      const body = asString(note.body)
      const createdAt = asString(note.createdAt)
      if (!id || !body || !createdAt) return null

      return {
        id,
        body,
        createdAt,
        authorUserId: asString(note.authorUserId),
        authorName: asString(note.authorName),
      }
    })
    .filter((item): item is ContactNote => Boolean(item))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, CONTACT_NOTE_LIMIT)
}

function truncateText(value: unknown, max = 140): string {
  const text = asString(value) ?? ''
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function timelineItem(input: ContactTimelineItem): ContactTimelineItem {
  return input
}

function readAiQualityRating(metadata: unknown): 'helpful' | 'not_helpful' | null {
  const rating = asString(asRecord(asRecord(metadata).aiQuality).rating)
  return rating === 'helpful' || rating === 'not_helpful' ? rating : null
}

function publicMeta(meta: unknown): Record<string, unknown> {
  const input = asRecord(meta)
  const allowedKeys = [
    'visitorId',
    'externalUserId',
    'phone',
    'company',
    'traits',
    'lastPage',
    'customAttributes',
    'source',
    'lastSeenAt',
    'tags',
    'customFields',
    'contactNotes',
  ]

  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(input, key))
      .map((key) => [key, input[key]])
  )
}

function readVisitorId(meta: unknown): string | null {
  const visitorId = asRecord(meta).visitorId
  return typeof visitorId === 'string' && visitorId.trim().length > 0
    ? visitorId.trim()
    : null
}

function normalizeVisitorTombstones(value: unknown): VisitorTombstone[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const row = asRecord(item)
      const visitorId = typeof row.visitorId === 'string' ? row.visitorId.trim() : ''
      const deletedAt = typeof row.deletedAt === 'string' ? row.deletedAt : ''
      if (!visitorId || !deletedAt) return null
      return { visitorId, deletedAt }
    })
    .filter((item): item is VisitorTombstone => Boolean(item))
}

async function tombstoneDeletedVisitor(
  supabase: any,
  orgId: string,
  visitorId: string | null
): Promise<void> {
  if (!visitorId) return

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

  const now = new Date()
  const settings = asRecord(data?.settings)
  const existing = normalizeVisitorTombstones(settings.visitorIdentityTombstones)
  const fresh = existing.filter((item) => {
    if (item.visitorId === visitorId) return false
    const age = now.getTime() - new Date(item.deletedAt).getTime()
    return Number.isFinite(age) && age < VISITOR_TOMBSTONE_MAX_AGE_MS
  })

  const nextSettings = {
    ...settings,
    visitorIdentityTombstones: [
      { visitorId, deletedAt: now.toISOString() },
      ...fresh,
    ].slice(0, VISITOR_TOMBSTONE_LIMIT),
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId)

  if (updateError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to update visitor deletion marker: ${updateError.message}`,
    })
  }
}

async function deleteRows(
  query: PromiseLike<{ error: { message: string } | null }>,
  message: string
): Promise<void> {
  const { error } = await query
  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `${message}: ${error.message}`,
    })
  }
}

export const contactsRouter = router({

  getContacts: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId
      const page = input?.page ?? 1
      const limit = input?.limit ?? 50
      const search = input?.search?.trim() ?? ''
      const offset = (page - 1) * limit

      // Build base query with search
      let query = ctx.supabase
        .from('contacts')
        .select('id, name, email, phone, meta, created_at', { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      }

      const { data: contacts, count, error } = await query

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch contacts: ${error.message}` })
      }

      // Fetch conversation stats for all contacts in one query
      const contactIds = (contacts ?? []).map((c: { id: string }) => c.id)

      let convStats: Array<{
        contact_id: string
        count: number
        last_started: string
        channel: string
      }> = []

      let callStats: Array<{ contact_id: string; count: number }> = []

      if (contactIds.length > 0) {
        const { data: convData } = await ctx.supabase
          .from('conversations')
          .select('contact_id, started_at, channel')
          .eq('org_id', orgId)
          .in('contact_id', contactIds)
          .order('started_at', { ascending: false })

        // Group conversation stats by contact
        const convMap = new Map<string, { count: number; last_started: string; channel: string }>()
        for (const conv of convData ?? []) {
          const cid = conv.contact_id as string
          if (!convMap.has(cid)) {
            convMap.set(cid, { count: 0, last_started: conv.started_at as string, channel: conv.channel as string })
          }
          const entry = convMap.get(cid)!
          entry.count++
        }
        convStats = Array.from(convMap.entries()).map(([contact_id, v]) => ({ contact_id, ...v }))

        // Fetch call stats
        const { data: callData } = await ctx.supabase
          .from('calls')
          .select('contact_id')
          .eq('org_id', orgId)
          .in('contact_id', contactIds)

        const callMap = new Map<string, number>()
        for (const call of callData ?? []) {
          const cid = call.contact_id as string
          callMap.set(cid, (callMap.get(cid) ?? 0) + 1)
        }
        callStats = Array.from(callMap.entries()).map(([contact_id, count]) => ({ contact_id, count }))
      }

      // Fetch last messages for conversations
      const convStatsMap = new Map(convStats.map(s => [s.contact_id, s]))
      const callStatsMap = new Map(callStats.map(s => [s.contact_id, s]))

      const result = (contacts ?? []).map((contact: {
        id: string
        name: string | null
        email: string | null
        phone: string | null
        meta: Record<string, unknown> | null
        created_at: string
      }) => {
        const conv = convStatsMap.get(contact.id)
        const call = callStatsMap.get(contact.id)
        const meta = contact.meta as Record<string, unknown> | null
        return {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          meta: publicMeta(meta),
          tags: normalizeTags(meta?.tags),
          lastSeenAt: asString(meta?.lastSeenAt),
          currentPage: asRecord(meta?.lastPage),
          createdAt: contact.created_at,
          conversationCount: conv?.count ?? 0,
          lastConversationAt: conv?.last_started ?? null,
          channel: conv?.channel ?? (meta?.source as string | null) ?? null,
          callCount: call?.count ?? 0,
        }
      })

      return {
        contacts: result,
        totalCount: count ?? 0,
        page,
        limit,
        hasMore: page * limit < (count ?? 0),
      }
    }),

  getContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      // Fetch contact
      const { data: contact, error } = await ctx.supabase
        .from('contacts')
        .select('*')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (error || !contact) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      // Fetch conversations
      const { data: conversations } = await ctx.supabase
        .from('conversations')
        .select('id, status, channel, started_at, resolved_at, assigned_to, last_customer_message_at, last_agent_reply_at')
        .eq('org_id', orgId)
        .eq('contact_id', input.id)
        .order('started_at', { ascending: false })

      // Fetch last message for each conversation
      const convIds = (conversations ?? []).map((c: { id: string }) => c.id)
      let lastMessages: Record<string, string> = {}
      let messages: Array<{
        id: string
        conversation_id: string
        role: string
        content: string
        ai_metadata: Record<string, unknown> | null
        created_at: string
      }> = []

      if (convIds.length > 0) {
        const { data: msgs } = await ctx.supabase
          .from('messages')
          .select('id, conversation_id, role, content, ai_metadata, created_at')
          .eq('org_id', orgId)
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(300)

        messages = ((msgs ?? []) as typeof messages)
        const seen = new Set<string>()
        for (const msg of messages) {
          const cid = msg.conversation_id as string
          if (!seen.has(cid)) {
            lastMessages[cid] = (msg.content as string)?.slice(0, 80) ?? ''
            seen.add(cid)
          }
        }
      }

      // Fetch calls
      const { data: calls } = await ctx.supabase
        .from('calls')
        .select('id, status, type, duration_seconds, started_at, summary, ended_reason, caller_number')
        .eq('org_id', orgId)
        .eq('contact_id', input.id)
        .order('started_at', { ascending: false })

      // Fetch email conversations (distinct)
      const { data: emailMessages } = await ctx.supabase
        .from('email_messages')
        .select('id, conversation_id, subject, direction, created_at, from_email')
        .eq('org_id', orgId)
        .in('conversation_id', convIds.length > 0 ? convIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })

      // Deduplicate email threads
      const emailThreadMap = new Map<string, {
        conversationId: string
        subject: string
        direction: string
        createdAt: string
        fromEmail: string
      }>()
      for (const em of emailMessages ?? []) {
        const cid = em.conversation_id as string
        if (!emailThreadMap.has(cid)) {
          emailThreadMap.set(cid, {
            conversationId: cid,
            subject: em.subject as string,
            direction: em.direction as string,
            createdAt: em.created_at as string,
            fromEmail: em.from_email as string,
          })
        }
      }

      // Fetch WhatsApp conversations (distinct)
      const { data: whatsappMessages } = await ctx.supabase
        .from('whatsapp_messages')
        .select('id, conversation_id, direction, status, message_type, created_at, wa_contact_id')
        .eq('org_id', orgId)
        .in('conversation_id', convIds.length > 0 ? convIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })

      const whatsappThreadMap = new Map<string, {
        conversationId: string
        direction: string
        status: string
        messageType: string
        createdAt: string
        waContactId: string | null
      }>()
      for (const wm of whatsappMessages ?? []) {
        const cid = wm.conversation_id as string
        if (!whatsappThreadMap.has(cid)) {
          whatsappThreadMap.set(cid, {
            conversationId: cid,
            direction: wm.direction as string,
            status: wm.status as string,
            messageType: wm.message_type as string,
            createdAt: wm.created_at as string,
            waContactId: (wm.wa_contact_id as string | null) ?? null,
          })
        }
      }

      const { data: actionLogs } = await ctx.supabase
        .from('ai_action_logs')
        .select('id, action_id, conversation_id, contact_id, parameters_used, response_parsed, status, error_message, duration_ms, created_at, completed_at, ai_actions(name, display_name)')
        .eq('org_id', orgId)
        .or(convIds.length > 0
          ? `contact_id.eq.${input.id},conversation_id.in.(${convIds.join(',')})`
          : `contact_id.eq.${input.id}`)
        .order('created_at', { ascending: false })
        .limit(80)

      const contactMeta = asRecord(contact.meta)
      const tags = normalizeTags(contactMeta.tags)
      const customFields = normalizeCustomFields(contactMeta.customFields)
      const contactNotes = normalizeContactNotes(contactMeta.contactNotes)
      const currentPage = asRecord(contactMeta.lastPage)
      const company = asRecord(contactMeta.company)
      const traits = asRecord(contactMeta.traits)
      const customAttributes = asRecord(contactMeta.customAttributes)
      const lastSeenAt = asString(contactMeta.lastSeenAt)
      const createdAt = contact.created_at as string
      const conversationById = new Map(
        ((conversations ?? []) as Array<{ id: string; channel: string; status: string; started_at: string }>).map((conversation) => [
          conversation.id,
          conversation,
        ])
      )

      const timeline: ContactTimelineItem[] = []

      for (const conversation of (conversations ?? []) as Array<{
        id: string
        status: string
        channel: string
        started_at: string
        resolved_at: string | null
      }>) {
        timeline.push(timelineItem({
          id: `conversation:${conversation.id}`,
          type: 'conversation',
          title: `${conversation.channel} conversation started`,
          body: lastMessages[conversation.id] || null,
          channel: conversation.channel,
          status: conversation.status,
          href: `/inbox?conversation=${conversation.id}`,
          createdAt: conversation.started_at,
          metadata: { conversationId: conversation.id },
        }))

        if (conversation.resolved_at) {
          timeline.push(timelineItem({
            id: `conversation:${conversation.id}:resolved`,
            type: 'conversation',
            title: 'Conversation resolved',
            body: null,
            channel: conversation.channel,
            status: 'resolved',
            href: `/inbox?conversation=${conversation.id}`,
            createdAt: conversation.resolved_at,
            metadata: { conversationId: conversation.id },
          }))
        }
      }

      for (const message of messages.slice(0, 80)) {
        const conversation = conversationById.get(message.conversation_id)
        const rating = readAiQualityRating(message.ai_metadata)
        timeline.push(timelineItem({
          id: `message:${message.id}`,
          type: rating ? 'rating' : 'message',
          title: rating
            ? `AI answer marked ${rating === 'helpful' ? 'helpful' : 'not helpful'}`
            : message.role === 'user'
              ? 'Customer message'
              : message.role === 'assistant'
                ? 'AI response sent'
                : 'Agent message',
          body: truncateText(message.content, 180),
          channel: conversation?.channel ?? null,
          status: null,
          href: `/inbox?conversation=${message.conversation_id}`,
          createdAt: message.created_at,
          metadata: {
            conversationId: message.conversation_id,
            messageId: message.id,
            role: message.role,
            ...(rating ? { rating } : {}),
          },
        }))
      }

      for (const call of (calls ?? []) as Array<{
        id: string
        status: string
        type: string
        duration_seconds: number | null
        started_at: string | null
        summary: string | null
      }>) {
        timeline.push(timelineItem({
          id: `call:${call.id}`,
          type: 'call',
          title: 'Voice call',
          body: call.summary ? truncateText(call.summary, 180) : null,
          channel: 'voice',
          status: call.status,
          href: null,
          createdAt: call.started_at ?? createdAt,
          metadata: {
            callId: call.id,
            durationSeconds: call.duration_seconds,
            callType: call.type,
          },
        }))
      }

      for (const thread of emailThreadMap.values()) {
        timeline.push(timelineItem({
          id: `email:${thread.conversationId}`,
          type: 'email',
          title: thread.subject || 'Email thread',
          body: `Latest ${thread.direction} email from ${thread.fromEmail}`,
          channel: 'email',
          status: thread.direction,
          href: `/inbox?channel=email&conversation=${thread.conversationId}`,
          createdAt: thread.createdAt,
          metadata: { conversationId: thread.conversationId },
        }))
      }

      for (const thread of whatsappThreadMap.values()) {
        timeline.push(timelineItem({
          id: `whatsapp:${thread.conversationId}`,
          type: 'whatsapp',
          title: 'WhatsApp message',
          body: thread.waContactId ? `WhatsApp contact ${thread.waContactId}` : null,
          channel: 'whatsapp',
          status: thread.status,
          href: `/inbox?channel=whatsapp&conversation=${thread.conversationId}`,
          createdAt: thread.createdAt,
          metadata: {
            conversationId: thread.conversationId,
            messageType: thread.messageType,
          },
        }))
      }

      for (const log of (actionLogs ?? []) as Array<{
        id: string
        conversation_id: string | null
        contact_id: string | null
        parameters_used: Record<string, unknown> | null
        response_parsed: string | null
        status: string
        error_message: string | null
        duration_ms: number | null
        created_at: string
        completed_at: string | null
        ai_actions: { name: string | null; display_name: string | null } | Array<{ name: string | null; display_name: string | null }> | null
      }>) {
        const action = Array.isArray(log.ai_actions) ? log.ai_actions[0] : log.ai_actions
        timeline.push(timelineItem({
          id: `action:${log.id}`,
          type: 'action',
          title: action?.display_name || action?.name || 'AI action',
          body: log.response_parsed || log.error_message || null,
          channel: log.conversation_id ? (conversationById.get(log.conversation_id)?.channel ?? null) : null,
          status: log.status,
          href: log.conversation_id ? `/inbox?conversation=${log.conversation_id}` : '/ai-actions',
          createdAt: log.completed_at ?? log.created_at,
          metadata: {
            actionLogId: log.id,
            actionName: action?.name,
            durationMs: log.duration_ms,
            parameters: log.parameters_used,
          },
        }))
      }

      for (const note of contactNotes) {
        timeline.push(timelineItem({
          id: `note:${note.id}`,
          type: 'note',
          title: 'Contact note added',
          body: note.body,
          channel: null,
          status: null,
          href: null,
          createdAt: note.createdAt,
          metadata: {
            noteId: note.id,
            authorUserId: note.authorUserId,
            authorName: note.authorName,
          },
        }))
      }

      const satisfactionHistory = messages
        .map((message) => {
          const rating = readAiQualityRating(message.ai_metadata)
          if (!rating) return null
          return {
            messageId: message.id,
            conversationId: message.conversation_id,
            rating,
            createdAt: message.created_at,
            preview: truncateText(message.content, 160),
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 30)

      const aiActionsUsed = ((actionLogs ?? []) as Array<{
        id: string
        status: string
        duration_ms: number | null
        created_at: string
        completed_at: string | null
        response_parsed: string | null
        error_message: string | null
        ai_actions: { name: string | null; display_name: string | null } | Array<{ name: string | null; display_name: string | null }> | null
      }>).map((log) => {
        const action = Array.isArray(log.ai_actions) ? log.ai_actions[0] : log.ai_actions
        return {
          id: log.id,
          name: action?.name ?? 'unknown_action',
          displayName: action?.display_name ?? action?.name ?? 'AI action',
          status: log.status,
          durationMs: log.duration_ms,
          createdAt: log.completed_at ?? log.created_at,
          summary: truncateText(log.response_parsed || log.error_message, 180),
        }
      })

      timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Stats
      const resolvedCount = (conversations ?? []).filter(
        (c: { status: string }) => c.status === 'resolved' || c.status === 'closed'
      ).length
      const chatCount = (conversations ?? []).filter(
        (c: { channel: string }) => c.channel === 'chat'
      ).length
      const channelCounts = (conversations ?? []).reduce<Record<string, number>>((acc, row: { channel: string }) => {
        acc[row.channel] = (acc[row.channel] ?? 0) + 1
        return acc
      }, {})

      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        meta: publicMeta(contactMeta),
        tags,
        customFields,
        contactNotes,
        company,
        traits,
        customAttributes,
        currentPage,
        lastSeenAt,
        createdAt,
        conversations: (conversations ?? []).map((c: {
          id: string
          status: string
          channel: string
          started_at: string
          resolved_at: string | null
          assigned_to: string | null
        }) => ({
          id: c.id,
          status: c.status,
          channel: c.channel,
          startedAt: c.started_at,
          resolvedAt: c.resolved_at,
          assignedTo: c.assigned_to,
          lastMessagePreview: lastMessages[c.id] ?? '',
        })),
        calls: (calls ?? []).map((c: {
          id: string
          status: string
          type: string
          duration_seconds: number | null
          started_at: string | null
          summary: string | null
          ended_reason: string | null
          caller_number: string | null
        }) => ({
          id: c.id,
          status: c.status,
          type: c.type,
          durationSeconds: c.duration_seconds,
          startedAt: c.started_at,
          summary: c.summary,
          endedReason: c.ended_reason,
          callerNumber: c.caller_number,
        })),
        emailThreads: Array.from(emailThreadMap.values()),
        whatsappThreads: Array.from(whatsappThreadMap.values()),
        timeline: timeline.slice(0, CONTACT_TIMELINE_LIMIT),
        satisfactionHistory,
        aiActionsUsed,
        stats: {
          totalConversations: (conversations ?? []).length,
          totalChats: chatCount,
          resolvedConversations: resolvedCount,
          totalCalls: (calls ?? []).length,
          totalEmails: emailThreadMap.size,
          totalWhatsApp: whatsappThreadMap.size,
          channelCounts,
          satisfactionRatings: satisfactionHistory.length,
          aiActionsUsed: aiActionsUsed.length,
        },
      }
    }),

  updateContact: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(30).optional().or(z.literal('')),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      // Verify ownership
      const { data: existing } = await ctx.supabase
        .from('contacts')
        .select('id, meta')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      const payload: Record<string, unknown> = {}
      if (input.name !== undefined) payload.name = input.name || null
      if (input.email !== undefined) payload.email = input.email || null
      if (input.phone !== undefined) payload.phone = input.phone || null

      const { data, error } = await ctx.supabase
        .from('contacts')
        .update(payload)
        .eq('id', input.id)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to update contact: ${error.message}` })
      }

      const { data: conversations } = await ctx.supabase
        .from('conversations')
        .select('id')
        .eq('org_id', orgId)
        .eq('contact_id', input.id)
        .order('started_at', { ascending: false })
        .limit(80)

      await Promise.all(
        (conversations ?? []).map((conversation: { id: string }) =>
          safeRecordConversationTimelineEvent({
            supabase: ctx.supabase,
            orgId,
            conversationId: conversation.id,
            eventType: 'contact_updated',
            title: 'Contact updated',
            body: 'Contact profile details were changed.',
            actorUserId: ctx.user.id,
            metadata: {
              contactId: input.id,
              changedFields: Object.keys(payload),
            },
          })
        )
      )

      return data
    }),

  updateContactIntelligence: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      tags: z.array(tagInput).max(30).optional(),
      customFields: z.record(customFieldKeyInput, customFieldValueInput).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data: existing, error: existingError } = await ctx.supabase
        .from('contacts')
        .select('id, meta')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load contact: ${existingError.message}`,
        })
      }

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      const meta = asRecord((existing as { meta: unknown }).meta)
      const nextMeta = {
        ...meta,
        ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
        ...(input.customFields !== undefined
          ? { customFields: normalizeCustomFields(input.customFields) }
          : {}),
      }

      const { data, error } = await ctx.supabase
        .from('contacts')
        .update({ meta: nextMeta })
        .eq('id', input.id)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update contact intelligence: ${error.message}`,
        })
      }

      return data
    }),

  addContactNote: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      body: contactNoteInput,
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data: existing, error: existingError } = await ctx.supabase
        .from('contacts')
        .select('id, meta')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load contact: ${existingError.message}`,
        })
      }

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      const meta = asRecord((existing as { meta: unknown }).meta)
      const note: ContactNote = {
        id: randomUUID(),
        body: input.body,
        createdAt: new Date().toISOString(),
        authorUserId: ctx.user.id,
        authorName: null,
      }
      const nextMeta = {
        ...meta,
        contactNotes: [note, ...normalizeContactNotes(meta.contactNotes)].slice(0, CONTACT_NOTE_LIMIT),
      }

      const { data, error } = await ctx.supabase
        .from('contacts')
        .update({ meta: nextMeta })
        .eq('id', input.id)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save contact note: ${error.message}`,
        })
      }

      return data
    }),

  deleteContactNote: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      noteId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data: existing, error: existingError } = await ctx.supabase
        .from('contacts')
        .select('id, meta')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load contact: ${existingError.message}`,
        })
      }

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      const meta = asRecord((existing as { meta: unknown }).meta)
      const nextNotes = normalizeContactNotes(meta.contactNotes).filter((note) => note.id !== input.noteId)
      const nextMeta = { ...meta, contactNotes: nextNotes }

      const { data, error } = await ctx.supabase
        .from('contacts')
        .update({ meta: nextMeta })
        .eq('id', input.id)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete contact note: ${error.message}`,
        })
      }

      return data
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data: existing } = await ctx.supabase
        .from('contacts')
        .select('id, meta')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      const existingContact = existing as { id: string; meta: unknown }
      await tombstoneDeletedVisitor(ctx.supabase, orgId, readVisitorId(existingContact.meta))

      const { data: conversations, error: conversationsError } = await ctx.supabase
        .from('conversations')
        .select('id')
        .eq('org_id', orgId)
        .eq('contact_id', input.id)

      if (conversationsError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load contact conversations before deletion: ${conversationsError.message}`,
        })
      }

      const conversationIds = ((conversations ?? []) as Array<{ id: string }>).map((row) => row.id)

      if (conversationIds.length > 0) {
        await deleteRows(
          ctx.supabase
            .from('ai_action_approvals')
            .delete()
            .in('conversation_id', conversationIds),
          'Failed to delete action approvals linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('ai_action_logs')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete action logs linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('email_messages')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete email messages linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('whatsapp_messages')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete WhatsApp messages linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('inbox_routing_events')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete routing events linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('messages')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete conversation messages linked to this contact'
        )

        await deleteRows(
          ctx.supabase
            .from('calls')
            .delete()
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds),
          'Failed to delete calls linked to this contact conversations'
        )

        await deleteRows(
          ctx.supabase
            .from('conversations')
            .delete()
            .eq('org_id', orgId)
            .in('id', conversationIds),
          'Failed to delete conversations linked to this contact'
        )
      }

      await deleteRows(
        ctx.supabase
          .from('ai_action_logs')
          .delete()
          .eq('org_id', orgId)
          .eq('contact_id', input.id),
        'Failed to delete remaining action logs linked to this contact'
      )

      await deleteRows(
        ctx.supabase
          .from('calls')
          .delete()
          .eq('org_id', orgId)
          .eq('contact_id', input.id),
        'Failed to delete remaining calls linked to this contact'
      )

      const { error } = await ctx.supabase
        .from('contacts')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId)

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to delete contact: ${error.message}` })
      }

      return {
        success: true,
        deletedConversations: conversationIds.length,
      }
    }),

  createContact: protectedProcedure
    .input(z.object({
      name: z.string().max(120).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          name: input.name?.trim() || null,
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone?.trim() || null,
          meta: { source: 'manual' },
        })
        .select()
        .single()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create contact: ${error.message}` })
      }

      return data
    }),

  importContacts: protectedProcedure
    .input(z.object({
      contacts: z.array(z.object({
        name: z.string().max(120).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(30).optional(),
      })).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { contacts } = input

      // Fetch existing emails to detect duplicates
      const emails = contacts
        .map(c => c.email?.trim().toLowerCase())
        .filter((e): e is string => !!e)

      const { data: existingContacts } = emails.length > 0
        ? await ctx.supabase
            .from('contacts')
            .select('email')
            .eq('org_id', orgId)
            .in('email', emails)
        : { data: [] }

      const existingEmails = new Set(
        (existingContacts ?? []).map((c: { email: string | null }) => c.email?.toLowerCase())
      )

      let imported = 0
      let skipped = 0

      const toInsert = contacts.filter(c => {
        const email = c.email?.trim().toLowerCase()
        if (email && existingEmails.has(email)) {
          skipped++
          return false
        }
        return true
      })

      if (toInsert.length > 0) {
        // Insert in batches of 100
        const BATCH = 100
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const batch = toInsert.slice(i, i + BATCH).map(c => ({
            org_id: orgId,
            name: c.name?.trim() || null,
            email: c.email?.trim().toLowerCase() || null,
            phone: c.phone?.trim() || null,
            meta: { source: 'import' },
          }))

          const { error } = await ctx.supabase.from('contacts').insert(batch)
          if (!error) imported += batch.length
        }
      }

      return { imported, skipped }
    }),
})
