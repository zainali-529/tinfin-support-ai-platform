'use client'

import { ConversationView } from './ConversationView'
import { ConversationSidePanel, ConversationSidePanelSheet } from './ConversationSidePanel'
import { EmailConversationView } from '@/components/email/EmailConversationView'
import { WhatsAppConversationView } from './WhatsAppConversationView'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'
import { MenuIcon, PanelRightOpenIcon } from 'lucide-react'
import type { Conversation } from '@/types/database'

interface ConversationRendererProps {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string, patch?: Partial<Conversation>) => void
  onOpenConversationList?: () => void
}

export function ConversationRenderer({
  conversation,
  orgId,
  agentId,
  onStatusChange,
  onOpenConversationList,
}: ConversationRendererProps) {
  const [composerText, setComposerText] = useState('')
  const [copilotDraft, setCopilotDraft] = useState<{ content: string; nonce: number } | null>(null)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [sidePanelSheetOpen, setSidePanelSheetOpen] = useState(false)

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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 xl:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs lg:hidden"
          onClick={onOpenConversationList}
        >
          <MenuIcon className="size-3.5" />
          Inbox
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={() => setSidePanelSheetOpen(true)}
        >
          <PanelRightOpenIcon className="size-3.5" />
          Timeline & Copilot
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          {content}
        </div>
        <ConversationSidePanel
          conversation={conversation}
          agentId={agentId}
          composerText={composerText}
          onInsertDraft={handleInsertDraft}
          open={sidePanelOpen}
          onOpenChange={setSidePanelOpen}
        />
      </div>

      <ConversationSidePanelSheet
        conversation={conversation}
        agentId={agentId}
        composerText={composerText}
        onInsertDraft={handleInsertDraft}
        open={sidePanelSheetOpen}
        onOpenChange={setSidePanelSheetOpen}
      />
    </div>
  )
}
