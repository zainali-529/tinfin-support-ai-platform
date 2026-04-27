/**
 * apps/api/src/routers/org-membership.router.ts
 */

import { z } from 'zod'
import Stripe from 'stripe'
import { randomUUID } from 'crypto'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { PLANS } from '../lib/plans'
import { getEffectiveTeamPermissions } from '@workspace/types'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48)
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 8)
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Stripe is not configured.',
    })
  }
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes(column.toLowerCase())
}

async function buildUniqueSlug(supabase: any, orgName: string): Promise<string> {
  const baseSlug = slugify(orgName) || 'organization'
  let slug = baseSlug

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) return slug
    slug = `${baseSlug}-${shortId()}`
  }

  return `${baseSlug}-${shortId()}`
}

async function getOwnedOrganizationsCount(supabase: any, userId: string): Promise<number> {
  const ownerCount = await supabase
    .from('user_organizations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_owner', true)

  if (!ownerCount.error) return ownerCount.count ?? 0

  if (isMissingColumnError(ownerCount.error, 'is_owner')) {
    const adminCount = await supabase
      .from('user_organizations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'admin')

    if (adminCount.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to evaluate organization ownership: ${adminCount.error.message}`,
      })
    }

    return adminCount.count ?? 0
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Failed to evaluate organization ownership: ${ownerCount.error.message}`,
  })
}

async function getSubscriptionPlanMap(supabase: any, orgIds: string[]): Promise<Map<string, string>> {
  if (orgIds.length === 0) return new Map()

  const { data } = await supabase
    .from('subscriptions')
    .select('org_id, plan')
    .in('org_id', orgIds)

  const map = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ org_id: string; plan: string | null }>) {
    map.set(row.org_id, row.plan ?? 'free')
  }

  return map
}

async function getOrgWithSubscriptionPlan(supabase: any, orgId: string) {
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, plan')
    .eq('id', orgId)
    .single()

  if (!org) return null

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('org_id', orgId)
    .maybeSingle()

  return {
    id: org.id as string,
    name: org.name as string,
    slug: org.slug as string,
    plan: ((sub?.plan as string | null) ?? (org.plan as string) ?? 'free') as string,
  }
}

export const orgMembershipRouter = router({
  getMyOrgs: protectedProcedure.query(async ({ ctx }) => {
    const membershipsWithPermissions = await ctx.supabase
      .from('user_organizations')
      .select(
        `id, role, permissions, is_owner, is_default, joined_at, organizations (id, name, slug, plan, created_at)`
      )
      .eq('user_id', ctx.user.id)
      .order('joined_at', { ascending: true })

    let membershipsData = membershipsWithPermissions.data as Array<any> | null
    let membershipsError = membershipsWithPermissions.error

    if (membershipsError && isMissingColumnError(membershipsError, 'permissions')) {
      const fallbackMemberships = await ctx.supabase
        .from('user_organizations')
        .select(
          `id, role, is_owner, is_default, joined_at, organizations (id, name, slug, plan, created_at)`
        )
        .eq('user_id', ctx.user.id)
        .order('joined_at', { ascending: true })

      membershipsData = fallbackMemberships.data as Array<any> | null
      membershipsError = fallbackMemberships.error
    }

    if (membershipsError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch organizations: ${membershipsError.message}`,
      })
    }

    const normalized = (membershipsData ?? []).map((row) => {
      const org = (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) as {
        id: string
        name: string
        slug: string
        plan: string
        created_at: string
      }

      const role = (row.role === 'admin' ? 'admin' : 'agent') as 'admin' | 'agent'

      return {
        membershipId: row.id,
        role,
        permissions: getEffectiveTeamPermissions(role, row.permissions ?? null),
        isOwner: (row.is_owner as boolean) ?? false,
        isDefault: row.is_default,
        joinedAt: row.joined_at,
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        created_at: org.created_at,
      }
    })

    const orgIds = normalized.map((org) => org.id)
    const planMap = await getSubscriptionPlanMap(ctx.supabase, orgIds)

    return normalized.map((org) => ({
      ...org,
      plan: planMap.get(org.id) ?? org.plan ?? 'free',
    }))
  }),

  getActiveOrg: protectedProcedure.query(async ({ ctx }) => {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('active_org_id, org_id')
      .eq('id', ctx.user.id)
      .single()

    const activeOrgId = user?.active_org_id ?? user?.org_id
    if (!activeOrgId) return null

    const org = await getOrgWithSubscriptionPlan(ctx.supabase, activeOrgId)
    if (!org) return null

    let membershipResult = await ctx.supabase
      .from('user_organizations')
      .select('role, permissions')
      .eq('user_id', ctx.user.id)
      .eq('org_id', activeOrgId)
      .maybeSingle()

    if (membershipResult.error && isMissingColumnError(membershipResult.error, 'permissions')) {
      membershipResult = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', activeOrgId)
        .maybeSingle()
    }

    if (membershipResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to resolve organization membership: ${membershipResult.error.message}`,
      })
    }

    const role = (membershipResult.data?.role === 'admin' ? 'admin' : 'agent') as 'admin' | 'agent'

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      role,
      permissions: getEffectiveTeamPermissions(role, membershipResult.data?.permissions ?? null),
    }
  }),

  switchOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      let membershipResult = await ctx.supabase
        .from('user_organizations')
        .select('id, role, permissions')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (membershipResult.error && isMissingColumnError(membershipResult.error, 'permissions')) {
        membershipResult = await ctx.supabase
          .from('user_organizations')
          .select('id, role')
          .eq('user_id', ctx.user.id)
          .eq('org_id', input.orgId)
          .maybeSingle()
      }

      if (membershipResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to resolve organization membership: ${membershipResult.error.message}`,
        })
      }

      const membership = membershipResult.data

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this organization.',
        })
      }

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

      const org = await getOrgWithSubscriptionPlan(ctx.supabase, input.orgId)
      const role = (membership.role === 'admin' ? 'admin' : 'agent') as 'admin' | 'agent'
      return {
        success: true,
        org,
        role,
        permissions: getEffectiveTeamPermissions(role, (membership as { permissions?: unknown }).permissions ?? null),
      }
    }),

  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Organization name is required').max(80),
        planId: z.enum(['free', 'starter', 'pro', 'scale']).default('free'),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id
      const orgName = input.name.trim()

      const ownedCount = await getOwnedOrganizationsCount(ctx.supabase, userId)

      if (ownedCount <= 0 && input.planId !== 'free') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Your first organization must start on the Free plan.',
        })
      }

      if (ownedCount >= 1 && input.planId === 'free') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only your first owned organization can be created on Free. Choose a paid plan.',
        })
      }

      const slug = await buildUniqueSlug(ctx.supabase, orgName)

      if (input.planId === 'free') {
        const orgInsert = await ctx.supabase
          .from('organizations')
          .insert({
            name: orgName,
            slug,
            plan: 'free',
          })
          .select('id, name, slug, plan, created_at')
          .single()

        const org = orgInsert.data
        const orgError = orgInsert.error

        if (orgError || !org) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create organization: ${orgError?.message ?? 'Unknown error'}`,
          })
        }

        const subInsert = await ctx.supabase
          .from('subscriptions')
          .upsert(
            {
              org_id: org.id,
              plan: 'free',
              status: 'active',
            },
            { onConflict: 'org_id' }
          )

        if (subInsert.error) {
          await ctx.supabase.from('organizations').delete().eq('id', org.id)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to initialize subscription: ${subInsert.error.message}`,
          })
        }

        await ctx.supabase.from('widget_configs').upsert({ org_id: org.id }, { onConflict: 'org_id' })

        let memberInsert = await ctx.supabase
          .from('user_organizations')
          .insert({
            user_id: userId,
            org_id: org.id,
            role: 'admin',
            permissions: getEffectiveTeamPermissions('admin', null),
            is_default: false,
            is_owner: true,
          })

        if (memberInsert.error && isMissingColumnError(memberInsert.error, 'permissions')) {
          memberInsert = await ctx.supabase
            .from('user_organizations')
            .insert({
              user_id: userId,
              org_id: org.id,
              role: 'admin',
              is_default: false,
              is_owner: true,
            })
        }

        if (memberInsert.error) {
          await ctx.supabase.from('organizations').delete().eq('id', org.id)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to add membership: ${memberInsert.error.message}`,
          })
        }

        await ctx.supabase.from('users').update({ active_org_id: org.id }).eq('id', userId)

        return {
          requiresCheckout: false,
          checkoutUrl: null as string | null,
          org,
          role: 'admin' as const,
        }
      }

      const targetPlan = PLANS[input.planId]
      if (!targetPlan?.stripePriceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This plan is not available for purchase.',
        })
      }

      const stripe = getStripe()
      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const pendingOrgId = randomUUID()

      const customer = await stripe.customers.create({
        name: orgName,
        metadata: {
          org_id: pendingOrgId,
          action: 'org_create',
          owner_user_id: userId,
        },
      })

      const metadata = {
        action: 'org_create',
        org_id: pendingOrgId,
        org_name: orgName,
        org_slug: slug,
        owner_user_id: userId,
        plan_id: input.planId,
      }

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: targetPlan.stripePriceId, quantity: 1 }],
        success_url: input.successUrl ?? `${webUrl}/dashboard?orgCreated=true`,
        cancel_url: input.cancelUrl ?? `${webUrl}/dashboard?orgCreateCancelled=true`,
        metadata,
        subscription_data: {
          metadata,
        },
      })

      return {
        requiresCheckout: true,
        checkoutUrl: session.url!,
        org: null,
        role: null,
      }
    }),

  renameOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (!membership || membership.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can rename an organization.' })
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

  leaveOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id

      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role, is_owner')
        .eq('user_id', userId)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (membership?.is_owner) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'As the organization owner, you cannot leave. Transfer ownership first.',
        })
      }

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

      await ctx.supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', input.orgId)

      const { data: user } = await ctx.supabase
        .from('users')
        .select('active_org_id, org_id')
        .eq('id', userId)
        .single()

      if (user?.active_org_id === input.orgId || user?.org_id === input.orgId) {
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

  getOrgMembers: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', input.orgId)
        .maybeSingle()

      if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member.' })

      const membersWithPermissions = await ctx.supabase
        .from('user_organizations')
        .select(`id, role, permissions, is_owner, joined_at, users (id, email, name, avatar_url)`)
        .eq('org_id', input.orgId)
        .order('joined_at', { ascending: true })

      let membersData = membersWithPermissions.data as Array<any> | null
      let membersError = membersWithPermissions.error

      if (membersError && isMissingColumnError(membersError, 'permissions')) {
        const fallbackMembers = await ctx.supabase
          .from('user_organizations')
          .select(`id, role, is_owner, joined_at, users (id, email, name, avatar_url)`)
          .eq('org_id', input.orgId)
          .order('joined_at', { ascending: true })

        membersData = fallbackMembers.data as Array<any> | null
        membersError = fallbackMembers.error
      }

      if (membersError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch members: ${membersError.message}`,
        })
      }

      return (membersData ?? []).map((row) => ({
        membershipId: row.id,
        role: row.role as 'admin' | 'agent',
        permissions: getEffectiveTeamPermissions((row.role === 'admin' ? 'admin' : 'agent') as 'admin' | 'agent', row.permissions ?? null),
        isOwner: (row.is_owner as boolean) ?? false,
        joinedAt: row.joined_at,
        ...((Array.isArray(row.users) ? row.users[0] : row.users) as {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
        }),
      }))
    }),
})
