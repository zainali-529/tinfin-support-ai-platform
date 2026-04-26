'use client'

import { ConversationView } from './ConversationView'
import { EmailConversationView } from '@/components/email/EmailConversationView'
import { WhatsAppConversationView } from './WhatsAppConversationView'
import type { Conversation } from '@/types/database'

interface ConversationRendererProps {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string) => void
}

export function ConversationRenderer({
  conversation,
  orgId,
  agentId,
  onStatusChange,
}: ConversationRendererProps) {
  switch (conversation.channel) {
    case 'email':
      return (
        <EmailConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
        />
      )

    case 'whatsapp':
      return (
        <WhatsAppConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
        />
      )

    case 'chat':
    default:
      return (
        <ConversationView
          conversation={conversation}
          orgId={orgId}
          agentId={agentId}
          onStatusChange={onStatusChange}
        />
      )
  }
}
