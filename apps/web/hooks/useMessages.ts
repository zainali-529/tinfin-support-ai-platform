'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRealtimeTable } from './useRealtime'
import type { Message } from '@/types/database'

export function useMessages(conversationId: string, orgId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const fetch = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    setMessages((data as Message[]) ?? [])
    setLoading(false)
  }, [conversationId])

  useEffect(() => { fetch() }, [fetch])

  // Real-time: new messages
  useRealtimeTable<Message>('messages', orgId, 'INSERT', useCallback((payload) => {
    if (payload.new.conversation_id === conversationId) {
      setMessages(prev => {
        if (prev.find(m => m.id === payload.new.id)) return prev
        return [...prev, payload.new]
      })
    }
  }, [conversationId]))

  // Agent sends a message (updates DB directly, also marks conversation open)
  const sendMessage = useCallback(async (content: string, agentId: string) => {
    setSending(true)
    const supabase = createClient()
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      org_id: orgId,
      role: 'agent',
      content,
    })
    await supabase
      .from('conversations')
      .update({ status: 'open', assigned_to: agentId })
      .eq('id', conversationId)
    setSending(false)
  }, [conversationId, orgId])

  return { messages, loading, sending, sendMessage, refetch: fetch }
}