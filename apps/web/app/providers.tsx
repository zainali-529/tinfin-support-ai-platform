'use client'

import { useState, useEffect } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import * as Sentry from '@sentry/nextjs'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@workspace/ui/components/tooltip'
import { Toaster, toast } from '@workspace/ui/components/sonner'
import { normalizeLaunchError } from '@/lib/launch-errors'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        Sentry.captureException(error, {
          tags: {
            surface: 'react_query',
            operation: 'query',
          },
          extra: {
            queryHash: query.queryHash,
            queryKey: query.queryKey,
          },
        })
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        Sentry.captureException(error, {
          tags: {
            surface: 'react_query',
            operation: 'mutation',
          },
          extra: {
            mutationKey: mutation.options.mutationKey,
          },
        })

        const info = normalizeLaunchError(error)
        toast.error(info.title, {
          description: info.message,
          action: info.docsHref
            ? {
                label: 'Docs',
                onClick: () => {
                  window.location.href = info.docsHref!
                },
              }
            : undefined,
        })
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          const message = error instanceof Error ? error.message.toLowerCase() : ''
          if (message.includes('forbidden') || message.includes('unauthorized')) return false
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
    },
  }))

  useEffect(() => {
    const warmSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
        })
      } else {
        Sentry.setUser(null)
      }
    }
    void warmSession()
  }, [])

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/trpc`,
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
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  )
}
