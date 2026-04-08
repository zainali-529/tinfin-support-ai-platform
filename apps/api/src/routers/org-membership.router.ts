import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48) // keep slugs short
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 8)
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const orgMembershipRouter = router({
  /**
   * Get all organizations the current user belongs to.
   */
  getMyOrgs: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('user_organizations')
      .select(`
        id,
        role,
        is_default,
        joined_at,
        organizations (
          id,
          name,
          slug,
          plan,
          created_at
        )
      `)
      .eq('user_id', ctx.user.id)
      .order('joined_at', { ascending: true })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch organizations: ${error.message}`,
      })
    }

    return (data ?? []).map((row) => ({
      membershipId: row.id,
      role: row.role as 'admin' | 'agent',
      isDefault: row.is_default,
      joinedAt: row.joined_at,
      ...((Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) as unknown as {
        id: string
        name: string
        slug: string
        plan: string
        created_at: string
      }),
    }))
  }),

  /**
   * Get the currently active organization's details.
   */
  getActiveOrg: protectedProcedure.query(async ({ ctx }) => {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('active_org_id, org_id')
      .eq('id', ctx.user.id)
      .single()

    const activeOrgId = user?.active_org_id ?? user?.org_id
    if (!activeOrgId) return null

    const { data: org } = await ctx.supabase
      .from('organizations')
      .select('id, name, slug, plan')
      .eq('id', activeOrgId)
      .single()

    // Also get the user's role in this org
    const { data: membership } = await ctx.supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', ctx.user.id)
      .eq('org_id', activeOrgId)
      .maybeSingle()

    return org
      ? {
          ...org,
          role: (membership?.role ?? 'agent') as 'admin' | 'agent',
        }
      : null
  }),

  /**
   * Switch the user's active organization.
   * Verifies the user is actually a member of the target org.
   */
  switchOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify membership
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('id, role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this organization.',
        })
      }

      // Update active org
      const { error } = await ctx.supabase
        .from('users')
        .update({ active_org_id: input.orgId })
        .eq('id', ctx.user.id)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to switch organization: ${error.message}`,
        })
      }

      // Return the new org's details
      const { data: org } = await ctx.supabase
        .from('organizations')
        .select('id, name, slug, plan')
        .eq('id', input.orgId)
        .single()

      return { success: true, org, role: membership.role }
    }),

  /**
   * Create a new organization and make the current user its admin.
   * Automatically switches to the new org.
   */
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Organization name is required').max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      // Build a unique slug
      const baseSlug = slugify(input.name) || 'organization'
      let slug = baseSlug

      // Check uniqueness and append suffix if needed
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: existing } = await ctx.supabase
          .from('organizations')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        if (!existing) break
        slug = `${baseSlug}-${shortId()}`
      }

      // Create the organization
      const { data: org, error: orgError } = await ctx.supabase
        .from('organizations')
        .insert({ name: input.name.trim(), slug, plan: 'free' })
        .select()
        .single()

      if (orgError || !org) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create organization: ${orgError?.message ?? 'Unknown error'}`,
        })
      }

      // Create default widget config for the new org
      await ctx.supabase
        .from('widget_configs')
        .insert({ org_id: org.id })
        .select()
        .maybeSingle()

      // Add user as admin member
      const { error: memberError } = await ctx.supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          org_id: org.id,
          role: 'admin',
          is_default: false,
        })

      if (memberError) {
        // Rollback org (best-effort)
        await ctx.supabase.from('organizations').delete().eq('id', org.id)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to add membership: ${memberError.message}`,
        })
      }

      // Switch user to new org
      await ctx.supabase
        .from('users')
        .update({ active_org_id: org.id })
        .eq('id', userId)

      return { org, role: 'admin' as const }
    }),

  /**
   * Rename an organization (admin only).
   */
  renameOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        name: z.string().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (!membership || membership.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can rename an organization.',
        })
      }

      const { data, error } = await ctx.supabase
        .from('organizations')
        .update({ name: input.name.trim() })
        .eq('id', input.orgId)
        .select()
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to rename: ${error.message}`,
        })
      }

      return data
    }),

  /**
   * Leave an organization.
   * Cannot leave if it is the user's only org.
   * Cannot leave if the user is the last admin.
   */
  leaveOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      // Count how many orgs the user belongs to
      const { count: orgCount } = await ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if ((orgCount ?? 0) <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot leave your only organization.',
        })
      }

      // Check if user is the last admin
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', userId)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (membership?.role === 'admin') {
        const { count: adminCount } = await ctx.supabase
          .from('user_organizations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', input.orgId)
          .eq('role', 'admin')

        if ((adminCount ?? 0) <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You are the last admin. Transfer ownership before leaving.',
          })
        }
      }

      // Remove membership
      await ctx.supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', input.orgId)

      // If this was the active org, switch to another one
      const { data: user } = await ctx.supabase
        .from('users')
        .select('active_org_id, org_id')
        .eq('id', userId)
        .single()

      if (
        user?.active_org_id === input.orgId ||
        user?.org_id === input.orgId
      ) {
        const { data: nextMembership } = await ctx.supabase
          .from('user_organizations')
          .select('org_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextMembership) {
          await ctx.supabase
            .from('users')
            .update({ active_org_id: nextMembership.org_id })
            .eq('id', userId)
        }
      }

      return { success: true }
    }),

  /**
   * Get members of an organization (admin only).
   */
  getOrgMembers: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify membership
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member.' })
      }

      const { data } = await ctx.supabase
        .from('user_organizations')
        .select(`
          id,
          role,
          joined_at,
          users (
            id,
            email,
            name,
            avatar_url
          )
        `)
        .eq('org_id', input.orgId)
        .order('joined_at', { ascending: true })

      return (data ?? []).map((row) => ({
        membershipId: row.id,
        role: row.role as 'admin' | 'agent',
        joinedAt: row.joined_at,
        ...((Array.isArray(row.users) ? row.users[0] : row.users) as unknown as {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
        }),
      }))
    }),
})