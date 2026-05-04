'use client'

import { ConversationView } from './ConversationView'
import { ConversationTimelinePanel } from './ConversationTimelinePanel'
import { EmailConversationView } from '@/components/email/EmailConversationView'
import { WhatsAppConversationView } from './WhatsAppConversationView'
import type { ReactNode } from 'react'
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
  let content: ReactNode

  switch (conversation.channel) {
    case 'email':
      content = (
        <EmailConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
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
        />
      )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-hidden">
        {content}
      </div>
      <ConversationTimelinePanel conversationId={conversation.id} agentId={agentId} />
    </div>
  )
}
