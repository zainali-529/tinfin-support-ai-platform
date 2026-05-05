import { createClient } from '@supabase/supabase-js'

export const SCREENSHOT_DEMO_FLAG = 'screenshotDemoSeed'
export const DEFAULT_SCREENSHOT_DEMO_SEED_ID = 'launch-screenshot-demo'

export type CliOptions = {
  orgId: string
  seedId: string
  days: number
  scale: number
  reset: boolean
}

export type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

export function readCliOptions(): CliOptions {
  const args = new Map<string, string>()
  const positionalOrgIds: string[] = []

  const rawArgs = process.argv.slice(2)

  for (let index = 0; index < rawArgs.length; index += 1) {
    const rawArg = rawArgs[index]
    if (!rawArg) continue

    const maybeBareUuid = rawArg.replace(/^--?/, '')

    if (isUuid(maybeBareUuid)) {
      positionalOrgIds.push(maybeBareUuid)
      continue
    }

    if (!rawArg.startsWith('--')) continue

    const [rawKey, ...rawValue] = rawArg.slice(2).split('=')
    if (!rawKey) continue

    const inlineValue = rawValue.join('=')
    const nextArg = rawArgs[index + 1]
    const value = inlineValue || (nextArg && !nextArg.startsWith('--') ? nextArg : 'true')

    args.set(rawKey, value)
    if (!inlineValue && nextArg && !nextArg.startsWith('--')) index += 1
  }

  const orgId =
    args.get('org') ??
    args.get('org-id') ??
    args.get('organization') ??
    args.get('organization-id') ??
    positionalOrgIds[0] ??
    process.env.SCREENSHOT_DEMO_ORG_ID ??
    ''
  const seedId = sanitizeSeedId(args.get('seed') ?? process.env.SCREENSHOT_DEMO_SEED_ID ?? DEFAULT_SCREENSHOT_DEMO_SEED_ID)
  const days = clampNumber(Number(args.get('days') ?? process.env.SCREENSHOT_DEMO_DAYS ?? 30), 7, 90)
  const scale = clampNumber(Number(args.get('scale') ?? process.env.SCREENSHOT_DEMO_SCALE ?? 2), 1, 6)
  const reset = readBoolean(args.get('reset') ?? process.env.SCREENSHOT_DEMO_RESET ?? 'true')

  if (!orgId) {
    throw new Error('Missing org id. Pass --org=<organization_id> or set SCREENSHOT_DEMO_ORG_ID in .env.')
  }

  return { orgId, seedId, days, scale, reset }
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
    [SCREENSHOT_DEMO_FLAG]: true,
    screenshotDemoSeedId: seedId,
  }
}

export function demoActionNames(seedId: string) {
  const suffix = seedId.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 36)
  return [
    `screenshot_order_lookup_${suffix}`,
    `screenshot_cancel_order_${suffix}`,
    `screenshot_subscription_check_${suffix}`,
    `screenshot_booking_lookup_${suffix}`,
  ]
}

export function nowMinus(days: number, hour = 10, minute = 0) {
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

export function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!
}

export async function insertBatched<T extends Record<string, unknown>>(
  supabase: SupabaseAdmin,
  table: string,
  rows: T[],
  options: { chunkSize?: number; select?: string } = {}
): Promise<Array<Record<string, unknown>>> {
  if (rows.length === 0) return []

  const chunkSize = options.chunkSize ?? 300
  const output: Array<Record<string, unknown>> = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    let query: any = supabase.from(table).insert(chunk)
    if (options.select) query = query.select(options.select)

    const { data, error } = await query
    if (error) throw new Error(`Failed to insert ${table}: ${error.message}`)
    if (Array.isArray(data)) output.push(...(data as Array<Record<string, unknown>>))
  }

  return output
}

export async function selectIdsByJsonMarker(
  supabase: SupabaseAdmin,
  table: string,
  jsonColumn: string,
  seedId: string,
  orgId: string
): Promise<string[]> {
  const ids: string[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('org_id', orgId)
      .eq(`${jsonColumn}->>screenshotDemoSeedId`, seedId)
      .range(from, from + 999)

    if (error) throw new Error(`Failed to select ${table}: ${error.message}`)

    const rows = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
    ids.push(...rows)
    if (rows.length < 1000) break
  }

  return ids
}

export async function deleteByIds(
  supabase: SupabaseAdmin,
  table: string,
  ids: string[]
): Promise<number> {
  return deleteByColumn(supabase, table, 'id', ids)
}

export async function deleteByColumn(
  supabase: SupabaseAdmin,
  table: string,
  column: string,
  values: string[]
): Promise<number> {
  if (values.length === 0) return 0
  let deleted = 0

  for (let index = 0; index < values.length; index += 100) {
    const chunk = values.slice(index, index + 100)
    const { error } = await supabase.from(table).delete().in(column, chunk)
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`)
    deleted += chunk.length
  }

  return deleted
}

export async function maybeDeleteByColumn(
  supabase: SupabaseAdmin,
  table: string,
  column: string,
  values: string[]
): Promise<number> {
  try {
    return await deleteByColumn(supabase, table, column, values)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[screenshot-demo] skipped ${table} cleanup: ${message}`)
    return 0
  }
}

function sanitizeSeedId(value: string) {
  const next = value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60)
  return next || DEFAULT_SCREENSHOT_DEMO_SEED_ID
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function readBoolean(value: string) {
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())
}
