/**
 * apps/api/src/routers/team.router.ts
 *
 * Fixes:
 * 1. getInviteLink — returns the invite URL for any pending invitation by ID
 *    so admin can copy it again after dialog closes.
 * 2. acceptInvite — validates that the logged-in user's email matches the
 *    invitation email. Wrong email = FORBIDDEN.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'


// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertOrgAdmin(supabase: any, userId: string, orgId: string): Promise<void> {
  const { data } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data || data.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required.' })
  }
}

async function getAdminCount(supabase: any, orgId: string): Promise<number> {
  const { count } = await supabase
    .from('user_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin')
  return count ?? 0
}

async function assertNotOwner(supabase: any, targetUserId: string, orgId: string, action: string): Promise<void> {
  const { data } = await supabase
    .from('user_organizations')
    .select('is_owner')
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (data?.is_owner === true) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Cannot ${action} the organization owner.`,
    })
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const teamRouter = router({

  getMembers: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const { data, error } = await ctx.supabase
      .from('user_organizations')
      .select('id, role, is_owner, joined_at, users (id, email, name, avatar_url)')
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    return (data ?? []).map((row) => {
      const user = (Array.isArray(row.users) ? row.users[0] : row.users) as {
        id: string; email: string; name: string | null; avatar_url: string | null
      } | null
      return {
        membershipId: row.id as string,
        role: row.role as 'admin' | 'agent',
        isOwner: (row.is_owner as boolean) ?? false,
        joinedAt: row.joined_at as string,
        id: user?.id ?? '',
        email: user?.email ?? '',
        name: user?.name ?? null,
        avatarUrl: user?.avatar_url ?? null,
        isCurrentUser: user?.id === ctx.user.id,
      }
    })
  }),

  updateMemberRole: protectedProcedure
    .input(z.object({ userId: z.string().uuid(), role: z.enum(['admin', 'agent']) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      await assertNotOwner(ctx.supabase, input.userId, orgId, 'change the role of')
      if (input.userId === ctx.user.id && input.role === 'agent') {
        const count = await getAdminCount(ctx.supabase, orgId)
        if (count <= 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot demote yourself — you are the only admin.' })
      }
      const { error } = await ctx.supabase.from('user_organizations').update({ role: input.role }).eq('user_id', input.userId).eq('org_id', orgId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  removeMember: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      if (input.userId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use "Leave Organization" to remove yourself.' })
      await assertNotOwner(ctx.supabase, input.userId, orgId, 'remove')

      const { data: targetMembership } = await ctx.supabase.from('user_organizations').select('role').eq('user_id', input.userId).eq('org_id', orgId).maybeSingle()
      if (!targetMembership) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found in this organization.' })
      if (targetMembership.role === 'admin') {
        const count = await getAdminCount(ctx.supabase, orgId)
        if (count <= 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove the last admin.' })
      }

      await ctx.supabase.from('user_organizations').delete().eq('user_id', input.userId).eq('org_id', orgId)

      const { data: userRecord } = await ctx.supabase.from('users').select('active_org_id, org_id').eq('id', input.userId).maybeSingle()
      if (userRecord && (userRecord.active_org_id === orgId || userRecord.org_id === orgId)) {
        const { data: next } = await ctx.supabase.from('user_organizations').select('org_id').eq('user_id', input.userId).order('joined_at', { ascending: true }).limit(1).maybeSingle()
        if (next) await ctx.supabase.from('users').update({ active_org_id: next.org_id }).eq('id', input.userId)
      }
      return { success: true }
    }),

  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
    const { data } = await ctx.supabase
      .from('org_invitations')
      .select('id, email, role, status, expires_at, created_at, token')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return (data ?? []) as Array<{
      id: string; email: string; role: 'admin' | 'agent'
      status: string; expires_at: string; created_at: string; token: string
    }>
  }),

  /**
   * FIX 1: Get invite link for an existing pending invitation.
   * Admin can re-copy the link any time from the three-dot menu.
   */
  getInviteLink: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const { data } = await ctx.supabase
        .from('org_invitations')
        .select('id, token, email, role, status, expires_at')
        .eq('id', input.invitationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })
      if (data.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: `This invitation is ${data.status as string}.` })

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const inviteLink = `${webUrl}/invite/${data.token as string}`

      return {
        inviteLink,
        email: data.email as string,
        role: data.role as 'admin' | 'agent',
        expiresAt: data.expires_at as string,
      }
    }),

  inviteMember: protectedProcedure
    .input(z.object({
      email: z.string().email('Please enter a valid email address.'),
      role: z.enum(['admin', 'agent']).default('agent'),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const { count: currentMemberCount } = await ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'teamMembers', currentMemberCount ?? 0)

      const normalizedEmail = input.email.trim().toLowerCase()

      const { data: existingUser } = await ctx.supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle()
      if (existingUser?.id) {
        const { data: existingMember } = await ctx.supabase.from('user_organizations').select('id').eq('user_id', existingUser.id).eq('org_id', orgId).maybeSingle()
        if (existingMember) throw new TRPCError({ code: 'CONFLICT', message: 'This person is already a member of the organization.' })
      }

      await ctx.supabase.from('org_invitations').update({ status: 'cancelled' }).eq('org_id', orgId).eq('email', normalizedEmail).eq('status', 'pending')

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: invite, error } = await ctx.supabase
        .from('org_invitations')
        .insert({ org_id: orgId, email: normalizedEmail, role: input.role, invited_by: ctx.user.id, status: 'pending', expires_at: expiresAt })
        .select('id, token')
        .single()

      if (error || !invite) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create invitation: ${error?.message ?? 'Unknown error'}` })

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const inviteLink = `${webUrl}/invite/${invite.token as string}`

      return { inviteId: invite.id as string, inviteLink, token: invite.token as string, email: normalizedEmail, expiresAt }
    }),

  resendInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const { data: existing } = await ctx.supabase.from('org_invitations').select('email, role').eq('id', input.invitationId).eq('org_id', orgId).maybeSingle()
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })

      await ctx.supabase.from('org_invitations').update({ status: 'cancelled' }).eq('id', input.invitationId)

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: newInvite, error } = await ctx.supabase
        .from('org_invitations')
        .insert({ org_id: orgId, email: existing.email, role: existing.role, invited_by: ctx.user.id, status: 'pending', expires_at: expiresAt })
        .select('id, token')
        .single()

      if (error || !newInvite) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message ?? 'Unknown error' })

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      return { inviteLink: `${webUrl}/invite/${newInvite.token as string}`, token: newInvite.token as string }
    }),

  cancelInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      const { error } = await ctx.supabase.from('org_invitations').update({ status: 'cancelled' }).eq('id', input.invitationId).eq('org_id', orgId).eq('status', 'pending')
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  // ── Public invite flow ─────────────────────────────────────────────────────

  getInviteInfo: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('org_invitations')
        .select('id, email, role, status, expires_at, organizations (id, name), users!org_invitations_invited_by_fkey (id, name, email)')
        .eq('token', input.token)
        .maybeSingle()

      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found or already used.' })
      if (data.status === 'accepted') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has already been accepted.' })
      if (data.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has been cancelled.' })
      if (new Date(data.expires_at as string) < new Date()) {
        void ctx.supabase.from('org_invitations').update({ status: 'expired' }).eq('token', input.token)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has expired.' })
      }

      const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as { id: string; name: string } | null
      const inviter = (Array.isArray(data.users) ? data.users[0] : data.users) as { id: string; name: string | null; email: string } | null

      return {
        inviteId: data.id as string,
        email: data.email as string,
        role: data.role as 'admin' | 'agent',
        expiresAt: data.expires_at as string,
        orgId: org?.id ?? '',
        orgName: org?.name ?? 'Unknown Organization',
        inviterName: inviter?.name || inviter?.email || 'a team member',
      }
    }),

  /**
   * FIX 2: Email validation on accept.
   * The logged-in user's email must match the invite email exactly.
   * If mismatch → FORBIDDEN with clear message.
   */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: invite } = await ctx.supabase
        .from('org_invitations')
        .select('id, org_id, email, role, status, expires_at')
        .eq('token', input.token)
        .maybeSingle()

      if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })
      if (invite.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: `Invitation is ${invite.status as string}.` })
      if (new Date(invite.expires_at as string) < new Date()) {
        await ctx.supabase.from('org_invitations').update({ status: 'expired' }).eq('id', invite.id)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired.' })
      }

      // ── EMAIL VALIDATION ────────────────────────────────────────────────────
      // Fetch the logged-in user's email from Supabase Auth (authoritative source)
      const { data: { user: authUser } } = await ctx.supabase.auth.getUser()
      const userEmail = authUser?.email?.toLowerCase().trim()
      const inviteEmail = (invite.email as string).toLowerCase().trim()

      if (!userEmail || userEmail !== inviteEmail) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `This invitation was sent to ${invite.email as string}. Please sign in with that email address to accept it.`,
        })
      }

      const orgId = invite.org_id as string

      const { data: existing } = await ctx.supabase.from('user_organizations').select('id').eq('user_id', ctx.user.id).eq('org_id', orgId).maybeSingle()
      if (!existing) {
        const { error: memberError } = await ctx.supabase
          .from('user_organizations')
          .insert({ user_id: ctx.user.id, org_id: orgId, role: invite.role as string, is_default: false, is_owner: false })
        if (memberError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to join: ${memberError.message}` })
      }

      await ctx.supabase.from('org_invitations').update({ status: 'accepted' }).eq('id', invite.id)
      await ctx.supabase.from('users').update({ active_org_id: orgId }).eq('id', ctx.user.id)

      return { success: true, orgId }
    }),
})