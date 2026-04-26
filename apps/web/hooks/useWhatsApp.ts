'use client'

import { useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useRealtimeTable } from './useRealtime'
import { useActiveOrgId } from '@/components/org/OrgContext'

interface WhatsAppRealtimeRow {
  id: string
  conversation_id: string
}

interface MessageRealtimeRow {
  id: string
  conversation_id: string
  org_id: string
}

export function useWhatsAppAccount() {
  const utils = trpc.useUtils()

  const accountQuery = trpc.whatsapp.getAccount.useQuery(undefined, {
    staleTime: 60_000,
  })

  const setupAccount = trpc.whatsapp.setupAccount.useMutation({
    onSuccess: () => {
      void utils.whatsapp.getAccount.invalidate()
    },
  })

  const updateAccount = trpc.whatsapp.updateAccount.useMutation({
    onSuccess: () => {
      void utils.whatsapp.getAccount.invalidate()
    },
  })

  const deleteAccount = trpc.whatsapp.deleteAccount.useMutation({
    onSuccess: () => {
      void utils.whatsapp.getAccount.invalidate()
    },
  })

  const testConnection = trpc.whatsapp.testConnection.useMutation()

  return {
    account: accountQuery.data ?? null,
    isLoading: accountQuery.isLoading,
    setupAccount,
    updateAccount,
    deleteAccount,
    testConnection,
  }
}

export function useWhatsAppMessages(conversationId: string | null) {
  const orgId = useActiveOrgId()
  const utils = trpc.useUtils()

  const query = trpc.whatsapp.getMessages.useQuery(
    { conversationId: conversationId ?? '' },
    {
      enabled: !!conversationId,
      staleTime: 30_000,
    }
  )

  const invalidateConversation = useCallback(() => {
    if (!conversationId) return
    void utils.whatsapp.getMessages.invalidate({ conversationId })
    void utils.chat.getMessages.invalidate({ conversationId })
  }, [conversationId, utils.chat.getMessages, utils.whatsapp.getMessages])

  const handleWhatsAppInsert = useCallback(
    (payload: { new: WhatsAppRealtimeRow }) => {
      if (!conversationId) return
      if (payload.new.conversation_id !== conversationId) return

      invalidateConversation()
    },
    [conversationId, invalidateConversation]
  )

  useRealtimeTable<WhatsAppRealtimeRow>(
    'whatsapp_messages',
    orgId,
    'INSERT',
    handleWhatsAppInsert
  )

  // Fallback + chat-like behavior:
  // If whatsapp_messages realtime misses or is delayed, messages inserts/updates
  // still push the thread live exactly like chat.
  const handleMessageInsert = useCallback(
    (payload: { new: MessageRealtimeRow }) => {
      if (!conversationId) return
      if (payload.new.conversation_id !== conversationId) return
      invalidateConversation()
    },
    [conversationId, invalidateConversation]
  )

  useRealtimeTable<MessageRealtimeRow>(
    'messages',
    orgId,
    'INSERT',
    handleMessageInsert
  )

  const handleWhatsAppUpdate = useCallback(
    (payload: { new: WhatsAppRealtimeRow }) => {
      if (!conversationId) return
      if (payload.new.conversation_id !== conversationId) return
      invalidateConversation()
    },
    [conversationId, invalidateConversation]
  )

  useRealtimeTable<WhatsAppRealtimeRow>(
    'whatsapp_messages',
    orgId,
    'UPDATE',
    handleWhatsAppUpdate
  )

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export function useWhatsAppReply() {
  const utils = trpc.useUtils()

  const sendReply = trpc.whatsapp.sendReply.useMutation({
    onSuccess: (_data, variables) => {
      void utils.whatsapp.getMessages.invalidate({
        conversationId: variables.conversationId,
      })
      void utils.chat.getMessages.invalidate({
        conversationId: variables.conversationId,
      })
    },
  })

  return { sendReply }
}
