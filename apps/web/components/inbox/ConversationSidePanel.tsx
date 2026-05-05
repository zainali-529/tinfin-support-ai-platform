'use client'

import { BotIcon, NotebookPenIcon } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'
import { AgentCopilotPanel } from './AgentCopilotPanel'
import { ConversationTimelinePanel } from './ConversationTimelinePanel'
import type { Conversation } from '@/types/database'

interface ConversationSidePanelProps {
  conversation: Conversation
  agentId: string
  composerText: string
  onInsertDraft: (content: string) => void
}

export function ConversationSidePanel({
  conversation,
  agentId,
  composerText,
  onInsertDraft,
}: ConversationSidePanelProps) {
  return (
    <aside className="hidden h-full w-[348px] shrink-0 border-l bg-muted/10 xl:flex">
      <Tabs defaultValue="timeline" className="h-full min-h-0 w-full gap-0">
        <div className="border-b bg-background/60 px-3 py-2">
          <TabsList className="grid h-8 w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="timeline" className="gap-1.5 text-xs">
              <NotebookPenIcon className="size-3.5" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="copilot" className="gap-1.5 text-xs">
              <BotIcon className="size-3.5" />
              Copilot
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timeline" className="min-h-0">
          <ConversationTimelinePanel
            conversationId={conversation.id}
            agentId={agentId}
            embedded
          />
        </TabsContent>
        <TabsContent value="copilot" className="min-h-0">
          <AgentCopilotPanel
            conversation={conversation}
            composerText={composerText}
            onInsertDraft={onInsertDraft}
          />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
