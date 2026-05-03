/**
 * apps/api/src/routers/org.router.ts  (Updated)
 *
 * Fix: updateWidgetConfig now requires admin role.
 * getOrg and getWidgetConfig remain available to all members.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireFeature } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'

const widgetThemeSchema = z.object({
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  surfaceColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  mutedTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  assistantBubbleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  assistantTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  userBubbleTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  inputBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  headerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export const orgRouter = router({
  getOrg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx }) => {
      const { data } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', ctx.userOrgId)
        .single()
      return data
    }),

  getWidgetConfig: protectedProcedure
    .input(z.object({ orgId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('widget_configs')
        .select('*')
        .eq('org_id', ctx.userOrgId)
        .maybeSingle()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to load widget config: ${error.message}` })
      }
      return data
    }),

  // ── ADMIN ONLY ────────────────────────────────────────────────────────────

  updateWidgetConfig: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      welcomeMessage: z.string().max(200).optional(),
      companyName: z.string().max(80).optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      position: z.enum(['bottom-right', 'bottom-left']).optional(),
      showBranding: z.boolean().optional(),
      settings: z.object({
        themeMode: z.enum(['light', 'dark', 'system']).optional(),
        lightTheme: widgetThemeSchema.optional(),
        darkTheme: widgetThemeSchema.optional(),
        botName: z.string().max(50).optional(),
        inputPlaceholder: z.string().max(100).optional(),
        responseTimeText: z.string().max(100).optional(),
        launcherSize: z.enum(['sm', 'md', 'lg']).optional(),
        borderRadius: z.number().min(8).max(28).optional(),
        widgetWidth: z.number().min(300).max(460).optional(),
        widgetHeight: z.number().min(480).max(720).optional(),
        expandedWidth: z.number().min(520).max(900).optional(),
        expandedHeight: z.number().min(560).max(820).optional(),
        headerStyle: z.enum(['gradient', 'solid']).optional(),
        userBubbleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
        autoOpen: z.boolean().optional(),
        autoOpenDelay: z.number().min(0).max(60).optional(),
        showTypingIndicator: z.boolean().optional(),
        offlineMessage: z.string().max(200).optional(),
        suggestions: z.array(
          z.object({
            label: z.string().min(1).max(40),
            message: z.string().min(1).max(240),
          })
        ).max(6).optional(),
        helpItems: z.array(
          z.object({
            id: z.string().max(60).optional(),
            question: z.string().min(1).max(90),
            answer: z.string().min(1).max(700),
            actionLabel: z.string().max(40).optional(),
            actionMessage: z.string().max(240).optional(),
          })
        ).max(8).optional(),
        talkToHumanLabel: z.string().max(40).optional(),
        talkToHumanMessage: z.string().max(240).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'widget', 'Widget access is required.')
      await requireFeature(ctx.supabase, ctx.userOrgId, 'widgetCustomization')

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

        const existingSettings = asRecord(existing?.settings)
        const nextSettings: Record<string, unknown> = { ...existingSettings, ...settings }
        if (settings.lightTheme) {
          nextSettings.lightTheme = { ...asRecord(existingSettings.lightTheme), ...settings.lightTheme }
        }
        if (settings.darkTheme) {
          nextSettings.darkTheme = { ...asRecord(existingSettings.darkTheme), ...settings.darkTheme }
        }
        payload.settings = nextSettings
      }

      const { data, error } = await ctx.supabase
        .from('widget_configs')
        .upsert(payload, { onConflict: 'org_id' })
        .select()
        .maybeSingle()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to update widget config: ${error.message}` })
      if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Widget config update did not return a row.' })

      return data
    }),
})
