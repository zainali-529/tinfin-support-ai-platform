'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  ArrowLeftIcon,
  BotIcon,
  CheckCircle2Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
} from 'lucide-react'
import {
  AI_CHANNEL_LABELS,
  AI_CHANNEL_TONE_DESCRIPTIONS,
  AI_CHANNEL_TONE_LABELS,
  AI_CHANNEL_TONES,
  AI_RESPONSE_CHANNELS,
  DEFAULT_AI_CHANNEL_BEHAVIOR,
  normalizeAiChannelBehaviorConfig,
  type AiChannelBehaviorConfig,
  type AiChannelTone,
  type AiResponseChannel,
} from '@workspace/types'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { toast } from '@workspace/ui/components/sonner'
import { cn } from '@workspace/ui/lib/utils'
import { LaunchErrorState } from '@/components/launch/LaunchState'
import { trpc } from '@/lib/trpc'

const CHANNEL_META: Record<AiResponseChannel, {
  icon: ComponentType<{ className?: string }>
  description: string
  preview: string
}> = {
  chat: {
    icon: MessageCircleIcon,
    description: 'Website widget and live chat replies.',
    preview: 'Sure - here is the short version. You can set up the widget, add knowledge, and let AI answer common support questions.',
  },
  email: {
    icon: MailIcon,
    description: 'Longer customer emails and threaded replies.',
    preview: 'Hi there,\n\nHere is a clear overview with the key details:\n\n1. Add your knowledge sources.\n2. Test the AI answer.\n3. Invite your team when you are ready.\n\nBest,',
  },
  whatsapp: {
    icon: BotIcon,
    description: 'Mobile-first WhatsApp auto replies.',
    preview: 'Yes, I can help with that. Add your question here and I will keep the answer short and clear.',
  },
  voice: {
    icon: PhoneCallIcon,
    description: 'Vapi voice assistant and spoken answers.',
    preview: 'I can help with quick support questions and connect you with a human agent if needed.',
  },
}

function behaviorFingerprint(config: AiChannelBehaviorConfig): string {
  return JSON.stringify(config.channels)
}

function BehaviorSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChannelCard({
  channel,
  tone,
  onToneChange,
}: {
  channel: AiResponseChannel
  tone: AiChannelTone
  onToneChange: (tone: AiChannelTone) => void
}) {
  const meta = CHANNEL_META[channel]
  const Icon = meta.icon

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{AI_CHANNEL_LABELS[channel]}</h3>
                <Badge variant="outline" className="h-5 text-[10px]">
                  {AI_CHANNEL_TONE_LABELS[tone]}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta.description}</p>
            </div>
          </div>

          <Select value={tone} onValueChange={(value) => onToneChange(value as AiChannelTone)}>
            <SelectTrigger size="sm" className="w-full sm:w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_CHANNEL_TONES.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {AI_CHANNEL_TONE_LABELS[candidate]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Behavior
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {AI_CHANNEL_TONE_DESCRIPTIONS[tone]}
          </p>
        </div>

        <div
          className={cn(
            'rounded-xl border bg-background p-3 text-xs leading-5',
            channel === 'email' ? 'whitespace-pre-line' : 'text-muted-foreground'
          )}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Example shape
          </p>
          {meta.preview}
        </div>
      </CardContent>
    </Card>
  )
}

export function KnowledgeAIBehaviorPanel({ onBack }: { onBack?: () => void }) {
  const utils = trpc.useUtils()
  const behaviorQuery = trpc.knowledge.getAiChannelBehavior.useQuery(undefined, {
    staleTime: 60_000,
  })
  const saveBehavior = trpc.knowledge.updateAiChannelBehavior.useMutation({
    onSuccess: async () => {
      toast.success('AI behavior settings saved', {
        description: 'Future AI replies will follow the channel-specific style.',
      })
      await utils.knowledge.getAiChannelBehavior.invalidate()
    },
  })

  const [draft, setDraft] = useState<AiChannelBehaviorConfig>(DEFAULT_AI_CHANNEL_BEHAVIOR)
  const [savedFingerprint, setSavedFingerprint] = useState(behaviorFingerprint(DEFAULT_AI_CHANNEL_BEHAVIOR))

  useEffect(() => {
    if (!behaviorQuery.data) return
    const normalized = normalizeAiChannelBehaviorConfig(behaviorQuery.data)
    setDraft(normalized)
    setSavedFingerprint(behaviorFingerprint(normalized))
  }, [behaviorQuery.data])

  const isDirty = useMemo(
    () => behaviorFingerprint(draft) !== savedFingerprint,
    [draft, savedFingerprint]
  )

  const updateTone = (channel: AiResponseChannel, tone: AiChannelTone) => {
    setDraft((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: { tone },
      },
    }))
  }

  const resetDefaults = () => {
    setDraft(DEFAULT_AI_CHANNEL_BEHAVIOR)
  }

  const save = async () => {
    const normalized = normalizeAiChannelBehaviorConfig(draft)
    await saveBehavior.mutateAsync(normalized)
    setSavedFingerprint(behaviorFingerprint(normalized))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onBack && (
        <div className="flex shrink-0 items-center border-b px-3 py-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5 px-2 text-xs">
            <ArrowLeftIcon className="size-3.5" />
            Knowledge bases
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-b bg-card/50 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">AI Behavior</h2>
            <Badge variant="outline" className="h-5 text-[10px]">Channel aware</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Set how the same grounded answer should be shaped per channel. This does not loosen KB grounding; it only changes format, length, and delivery style.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void behaviorQuery.refetch()}
            disabled={behaviorQuery.isFetching || saveBehavior.isPending}
            className="h-8 gap-1.5"
          >
            <RefreshCwIcon className={cn('size-3.5', behaviorQuery.isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetDefaults}
            disabled={saveBehavior.isPending}
            className="h-8 gap-1.5"
          >
            <RotateCcwIcon className="size-3.5" />
            <span className="hidden sm:inline">Defaults</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!isDirty || saveBehavior.isPending}
            className="h-8 gap-1.5"
          >
            {saveBehavior.isPending ? (
              <RefreshCwIcon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {behaviorQuery.isError ? (
        <div className="p-4">
          <LaunchErrorState
            error={behaviorQuery.error}
            title="AI behavior settings could not be loaded"
            onRetry={() => void behaviorQuery.refetch()}
            docsHref="/docs/ai/response-quality"
          />
        </div>
      ) : behaviorQuery.isLoading ? (
        <BehaviorSkeleton />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-4 flex items-start gap-3 rounded-xl border bg-emerald-500/5 p-4">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold">Simple channel-specific deployment</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Chat stays natural, email becomes more complete, WhatsApp stays compact, and voice avoids screen-style formatting.
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {AI_RESPONSE_CHANNELS.map((channel) => (
              <ChannelCard
                key={channel}
                channel={channel}
                tone={draft.channels[channel].tone}
                onToneChange={(tone) => updateTone(channel, tone)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
