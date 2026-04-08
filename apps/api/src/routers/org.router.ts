/**
 * ORG ROUTER — Multi-Org Fixed
 *
 * Same fix: use ctx.userOrgId from middleware instead of requireOrgAccess check.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

export const orgRouter = router({
  getOrg: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(), // kept for backward compat
    }).optional())
    .query(async ({ ctx }) => {
      const orgId = ctx.userOrgId

      const { data } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      return data
    }),

  getWidgetConfig: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(), // kept for backward compat
    }).optional())
    .query(async ({ ctx }) => {
      const orgId = ctx.userOrgId

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
      orgId: z.string().uuid().optional(), // kept for backward compat
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
      welcomeMessage: z.string().max(200).optional(),
      companyName: z.string().max(80).optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
      showBranding: z.boolean().optional(),
      settings: z.object({
        botName: z.string().max(50).optional(),
        inputPlaceholder: z.string().max(100).optional(),
        responseTimeText: z.string().max(100).optional(),
        launcherSize: z.enum(['sm', 'md', 'lg']).optional(),
        borderRadius: z.number().min(8).max(28).optional(),
        widgetWidth: z.number().min(300).max(440).optional(),
        headerStyle: z.enum(['gradient', 'solid']).optional(),
        userBubbleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
        autoOpen: z.boolean().optional(),
        autoOpenDelay: z.number().min(0).max(60).optional(),
        showTypingIndicator: z.boolean().optional(),
        offlineMessage: z.string().max(200).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use the middleware-resolved active org — not the (potentially stale) input.orgId
      const orgId = ctx.userOrgId
      const { settings, ...rest } = input

      const payload: Record<string, unknown> = { org_id: orgId }
      if (rest.primaryColor !== undefined) payload.primary_color = rest.primaryColor
      if (rest.welcomeMessage !== undefined) payload.welcome_message = rest.welcomeMessage
      if (rest.companyName !== undefined) payload.company_name = rest.companyName
      if (rest.logoUrl !== undefined) payload.logo_url = rest.logoUrl || null
      if (rest.position !== undefined) payload.position = rest.position
      if (rest.showBranding !== undefined) payload.show_branding = rest.showBranding

      if (settings !== undefined) {
        const { data: existing } = await ctx.supabase
          .from('widget_configs')
          .select('settings')
          .eq('org_id', orgId)
          .maybeSingle()

        const existingSettings = (existing?.settings as Record<string, unknown>) ?? {}
        payload.settings = { ...existingSettings, ...settings }
      }

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
          message: 'Widget config update did not return a row.',
        })
      }

      return data
    }),
})