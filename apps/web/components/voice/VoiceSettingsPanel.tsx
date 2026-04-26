'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { Switch } from '@workspace/ui/components/switch'
import { Slider } from '@workspace/ui/components/slider'
import { Badge } from '@workspace/ui/components/badge'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@workspace/ui/components/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'
import {
  MicIcon,
  PhoneCallIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  KeyIcon,
  SaveIcon,
  Trash2Icon,
  PlayCircleIcon,
  PauseCircleIcon,
  ZapIcon,
  LockIcon,
  BookOpenIcon,
  Settings2Icon,
  AudioWaveformIcon,
  RadioIcon,
} from 'lucide-react'
import { useVapiAssistantConfig } from '@/hooks/useCalls'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import { usePlan } from '@/hooks/usePlan'

// ─── Voice catalogue ──────────────────────────────────────────────────────────

interface VoiceCatalogueEntry {
  id: string
  label: string
  provider: string
  gender: 'Male' | 'Female' | 'Neutral'
  accent: string
  description: string
  tag?: 'Recommended' | 'Ultra-fast'
}

const VOICE_CATALOGUE: VoiceCatalogueEntry[] = [
  { id: 'openai:alloy',   label: 'Alloy',   provider: 'OpenAI',   gender: 'Neutral', accent: 'American', description: 'Balanced, versatile', tag: 'Recommended' },
  { id: 'openai:nova',    label: 'Nova',    provider: 'OpenAI',   gender: 'Female',  accent: 'American', description: 'Friendly and warm' },
  { id: 'openai:shimmer', label: 'Shimmer', provider: 'OpenAI',   gender: 'Female',  accent: 'American', description: 'Soft and professional' },
  { id: 'openai:echo',    label: 'Echo',    provider: 'OpenAI',   gender: 'Male',    accent: 'American', description: 'Clear and confident' },
  { id: 'openai:onyx',    label: 'Onyx',    provider: 'OpenAI',   gender: 'Male',    accent: 'American', description: 'Deep and authoritative' },
  { id: 'openai:fable',   label: 'Fable',   provider: 'OpenAI',   gender: 'Male',    accent: 'British',  description: 'Expressive British' },
  { id: 'deepgram:aura-asteria-en', label: 'Asteria', provider: 'Deepgram', gender: 'Female', accent: 'American', description: 'Natural, very low latency', tag: 'Ultra-fast' },
  { id: 'deepgram:aura-luna-en',    label: 'Luna',    provider: 'Deepgram', gender: 'Female', accent: 'American', description: 'Gentle, ultra-fast',        tag: 'Ultra-fast' },
  { id: 'deepgram:aura-stella-en',  label: 'Stella',  provider: 'Deepgram', gender: 'Female', accent: 'American', description: 'Bright and cheerful',       tag: 'Ultra-fast' },
  { id: 'deepgram:aura-athena-en',  label: 'Athena',  provider: 'Deepgram', gender: 'Female', accent: 'British',  description: 'Professional British',      tag: 'Ultra-fast' },
  { id: 'deepgram:aura-orion-en',   label: 'Orion',   provider: 'Deepgram', gender: 'Male',   accent: 'American', description: 'Clear American male',        tag: 'Ultra-fast' },
  { id: 'deepgram:aura-arcas-en',   label: 'Arcas',   provider: 'Deepgram', gender: 'Male',   accent: 'American', description: 'Confident male',             tag: 'Ultra-fast' },
  { id: 'deepgram:aura-zeus-en',    label: 'Zeus',    provider: 'Deepgram', gender: 'Male',   accent: 'American', description: 'Deep, powerful',             tag: 'Ultra-fast' },
  { id: 'deepgram:aura-helios-en',  label: 'Helios',  provider: 'Deepgram', gender: 'Male',   accent: 'British',  description: 'Refined British',            tag: 'Ultra-fast' },
]

const DEFAULT_VOICE_ID = 'openai:alloy'

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Fast · Affordable · Recommended for voice' },
  { value: 'gpt-4o',      label: 'GPT-4o',      sub: 'Most capable · Higher cost' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', sub: 'Powerful · Higher cost' },
]

const TRANSCRIPTION_PROVIDERS = [
  { value: 'deepgram',    label: 'Deepgram',    sub: 'Ultra-low latency · Recommended' },
  { value: 'talkscriber', label: 'Talkscriber', sub: 'High accuracy · Multilingual' },
  { value: 'gladia',      label: 'Gladia',      sub: 'Real-time · Multi-speaker' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ur', label: 'Urdu' },
]

// ─── Voice Preview hook ───────────────────────────────────────────────────────

type PreviewState = 'idle' | 'loading' | 'playing' | 'error'

function useVoicePreview() {
  const [previewStates, setPreviewStates] = useState<Record<string, PreviewState>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeVoiceRef = useRef<string | null>(null)

  const playPreview = useCallback(async (voiceId: string) => {
    if (activeVoiceRef.current === voiceId && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPreviewStates(prev => ({ ...prev, [voiceId]: 'idle' }))
      activeVoiceRef.current = null
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
      if (activeVoiceRef.current) {
        setPreviewStates(prev => ({ ...prev, [activeVoiceRef.current!]: 'idle' }))
      }
      audioRef.current = null
    }
    activeVoiceRef.current = voiceId
    setPreviewStates(prev => ({ ...prev, [voiceId]: 'loading' }))
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/voice-preview/${encodeURIComponent(voiceId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        setPreviewStates(prev => ({ ...prev, [voiceId]: 'idle' }))
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        activeVoiceRef.current = null
      }
      audio.onerror = () => {
        setPreviewStates(prev => ({ ...prev, [voiceId]: 'error' }))
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        activeVoiceRef.current = null
      }
      setPreviewStates(prev => ({ ...prev, [voiceId]: 'playing' }))
      await audio.play()
    } catch (err) {
      console.error('[VoicePreview]', err)
      setPreviewStates(prev => ({ ...prev, [voiceId]: 'error' }))
      activeVoiceRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [])

  return { previewStates, playPreview }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingRow({
  label, description, children,
}: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function VoiceCard({
  voice, isSelected, previewState, onSelect, onPreview,
}: {
  voice: VoiceCatalogueEntry
  isSelected: boolean
  previewState: PreviewState
  onSelect: () => void
  onPreview: (e: React.MouseEvent) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-100',
        'hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]',
        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background'
      )}
    >
      <div className={cn('size-2 shrink-0 rounded-full', {
        'bg-pink-400': voice.gender === 'Female',
        'bg-blue-400': voice.gender === 'Male',
        'bg-violet-400': voice.gender === 'Neutral',
      })} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
            {voice.label}
          </span>
          <span className="text-[10px] text-muted-foreground">{voice.provider}</span>
          <span className={cn('text-[10px]', {
            'text-pink-500': voice.gender === 'Female',
            'text-blue-500': voice.gender === 'Male',
            'text-violet-500': voice.gender === 'Neutral',
          })}>{voice.gender}</span>
          {voice.accent !== 'American' && (
            <span className="text-[10px] text-muted-foreground">· {voice.accent}</span>
          )}
          {voice.tag && (
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none',
              voice.tag === 'Recommended'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}>
              {voice.tag}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{voice.description}</p>
      </div>
      <button
        type="button"
        data-free-allow="true"
        onClick={onPreview}
        disabled={previewState === 'loading'}
        className={cn(
          'shrink-0 flex items-center justify-center size-7 rounded-lg border transition-all',
          'hover:border-primary/40 hover:bg-primary/5',
          previewState === 'playing' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
          previewState === 'error' && 'border-destructive/40 text-destructive'
        )}
      >
        {previewState === 'loading' ? <Spinner className="size-3" /> :
         previewState === 'playing' ? <PauseCircleIcon className="size-3.5" /> :
         <PlayCircleIcon className="size-3.5" />}
      </button>
      {isSelected && <CheckCircleIcon className="size-3.5 shrink-0 text-primary" />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VoiceSettingsPanel() {
  const { config: assistantConfig, isLoading, upsert, remove } = useVapiAssistantConfig()
  const { data: hasKeyData } = trpc.vapi.hasCustomVapiKey.useQuery()
  const { data: knowledgeBases } = trpc.knowledge.getKnowledgeBases.useQuery({})
  const utils = trpc.useUtils()
  const { previewStates, playPreview } = useVoicePreview()
  const { planId } = usePlan()
  const isReadOnly = planId === 'free'

  const saveKey   = trpc.vapi.saveOrgVapiKey.useMutation({ onSuccess: () => utils.vapi.hasCustomVapiKey.invalidate() })
  const removeKey = trpc.vapi.removeOrgVapiKey.useMutation({ onSuccess: () => utils.vapi.hasCustomVapiKey.invalidate() })

  // ── Form state ───────────────────────────────────────────────────────────────
  const [name,          setName]          = useState('Support Assistant')
  const [firstMessage,  setFirstMessage]  = useState('Hello! How can I help you today?')
  const [systemPrompt,  setSystemPrompt]  = useState('')
  const [voiceId,       setVoiceId]       = useState(DEFAULT_VOICE_ID)
  const [model,         setModel]         = useState('gpt-4o-mini')
  const [maxDuration,   setMaxDuration]   = useState(600)
  const [bgSound,       setBgSound]       = useState<'off' | 'office' | 'cafe'>('off')
  const [isActive,      setIsActive]      = useState(true)
  const [vapiKey,       setVapiKey]       = useState('')
  const [saved,         setSaved]         = useState(false)
  const [genderFilter,  setGenderFilter]  = useState<'All' | 'Female' | 'Male' | 'Neutral'>('All')
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)

  // KB integration
  const [selectedKbIds,  setSelectedKbIds]  = useState<string[]>([])
  const [toolsEnabled,   setToolsEnabled]   = useState(true)

  // Advanced settings
  const [transcriptionProvider,  setTranscriptionProvider]  = useState<'deepgram' | 'talkscriber' | 'gladia'>('deepgram')
  const [transcriptionLanguage,  setTranscriptionLanguage]  = useState('en')
  const [silenceTimeout,         setSilenceTimeout]         = useState(30)
  const [responseDelay,          setResponseDelay]          = useState(0.4)
  const [interruptionsEnabled,   setInterruptionsEnabled]   = useState(true)
  const [recordingEnabled,       setRecordingEnabled]       = useState(true)
  const [endCallPhrases,         setEndCallPhrases]         = useState('goodbye, bye, thanks bye, end call')

  // Sync from DB on load
  useEffect(() => {
    if (!assistantConfig) return
    setName(        (assistantConfig.name          as string) || 'Support Assistant')
    setFirstMessage((assistantConfig.first_message as string) || 'Hello! How can I help you today?')
    setSystemPrompt((assistantConfig.system_prompt as string) || '')
    setVoiceId(     (assistantConfig.voice         as string) || DEFAULT_VOICE_ID)
    setModel(       (assistantConfig.model         as string) || 'gpt-4o-mini')
    setMaxDuration( (assistantConfig.max_duration_seconds as number) || 600)
    setBgSound(     ((assistantConfig.background_sound as string) as 'off' | 'office' | 'cafe') || 'off')
    setIsActive(    (assistantConfig.is_active     as boolean) ?? true)
    setSelectedKbIds((assistantConfig.kb_ids as string[] | null) ?? [])
    setToolsEnabled( (assistantConfig.tools_enabled as boolean) ?? true)

    const s = (assistantConfig.settings as Record<string, unknown>) ?? {}
    if (s.transcriptionProvider) setTranscriptionProvider(s.transcriptionProvider as 'deepgram' | 'talkscriber' | 'gladia')
    if (s.transcriptionLanguage) setTranscriptionLanguage(s.transcriptionLanguage as string)
    if (s.silenceTimeoutSeconds) setSilenceTimeout(s.silenceTimeoutSeconds as number)
    if (s.responseDelaySeconds !== undefined) setResponseDelay(s.responseDelaySeconds as number)
    if (s.interruptionsEnabled !== undefined) setInterruptionsEnabled(s.interruptionsEnabled as boolean)
    if (s.recordingEnabled !== undefined) setRecordingEnabled(s.recordingEnabled as boolean)
    if (s.endCallPhrases) setEndCallPhrases((s.endCallPhrases as string[]).join(', '))
  }, [assistantConfig])

  const openUpgradeDialog = useCallback(() => setIsUpgradeOpen(true), [])

  const handleRestrictedCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!isReadOnly) return
    const target = event.target as HTMLElement | null
    if (!target) return
    const editable = target.closest('input, textarea, select, button, [role="switch"], [role="slider"], [role="button"], [role="checkbox"]')
    if (!editable || editable.closest('[data-free-allow="true"]')) return
    event.preventDefault()
    event.stopPropagation()
    openUpgradeDialog()
  }, [isReadOnly, openUpgradeDialog])

  const toggleKb = useCallback((kbId: string) => {
    setSelectedKbIds(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    )
  }, [])

  const handleSave = async () => {
    if (isReadOnly) { openUpgradeDialog(); return }
    await upsert.mutateAsync({
      name,
      firstMessage,
      systemPrompt: systemPrompt || undefined,
      voiceId,
      model,
      maxDurationSeconds: maxDuration,
      backgroundSound: bgSound,
      isActive,
      kbIds: selectedKbIds,
      toolsEnabled,
      transcriptionProvider,
      transcriptionLanguage,
      silenceTimeoutSeconds: silenceTimeout,
      responseDelaySeconds: responseDelay,
      interruptionsEnabled,
      recordingEnabled,
      endCallPhrases: endCallPhrases.split(',').map(p => p.trim()).filter(Boolean),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveKey = async () => {
    if (isReadOnly) { openUpgradeDialog(); return }
    if (!vapiKey.trim()) return
    await saveKey.mutateAsync({ vapiPrivateKey: vapiKey.trim() })
    setVapiKey('')
  }

  const filteredVoices = VOICE_CATALOGUE.filter(v =>
    genderFilter === 'All' ? true : v.gender === genderFilter
  )

  const isConfigured = !!(assistantConfig?.vapi_assistant_id)
  const kbList = (knowledgeBases ?? []) as Array<{ id: string; name: string; source_type: string | null }>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4" onPointerDownCapture={handleRestrictedCapture}>

      {isReadOnly && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <LockIcon className="size-4 text-amber-600" />
          <AlertDescription className="flex flex-col gap-2 text-xs text-amber-800 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span>Preview mode on Free plan — editing is locked.</span>
            <Button size="sm" className="h-7" asChild data-free-allow="true">
              <Link href="/billing">Upgrade to Pro</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Status banner */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        isConfigured
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
      )}>
        {isConfigured
          ? <CheckCircleIcon className="size-4 text-emerald-600 shrink-0" />
          : <AlertCircleIcon className="size-4 text-amber-600 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', isConfigured ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200')}>
            {isConfigured ? 'Voice assistant is configured' : 'Voice assistant not set up yet'}
          </p>
          <p className={cn('text-xs mt-0.5', isConfigured ? 'text-emerald-600/80' : 'text-amber-700/80')}>
            {isConfigured ? `Vapi ID: ${assistantConfig!.vapi_assistant_id}` : 'Fill in the fields below and click Create Assistant'}
          </p>
        </div>
        {isConfigured && (
          <Badge variant="outline" className="border-emerald-300 text-emerald-700 shrink-0">
            <PhoneCallIcon className="size-3 mr-1" /> Active
          </Badge>
        )}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="identity">
        <TabsList className="h-9 w-full grid grid-cols-4">
          <TabsTrigger value="identity" className="text-xs gap-1.5">
            <MicIcon className="size-3" /> Identity
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5">
            <BookOpenIcon className="size-3" /> Knowledge
          </TabsTrigger>
          <TabsTrigger value="voice" className="text-xs gap-1.5">
            <AudioWaveformIcon className="size-3" /> Voice
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs gap-1.5">
            <Settings2Icon className="size-3" /> Advanced
          </TabsTrigger>
        </TabsList>

        {/* ── IDENTITY TAB ── */}
        <TabsContent value="identity" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Assistant Identity</CardTitle>
              <CardDescription className="text-xs">
                How your AI voice assistant presents itself on calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Assistant Name</Label>
                <Input
                  placeholder="Support Assistant"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  First Message{' '}
                  <span className="text-muted-foreground/60">(spoken on call connect)</span>
                </Label>
                <Textarea
                  placeholder="Hello! How can I help you today?"
                  value={firstMessage}
                  onChange={e => setFirstMessage(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                  maxLength={300}
                />
                <p className="text-[11px] text-muted-foreground text-right">{firstMessage.length}/300</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  System Prompt{' '}
                  <span className="text-muted-foreground/60">(leave empty for smart default)</span>
                </Label>
                <Textarea
                  placeholder={`You are a helpful voice assistant for [Company].\nAnswer questions about our products clearly and concisely...`}
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="min-h-[90px] text-sm resize-none font-mono text-xs"
                  maxLength={4000}
                />
                <p className="text-[11px] text-muted-foreground text-right">{systemPrompt.length}/4000</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">AI Model</CardTitle>
              <CardDescription className="text-xs">
                GPT-4o Mini is recommended for voice — faster responses mean more natural conversation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setModel(opt.value)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                      'hover:border-primary/40',
                      model === opt.value ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <div className={cn(
                      'size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      model === opt.value ? 'border-primary' : 'border-muted-foreground/40'
                    )}>
                      {model === opt.value && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className={cn('text-xs font-semibold', model === opt.value ? 'text-primary' : 'text-foreground')}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── KNOWLEDGE BASE TAB ── */}
        <TabsContent value="knowledge" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpenIcon className="size-4 text-primary" />
                Knowledge Base Integration
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Select which knowledge bases your voice assistant can search in real-time during calls.
                The AI will use the <span className="font-mono bg-muted px-1 rounded">searchKnowledgeBase</span> tool
                to look up accurate answers instead of guessing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingRow
                label="Enable Knowledge Base Search"
                description="AI will call your KBs in real-time when it needs factual information"
              >
                <Switch checked={toolsEnabled} onCheckedChange={setToolsEnabled} />
              </SettingRow>

              {toolsEnabled && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Knowledge Bases to search
                    {selectedKbIds.length > 0 && (
                      <span className="ml-2 text-primary font-semibold">
                        {selectedKbIds.length} selected
                      </span>
                    )}
                  </p>

                  {kbList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center rounded-xl border border-dashed">
                      <BookOpenIcon className="size-8 text-muted-foreground opacity-30" />
                      <p className="text-sm text-muted-foreground">No knowledge bases yet</p>
                      <Button variant="outline" size="sm" asChild data-free-allow="true">
                        <Link href="/knowledge">Create Knowledge Base</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {kbList.map((kb) => (
                        <div
                          key={kb.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all cursor-pointer',
                            'hover:border-primary/40 hover:bg-muted/30',
                            selectedKbIds.includes(kb.id) ? 'border-primary bg-primary/5' : 'border-border'
                          )}
                          onClick={() => toggleKb(kb.id)}
                        >
                          <Checkbox
                            checked={selectedKbIds.includes(kb.id)}
                            onCheckedChange={() => toggleKb(kb.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              'text-xs font-semibold',
                              selectedKbIds.includes(kb.id) ? 'text-primary' : 'text-foreground'
                            )}>
                              {kb.name}
                            </p>
                            {kb.source_type && (
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {kb.source_type}
                              </p>
                            )}
                          </div>
                          {selectedKbIds.includes(kb.id) && (
                            <CheckCircleIcon className="size-3.5 shrink-0 text-primary" />
                          )}
                        </div>
                      ))}
                      {kbList.length > 0 && selectedKbIds.length === 0 && (
                        <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                          💡 No KBs selected — the AI will search <strong>all</strong> knowledge bases in your org.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!toolsEnabled && (
                <div className="rounded-xl border border-dashed px-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Knowledge base search is disabled. The AI will rely only on its system prompt.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VOICE TAB ── */}
        <TabsContent value="voice" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Voice Selection</CardTitle>
              <CardDescription className="text-xs">
                Click ▶ to preview a voice. All voices work without extra credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1.5">
                {(['All', 'Female', 'Male', 'Neutral'] as const).map(g => (
                  <button
                    key={g}
                    data-free-allow="true"
                    onClick={() => setGenderFilter(g)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                      genderFilter === g
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
                {filteredVoices.map(voice => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    isSelected={voiceId === voice.id}
                    previewState={previewStates[voice.id] ?? 'idle'}
                    onSelect={() => {
                      if (isReadOnly) { openUpgradeDialog(); return }
                      setVoiceId(voice.id)
                    }}
                    onPreview={e => { e.stopPropagation(); void playPreview(voice.id) }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 border">
                <ZapIcon className="size-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Selected:{' '}
                  <span className="font-semibold text-foreground">
                    {VOICE_CATALOGUE.find(v => v.id === voiceId)?.label ?? voiceId}
                  </span>
                  {' '}({voiceId})
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <RadioIcon className="size-4 text-primary" />
                Transcription
              </CardTitle>
              <CardDescription className="text-xs">
                Controls how caller speech is converted to text during calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Provider</Label>
                <div className="space-y-1.5">
                  {TRANSCRIPTION_PROVIDERS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTranscriptionProvider(opt.value as 'deepgram' | 'talkscriber' | 'gladia')}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:border-primary/40',
                        transcriptionProvider === opt.value ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className={cn(
                        'size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        transcriptionProvider === opt.value ? 'border-primary' : 'border-muted-foreground/40'
                      )}>
                        {transcriptionProvider === opt.value && <div className="size-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className={cn('text-xs font-semibold', transcriptionProvider === opt.value ? 'text-primary' : 'text-foreground')}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Language</Label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => setTranscriptionLanguage(lang.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                        transcriptionLanguage === lang.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ADVANCED TAB ── */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Call Behavior</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <SettingRow label="Enable Voice Calls" description="Show the call button in the widget.">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </SettingRow>

              <SettingRow
                label="Allow Interruptions"
                description="User can interrupt AI mid-sentence. Disable for more formal calls."
              >
                <Switch checked={interruptionsEnabled} onCheckedChange={setInterruptionsEnabled} />
              </SettingRow>

              <SettingRow
                label="Record Calls"
                description="Save call audio recordings for review."
              >
                <Switch checked={recordingEnabled} onCheckedChange={setRecordingEnabled} />
              </SettingRow>

              <div className="py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Max Call Duration</div>
                    <div className="text-xs text-muted-foreground">Call auto-ends after this time.</div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {Math.floor(maxDuration / 60)}m {maxDuration % 60 > 0 ? `${maxDuration % 60}s` : ''}
                  </div>
                </div>
                <Slider
                  min={60} max={3600} step={60}
                  value={[maxDuration]}
                  onValueChange={([v]) => setMaxDuration(v!)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1 min</span><span>60 min</span>
                </div>
              </div>

              <div className="py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Silence Timeout</div>
                    <div className="text-xs text-muted-foreground">Seconds of silence before auto-hang.</div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">{silenceTimeout}s</div>
                </div>
                <Slider
                  min={5} max={120} step={5}
                  value={[silenceTimeout]}
                  onValueChange={([v]) => setSilenceTimeout(v!)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>5s</span><span>120s</span>
                </div>
              </div>

              <div className="py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Response Delay</div>
                    <div className="text-xs text-muted-foreground">Seconds before AI starts speaking.</div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">{responseDelay.toFixed(1)}s</div>
                </div>
                <Slider
                  min={0} max={5} step={0.1}
                  value={[responseDelay]}
                  onValueChange={([v]) => setResponseDelay(parseFloat(v!.toFixed(1)))}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0s (instant)</span><span>5s</span>
                </div>
              </div>

              <SettingRow label="Background Sound" description="Subtle ambient audio during calls.">
                <div className="flex gap-1.5">
                  {(['off', 'office', 'cafe'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setBgSound(s)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg border text-[11px] font-medium capitalize transition-all',
                        bgSound === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">End Call Phrases</CardTitle>
              <CardDescription className="text-xs">
                Comma-separated phrases that trigger an automatic call end.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={endCallPhrases}
                onChange={e => setEndCallPhrases(e.target.value)}
                placeholder="goodbye, bye, thanks bye, end call"
                className="min-h-[60px] text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {endCallPhrases.split(',').filter(p => p.trim()).length} phrases configured
              </p>
            </CardContent>
          </Card>

          {/* Custom Vapi Key */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyIcon className="size-4 text-muted-foreground" />
                Custom Vapi Key
                <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Use your own Vapi account. Leave empty to use the platform's shared key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasKeyData?.hasCustomKey && (
                <Alert>
                  <CheckCircleIcon className="size-4 text-emerald-500" />
                  <AlertDescription className="text-xs">
                    Custom Vapi key is configured.{' '}
                    <button
                      data-free-allow={isReadOnly ? 'true' : undefined}
                      className="text-destructive underline underline-offset-2"
                      onClick={() => { if (isReadOnly) { openUpgradeDialog(); return }; removeKey.mutate() }}
                      disabled={removeKey.isPending}
                    >
                      {removeKey.isPending ? 'Removing...' : 'Remove'}
                    </button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="vapi_private_key_..."
                  value={vapiKey}
                  onChange={e => setVapiKey(e.target.value)}
                  className="h-8 text-sm font-mono flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveKey}
                  disabled={!vapiKey.trim() || saveKey.isPending}
                >
                  {saveKey.isPending ? <Spinner className="size-3.5" /> : <SaveIcon className="size-3.5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save / Delete actions */}
      <div className="flex items-center justify-between pt-2">
        {isConfigured && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => { if (isReadOnly) { openUpgradeDialog(); return }; remove.mutate() }}
            disabled={remove.isPending}
          >
            {remove.isPending ? <Spinner className="size-3" /> : <Trash2Icon className="size-3" />}
            Delete Assistant
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {saved && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircleIcon className="size-3 mr-1" /> Saved
            </Badge>
          )}
          {upsert.isError && (
            <p className="text-xs text-destructive max-w-[240px] truncate">
              {upsert.error.message}
            </p>
          )}
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
            {upsert.isPending ? <Spinner className="size-3.5" /> : <SaveIcon className="size-3.5" />}
            {isConfigured ? 'Update Assistant' : 'Create Assistant'}
          </Button>
        </div>
      </div>

      <AlertDialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade Required</AlertDialogTitle>
            <AlertDialogDescription>
              Voice assistant configuration requires the Pro plan. Upgrade to unlock full control.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe Later</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/billing">Upgrade to Pro</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}