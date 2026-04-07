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
    .select('org_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !userRecord?.org_id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'User organization not found.' })
  }

  return next({
    ctx: {
      ...ctx,
      user,
      userOrgId: userRecord.org_id as string,
      userRole: (userRecord.role as string | null) ?? 'agent',
    },
  })
})