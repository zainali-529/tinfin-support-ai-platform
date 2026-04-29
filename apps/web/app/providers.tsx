'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@workspace/ui/components/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }))

  useEffect(() => {
    const logSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        console.log('User Access Token:', session.access_token)
      } else {
        console.log('No active Supabase session found.')
      }
    }
    logSession()
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
          </TooltipProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  )
}