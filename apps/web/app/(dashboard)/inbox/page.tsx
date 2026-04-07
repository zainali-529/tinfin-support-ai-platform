'use client'

import { useEffect, useState, useCallback } from 'react'
import { ConversationList } from '@/components/inbox/ConversationList'
import { ConversationView } from '@/components/inbox/ConversationView'
import { EmptyState } from '@/components/inbox/EmptyState'
import { useConversations } from '@/hooks/useConversations'
import { createClient } from '@/lib/supabase'

function useSession() {
  const [session, setSession] = useState<{ orgId: string; userId: string } | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id
      if (!userId) return
      const { data: user } = await supabase
        .from('users').select('org_id').eq('id', userId).single()
      if (user) setSession({ orgId: user.org_id, userId })
    })
  }, [])
  return session
}

export default function InboxPage() {
  const session = useSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conversations, loading, refetch } = useConversations(session?.orgId || '')

  const selected = conversations.find(c => c.id === selectedId) ?? null

  const handleStatusChange = useCallback((id: string, status: string) => {
    refetch()
  }, [refetch])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Left: Conversation List — fixed width, never collapses */}
      <div className="w-[300px] xl:w-[340px] shrink-0 border-r overflow-hidden flex flex-col">
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right: Conversation View — takes remaining space */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {selected ? (
          <ConversationView
            conversation={selected}
            orgId={session.orgId}
            agentId={session.userId}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}