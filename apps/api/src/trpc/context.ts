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

function readJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const supabaseRole = readJwtRole(supabaseServiceKey)
if (supabaseRole !== 'service_role') {
  console.warn('[api] SUPABASE_SERVICE_KEY does not look like a service_role key. Widget updates may fail due to RLS policies.')
}

export function createContext({ req }: CreateExpressContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
  )
  return { supabase, token }
}

export type Context = inferAsyncReturnType<typeof createContext>