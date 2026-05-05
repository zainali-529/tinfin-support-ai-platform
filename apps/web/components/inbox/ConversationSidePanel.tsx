'use client'

import { BotIcon, LockIcon, NotebookPenIcon, PanelRightOpenIcon, XIcon } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'
import { Button } from '@workspace/ui/components/button'
import { Sheet, SheetContent } from '@workspace/ui/components/sheet'
import { AgentCopilotPanel } from './AgentCopilotPanel'
import { ConversationTimelinePanel } from './ConversationTimelinePanel'
import type { Conversation } from '@/types/database'
import { UpgradePrompt } from '@/components/billing/PlanGuard'
import { usePlan } from '@/hooks/usePlan'

interface ConversationSidePanelProps {
  conversation: Conversation
  agentId: string
  composerText: string
  onInsertDraft: (content: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ConversationSidePanelContentProps {
  conversation: Conversation
  agentId: string
  composerText: string
  onInsertDraft: (content: string) => void
  onClose?: () => void
}

function ConversationSidePanelContent({
  conversation,
  agentId,
  composerText,
  onInsertDraft,
  onClose,
}: ConversationSidePanelContentProps) {
  const { canUse, isPlanLoading } = usePlan()
  const canUseCopilot = isPlanLoading || canUse('agentCopilot')

  return (
    <Tabs defaultValue="timeline" className="h-full min-h-0 w-full gap-0">
      <div className="flex items-center gap-2 border-b bg-background/60 px-3 py-2">
        <TabsList className="grid h-8 min-w-0 flex-1 grid-cols-2 rounded-xl">
          <TabsTrigger value="timeline" className="gap-1.5 text-xs">
            <NotebookPenIcon className="size-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="copilot" className="gap-1.5 text-xs">
            {canUseCopilot ? <BotIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
            Copilot
          </TabsTrigger>
        </TabsList>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={onClose}
            aria-label="Close conversation side panel"
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>

      <TabsContent value="timeline" className="min-h-0">
        <ConversationTimelinePanel
          conversationId={conversation.id}
          agentId={agentId}
          embedded
        />
      </TabsContent>
      <TabsContent value="copilot" className="min-h-0">
        {canUseCopilot ? (
          <AgentCopilotPanel
            conversation={conversation}
            composerText={composerText}
            onInsertDraft={onInsertDraft}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <UpgradePrompt
              feature="Agent Copilot"
              requiredPlan="pro"
              description="Draft replies, summarize conversations, rewrite responses, translate, and find next actions with AI."
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export function ConversationSidePanel({
  conversation,
  agentId,
  composerText,
  onInsertDraft,
  open = true,
  onOpenChange,
}: ConversationSidePanelProps) {
  if (!open) {
    return (
      <div className="hidden h-full w-11 shrink-0 items-start justify-center border-l bg-muted/10 pt-3 xl:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground"
          onClick={() => onOpenChange?.(true)}
          aria-label="Open timeline and Copilot panel"
        >
          <PanelRightOpenIcon className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <aside className="hidden h-full w-[348px] shrink-0 border-l bg-muted/10 xl:flex">
      <ConversationSidePanelContent
        conversation={conversation}
        agentId={agentId}
        composerText={composerText}
        onInsertDraft={onInsertDraft}
        onClose={onOpenChange ? () => onOpenChange(false) : undefined}
      />
    </aside>
  )
}

export function ConversationSidePanelSheet({
  conversation,
  agentId,
  composerText,
  onInsertDraft,
  open = false,
  onOpenChange,
}: ConversationSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(100vw,420px)] max-w-none gap-0 p-0 sm:max-w-[420px]"
      >
        <ConversationSidePanelContent
          conversation={conversation}
          agentId={agentId}
          composerText={composerText}
          onInsertDraft={onInsertDraft}
          onClose={() => onOpenChange?.(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
