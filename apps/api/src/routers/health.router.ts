import { router, publicProcedure } from '../trpc/trpc'

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: 'ok', time: new Date().toISOString() })),
})