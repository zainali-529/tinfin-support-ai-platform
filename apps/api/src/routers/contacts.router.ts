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
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

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
          meta,
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
        .select('id, status, channel, started_at, assigned_to')
        .eq('org_id', orgId)
        .eq('contact_id', input.id)
        .order('started_at', { ascending: false })

      // Fetch last message for each conversation
      const convIds = (conversations ?? []).map((c: { id: string }) => c.id)
      let lastMessages: Record<string, string> = {}

      if (convIds.length > 0) {
        const { data: msgs } = await ctx.supabase
          .from('messages')
          .select('conversation_id, content, created_at')
          .eq('org_id', orgId)
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })

        const seen = new Set<string>()
        for (const msg of msgs ?? []) {
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

      // Stats
      const resolvedCount = (conversations ?? []).filter(
        (c: { status: string }) => c.status === 'resolved' || c.status === 'closed'
      ).length

      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        meta: contact.meta as Record<string, unknown> | null,
        createdAt: contact.created_at,
        conversations: (conversations ?? []).map((c: {
          id: string
          status: string
          channel: string
          started_at: string
          assigned_to: string | null
        }) => ({
          id: c.id,
          status: c.status,
          channel: c.channel,
          startedAt: c.started_at,
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
        stats: {
          totalConversations: (conversations ?? []).length,
          resolvedConversations: resolvedCount,
          totalCalls: (calls ?? []).length,
          totalEmails: emailThreadMap.size,
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
        .select('id')
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

      return data
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'contacts', 'Contacts access is required.')
      const orgId = ctx.userOrgId

      const { data: existing } = await ctx.supabase
        .from('contacts')
        .select('id')
        .eq('id', input.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found.' })
      }

      // Preserve activity history by unlinking the contact before deletion.
      const { error: unlinkConversationsError } = await ctx.supabase
        .from('conversations')
        .update({ contact_id: null })
        .eq('org_id', orgId)
        .eq('contact_id', input.id)

      if (unlinkConversationsError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to unlink conversations before deleting contact: ${unlinkConversationsError.message}`,
        })
      }

      // Defensive unlink for older environments where FK behavior may differ.
      const { error: unlinkCallsError } = await ctx.supabase
        .from('calls')
        .update({ contact_id: null })
        .eq('org_id', orgId)
        .eq('contact_id', input.id)

      if (unlinkCallsError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to unlink calls before deleting contact: ${unlinkCallsError.message}`,
        })
      }

      const { error } = await ctx.supabase
        .from('contacts')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId)

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to delete contact: ${error.message}` })
      }

      return { success: true }
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
