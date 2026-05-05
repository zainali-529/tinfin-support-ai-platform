'use client'

import { useState, useEffect } from 'react'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@workspace/ui/components/tooltip'
import { Toaster, toast } from '@workspace/ui/components/sonner'
import { normalizeLaunchError } from '@/lib/launch-errors'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    mutationCache: new MutationCache({
      onError(error) {
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
      await supabase.auth.getSession()
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
