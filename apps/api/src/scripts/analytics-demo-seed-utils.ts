import { createClient } from '@supabase/supabase-js'

export const DEMO_SEED_FLAG = 'analyticsDemoSeed'
export const DEFAULT_DEMO_SEED_ID = 'analytics-ui-demo'

export type CliOptions = {
  orgId: string
  seedId: string
  days: number
  scale: number
}

export function readCliOptions(): CliOptions {
  const args = new Map<string, string>()

  for (const rawArg of process.argv.slice(2)) {
    if (!rawArg.startsWith('--')) continue
    const [rawKey, ...rawValue] = rawArg.slice(2).split('=')
    if (!rawKey) continue
    args.set(rawKey, rawValue.join('=') || 'true')
  }

  const orgId = args.get('org') ?? process.env.ANALYTICS_DEMO_ORG_ID ?? ''
  const seedId = sanitizeSeedId(args.get('seed') ?? process.env.ANALYTICS_DEMO_SEED_ID ?? DEFAULT_DEMO_SEED_ID)
  const days = clampNumber(Number(args.get('days') ?? process.env.ANALYTICS_DEMO_DAYS ?? 45), 7, 90)
  const scale = clampNumber(Number(args.get('scale') ?? process.env.ANALYTICS_DEMO_SCALE ?? 1), 1, 5)

  if (!orgId) {
    throw new Error(
      'Missing org id. Pass --org=<organization_id> or set ANALYTICS_DEMO_ORG_ID in .env.'
    )
  }

  return { orgId, seedId, days, scale }
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function seedMarker(seedId: string) {
  return {
    [DEMO_SEED_FLAG]: true,
    analyticsDemoSeedId: seedId,
  }
}

export function demoActionNames(seedId: string) {
  const suffix = seedId.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40)
  return [
    `demo_analytics_order_lookup_${suffix}`,
    `demo_analytics_refund_check_${suffix}`,
    `demo_analytics_subscription_sync_${suffix}`,
  ]
}

export function daysAgo(days: number, hour = 10, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export function iso(date: Date) {
  return date.toISOString()
}

export async function deleteByIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  ids: string[]
) {
  return deleteByColumn(supabase, table, 'id', ids)
}

export async function deleteByColumn(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  values: string[]
) {
  if (values.length === 0) return 0
  let deleted = 0

  for (let index = 0; index < values.length; index += 50) {
    const chunk = values.slice(index, index + 50)
    const { error } = await supabase.from(table).delete().in(column, chunk)
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`)
    deleted += chunk.length
  }

  return deleted
}

function sanitizeSeedId(value: string) {
  const next = value.trim().replace(/\s+/g, '-').slice(0, 60)
  return next || DEFAULT_DEMO_SEED_ID
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}
