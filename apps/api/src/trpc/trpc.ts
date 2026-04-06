import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.token) throw new TRPCError({ code: 'UNAUTHORIZED' })
  const { data: { user } } = await ctx.supabase.auth.getUser(ctx.token)
  if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user } })
})