'use client'

import { useState, useEffect, useCallback, useDeferredValue, useRef } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { Switch } from '@workspace/ui/components/switch'
import { Slider } from '@workspace/ui/components/slider'
import { Badge } from '@workspace/ui/components/badge'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
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
import { Tabs, TabsContent, TabsList } from '@workspace/ui/components/tabs'
import { usePlan } from '@/hooks/usePlan'
import {
  AlertCircleIcon,
  CheckIcon, SaveIcon, ZapIcon, LockIcon,
  PaletteIcon, MessageSquareIcon, SlidersHorizontalIcon,
} from 'lucide-react'
import { WidgetPreview } from './WidgetPreview'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetSettings {
  primaryColor: string
  welcomeMessage: string
  companyName: string
  logoUrl: string
  position: 'bottom-right' | 'bottom-left'
  showBranding: boolean
  themeMode: 'light' | 'dark' | 'system'
  lightTheme: WidgetThemeColors
  darkTheme: WidgetThemeColors
  botName: string
  inputPlaceholder: string
  responseTimeText: string
  launcherSize: 'sm' | 'md' | 'lg'
  borderRadius: number
  widgetWidth: number
  widgetHeight: number
  expandedWidth: number
  expandedHeight: number
  headerStyle: 'gradient' | 'solid'
  userBubbleColor: string
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator: boolean
  offlineMessage: string
  suggestions: WidgetSuggestion[]
  helpItems: WidgetHelpItem[]
  talkToHumanLabel: string
  talkToHumanMessage: string
}

interface WidgetThemeColors {
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  borderColor: string
  assistantBubbleColor: string
  assistantTextColor: string
  userBubbleTextColor: string
  inputBackgroundColor: string
  headerTextColor: string
}

interface WidgetSuggestion {
  label: string
  message: string
}

interface WidgetHelpItem {
  id: string
  question: string
  answer: string
  actionLabel?: string
  actionMessage?: string
}

const DEFAULT_LIGHT_THEME: WidgetThemeColors = {
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#111827',
  mutedTextColor: '#6b7280',
  borderColor: '#e5e7eb',
  assistantBubbleColor: '#ffffff',
  assistantTextColor: '#111827',
  userBubbleTextColor: '#ffffff',
  inputBackgroundColor: '#f3f4f6',
  headerTextColor: '#ffffff',
}

const DEFAULT_DARK_THEME: WidgetThemeColors = {
  backgroundColor: '#0f172a',
  surfaceColor: '#111827',
  textColor: '#f8fafc',
  mutedTextColor: '#94a3b8',
  borderColor: '#263244',
  assistantBubbleColor: '#172033',
  assistantTextColor: '#f8fafc',
  userBubbleTextColor: '#ffffff',
  inputBackgroundColor: '#0b1220',
  headerTextColor: '#ffffff',
}

const DEFAULT_SETTINGS: WidgetSettings = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi 👋 How can we help you today?',
  companyName: '',
  logoUrl: '',
  position: 'bottom-right',
  showBranding: true,
  themeMode: 'light',
  lightTheme: DEFAULT_LIGHT_THEME,
  darkTheme: DEFAULT_DARK_THEME,
  botName: 'AI Assistant',
  inputPlaceholder: 'Type a message...',
  responseTimeText: 'AI · We reply instantly',
  launcherSize: 'md',
  borderRadius: 20,
  widgetWidth: 380,
  widgetHeight: 580,
  expandedWidth: 720,
  expandedHeight: 720,
  headerStyle: 'gradient',
  userBubbleColor: '',
  autoOpen: false,
  autoOpenDelay: 5,
  showTypingIndicator: true,
  offlineMessage: '',
  suggestions: [],
  helpItems: [
    {
      id: 'getting-started',
      question: 'How can I get support?',
      answer: 'Send us a message here and our AI or support team will help you as quickly as possible.',
      actionLabel: 'Start a chat',
      actionMessage: 'I need help from support.',
    },
  ],
  talkToHumanLabel: 'Talk to Human',
  talkToHumanMessage: 'I want to talk to a human agent.',
}

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right', dot: { bottom: 0, right: 0 } },
  { value: 'bottom-left',  label: 'Bottom Left',  dot: { bottom: 0, left: 0 } },
] as const

const LAUNCHER_SIZES = {
  sm: 48,
  md: 56,
  lg: 64,
} as const

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#1e293b', '#18181b',
]

const MAX_SUGGESTIONS = 6
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const COLOR_COMMIT_DELAY_MS = 90

function parseSuggestions(value: unknown): WidgetSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = typeof (item as { label?: unknown }).label === 'string'
        ? (item as { label: string }).label.trim()
        : ''
      const message = typeof (item as { message?: unknown }).message === 'string'
        ? (item as { message: string }).message.trim()
        : ''
      if (!label || !message) return null
      return { label, message }
    })
    .filter((item): item is WidgetSuggestion => Boolean(item))
    .slice(0, MAX_SUGGESTIONS)
}

function normalizeSuggestions(items: WidgetSuggestion[]): WidgetSuggestion[] {
  return items
    .map((item) => ({
      label: item.label.trim(),
      message: item.message.trim(),
    }))
    .filter(item => item.label.length > 0 && item.message.length > 0)
    .slice(0, MAX_SUGGESTIONS)
}

function parseTheme(value: unknown, fallback: WidgetThemeColors): WidgetThemeColors {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<WidgetThemeColors>
    : {}

  return {
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : fallback.backgroundColor,
    surfaceColor: typeof raw.surfaceColor === 'string' ? raw.surfaceColor : fallback.surfaceColor,
    textColor: typeof raw.textColor === 'string' ? raw.textColor : fallback.textColor,
    mutedTextColor: typeof raw.mutedTextColor === 'string' ? raw.mutedTextColor : fallback.mutedTextColor,
    borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : fallback.borderColor,
    assistantBubbleColor: typeof raw.assistantBubbleColor === 'string' ? raw.assistantBubbleColor : fallback.assistantBubbleColor,
    assistantTextColor: typeof raw.assistantTextColor === 'string' ? raw.assistantTextColor : fallback.assistantTextColor,
    userBubbleTextColor: typeof raw.userBubbleTextColor === 'string' ? raw.userBubbleTextColor : fallback.userBubbleTextColor,
    inputBackgroundColor: typeof raw.inputBackgroundColor === 'string' ? raw.inputBackgroundColor : fallback.inputBackgroundColor,
    headerTextColor: typeof raw.headerTextColor === 'string' ? raw.headerTextColor : fallback.headerTextColor,
  }
}

function parseHelpItems(value: unknown): WidgetHelpItem[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.helpItems
  const items: WidgetHelpItem[] = []

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const raw = item as Partial<WidgetHelpItem>
    const question = typeof raw.question === 'string' ? raw.question.trim() : ''
    const answer = typeof raw.answer === 'string' ? raw.answer.trim() : ''
    if (!question || !answer) return

    items.push({
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `help-${index + 1}`,
      question,
      answer,
      actionLabel: typeof raw.actionLabel === 'string' ? raw.actionLabel : '',
      actionMessage: typeof raw.actionMessage === 'string' ? raw.actionMessage : '',
    })
  })

  return items.slice(0, 8)
}

function normalizeHelpItems(items: WidgetHelpItem[]): WidgetHelpItem[] {
  return items
    .map((item, index) => ({
      id: item.id || `help-${index + 1}`,
      question: item.question.trim(),
      answer: item.answer.trim(),
      actionLabel: item.actionLabel?.trim() || undefined,
      actionMessage: item.actionMessage?.trim() || undefined,
    }))
    .filter(item => item.question.length > 0 && item.answer.length > 0)
    .slice(0, 8)
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setHex(value), [value])
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const commit = useCallback((next: string, immediate = false) => {
    if (!HEX_COLOR_RE.test(next)) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (immediate) {
      onChange(next)
      return
    }

    timeoutRef.current = setTimeout(() => {
      onChange(next)
      timeoutRef.current = null
    }, COLOR_COMMIT_DELAY_MS)
  }, [onChange])

  const handleHex = (v: string) => {
    setHex(v)
    commit(v)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_COLORS.map(c => (
          <button key={c}
            className="relative w-full aspect-square rounded-md border-2 transition-all hover:scale-105"
            style={{
              background: c,
              borderColor: hex === c ? '#000' : 'transparent',
              outline: hex === c ? `2px solid ${c}` : 'none',
              outlineOffset: 2,
            }}
            onClick={() => {
              setHex(c)
              commit(c, true)
            }}>
            {hex === c && <CheckIcon className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={HEX_COLOR_RE.test(hex) ? hex : value}
            onChange={e => handleHex(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          <div className="w-9 h-9 rounded-lg border border-border cursor-pointer" style={{ background: HEX_COLOR_RE.test(hex) ? hex : value }} />
        </div>
        <Input
          value={hex}
          onChange={e => handleHex(e.target.value)}
          onBlur={() => {
            if (HEX_COLOR_RE.test(hex)) commit(hex, true)
            else setHex(value)
          }}
          placeholder="#6366f1" className="h-9 font-mono text-sm flex-1" />
      </div>
    </div>
  )
}

function CompactColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHex(value)
  }, [value])
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const commit = useCallback((next: string, immediate = false) => {
    if (!HEX_COLOR_RE.test(next)) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (immediate) {
      onChange(next)
      return
    }

    timeoutRef.current = setTimeout(() => {
      onChange(next)
      timeoutRef.current = null
    }, COLOR_COMMIT_DELAY_MS)
  }, [onChange])

  const handleHexChange = (next: string) => {
    setHex(next)
    commit(next)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX_COLOR_RE.test(hex) ? hex : value}
        onChange={event => handleHexChange(event.target.value)}
        className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent p-0"
      />
      <Input
        value={hex}
        onChange={event => handleHexChange(event.target.value)}
        onBlur={() => {
          if (HEX_COLOR_RE.test(hex)) commit(hex, true)
          else setHex(value)
        }}
        className="h-8 flex-1 font-mono text-xs"
      />
    </div>
  )
}

function ThemeColorEditor({
  title,
  value,
  onChange,
}: {
  title: string
  value: WidgetThemeColors
  onChange: (patch: Partial<WidgetThemeColors>) => void
}) {
  const fields: Array<{ key: keyof WidgetThemeColors; label: string }> = [
    { key: 'backgroundColor', label: 'Panel background' },
    { key: 'surfaceColor', label: 'Cards / surfaces' },
    { key: 'textColor', label: 'Primary text' },
    { key: 'mutedTextColor', label: 'Muted text' },
    { key: 'borderColor', label: 'Borders' },
    { key: 'assistantBubbleColor', label: 'Assistant bubble' },
    { key: 'assistantTextColor', label: 'Assistant text' },
    { key: 'userBubbleTextColor', label: 'User bubble text' },
    { key: 'inputBackgroundColor', label: 'Input background' },
    { key: 'headerTextColor', label: 'Header text' },
  ]

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
            <CompactColorInput value={value[field.key]} onChange={v => onChange({ [field.key]: v })} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  orgId: string
}

export function WidgetCustomizationPage({ orgId }: Props) {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('style')
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false)
  const deferredSettings = useDeferredValue(settings)
  const { planId } = usePlan()
  const isReadOnly = planId === 'free'

  const { data: existingConfig, isLoading } = trpc.org.getWidgetConfig.useQuery(
    { orgId }, { retry: false }
  )
  const updateConfig = trpc.org.updateWidgetConfig.useMutation()

  useEffect(() => {
    if (!existingConfig) return
    const s = (existingConfig.settings ?? {}) as Record<string, unknown>
    setSettings({
      primaryColor:      (existingConfig.primary_color as string)     ?? DEFAULT_SETTINGS.primaryColor,
      welcomeMessage:    (existingConfig.welcome_message as string)   ?? DEFAULT_SETTINGS.welcomeMessage,
      companyName:       (existingConfig.company_name as string)      ?? DEFAULT_SETTINGS.companyName,
      logoUrl:           (existingConfig.logo_url as string)          ?? DEFAULT_SETTINGS.logoUrl,
      position:          existingConfig.position === 'bottom-left' ? 'bottom-left' : DEFAULT_SETTINGS.position,
      showBranding:      (existingConfig.show_branding as boolean)    ?? DEFAULT_SETTINGS.showBranding,
      themeMode:         s.themeMode === 'dark' || s.themeMode === 'system' ? s.themeMode : DEFAULT_SETTINGS.themeMode,
      lightTheme:        parseTheme(s.lightTheme, DEFAULT_LIGHT_THEME),
      darkTheme:         parseTheme(s.darkTheme, DEFAULT_DARK_THEME),
      botName:           typeof s.botName === 'string'          ? s.botName          : DEFAULT_SETTINGS.botName,
      inputPlaceholder:  typeof s.inputPlaceholder === 'string' ? s.inputPlaceholder : DEFAULT_SETTINGS.inputPlaceholder,
      responseTimeText:  typeof s.responseTimeText === 'string' ? s.responseTimeText : DEFAULT_SETTINGS.responseTimeText,
      launcherSize:      typeof s.launcherSize === 'string'     ? s.launcherSize as WidgetSettings['launcherSize'] : DEFAULT_SETTINGS.launcherSize,
      borderRadius:      typeof s.borderRadius === 'number'     ? s.borderRadius     : DEFAULT_SETTINGS.borderRadius,
      widgetWidth:       typeof s.widgetWidth === 'number'      ? s.widgetWidth      : DEFAULT_SETTINGS.widgetWidth,
      widgetHeight:      typeof s.widgetHeight === 'number'     ? s.widgetHeight     : DEFAULT_SETTINGS.widgetHeight,
      expandedWidth:     typeof s.expandedWidth === 'number'    ? s.expandedWidth    : DEFAULT_SETTINGS.expandedWidth,
      expandedHeight:    typeof s.expandedHeight === 'number'   ? s.expandedHeight   : DEFAULT_SETTINGS.expandedHeight,
      headerStyle:       typeof s.headerStyle === 'string'      ? s.headerStyle as WidgetSettings['headerStyle'] : DEFAULT_SETTINGS.headerStyle,
      userBubbleColor:   typeof s.userBubbleColor === 'string'  ? s.userBubbleColor  : DEFAULT_SETTINGS.userBubbleColor,
      autoOpen:          typeof s.autoOpen === 'boolean'        ? s.autoOpen         : DEFAULT_SETTINGS.autoOpen,
      autoOpenDelay:     typeof s.autoOpenDelay === 'number'    ? s.autoOpenDelay    : DEFAULT_SETTINGS.autoOpenDelay,
      showTypingIndicator: typeof s.showTypingIndicator === 'boolean' ? s.showTypingIndicator : DEFAULT_SETTINGS.showTypingIndicator,
      offlineMessage:    typeof s.offlineMessage === 'string'   ? s.offlineMessage   : DEFAULT_SETTINGS.offlineMessage,
      suggestions:       parseSuggestions(s.suggestions),
      helpItems:         parseHelpItems(s.helpItems),
      talkToHumanLabel:  typeof s.talkToHumanLabel === 'string' && s.talkToHumanLabel.trim()
        ? s.talkToHumanLabel
        : DEFAULT_SETTINGS.talkToHumanLabel,
      talkToHumanMessage: typeof s.talkToHumanMessage === 'string' && s.talkToHumanMessage.trim()
        ? s.talkToHumanMessage
        : DEFAULT_SETTINGS.talkToHumanMessage,
    })
    setIsDirty(false)
  }, [existingConfig])

  const update = useCallback((patch: Partial<WidgetSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    setIsDirty(true)
  }, [])

  const updateSuggestion = useCallback((index: number, patch: Partial<WidgetSuggestion>) => {
    update({
      suggestions: settings.suggestions.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    })
  }, [settings.suggestions, update])

  const updateTheme = useCallback((
    mode: 'lightTheme' | 'darkTheme',
    patch: Partial<WidgetThemeColors>
  ) => {
    update({
      [mode]: {
        ...settings[mode],
        ...patch,
      },
    } as Partial<WidgetSettings>)
  }, [settings, update])

  const addSuggestion = useCallback(() => {
    if (settings.suggestions.length >= MAX_SUGGESTIONS) return
    update({ suggestions: [...settings.suggestions, { label: '', message: '' }] })
  }, [settings.suggestions, update])

  const removeSuggestion = useCallback((index: number) => {
    update({ suggestions: settings.suggestions.filter((_, idx) => idx !== index) })
  }, [settings.suggestions, update])

  const updateHelpItem = useCallback((index: number, patch: Partial<WidgetHelpItem>) => {
    update({
      helpItems: settings.helpItems.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    })
  }, [settings.helpItems, update])

  const addHelpItem = useCallback(() => {
    if (settings.helpItems.length >= 8) return
    update({
      helpItems: [
        ...settings.helpItems,
        {
          id: `help-${Date.now()}`,
          question: '',
          answer: '',
          actionLabel: '',
          actionMessage: '',
        },
      ],
    })
  }, [settings.helpItems, update])

  const removeHelpItem = useCallback((index: number) => {
    update({ helpItems: settings.helpItems.filter((_, idx) => idx !== index) })
  }, [settings.helpItems, update])

  const openUpgradeDialog = useCallback(() => {
    setIsUpgradeDialogOpen(true)
  }, [])

  const handleRestrictedInteractCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!isReadOnly) return

    const target = event.target as HTMLElement | null
    if (!target) return

    const editableTarget = target.closest('input, textarea, select, button, [role="switch"], [role="slider"], [role="button"]')
    if (!editableTarget) return
    if (editableTarget.closest('[data-free-allow="true"]')) return

    event.preventDefault()
    event.stopPropagation()
    openUpgradeDialog()
  }, [isReadOnly, openUpgradeDialog])

  const handleSave = async () => {
    if (isReadOnly) {
      openUpgradeDialog()
      return
    }

    setSaving(true)
    try {
      await updateConfig.mutateAsync({
        orgId,
        primaryColor:   settings.primaryColor,
        welcomeMessage: settings.welcomeMessage,
        companyName:    settings.companyName,
        logoUrl:        settings.logoUrl,
        position:       settings.position,
        showBranding:   settings.showBranding,
        settings: {
          themeMode:         settings.themeMode,
          lightTheme:        settings.lightTheme,
          darkTheme:         settings.darkTheme,
          botName:            settings.botName,
          inputPlaceholder:   settings.inputPlaceholder,
          responseTimeText:   settings.responseTimeText,
          launcherSize:       settings.launcherSize,
          borderRadius:       settings.borderRadius,
          widgetWidth:        settings.widgetWidth,
          widgetHeight:       settings.widgetHeight,
          expandedWidth:      settings.expandedWidth,
          expandedHeight:     settings.expandedHeight,
          headerStyle:        settings.headerStyle,
          userBubbleColor:    settings.userBubbleColor || undefined,
          autoOpen:           settings.autoOpen,
          autoOpenDelay:      settings.autoOpenDelay,
          showTypingIndicator: settings.showTypingIndicator,
          offlineMessage:     settings.offlineMessage || undefined,
          suggestions:        normalizeSuggestions(settings.suggestions),
          helpItems:          normalizeHelpItems(settings.helpItems),
          talkToHumanLabel:   settings.talkToHumanLabel.trim() || undefined,
          talkToHumanMessage: settings.talkToHumanMessage.trim() || undefined,
        },
      })
      setSaved(true)
      setIsDirty(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('[widget save]', err)
    } finally {
      setSaving(false)
    }
  }

  const previewConfig = {
    primaryColor:        deferredSettings.primaryColor,
    welcomeMessage:      deferredSettings.welcomeMessage,
    companyName:         deferredSettings.companyName,
    logoUrl:             deferredSettings.logoUrl,
    position:            deferredSettings.position,
    showBranding:        deferredSettings.showBranding,
    themeMode:           deferredSettings.themeMode,
    lightTheme:          deferredSettings.lightTheme,
    darkTheme:           deferredSettings.darkTheme,
    botName:             deferredSettings.botName,
    inputPlaceholder:    deferredSettings.inputPlaceholder,
    responseTimeText:    deferredSettings.responseTimeText,
    launcherSize:        deferredSettings.launcherSize,
    borderRadius:        deferredSettings.borderRadius,
    widgetWidth:         deferredSettings.widgetWidth,
    widgetHeight:        deferredSettings.widgetHeight,
    expandedWidth:       deferredSettings.expandedWidth,
    expandedHeight:      deferredSettings.expandedHeight,
    headerStyle:         deferredSettings.headerStyle,
    userBubbleColor:     deferredSettings.userBubbleColor || deferredSettings.primaryColor,
    autoOpen:            deferredSettings.autoOpen,
    autoOpenDelay:       deferredSettings.autoOpenDelay,
    showTypingIndicator: deferredSettings.showTypingIndicator,
    offlineMessage:      deferredSettings.offlineMessage,
    suggestions:         deferredSettings.suggestions,
    helpItems:           deferredSettings.helpItems,
    talkToHumanLabel:    deferredSettings.talkToHumanLabel,
    talkToHumanMessage:  deferredSettings.talkToHumanMessage,
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ZapIcon className="size-5 text-primary" />
            Widget Customization
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customize your chat widget appearance, content, and behavior.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && !saved && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
              Unsaved changes
            </Badge>
          )}
          {saved && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
              <CheckIcon className="size-3 mr-1" /> Saved
            </Badge>
          )}
          {isReadOnly ? (
            <Button size="sm" onClick={openUpgradeDialog} className="gap-1.5" variant="outline">
              <LockIcon className="size-3.5" />
              Unlock Editing
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty} className="gap-1.5">
              <SaveIcon className="size-3.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircleIcon className="size-4 text-amber-600" />
          <AlertDescription className="flex flex-col gap-2 text-xs text-amber-800 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Preview mode on Free plan: all customization controls are visible for exploration, but editing is locked.
            </span>
            <Button size="sm" className="h-7 gap-1.5" asChild>
              <Link href="/billing">Upgrade to Starter</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Main Layout: 50/50 ── */}
      <div className="flex gap-0 overflow-hidden rounded-xl border bg-background shadow-sm" style={{ height: 'calc(100vh - 11rem)' }}>

        {/* ── Left: Settings (50%) ── */}
        <div className="w-1/2 shrink-0 border-r flex flex-col overflow-hidden transition-all">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            {/* Tab triggers */}
            <div className="border-b px-4 pt-3 pb-0 shrink-0 bg-card/50">
              <TabsList className="h-8 gap-0 bg-transparent p-0 border-0">
                {[
                  { value: 'style',    icon: PaletteIcon,          label: 'Style' },
                  { value: 'content',  icon: MessageSquareIcon,    label: 'Content' },
                  { value: 'behavior', icon: SlidersHorizontalIcon, label: 'Behavior' },
                ].map(({ value, icon: Icon, label }) => (
                  <button key={value}
                    data-free-allow="true"
                    onClick={() => setActiveTab(value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === value
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}>
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </TabsList>
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto" onPointerDownCapture={handleRestrictedInteractCapture}>

              {/* ── STYLE TAB ── */}
              <TabsContent value="style" className="m-0 p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Brand Color</CardTitle>
                    <CardDescription className="text-xs">Applied to header, launcher button, and AI message accents.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ColorPicker value={settings.primaryColor} onChange={v => update({ primaryColor: v })} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Theme Mode</CardTitle>
                    <CardDescription className="text-xs">Choose light, dark, or follow the visitor's device setting.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {(['light', 'dark', 'system'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => update({ themeMode: mode })}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                            settings.themeMode === mode
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <ThemeColorEditor
                      title="Light palette"
                      value={settings.lightTheme}
                      onChange={patch => updateTheme('lightTheme', patch)}
                    />
                    <ThemeColorEditor
                      title="Dark palette"
                      value={settings.darkTheme}
                      onChange={patch => updateTheme('darkTheme', patch)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">User Message Color</CardTitle>
                    <CardDescription className="text-xs">Color of visitor's outgoing message bubbles. Leave empty to use brand color.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ColorPicker
                      value={settings.userBubbleColor || settings.primaryColor}
                      onChange={v => update({ userBubbleColor: v })}
                    />
                    {settings.userBubbleColor && (
                      <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground"
                        onClick={() => update({ userBubbleColor: '' })}>
                        Reset to brand color
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <SettingRow label="Header Style" description="Gradient adds depth; solid is clean and minimal.">
                      <div className="flex gap-2">
                        {(['gradient', 'solid'] as const).map(style => (
                          <button key={style}
                            onClick={() => update({ headerStyle: style })}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                              settings.headerStyle === style
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            }`}>
                            {style}
                          </button>
                        ))}
                      </div>
                    </SettingRow>
                    <div className="mt-2 h-8 rounded-lg overflow-hidden border border-border"
                      style={{
                        background: settings.headerStyle === 'gradient'
                          ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.primaryColor}bb)`
                          : settings.primaryColor
                      }} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Widget Position</CardTitle>
                    <CardDescription className="text-xs">Where the launcher button appears on your website.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {POSITIONS.map(pos => (
                        <button key={pos.value}
                          onClick={() => update({ position: pos.value })}
                          className={`relative h-16 rounded-lg border-2 text-xs font-medium transition-all hover:border-primary/50 ${
                            settings.position === pos.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground'
                          }`}>
                          <div className="absolute inset-2">
                            <div className="absolute w-3 h-3 rounded-full"
                              style={{
                                background: settings.position === pos.value ? settings.primaryColor : '#d1d5db',
                                ...pos.dot,
                              }} />
                          </div>
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Launcher Size</div>
                        <div className="text-xs text-muted-foreground mb-3">Size of the chat button in the corner.</div>
                      </div>
                      <div className="flex gap-3">
                        {(['sm', 'md', 'lg'] as const).map((size) => {
                          const px = LAUNCHER_SIZES[size]
                          return (
                            <button key={size}
                              onClick={() => update({ launcherSize: size })}
                              className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${
                                settings.launcherSize === size
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/40'
                              }`}>
                              <div className="rounded-full flex items-center justify-center text-white"
                                style={{
                                  width: px * 0.6,
                                  height: px * 0.6,
                                  background: settings.primaryColor,
                                  fontSize: 10,
                                }}>
                                💬
                              </div>
                              <div className={`text-[10px] font-semibold uppercase ${settings.launcherSize === size ? 'text-primary' : 'text-muted-foreground'}`}>
                                {size.toUpperCase()} · {px}px
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Border Radius</div>
                          <div className="text-xs text-muted-foreground">Roundness of the widget panel.</div>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">{settings.borderRadius}px</div>
                      </div>
                      <Slider min={8} max={28} step={2} value={[settings.borderRadius]}
                        onValueChange={([v]) => update({ borderRadius: v! })} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>8 · Sharp</span><span>28 · Very Round</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Widget Width</div>
                          <div className="text-xs text-muted-foreground">Width of the chat panel window.</div>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">{settings.widgetWidth}px</div>
                      </div>
                      <Slider min={300} max={440} step={10} value={[settings.widgetWidth]}
                        onValueChange={([v]) => update({ widgetWidth: v! })} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>300 · Compact</span><span>440 · Wide</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">Widget Height</div>
                            <div className="text-xs text-muted-foreground">Compact panel height before visitor expands it.</div>
                          </div>
                          <div className="text-sm font-mono text-muted-foreground">{settings.widgetHeight}px</div>
                        </div>
                        <Slider min={480} max={720} step={10} value={[settings.widgetHeight]}
                          onValueChange={([v]) => update({ widgetHeight: v! })} />
                      </div>
                      <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">Expanded Size</div>
                            <div className="text-xs text-muted-foreground">Size used when the visitor clicks the expand icon.</div>
                          </div>
                          <div className="text-sm font-mono text-muted-foreground">
                            {settings.expandedWidth} x {settings.expandedHeight}
                          </div>
                        </div>
                        <Slider min={520} max={900} step={10} value={[settings.expandedWidth]}
                          onValueChange={([v]) => update({ expandedWidth: v! })} />
                        <Slider min={560} max={820} step={10} value={[settings.expandedHeight]}
                          onValueChange={([v]) => update({ expandedHeight: v! })} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── CONTENT TAB ── */}
              <TabsContent value="content" className="m-0 p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Brand Identity</CardTitle>
                    <CardDescription className="text-xs">Shown in the widget header.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Company Name</Label>
                      <Input placeholder="Acme Support" value={settings.companyName}
                        onChange={e => update({ companyName: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Logo URL</Label>
                      <Input placeholder="https://example.com/logo.png" value={settings.logoUrl}
                        onChange={e => update({ logoUrl: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">AI Bot Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Bot Name</Label>
                      <Input placeholder="AI Assistant" value={settings.botName}
                        onChange={e => update({ botName: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Response Time Text</Label>
                      <Input placeholder="AI · We reply instantly" value={settings.responseTimeText}
                        onChange={e => update({ responseTimeText: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Messages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Welcome Message</Label>
                      <Textarea value={settings.welcomeMessage}
                        onChange={e => update({ welcomeMessage: e.target.value })}
                        placeholder="Hi 👋 How can we help you today?"
                        className="min-h-[72px] text-sm resize-none" maxLength={200} />
                      <p className="text-[11px] text-muted-foreground text-right">{settings.welcomeMessage.length}/200</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Input Placeholder</Label>
                      <Input placeholder="Type a message..." value={settings.inputPlaceholder}
                        onChange={e => update({ inputPlaceholder: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Offline Message</Label>
                      <Input placeholder="We're offline right now."
                        value={settings.offlineMessage}
                        onChange={e => update({ offlineMessage: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Suggestions</CardTitle>
                    <CardDescription className="text-xs">
                      Shown right after the AI welcome message. They disappear after the first user reply.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {settings.suggestions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No suggestions yet. Add a few to guide visitors.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {settings.suggestions.map((item, idx) => (
                          <div key={idx} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">Suggestion {idx + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => removeSuggestion(idx)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-medium">Label</Label>
                              <Input
                                placeholder="Pricing"
                                value={item.label}
                                onChange={e => updateSuggestion(idx, { label: e.target.value })}
                                className="h-8 text-sm"
                                maxLength={40}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-medium">Message to send</Label>
                              <Textarea
                                placeholder="I want to learn about pricing."
                                value={item.message}
                                onChange={e => updateSuggestion(idx, { message: e.target.value })}
                                className="min-h-[64px] text-sm resize-none"
                                maxLength={240}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={addSuggestion}
                      disabled={settings.suggestions.length >= MAX_SUGGESTIONS}
                    >
                      Add suggestion
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Help Center / FAQs</CardTitle>
                    <CardDescription className="text-xs">
                      Shown in the widget Help tab. Add concise answers for common visitor questions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {settings.helpItems.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No help items yet. Add one to show a Help tab in the widget.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {settings.helpItems.map((item, idx) => (
                          <div key={item.id || idx} className="space-y-2 rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">Help item {idx + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => removeHelpItem(idx)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-medium">Question</Label>
                              <Input
                                placeholder="How do I contact support?"
                                value={item.question}
                                onChange={e => updateHelpItem(idx, { question: e.target.value })}
                                className="h-8 text-sm"
                                maxLength={90}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground font-medium">Answer</Label>
                              <Textarea
                                placeholder="Explain the answer clearly."
                                value={item.answer}
                                onChange={e => updateHelpItem(idx, { answer: e.target.value })}
                                className="min-h-[86px] text-sm resize-none"
                                maxLength={700}
                              />
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground font-medium">Action Label</Label>
                                <Input
                                  placeholder="Ask support"
                                  value={item.actionLabel ?? ''}
                                  onChange={e => updateHelpItem(idx, { actionLabel: e.target.value })}
                                  className="h-8 text-sm"
                                  maxLength={40}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground font-medium">Action Message</Label>
                                <Input
                                  placeholder="I need help with this."
                                  value={item.actionMessage ?? ''}
                                  onChange={e => updateHelpItem(idx, { actionMessage: e.target.value })}
                                  className="h-8 text-sm"
                                  maxLength={240}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={addHelpItem}
                      disabled={settings.helpItems.length >= 8}
                    >
                      Add help item
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Talk to Human Button</CardTitle>
                    <CardDescription className="text-xs">
                      Always visible at the bottom of chat. Sends the message below when clicked.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Button Label</Label>
                      <Input
                        placeholder="Talk to Human"
                        value={settings.talkToHumanLabel}
                        onChange={e => update({ talkToHumanLabel: e.target.value })}
                        className="h-8 text-sm"
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Message to send</Label>
                      <Textarea
                        placeholder="I want to talk to a human agent."
                        value={settings.talkToHumanMessage}
                        onChange={e => update({ talkToHumanMessage: e.target.value })}
                        className="min-h-[64px] text-sm resize-none"
                        maxLength={240}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── BEHAVIOR TAB ── */}
              <TabsContent value="behavior" className="m-0 p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Display</CardTitle></CardHeader>
                  <CardContent className="divide-y divide-border">
                    <SettingRow label="Show &quot;Powered by Tinfin&quot;" description="Display Tinfin branding in the widget footer.">
                      <Switch checked={settings.showBranding} onCheckedChange={v => update({ showBranding: v })} />
                    </SettingRow>
                    <SettingRow label="Show Typing Indicator" description="Show animated dots when AI is generating a reply.">
                      <Switch checked={settings.showTypingIndicator} onCheckedChange={v => update({ showTypingIndicator: v })} />
                    </SettingRow>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Auto Open</CardTitle>
                    <CardDescription className="text-xs">Automatically open the widget after a delay.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingRow label="Enable Auto Open" description="Widget opens automatically on page load.">
                      <Switch checked={settings.autoOpen} onCheckedChange={v => update({ autoOpen: v })} />
                    </SettingRow>
                    {settings.autoOpen && (
                      <div className="space-y-2 pt-1 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">Open Delay</div>
                            <div className="text-xs text-muted-foreground">Seconds before widget auto-opens.</div>
                          </div>
                          <div className="text-sm font-mono text-muted-foreground">{settings.autoOpenDelay}s</div>
                        </div>
                        <Slider min={0} max={60} step={1} value={[settings.autoOpenDelay]}
                          onValueChange={([v]) => update({ autoOpenDelay: v! })} />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0 · Immediate</span><span>60s</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>
        </div>

        {/* ── Right: Live Preview (50%) ── */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-muted/20">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-card/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium">Live Preview</span>
            </div>
            <Badge variant="outline" className="text-[10px]">Updates instantly</Badge>
          </div>
          <div className="flex-1 overflow-hidden p-4 flex items-stretch">
            <WidgetPreview config={previewConfig} />
          </div>
          <div className="text-center py-2 text-xs text-muted-foreground shrink-0 border-t bg-card/30">
            Click the launcher to toggle the widget
          </div>
        </div>

      </div>

      <AlertDialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade Required for Editing</AlertDialogTitle>
            <AlertDialogDescription>
              You're currently in preview mode on the Free plan. Upgrade to Starter to unlock widget customization and save changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe Later</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/billing">Upgrade to Starter</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
