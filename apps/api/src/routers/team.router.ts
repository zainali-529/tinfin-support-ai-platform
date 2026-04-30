import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'
import { assertOrgAdmin } from '../lib/org-permissions'
import {
  getEffectiveTeamPermissions,
  type OrgRole,
  type TeamPermissions,
} from '@workspace/types'

const permissionsInputSchema = z
  .object({
    dashboard: z.boolean().optional(),
    inbox: z.boolean().optional(),
    contacts: z.boolean().optional(),
    calls: z.boolean().optional(),
    knowledge: z.boolean().optional(),
    analytics: z.boolean().optional(),
    widget: z.boolean().optional(),
    embedding: z.boolean().optional(),
    voiceAssistant: z.boolean().optional(),
    cannedResponses: z.boolean().optional(),
    channels: z.boolean().optional(),
  })
  .optional()

function toRole(value: unknown): OrgRole {
  return value === 'admin' ? 'admin' : 'agent'
}

function resolvePermissions(role: OrgRole, raw: unknown): TeamPermissions {
  return getEffectiveTeamPermissions(role, raw)
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes(column.toLowerCase())
}

function migrationHint(column: 'permissions'): string {
  return `Database column "${column}" is missing. Run repo DB migrations (pnpm --filter @workspace/db db:migrate) and deploy the latest baseline.`
}

async function getAdminCount(supabase: any, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin')

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }

  return count ?? 0
}

async function assertNotOwner(
  supabase: any,
  targetUserId: string,
  orgId: string,
  action: string
): Promise<void> {
  const { data, error } = await supabase
    .from('user_organizations')
    .select('is_owner')
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }

  if (data?.is_owner === true) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Cannot ${action} the organization owner.`,
    })
  }
}

async function getMemberByUserId(supabase: any, orgId: string, userId: string) {
  const withPermissions = await supabase
    .from('user_organizations')
    .select('role, is_owner, permissions')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!withPermissions.error) {
    if (!withPermissions.data) return null
    const role = toRole(withPermissions.data.role)
    return {
      role,
      isOwner: withPermissions.data.is_owner === true,
      permissions: resolvePermissions(role, withPermissions.data.permissions ?? null),
    }
  }

  if (isMissingColumnError(withPermissions.error, 'permissions')) {
    const fallback = await supabase
      .from('user_organizations')
      .select('role, is_owner')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (fallback.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fallback.error.message })
    }
    if (!fallback.data) return null

    const role = toRole(fallback.data.role)
    return {
      role,
      isOwner: fallback.data.is_owner === true,
      permissions: resolvePermissions(role, null),
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: withPermissions.error.message,
  })
}

async function getPendingInvitationsWithPermissions(supabase: any, orgId: string) {
  const withPermissions = await supabase
    .from('org_invitations')
    .select('id, email, role, permissions, status, expires_at, created_at, token')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (!withPermissions.error) {
    return (withPermissions.data ?? []).map((row: any) => {
      const role = toRole(row.role)
      return {
        id: row.id as string,
        email: row.email as string,
        role,
        permissions: resolvePermissions(role, row.permissions ?? null),
        status: row.status as string,
        expires_at: row.expires_at as string,
        created_at: row.created_at as string,
        token: row.token as string,
      }
    })
  }

  if (isMissingColumnError(withPermissions.error, 'permissions')) {
    const fallback = await supabase
      .from('org_invitations')
      .select('id, email, role, status, expires_at, created_at, token')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (fallback.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fallback.error.message })
    }

    return (fallback.data ?? []).map((row: any) => {
      const role = toRole(row.role)
      return {
        id: row.id as string,
        email: row.email as string,
        role,
        permissions: resolvePermissions(role, null),
        status: row.status as string,
        expires_at: row.expires_at as string,
        created_at: row.created_at as string,
        token: row.token as string,
      }
    })
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: withPermissions.error.message,
  })
}

async function getInvitationByIdWithPermissions(supabase: any, invitationId: string, orgId: string) {
  const withPermissions = await supabase
    .from('org_invitations')
    .select('id, token, email, role, permissions, status, expires_at')
    .eq('id', invitationId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!withPermissions.error) {
    if (!withPermissions.data) return null
    const role = toRole(withPermissions.data.role)
    return {
      id: withPermissions.data.id as string,
      token: withPermissions.data.token as string,
      email: withPermissions.data.email as string,
      role,
      permissions: resolvePermissions(role, withPermissions.data.permissions ?? null),
      status: withPermissions.data.status as string,
      expiresAt: withPermissions.data.expires_at as string,
    }
  }

  if (isMissingColumnError(withPermissions.error, 'permissions')) {
    const fallback = await supabase
      .from('org_invitations')
      .select('id, token, email, role, status, expires_at')
      .eq('id', invitationId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (fallback.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fallback.error.message })
    }
    if (!fallback.data) return null

    const role = toRole(fallback.data.role)
    return {
      id: fallback.data.id as string,
      token: fallback.data.token as string,
      email: fallback.data.email as string,
      role,
      permissions: resolvePermissions(role, null),
      status: fallback.data.status as string,
      expiresAt: fallback.data.expires_at as string,
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: withPermissions.error.message,
  })
}

async function getInvitationByTokenWithPermissions(supabase: any, token: string) {
  const withPermissions = await supabase
    .from('org_invitations')
    .select(
      'id, org_id, email, role, permissions, status, expires_at, organizations (id, name), users!org_invitations_invited_by_fkey (id, name, email)'
    )
    .eq('token', token)
    .maybeSingle()

  if (!withPermissions.error) {
    if (!withPermissions.data) return null
    const role = toRole(withPermissions.data.role)
    return {
      id: withPermissions.data.id as string,
      orgId: withPermissions.data.org_id as string,
      email: withPermissions.data.email as string,
      role,
      permissions: resolvePermissions(role, withPermissions.data.permissions ?? null),
      status: withPermissions.data.status as string,
      expiresAt: withPermissions.data.expires_at as string,
      organizations: withPermissions.data.organizations,
      users: withPermissions.data.users,
    }
  }

  if (isMissingColumnError(withPermissions.error, 'permissions')) {
    const fallback = await supabase
      .from('org_invitations')
      .select(
        'id, org_id, email, role, status, expires_at, organizations (id, name), users!org_invitations_invited_by_fkey (id, name, email)'
      )
      .eq('token', token)
      .maybeSingle()

    if (fallback.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fallback.error.message })
    }
    if (!fallback.data) return null

    const role = toRole(fallback.data.role)
    return {
      id: fallback.data.id as string,
      orgId: fallback.data.org_id as string,
      email: fallback.data.email as string,
      role,
      permissions: resolvePermissions(role, null),
      status: fallback.data.status as string,
      expiresAt: fallback.data.expires_at as string,
      organizations: fallback.data.organizations,
      users: fallback.data.users,
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: withPermissions.error.message,
  })
}

export const teamRouter = router({
  getMembers: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId

    const withPermissions = await ctx.supabase
      .from('user_organizations')
      .select('id, role, permissions, is_owner, joined_at, users (id, email, name, avatar_url)')
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true })

    if (withPermissions.error && !isMissingColumnError(withPermissions.error, 'permissions')) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: withPermissions.error.message,
      })
    }

    let rows = withPermissions.data as Array<any> | null
    if (!rows) {
      const fallback = await ctx.supabase
        .from('user_organizations')
        .select('id, role, is_owner, joined_at, users (id, email, name, avatar_url)')
        .eq('org_id', orgId)
        .order('joined_at', { ascending: true })

      if (fallback.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: fallback.error.message,
        })
      }
      rows = fallback.data as Array<any> | null
    }

    return (rows ?? []).map((row) => {
      const user = (Array.isArray(row.users) ? row.users[0] : row.users) as
        | { id: string; email: string; name: string | null; avatar_url: string | null }
        | null
      const role = toRole(row.role)

      return {
        membershipId: row.id as string,
        role,
        permissions: resolvePermissions(role, row.permissions ?? null),
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
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['admin', 'agent']),
        permissions: permissionsInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      await assertNotOwner(ctx.supabase, input.userId, orgId, 'change the role of')

      const existing = await getMemberByUserId(ctx.supabase, orgId, input.userId)
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found in this organization.' })
      }

      if (input.userId === ctx.user.id && input.role === 'agent') {
        const count = await getAdminCount(ctx.supabase, orgId)
        if (count <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot demote yourself because you are the only admin.',
          })
        }
      }

      const nextRole = toRole(input.role)
      const nextPermissions =
        nextRole === 'admin'
          ? resolvePermissions('admin', null)
          : resolvePermissions(
              'agent',
              input.permissions ?? (existing.role === 'agent' ? existing.permissions : null)
            )

      const { error } = await ctx.supabase
        .from('user_organizations')
        .update({ role: nextRole, permissions: nextPermissions })
        .eq('user_id', input.userId)
        .eq('org_id', orgId)

      if (error) {
        if (isMissingColumnError(error, 'permissions')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: migrationHint('permissions') })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { success: true }
    }),

  updateMemberPermissions: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        permissions: permissionsInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      await assertNotOwner(ctx.supabase, input.userId, orgId, 'change permissions for')

      const member = await getMemberByUserId(ctx.supabase, orgId, input.userId)
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found in this organization.' })
      }
      if (member.role !== 'agent') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only agent permissions can be customized. Admins always have full access.',
        })
      }

      const nextPermissions = resolvePermissions('agent', input.permissions ?? member.permissions)
      const { error } = await ctx.supabase
        .from('user_organizations')
        .update({ permissions: nextPermissions })
        .eq('user_id', input.userId)
        .eq('org_id', orgId)

      if (error) {
        if (isMissingColumnError(error, 'permissions')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: migrationHint('permissions') })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { success: true }
    }),

  removeMember: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use "Leave Organization" to remove yourself.',
        })
      }

      await assertNotOwner(ctx.supabase, input.userId, orgId, 'remove')

      const targetMembership = await getMemberByUserId(ctx.supabase, orgId, input.userId)
      if (!targetMembership) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found in this organization.' })
      }

      if (targetMembership.role === 'admin') {
        const count = await getAdminCount(ctx.supabase, orgId)
        if (count <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove the last admin.' })
        }
      }

      const { error: removeError } = await ctx.supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', input.userId)
        .eq('org_id', orgId)

      if (removeError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: removeError.message })
      }

      const { data: userRecord } = await ctx.supabase
        .from('users')
        .select('active_org_id, org_id')
        .eq('id', input.userId)
        .maybeSingle()

      if (userRecord && (userRecord.active_org_id === orgId || userRecord.org_id === orgId)) {
        const { data: next } = await ctx.supabase
          .from('user_organizations')
          .select('org_id')
          .eq('user_id', input.userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (next) {
          await ctx.supabase.from('users').update({ active_org_id: next.org_id }).eq('id', input.userId)
        }
      }

      return { success: true }
    }),

  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
    return getPendingInvitationsWithPermissions(ctx.supabase, orgId)
  }),

  getInviteLink: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const data = await getInvitationByIdWithPermissions(ctx.supabase, input.invitationId, orgId)
      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })
      }
      if (data.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `This invitation is ${data.status}.` })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const inviteLink = `${webUrl}/invite/${data.token}`

      return {
        inviteLink,
        email: data.email,
        role: data.role,
        permissions: data.permissions,
        expiresAt: data.expiresAt,
      }
    }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email('Please enter a valid email address.'),
        role: z.enum(['admin', 'agent']).default('agent'),
        permissions: permissionsInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const { count: currentMemberCount } = await ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'teamMembers', currentMemberCount ?? 0)

      const normalizedEmail = input.email.trim().toLowerCase()
      const role = toRole(input.role)
      const permissions = resolvePermissions(role, input.permissions ?? null)

      const { data: existingUser } = await ctx.supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (existingUser?.id) {
        const { data: existingMember } = await ctx.supabase
          .from('user_organizations')
          .select('id')
          .eq('user_id', existingUser.id)
          .eq('org_id', orgId)
          .maybeSingle()
        if (existingMember) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This person is already a member of the organization.',
          })
        }
      }

      await ctx.supabase
        .from('org_invitations')
        .update({ status: 'cancelled' })
        .eq('org_id', orgId)
        .eq('email', normalizedEmail)
        .eq('status', 'pending')

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: invite, error } = await ctx.supabase
        .from('org_invitations')
        .insert({
          org_id: orgId,
          email: normalizedEmail,
          role,
          permissions,
          invited_by: ctx.user.id,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id, token')
        .single()

      if (error || !invite) {
        if (isMissingColumnError(error, 'permissions')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: migrationHint('permissions') })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create invitation: ${error?.message ?? 'Unknown error'}`,
        })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const inviteLink = `${webUrl}/invite/${invite.token as string}`

      return {
        inviteId: invite.id as string,
        inviteLink,
        token: invite.token as string,
        email: normalizedEmail,
        role,
        permissions,
        expiresAt,
      }
    }),

  resendInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const existing = await getInvitationByIdWithPermissions(ctx.supabase, input.invitationId, orgId)
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })
      }

      await ctx.supabase.from('org_invitations').update({ status: 'cancelled' }).eq('id', input.invitationId)

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: newInvite, error } = await ctx.supabase
        .from('org_invitations')
        .insert({
          org_id: orgId,
          email: existing.email,
          role: existing.role,
          permissions: existing.permissions,
          invited_by: ctx.user.id,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id, token')
        .single()

      if (error || !newInvite) {
        if (isMissingColumnError(error, 'permissions')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: migrationHint('permissions') })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message ?? 'Unknown error',
        })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      return { inviteLink: `${webUrl}/invite/${newInvite.token as string}`, token: newInvite.token as string }
    }),

  cancelInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)
      const { error } = await ctx.supabase
        .from('org_invitations')
        .update({ status: 'cancelled' })
        .eq('id', input.invitationId)
        .eq('org_id', orgId)
        .eq('status', 'pending')
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  getInviteInfo: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await getInvitationByTokenWithPermissions(ctx.supabase, input.token)

      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found or already used.' })
      if (data.status === 'accepted') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has already been accepted.' })
      if (data.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has been cancelled.' })
      if (new Date(data.expiresAt) < new Date()) {
        void ctx.supabase.from('org_invitations').update({ status: 'expired' }).eq('token', input.token)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invitation has expired.' })
      }

      const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as
        | { id: string; name: string }
        | null
      const inviter = (Array.isArray(data.users) ? data.users[0] : data.users) as
        | { id: string; name: string | null; email: string }
        | null

      return {
        inviteId: data.id,
        email: data.email,
        role: data.role,
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        orgId: org?.id ?? '',
        orgName: org?.name ?? 'Unknown Organization',
        inviterName: inviter?.name || inviter?.email || 'a team member',
      }
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await getInvitationByTokenWithPermissions(ctx.supabase, input.token)

      if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' })
      if (invite.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invitation is ${invite.status}.` })
      }
      if (new Date(invite.expiresAt) < new Date()) {
        await ctx.supabase.from('org_invitations').update({ status: 'expired' }).eq('id', invite.id)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired.' })
      }

      const inviteEmail = invite.email.toLowerCase().trim()
      let userEmail = ctx.user.email?.toLowerCase().trim() ?? ''

      if (!userEmail) {
        const { data: userRow } = await ctx.supabase
          .from('users')
          .select('email')
          .eq('id', ctx.user.id)
          .maybeSingle()
        userEmail = userRow?.email?.toLowerCase().trim() ?? ''
      }

      if (!userEmail || userEmail !== inviteEmail) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `This invitation was sent to ${invite.email}. Please sign in with that email address to accept it.`,
        })
      }

      const orgId = invite.orgId

      const { data: existing } = await ctx.supabase
        .from('user_organizations')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!existing) {
        const { error: memberError } = await ctx.supabase.from('user_organizations').insert({
          user_id: ctx.user.id,
          org_id: orgId,
          role: invite.role,
          permissions: invite.permissions,
          is_default: false,
          is_owner: false,
        })

        if (memberError) {
          if (isMissingColumnError(memberError, 'permissions')) {
            throw new TRPCError({ code: 'PRECONDITION_FAILED', message: migrationHint('permissions') })
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to join: ${memberError.message}`,
          })
        }
      }

      await ctx.supabase.from('org_invitations').update({ status: 'accepted' }).eq('id', invite.id)
      await ctx.supabase.from('users').update({ active_org_id: orgId }).eq('id', ctx.user.id)

      return { success: true, orgId }
    }),
})
