'use client'

import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  FileTextIcon,
  LanguagesIcon,
  LightbulbIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Wand2Icon,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Separator } from '@workspace/ui/components/separator'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/sonner'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc'
import { MessageMarkdown } from './MessageMarkdown'
import type { Conversation } from '@/types/database'

type CopilotMode =
  | 'draft_reply'
  | 'summarize'
  | 'rewrite'
  | 'translate'
  | 'next_action'
  | 'similar_conversations'
  | 'custom'

interface AgentCopilotPanelProps {
  conversation: Conversation
  composerText: string
  onInsertDraft: (content: string) => void
}

const QUICK_ACTIONS: Array<{
  mode: CopilotMode
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}> = [
  {
    mode: 'draft_reply',
    label: 'Draft reply',
    description: 'Customer-ready response',
    icon: MessageSquareTextIcon,
  },
  {
    mode: 'summarize',
    label: 'Summarize',
    description: 'Issue and next step',
    icon: FileTextIcon,
  },
  {
    mode: 'next_action',
    label: 'Next action',
    description: 'Best operational move',
    icon: LightbulbIcon,
  },
  {
    mode: 'similar_conversations',
    label: 'Similar',
    description: 'Resolved patterns',
    icon: SearchIcon,
  },
]

const TONE_ACTIONS: Array<{
  tone: 'friendly' | 'shorter' | 'formal' | 'clearer'
  label: string
}> = [
  { tone: 'friendly', label: 'Friendly' },
  { tone: 'shorter', label: 'Shorter' },
  { tone: 'formal', label: 'Formal' },
  { tone: 'clearer', label: 'Clearer' },
]

function confidenceClass(label: string | undefined) {
  if (label === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (label === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
}

function resultCanInsert(mode: CopilotMode | undefined) {
  return mode === 'draft_reply' || mode === 'rewrite' || mode === 'translate' || mode === 'custom'
}

function modeTitle(mode: CopilotMode | null) {
  if (mode === 'draft_reply') return 'Reply draft'
  if (mode === 'summarize') return 'Summary'
  if (mode === 'rewrite') return 'Rewrite'
  if (mode === 'translate') return 'Translation'
  if (mode === 'next_action') return 'Next action'
  if (mode === 'similar_conversations') return 'Similar conversations'
  return 'Ask Copilot'
}

export function AgentCopilotPanel({
  conversation,
  composerText,
  onInsertDraft,
}: AgentCopilotPanelProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [customQuestion, setCustomQuestion] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('Spanish')
  const [activeMode, setActiveMode] = useState<CopilotMode | null>(null)
  const [lastInput, setLastInput] = useState<Record<string, unknown> | null>(null)

  const runCopilot = trpc.copilot.run.useMutation({
    onError: (error) => {
      toast.error(error.message || 'Copilot could not generate a response.')
    },
  })
  const createNote = trpc.chat.createInternalNote.useMutation({
    onSuccess: () => {
      toast.success('Copilot output added as an internal note.')
      void utils.chat.getConversationTimeline.invalidate({ conversationId: conversation.id })
    },
    onError: (error) => {
      toast.error(error.message || 'Could not save note.')
    },
  })

  const hasComposerText = composerText.trim().length > 0
  const result = runCopilot.data
  const sources = result?.sources ?? []
  const similarConversations = result?.similarConversations ?? []

  const statusLine = useMemo(() => {
    const channel = conversation.channel.charAt(0).toUpperCase() + conversation.channel.slice(1)
    return `${channel} - ${conversation.status}`
  }, [conversation.channel, conversation.status])

  const run = (mode: CopilotMode, options?: {
    targetTone?: 'friendly' | 'shorter' | 'formal' | 'clearer'
    customQuestion?: string
    targetLanguage?: string
  }) => {
    const payload = {
      conversationId: conversation.id,
      mode,
      draft: composerText,
      customQuestion: options?.customQuestion,
      targetTone: options?.targetTone,
      targetLanguage: options?.targetLanguage,
    }
    setActiveMode(mode)
    setLastInput(payload)
    runCopilot.mutate(payload)
  }

  const rerun = () => {
    if (!lastInput) return
    runCopilot.mutate(lastInput as Parameters<typeof runCopilot.mutate>[0])
  }

  const copyResult = async () => {
    const content = result?.content?.trim()
    if (!content) return
    await navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard.')
  }

  const insertResult = () => {
    const content = result?.content?.trim()
    if (!content) return
    onInsertDraft(content)
    toast.success('Inserted into composer.')
  }

  const saveAsNote = () => {
    const content = result?.content?.trim()
    const mode = result?.mode
    if (!content || !mode || createNote.isPending) return
    createNote.mutate({
      conversationId: conversation.id,
      body: `Copilot ${modeTitle(mode)}\n\n${content}`.slice(0, 4000),
    })
  }

  const askCustom = () => {
    const question = customQuestion.trim()
    if (!question) return
    run('custom', { customQuestion: question })
  }

  const askAboutSelection = () => {
    const selectedText = window.getSelection()?.toString().trim() ?? ''
    if (!selectedText) {
      toast.info('Select text in the conversation first, then ask Copilot.')
      return
    }

    const payload = {
      conversationId: conversation.id,
      mode: 'custom' as const,
      selectedText,
      customQuestion: customQuestion.trim() || 'Help me understand and respond to the selected text.',
      draft: composerText,
    }
    setActiveMode('custom')
    setLastInput(payload)
    runCopilot.mutate(payload)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/10">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">Agent Copilot</h3>
              <Badge variant="outline" className="h-5 rounded-md text-[10px]">
                Internal
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{statusLine}</p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background">
            <SparklesIcon className="size-4 text-primary" />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                const isActive = activeMode === action.mode && runCopilot.isPending
                return (
                  <button
                    key={action.mode}
                    type="button"
                    onClick={() => run(action.mode)}
                    disabled={runCopilot.isPending}
                    className={cn(
                      'rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60',
                      activeMode === action.mode && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="size-4 text-primary" />
                      {isActive && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="mt-2 text-xs font-semibold">{action.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{action.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Composer tools</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Rewrite the current draft before sending.
                </p>
              </div>
              <Wand2Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TONE_ACTIONS.map((item) => (
                <Button
                  key={item.tone}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg px-2 text-[11px]"
                  disabled={!hasComposerText || runCopilot.isPending}
                  onClick={() => run('rewrite', { targetTone: item.tone })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="h-8 text-xs"
                placeholder="Language"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-2 text-[11px]"
                disabled={!hasComposerText || runCopilot.isPending}
                onClick={() => run('translate', { targetLanguage })}
              >
                <LanguagesIcon className="size-3.5" />
                Translate
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-background p-3">
            <p className="text-xs font-semibold">Ask Copilot</p>
            <Textarea
              value={customQuestion}
              onChange={(event) => setCustomQuestion(event.target.value)}
              placeholder="Ask about this conversation, sources, actions, or next reply..."
              className="mt-2 min-h-[74px] resize-none text-xs"
              maxLength={2000}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">{customQuestion.trim().length}/2000</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={runCopilot.isPending}
                  onClick={askAboutSelection}
                >
                  <SearchIcon className="size-3" />
                  Selection
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!customQuestion.trim() || runCopilot.isPending}
                  onClick={askCustom}
                >
                  {activeMode === 'custom' && runCopilot.isPending ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <SendIcon className="size-3" />
                  )}
                  Ask
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {runCopilot.isPending && !result ? (
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Copilot is thinking...
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Reading the conversation, verified sources, configured actions, and similar resolved conversations.
              </p>
            </div>
          ) : result ? (
            <section className="rounded-xl border bg-background">
              <div className="border-b p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{result.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn('h-5 rounded-md text-[10px]', confidenceClass(result.confidenceLabel))}>
                        <ShieldCheckIcon className="mr-1 size-3" />
                        {result.confidenceLabel} confidence
                      </Badge>
                      <Badge variant="outline" className="h-5 rounded-md text-[10px]">
                        {modeTitle(result.mode)}
                      </Badge>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-7" onClick={rerun} disabled={runCopilot.isPending}>
                    <RefreshCwIcon className={cn('size-3.5', runCopilot.isPending && 'animate-spin')} />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                <div className="rounded-xl bg-muted/30 p-3 text-sm">
                  <MessageMarkdown content={result.content} compact />
                </div>

                {result.warnings.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {result.warnings.map((warning) => (
                      <p key={warning} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {resultCanInsert(result.mode) && (
                    <Button type="button" size="sm" className="h-7 gap-1.5 text-xs" onClick={insertResult}>
                      <CheckCircle2Icon className="size-3" />
                      Insert
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={copyResult}>
                    <CopyIcon className="size-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={saveAsNote}
                    disabled={createNote.isPending}
                  >
                    {createNote.isPending ? <Loader2Icon className="size-3 animate-spin" /> : <FileTextIcon className="size-3" />}
                    Add note
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <div className="rounded-xl border border-dashed bg-background p-4 text-center">
              <SparklesIcon className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Copilot is ready</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Draft replies, summarize context, rewrite messages, translate, and find proven resolved patterns.
              </p>
            </div>
          )}

          {result?.suggestedActions && result.suggestedActions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold">Suggested actions</p>
              {result.suggestedActions.map((action) => (
                <div key={`${action.kind}-${action.label}`} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold">{action.label}</p>
                    <Badge variant="outline" className="h-5 rounded-md text-[10px]">
                      {action.kind.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{action.reason}</p>
                </div>
              ))}
            </section>
          )}

          {sources.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold">Verified sources</p>
              {sources.slice(0, 5).map((source, index) => (
                <div key={`${source.title ?? source.url}-${index}`} className="rounded-xl border bg-background p-3">
                  <p className="line-clamp-1 text-xs font-semibold">{source.title || source.url || 'Knowledge source'}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {source.sourceType || 'source'}
                    {typeof source.similarity === 'number' ? ` - ${(source.similarity * 100).toFixed(0)}% match` : ''}
                  </p>
                </div>
              ))}
            </section>
          )}

          {similarConversations.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold">Similar resolved conversations</p>
              {similarConversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/inbox?conversation=${item.id}`)}
                  className="w-full rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.contactLabel}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">
                        {item.channel} - score {Math.round(item.score * 100)}%
                      </p>
                    </div>
                    <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-[11px] leading-4 text-muted-foreground">
                    {item.excerpt}
                  </p>
                </button>
              ))}
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
