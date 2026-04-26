import { createClient } from '@supabase/supabase-js'
import type { inferAsyncReturnType } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in API environment')
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_KEY in API environment')
}

const resolvedSupabaseUrl = supabaseUrl
const resolvedSupabaseServiceKey = supabaseServiceKey

function readJwtRole(token: string): string | null {
  const parts = token.split('.')
  const rawPayload = parts[1]
  if (!rawPayload) return null

  try {
    const raw = rawPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const supabaseRole = readJwtRole(resolvedSupabaseServiceKey)
if (supabaseRole !== 'service_role') {
  console.warn('[api] SUPABASE_SERVICE_KEY does not look like a service_role key. Widget updates may fail due to RLS policies.')
}

export function createContext({ req }: CreateExpressContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const supabase = createClient(
    resolvedSupabaseUrl,
    resolvedSupabaseServiceKey
  )
  return { supabase, token }
}

export type Context = inferAsyncReturnType<typeof createContext>
