import { createClient } from '@supabase/supabase-js'
import type { inferAsyncReturnType } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'

export function createContext({ req }: CreateExpressContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  return { supabase, token }
}

export type Context = inferAsyncReturnType<typeof createContext>