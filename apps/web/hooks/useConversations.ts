'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRealtimeTable } from './useRealtime'
import type { Conversation, Contact, Message } from '@/types/database'

function latestMessageAt(messages?: Message[]) {
  if (!messages?.length) return 0
  return messages.reduce((latest, message) => {
    const ts = new Date(message.created_at).getTime()
    return ts > latest ? ts : latest
  }, 0)
}

function sortConversations(items: Conversation[]) {
  return [...items].sort((a, b) => {
    const aTs = Math.max(new Date(a.started_at).getTime(), latestMessageAt(a.messages))
    const bTs = Math.max(new Date(b.started_at).getTime(), latestMessageAt(b.messages))
    return bTs - aTs
  })
}

export function useConversations(orgId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversationById = useCallback(async (conversationId: string): Promise<Conversation | null> => {
    if (!orgId) return null
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(*), messages(id, role, content, created_at, ai_metadata)')
      .eq('org_id', orgId)
      .eq('id', conversationId)
      .maybeSingle()
    return (data as Conversation | null) ?? null
  }, [orgId])

  const upsertConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conversation.id)
      if (idx === -1) return sortConversations([conversation, ...prev])
      const next = [...prev]
      next[idx] = { ...prev[idx], ...conversation }
      return sortConversations(next)
    })
  }, [])

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const supabase = createClient()
    // Include ALL statuses — resolved shown as disabled, not hidden
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(*), messages(id, role, content, created_at, ai_metadata)')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(150)
    setConversations(sortConversations((data as Conversation[]) ?? []))
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  useRealtimeTable<Conversation>('conversations', orgId, '*', useCallback((payload) => {
    if (payload.eventType === 'DELETE') {
      setConversations(prev => prev.filter(c => c.id !== (payload.old as Conversation).id))
      return
    }

    void (async () => {
      const hydrated = await fetchConversationById(payload.new.id)
      if (hydrated) {
        upsertConversation(hydrated)
        return
      }

      // Fallback when hydration fails: still merge base row to avoid missing updates.
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === payload.new.id)
        if (idx === -1) return sortConversations([payload.new as Conversation, ...prev])
        const next = [...prev]
        next[idx] = { ...prev[idx], ...payload.new }
        return sortConversations(next)
      })
    })()
  }, [fetchConversationById, upsertConversation]))

  useRealtimeTable<Message>('messages', orgId, 'INSERT', useCallback((payload) => {
    let missingConversation = false
    const nextMessage = payload.new

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === nextMessage.conversation_id)
      if (idx === -1) {
        missingConversation = true
        return prev
      }

      const current = prev[idx]
      if (!current) return prev
      const currentMessages = current.messages ?? []
      if (currentMessages.some(m => m.id === nextMessage.id)) return prev

      const next = [...prev]
      const updatedConversation: Conversation = {
        ...current,
        messages: [...currentMessages, nextMessage],
      }
      next[idx] = updatedConversation
      return sortConversations(next)
    })

    if (missingConversation) {
      void (async () => {
        const hydrated = await fetchConversationById(nextMessage.conversation_id)
        if (hydrated) upsertConversation(hydrated)
      })()
    }
  }, [fetchConversationById, upsertConversation]))

  useRealtimeTable<Contact>('contacts', orgId, '*', useCallback((payload) => {
    if (payload.eventType === 'DELETE') return
    const nextContact = payload.new

    setConversations(prev => {
      let changed = false
      const next = prev.map(conversation => {
        if (conversation.contact_id !== nextContact.id) return conversation
        changed = true
        return {
          ...conversation,
          contacts: {
            ...(conversation.contacts ?? {} as Contact),
            ...nextContact,
          },
        }
      })
      return changed ? next : prev
    })
  }, []))

  return { conversations, loading, refetch: fetch }
}