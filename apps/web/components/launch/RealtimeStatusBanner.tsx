'use client'

import * as React from 'react'
import Link from 'next/link'
import { WifiOffIcon } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { useAgentRealtime } from '@/components/realtime/AgentRealtimeProvider'

export function RealtimeStatusBanner() {
  const { connected } = useAgentRealtime()
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    if (connected) {
      setShow(false)
      return
    }

    const timeout = setTimeout(() => setShow(true), 3500)
    return () => clearTimeout(timeout)
  }, [connected])

  if (!show) return null

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-100">
        <div className="flex items-center gap-2">
          <WifiOffIcon className="size-3.5 shrink-0" />
          <span>
            Realtime updates are reconnecting. Messages are still saved, but live inbox badges may lag for a moment.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 bg-background/70 px-2 text-xs"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 bg-background/70 px-2 text-xs">
            <Link href="/docs/troubleshooting/common-issues">Docs</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
