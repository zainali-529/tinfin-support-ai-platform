'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRealtimeTable } from './useRealtime'
import type { Message, Attachment } from '@/types/database'

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readClientNonce(message: Message): string | null {
  const nonce = safeMetadata(message.ai_metadata).clientNonce
  return typeof nonce === 'string' && nonce.trim().length > 0 ? nonce : null
}

function stableAttachmentsKey(value: Attachment[] | null | undefined): string {
  const list = (value ?? []).map((item) => ({
    name: item.name,
    url: item.url,
    type: item.type,
    size: item.size,
  }))
  return JSON.stringify(list)
}

function isPotentialDuplicate(existing: Message, incoming: Message): boolean {
  if (existing.id === incoming.id) return true
  const existingNonce = readClientNonce(existing)
  const incomingNonce = readClientNonce(incoming)
  if (existingNonce && incomingNonce && existingNonce === incomingNonce) return true
  if (existing.role !== incoming.role) return false
  if (existing.content !== incoming.content) return false
  if (stableAttachmentsKey(existing.attachments) !== stableAttachmentsKey(incoming.attachments)) {
    return false
  }

  const existingMs = new Date(existing.created_at).getTime()
  const incomingMs = new Date(incoming.created_at).getTime()
  if (!Number.isFinite(existingMs) || !Number.isFinite(incomingMs)) return false

  return Math.abs(existingMs - incomingMs) <= 5_000
}

export function useMessages(conversationId: string, orgId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const appendMessage = useCallback((incoming: Message) => {
    setMessages((previous) => {
      if (previous.some((existing) => isPotentialDuplicate(existing, incoming))) {
        return previous
      }

      const next = [...previous, incoming]
      next.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      return next
    })
  }, [])

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

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Real-time: new messages (including attachments from realtime payload)
  useRealtimeTable<Message>(
    'messages',
    orgId,
    'INSERT',
    useCallback(
      (payload) => {
        if (payload.new.conversation_id === conversationId) {
          appendMessage(payload.new)
        }
      },
      [appendMessage, conversationId]
    )
  )

  // Agent sends a message (DB directly fallback)
  const sendMessage = useCallback(
    async (
      content: string,
      agentId: string,
      attachments?: Attachment[],
      aiMetadata?: Record<string, unknown>
    ) => {
      setSending(true)
      try {
        const supabase = createClient()
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          org_id: orgId,
          role: 'agent',
          content,
          attachments: attachments ?? [],
          ai_metadata: aiMetadata ?? null,
        })
        await supabase
          .from('conversations')
          .update({ status: 'open', assigned_to: agentId })
          .eq('id', conversationId)
      } finally {
        setSending(false)
      }
    },
    [conversationId, orgId]
  )

  return { messages, loading, sending, sendMessage, refetch: fetch, appendMessage }
}
