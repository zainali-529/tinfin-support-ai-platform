'use client'

import { useEffect, useState, useRef } from 'react'
import { ConversationList } from '@/components/inbox/ConversationList'
import { ConversationView } from '@/components/inbox/ConversationView'
import { EmptyState } from '@/components/inbox/EmptyState'
import { useConversations } from '@/hooks/useConversations'
import { createClient } from '@/lib/supabase'
import { cn } from '@workspace/ui/lib/utils'

// Temp: get orgId and userId from session
function useSession() {
  const [session, setSession] = useState<{ orgId: string; userId: string } | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id
      if (!userId) return
      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .single()
      if (user) setSession({ orgId: user.org_id, userId })
    })
  }, [])
  return session
}

export default function InboxPage() {
  const session = useSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(320)
  const containerRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)
  const { conversations, loading } = useConversations(session?.orgId || '')

  const selected = conversations.find(c => c.id === selectedId) || null

  // Stable references for event listeners
  const handleMouseMoveRef = useRef<(e: MouseEvent) => void>(null)
  const stopResizingRef = useRef<() => void>(null)

  useEffect(() => {
    const saved = localStorage.getItem('inbox-left-width')
    if (saved) setLeftWidth(parseInt(saved, 10))

    // Cleanup on unmount
    return () => {
      if (handleMouseMoveRef.current) document.removeEventListener('mousemove', handleMouseMoveRef.current)
      if (stopResizingRef.current) document.removeEventListener('mouseup', stopResizingRef.current)
    }
  }, [])

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth = e.clientX - containerRect.left
    if (newWidth > 200 && newWidth < 800) {
      setLeftWidth(newWidth)
      localStorage.setItem('inbox-left-width', newWidth.toString())
    }
  }

  const stopResizing = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResizing)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // Update refs to current functions
  handleMouseMoveRef.current = handleMouseMove
  stopResizingRef.current = stopResizing

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  if (!session) return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Loading...
    </div>
  )

  return (
    <div 
      ref={containerRef}
      className="h-[calc(100vh-4rem)] overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <div className="flex h-full w-full">
        {/* Left: Conversation List */}
        <div 
          style={{ width: `${leftWidth}px` }} 
          className="shrink-0 overflow-hidden border-r bg-background"
        >
          <ConversationList
            conversations={conversations}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Resizer Handle */}
        <div
          onMouseDown={startResizing}
          className={cn(
            "w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary",
            "flex items-center justify-center"
          )}
        >
          <div className="h-8 w-px bg-muted-foreground/20" />
        </div>

        {/* Right: Conversation View */}
        <div className="flex-1 min-w-0 bg-background">
          {selected ? (
            <ConversationView
              conversation={selected}
              orgId={session.orgId}
              agentId={session.userId}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  )
}