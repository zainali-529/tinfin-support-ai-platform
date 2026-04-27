import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'
import { getEffectiveTeamPermissions } from '@workspace/types'
import { getOrgMembershipAccess, toOrgRole } from '../lib/org-permissions'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.token) throw new TRPCError({ code: 'UNAUTHORIZED' })

  const { data: { user } } = await ctx.supabase.auth.getUser(ctx.token)
  if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' })

  const { data: userRecord, error } = await ctx.supabase
    .from('users')
    .select('org_id, active_org_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !userRecord?.org_id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'User organization not found.' })
  }

  // Use active_org_id when available, then fall back to primary org if membership is stale.
  const preferredOrgId = (userRecord.active_org_id ?? userRecord.org_id) as string
  const primaryOrgId = userRecord.org_id as string

  let resolvedOrgId = preferredOrgId
  let membership = await getOrgMembershipAccess(ctx.supabase, user.id, preferredOrgId)

  if (!membership && preferredOrgId !== primaryOrgId) {
    membership = await getOrgMembershipAccess(ctx.supabase, user.id, primaryOrgId)
    resolvedOrgId = primaryOrgId
  }

  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No organization membership found for this user.',
    })
  }

  const resolvedRole = toOrgRole(membership.role ?? userRecord.role ?? 'agent')
  const resolvedPermissions = membership.permissions ?? getEffectiveTeamPermissions(resolvedRole, null)

  return next({
    ctx: {
      ...ctx,
      user,
      userOrgId: resolvedOrgId,
      userRole: resolvedRole,
      userPermissions: resolvedPermissions,
    },
  })
})
