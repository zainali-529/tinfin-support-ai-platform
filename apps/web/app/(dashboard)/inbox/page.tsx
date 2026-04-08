'use client'

/**
 * BUG FIX: The old useSession() hook read `users.org_id` (the immutable primary org).
 * After switching orgs, it kept returning the old org's ID, causing the inbox to
 * show conversations from the wrong organization.
 *
 * FIX: Use useActiveOrgId() from OrgContext instead. OrgContext is populated by
 * the server-side layout which always reads the correct `active_org_id`.
 */

import { useState, useCallback } from 'react'
import { ConversationList } from '@/components/inbox/ConversationList'
import { ConversationView } from '@/components/inbox/ConversationView'
import { EmptyState } from '@/components/inbox/EmptyState'
import { useConversations } from '@/hooks/useConversations'
import { useActiveOrg } from '@/components/org/OrgContext'
import { createClient } from '@/lib/supabase'
import { useEffect, useRef, useState as useReactState } from 'react'

// ─── Agent ID hook (userId only — not org-dependent) ─────────────────────────

function useAgentId() {
  const [agentId, setAgentId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (uid) setAgentId(uid)
    })
  }, [])

  return agentId
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  // useActiveOrg() reads from OrgContext (set by layout.tsx from active_org_id).
  // It is always correct — even after an org switch — because router.refresh()
  // re-runs the layout server component which re-provides the new active org.
  const activeOrg = useActiveOrg()
  const orgId = activeOrg.id

  const agentId = useAgentId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conversations, loading, refetch } = useConversations(orgId)

  const selected = conversations.find(c => c.id === selectedId) ?? null

  const handleStatusChange = useCallback((_id: string, _status: string) => {
    refetch()
  }, [refetch])

  // When org changes (orgId changes), clear the selected conversation
  // so we don't try to render a conversation from the old org
  const prevOrgId = useRef(orgId)
  useEffect(() => {
    if (prevOrgId.current !== orgId) {
      setSelectedId(null)
      prevOrgId.current = orgId
    }
  }, [orgId])

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Left: Conversation List */}
      <div className="w-[300px] xl:w-[340px] shrink-0 border-r overflow-hidden flex flex-col">
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right: Conversation View */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {selected ? (
          <ConversationView
            conversation={selected}
            orgId={orgId}
            agentId={agentId}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}