import {
  createTRPCClient,
  httpBatchLink,
  httpLink,
  splitLink,
  type TRPCClient,
} from '@trpc/client'
import type { AppRouter } from '../../../apps/api/src/trpc/router'
import { createClient } from './supabase'

const UNBATCHED_TRPC_PATHS = new Set([
  'billing.getPlans',
  'notifications.getUnreadCount',
  'usage.getUsage',
])

function shouldUnbatchTrpcPath(path: string): boolean {
  return path.startsWith('dashboard.') || UNBATCHED_TRPC_PATHS.has(path)
}

async function authHeaders() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
}

export const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition(operation) {
        return shouldUnbatchTrpcPath(operation.path)
      },
      true: httpLink({
        url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
        headers: authHeaders,
      }),
      false: httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
        headers: authHeaders,
      }),
    }),
  ],
})
