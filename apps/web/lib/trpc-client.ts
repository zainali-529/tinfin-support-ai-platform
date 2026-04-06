import { httpBatchLink, createTRPCClient, type TRPCClient } from '@trpc/client'
import type { AppRouter } from '../../../apps/api/src/trpc/router'
import { createClient } from './supabase'

export const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
      async headers() {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}
      },
    }),
  ],
})