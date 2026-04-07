import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

function requireOrgAccess(userOrgId: string, requestedOrgId: string) {
  if (requestedOrgId !== userOrgId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization access denied.' })
  }
  return userOrgId
}

export const orgRouter = router({
  getOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      const { data } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      return data
    }),

  getWidgetConfig: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      const { data, error } = await ctx.supabase
        .from('widget_configs')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load widget config: ${error.message}`,
        })
      }

      return data
    }),

  updateWidgetConfig: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
      welcomeMessage: z.string().max(200).optional(),
      companyName: z.string().max(80).optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
      showBranding: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      const { orgId: _orgId, ...rest } = input

      // Build update payload — only include defined fields
      const payload: Record<string, unknown> = { org_id: orgId }
      if (rest.primaryColor !== undefined) payload.primary_color = rest.primaryColor
      if (rest.welcomeMessage !== undefined) payload.welcome_message = rest.welcomeMessage
      if (rest.companyName !== undefined) payload.company_name = rest.companyName
      if (rest.logoUrl !== undefined) payload.logo_url = rest.logoUrl || null
      if (rest.position !== undefined) payload.position = rest.position
      if (rest.showBranding !== undefined) payload.show_branding = rest.showBranding

      const { data, error } = await ctx.supabase
        .from('widget_configs')
        .upsert(payload, { onConflict: 'org_id' })
        .select()
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update widget config: ${error.message}`,
        })
      }

      if (!data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Widget config update did not return a row. Check table schema and permissions.',
        })
      }

      return data
    }),
})