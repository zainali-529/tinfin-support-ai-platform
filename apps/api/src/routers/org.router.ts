import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const orgRouter = router({
  getOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', input.orgId)
        .single()
      return data
    }),

  getWidgetConfig: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('widget_configs')
        .select('*')
        .eq('org_id', input.orgId)
        .single()
      return data
    }),

  updateWidgetConfig: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid(),
      primaryColor: z.string().optional(),
      welcomeMessage: z.string().optional(),
      position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
      showBranding: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, ...rest } = input
      const { data } = await ctx.supabase
        .from('widget_configs')
        .upsert({ org_id: orgId, ...rest }, { onConflict: 'org_id' })
        .select()
        .single()
      return data
    }),
})