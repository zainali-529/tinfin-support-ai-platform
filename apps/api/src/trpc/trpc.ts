import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

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

  // Use active_org_id if set; fall back to the primary org_id.
  // active_org_id is set when the user switches organizations.
  const userOrgId = (userRecord.active_org_id ?? userRecord.org_id) as string

  // Verify the user actually belongs to that org (guards against stale active_org_id)
  const { data: membership } = await ctx.supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', userOrgId)
    .maybeSingle()

  // If the active org membership is gone (user was removed), fall back to primary org
  const resolvedOrgId = membership
    ? userOrgId
    : (userRecord.org_id as string)

  const resolvedRole = (membership?.role ?? userRecord.role ?? 'agent') as string

  return next({
    ctx: {
      ...ctx,
      user,
      userOrgId: resolvedOrgId,
      userRole: resolvedRole,
    },
  })
})