import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { scanSlaNotifications } from '../services/notifications.service'

const SLA_SCAN_MIN_INTERVAL_MS = 60_000
const lastSlaScanByOrg = new Map<string, number>()
const runningSlaScansByOrg = new Map<string, Promise<void>>()
type SlaScanContext = {
  supabase: Parameters<typeof scanSlaNotifications>[0]
  userOrgId: string
}

const listInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    unreadOnly: z.boolean().default(false),
  })
  .optional()

function normalizeNotification(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    recipientUserId: String(row.recipient_user_id),
    actorUserId: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
    type: String(row.type),
    severity: String(row.severity),
    title: String(row.title),
    body: String(row.body),
    href: typeof row.href === 'string' ? row.href : null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    archivedAt: typeof row.archived_at === 'string' ? row.archived_at : null,
    emailStatus: String(row.email_status ?? 'not_queued'),
    emailSentAt: typeof row.email_sent_at === 'string' ? row.email_sent_at : null,
    createdAt: String(row.created_at),
  }
}

function scheduleSlaScan(ctx: SlaScanContext) {
  const now = Date.now()
  const lastScanAt = lastSlaScanByOrg.get(ctx.userOrgId) ?? 0

  if (now - lastScanAt < SLA_SCAN_MIN_INTERVAL_MS) return
  if (runningSlaScansByOrg.has(ctx.userOrgId)) return

  lastSlaScanByOrg.set(ctx.userOrgId, now)

  const scan = scanSlaNotifications(ctx.supabase, ctx.userOrgId)
    .then(() => undefined)
    .catch((error) => {
      console.error(
        '[notifications.router] SLA scan failed:',
        error instanceof Error ? error.message : error
      )
    })
    .finally(() => {
      runningSlaScansByOrg.delete(ctx.userOrgId)
    })

  runningSlaScansByOrg.set(ctx.userOrgId, scan)
}

export const notificationsRouter = router({
  list: protectedProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      scheduleSlaScan(ctx)

      const limit = input?.limit ?? 20
      const unreadOnly = input?.unreadOnly ?? false

      let query = ctx.supabase
        .from('notifications')
        .select('*')
        .eq('org_id', ctx.userOrgId)
        .eq('recipient_user_id', ctx.user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (unreadOnly) {
        query = query.is('read_at', null)
      }

      const { data, error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load notifications: ${error.message}`,
        })
      }

      return (data ?? []).map((row: Record<string, unknown>) => normalizeNotification(row))
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    scheduleSlaScan(ctx)

    const { count, error } = await ctx.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.userOrgId)
      .eq('recipient_user_id', ctx.user.id)
      .is('read_at', null)
      .is('archived_at', null)

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to count notifications: ${error.message}`,
      })
    }

    return { count: count ?? 0 }
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
        .eq('recipient_user_id', ctx.user.id)
        .is('archived_at', null)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to mark notification as read: ${error.message}`,
        })
      }

      return { success: true }
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('org_id', ctx.userOrgId)
      .eq('recipient_user_id', ctx.user.id)
      .is('read_at', null)
      .is('archived_at', null)

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to mark notifications as read: ${error.message}`,
      })
    }

    return { success: true }
  }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('notifications')
        .update({
          archived_at: new Date().toISOString(),
          read_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
        .eq('recipient_user_id', ctx.user.id)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to archive notification: ${error.message}`,
        })
      }

      return { success: true }
    }),
})
