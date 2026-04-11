/**
 * apps/api/src/routers/org-membership.router.ts  (Updated)
 *
 * Fix: createOrg now sets is_owner=true for the creator's user_organizations row.
 * This ensures the owner can never be demoted or removed via team management.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 48)
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 8)
}

export const orgMembershipRouter = router({
  getMyOrgs: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('user_organizations')
      .select(`id, role, is_owner, is_default, joined_at, organizations (id, name, slug, plan, created_at)`)
      .eq('user_id', ctx.user.id)
      .order('joined_at', { ascending: true })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch organizations: ${error.message}` })

    return (data ?? []).map((row) => ({
      membershipId: row.id,
      role: row.role as 'admin' | 'agent',
      isOwner: (row.is_owner as boolean) ?? false,
      isDefault: row.is_default,
      joinedAt: row.joined_at,
      ...((Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) as unknown as {
        id: string; name: string; slug: string; plan: string; created_at: string
      }),
    }))
  }),

  getActiveOrg: protectedProcedure.query(async ({ ctx }) => {
    const { data: user } = await ctx.supabase.from('users').select('active_org_id, org_id').eq('id', ctx.user.id).single()
    const activeOrgId = user?.active_org_id ?? user?.org_id
    if (!activeOrgId) return null

    const { data: org } = await ctx.supabase.from('organizations').select('id, name, slug, plan').eq('id', activeOrgId).single()
    const { data: membership } = await ctx.supabase.from('user_organizations').select('role').eq('user_id', ctx.user.id).eq('org_id', activeOrgId).maybeSingle()

    return org ? { ...org, role: (membership?.role ?? 'agent') as 'admin' | 'agent' } : null
  }),

  switchOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await ctx.supabase.from('user_organizations').select('id, role').eq('user_id', ctx.user.id).eq('org_id', input.orgId).maybeSingle()
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this organization.' })

      const { error } = await ctx.supabase.from('users').update({ active_org_id: input.orgId }).eq('id', ctx.user.id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to switch organization: ${error.message}` })

      const { data: org } = await ctx.supabase.from('organizations').select('id, name, slug, plan').eq('id', input.orgId).single()
      return { success: true, org, role: membership.role }
    }),

  createOrg: protectedProcedure
    .input(z.object({ name: z.string().min(1, 'Organization name is required').max(80) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      const { count: orgCount } = await ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      await requireLimit(ctx.supabase, ctx.userOrgId, 'organizations', orgCount ?? 0)

      const baseSlug = slugify(input.name) || 'organization'
      let slug = baseSlug

      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: existing } = await ctx.supabase.from('organizations').select('id').eq('slug', slug).maybeSingle()
        if (!existing) break
        slug = `${baseSlug}-${shortId()}`
      }

      const { data: org, error: orgError } = await ctx.supabase
        .from('organizations')
        .insert({ name: input.name.trim(), slug, plan: 'free' })
        .select()
        .single()

      if (orgError || !org) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create organization: ${orgError?.message ?? 'Unknown error'}` })

      await ctx.supabase.from('widget_configs').insert({ org_id: org.id }).select().maybeSingle()

      // ← OWNER FLAG: creator is marked as owner
      const { error: memberError } = await ctx.supabase
        .from('user_organizations')
        .insert({ user_id: userId, org_id: org.id, role: 'admin', is_default: false, is_owner: true })

      if (memberError) {
        await ctx.supabase.from('organizations').delete().eq('id', org.id)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to add membership: ${memberError.message}` })
      }

      await ctx.supabase.from('users').update({ active_org_id: org.id }).eq('id', userId)
      return { org, role: 'admin' as const }
    }),

  renameOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await ctx.supabase.from('user_organizations').select('role').eq('user_id', ctx.user.id).eq('org_id', input.orgId).maybeSingle()
      if (!membership || membership.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can rename an organization.' })

      const { data, error } = await ctx.supabase.from('organizations').update({ name: input.name.trim() }).eq('id', input.orgId).select().single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to rename: ${error.message}` })
      return data
    }),

  leaveOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      // Owner cannot leave their own org
      const { data: membership } = await ctx.supabase.from('user_organizations').select('role, is_owner').eq('user_id', userId).eq('org_id', input.orgId).maybeSingle()
      if (membership?.is_owner) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'As the organization owner, you cannot leave. Transfer ownership first.' })
      }

      const { count: orgCount } = await ctx.supabase.from('user_organizations').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if ((orgCount ?? 0) <= 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot leave your only organization.' })

      if (membership?.role === 'admin') {
        const { count: adminCount } = await ctx.supabase.from('user_organizations').select('id', { count: 'exact', head: true }).eq('org_id', input.orgId).eq('role', 'admin')
        if ((adminCount ?? 0) <= 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are the last admin. Transfer ownership before leaving.' })
      }

      await ctx.supabase.from('user_organizations').delete().eq('user_id', userId).eq('org_id', input.orgId)

      const { data: user } = await ctx.supabase.from('users').select('active_org_id, org_id').eq('id', userId).single()
      if (user?.active_org_id === input.orgId || user?.org_id === input.orgId) {
        const { data: nextMembership } = await ctx.supabase.from('user_organizations').select('org_id').eq('user_id', userId).order('joined_at', { ascending: true }).limit(1).maybeSingle()
        if (nextMembership) await ctx.supabase.from('users').update({ active_org_id: nextMembership.org_id }).eq('id', userId)
      }

      return { success: true }
    }),

  getOrgMembers: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: membership } = await ctx.supabase.from('user_organizations').select('role').eq('user_id', ctx.user.id).eq('org_id', input.orgId).maybeSingle()
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member.' })

      const { data } = await ctx.supabase
        .from('user_organizations')
        .select(`id, role, is_owner, joined_at, users (id, email, name, avatar_url)`)
        .eq('org_id', input.orgId)
        .order('joined_at', { ascending: true })

      return (data ?? []).map((row) => ({
        membershipId: row.id,
        role: row.role as 'admin' | 'agent',
        isOwner: (row.is_owner as boolean) ?? false,
        joinedAt: row.joined_at,
        ...((Array.isArray(row.users) ? row.users[0] : row.users) as unknown as {
          id: string; email: string; name: string | null; avatar_url: string | null
        }),
      }))
    }),
})