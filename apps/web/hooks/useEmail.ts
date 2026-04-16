'use client'

/**
 * apps/web/hooks/useEmail.ts
 *
 * All tRPC hooks for the email channel.
 */

import { trpc } from '@/lib/trpc'

// ─── Account hooks ────────────────────────────────────────────────────────────

export function useEmailAccount() {
  const utils = trpc.useUtils()

  const { data: account, isLoading } = trpc.email.getAccount.useQuery(undefined, {
    staleTime: 60_000,
  })

  const upsertAccount = trpc.email.upsertAccount.useMutation({
    onSuccess: () => utils.email.getAccount.invalidate(),
  })

  const deleteAccount = trpc.email.deleteAccount.useMutation({
    onSuccess: () => utils.email.getAccount.invalidate(),
  })

  const regenerateToken = trpc.email.regenerateWebhookToken.useMutation({
    onSuccess: () => utils.email.getAccount.invalidate(),
  })

  const testConnection = trpc.email.testConnection.useMutation()

  return {
    account,
    isLoading,
    upsertAccount,
    deleteAccount,
    regenerateToken,
    testConnection,
  }
}

// ─── Email messages hook ──────────────────────────────────────────────────────

export function useEmailMessages(conversationId: string | null) {
  const { data: messages = [], isLoading } = trpc.email.getMessages.useQuery(
    { conversationId: conversationId ?? '' },
    { enabled: !!conversationId, staleTime: 30_000 }
  )

  return { messages, isLoading }
}

// ─── Send reply hook ──────────────────────────────────────────────────────────

export function useEmailReply() {
  const utils = trpc.useUtils()

  const sendReply = trpc.email.sendReply.useMutation({
    onSuccess: (_data, variables) => {
      void utils.email.getMessages.invalidate({ conversationId: variables.conversationId })
      void utils.chat.getMessages.invalidate({ conversationId: variables.conversationId })
    },
  })

  return { sendReply }
}