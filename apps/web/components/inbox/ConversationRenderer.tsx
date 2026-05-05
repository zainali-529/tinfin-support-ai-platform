'use client'

import { ConversationView } from './ConversationView'
import { ConversationSidePanel } from './ConversationSidePanel'
import { EmailConversationView } from '@/components/email/EmailConversationView'
import { WhatsAppConversationView } from './WhatsAppConversationView'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Conversation } from '@/types/database'

interface ConversationRendererProps {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string, patch?: Partial<Conversation>) => void
}

export function ConversationRenderer({
  conversation,
  orgId,
  agentId,
  onStatusChange,
}: ConversationRendererProps) {
  const [composerText, setComposerText] = useState('')
  const [copilotDraft, setCopilotDraft] = useState<{ content: string; nonce: number } | null>(null)

  useEffect(() => {
    setComposerText('')
    setCopilotDraft(null)
  }, [conversation.id])

  const handleInsertDraft = useCallback((content: string) => {
    setCopilotDraft({ content, nonce: Date.now() })
  }, [])

  let content: ReactNode

  switch (conversation.channel) {
    case 'email':
      content = (
        <EmailConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
          copilotDraft={copilotDraft}
          onComposerTextChange={setComposerText}
        />
      )
      break

    case 'whatsapp':
      content = (
        <WhatsAppConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
          copilotDraft={copilotDraft}
          onComposerTextChange={setComposerText}
        />
      )
      break

    case 'chat':
    default:
      content = (
        <ConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
          copilotDraft={copilotDraft}
          onComposerTextChange={setComposerText}
        />
      )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-hidden">
        {content}
      </div>
      <ConversationSidePanel
        conversation={conversation}
        agentId={agentId}
        composerText={composerText}
        onInsertDraft={handleInsertDraft}
      />
    </div>
  )
}
