'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@workspace/ui/components/native-select'
import { Switch } from '@workspace/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Textarea } from '@workspace/ui/components/textarea'
import { cn } from '@workspace/ui/lib/utils'
import {
  BotIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  DatabaseZapIcon,
  FileTextIcon,
  GaugeIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

type ProfileForm = {
  assistantName: string
  companyName: string
  companySummary: string
  websiteUrl: string
  industry: string
  targetCustomers: string
  valueProposition: string
  supportScope: string
  outOfScope: string
  brandVoice: string
  defaultLanguage: string
  formattingStyle: string
  handoffPolicy: string
  forbiddenPhrases: string
  goodAnswerExamples: string
  badAnswerExamples: string
}

type GuidanceForm = {
  id?: string
  name: string
  category: 'brand_voice' | 'content' | 'escalation' | 'formatting' | 'safety' | 'channel' | 'general'
  conditionText: string
  guidanceText: string
  channel: 'all' | 'chat' | 'email' | 'whatsapp' | 'voice'
  priority: number
  isActive: boolean
}

type EvalRunResult = {
  total: number
  passed: number
  failed: number
  results: Array<{
    id: string
    name: string
    passed: boolean
    score: number
    output: string
  }>
}

const EMPTY_PROFILE: ProfileForm = {
  assistantName: 'Support Assistant',
  companyName: '',
  companySummary: '',
  websiteUrl: '',
  industry: '',
  targetCustomers: '',
  valueProposition: '',
  supportScope: '',
  outOfScope: '',
  brandVoice: 'Warm, clear, professional, concise',
  defaultLanguage: 'auto',
  formattingStyle: 'Direct answer first. Use bullets or numbered steps when helpful.',
  handoffPolicy: 'Offer a human agent when confidence is low, the customer is frustrated, or a request needs account-specific action.',
  forbiddenPhrases: 'Which company?\nWhat company are you referring to?\nI am an AI language model',
  goodAnswerExamples: '',
  badAnswerExamples: '',
}

const EMPTY_GUIDANCE: GuidanceForm = {
  name: '',
  category: 'general',
  conditionText: '',
  guidanceText: '',
  channel: 'all',
  priority: 100,
  isActive: true,
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinLines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join('\n')
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string
  value: string | number
  hint: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/30">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function AIProfilePage() {
  const utils = trpc.useUtils()
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE)
  const [companySource, setCompanySource] = useState('')
  const [sourceTitle, setSourceTitle] = useState('Company Profile')
  const [guidanceForm, setGuidanceForm] = useState<GuidanceForm>(EMPTY_GUIDANCE)
  const [evalResult, setEvalResult] = useState<EvalRunResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const profileQuery = trpc.aiProfile.getProfile.useQuery(undefined, {
    staleTime: 20_000,
  })
  const guidanceQuery = trpc.aiProfile.listGuidanceRules.useQuery(undefined, {
    staleTime: 20_000,
  })
  const evalCasesQuery = trpc.aiProfile.listEvalCases.useQuery(undefined, {
    staleTime: 20_000,
  })
  const tracesQuery = trpc.aiProfile.listAnswerTraces.useQuery({ limit: 30 }, {
    staleTime: 10_000,
  })

  const saveProfile = trpc.aiProfile.upsertProfile.useMutation({
    onSuccess: async () => {
      setNotice('AI profile saved.')
      await profileQuery.refetch()
    },
  })
  const saveCompanySource = trpc.aiProfile.saveCompanyProfileSource.useMutation({
    onSuccess: async (result) => {
      setNotice(`Company profile pinned source saved (${result.chunksStored} chunks).`)
      await Promise.all([profileQuery.refetch(), utils.knowledge.getKnowledgeBases.invalidate()])
    },
  })
  const saveGuidance = trpc.aiProfile.upsertGuidanceRule.useMutation({
    onSuccess: async () => {
      setGuidanceForm(EMPTY_GUIDANCE)
      setNotice('Guidance rule saved.')
      await guidanceQuery.refetch()
    },
  })
  const deleteGuidance = trpc.aiProfile.deleteGuidanceRule.useMutation({
    onSuccess: async () => {
      setNotice('Guidance rule deleted.')
      await guidanceQuery.refetch()
    },
  })
  const seedEvalCases = trpc.aiProfile.seedDefaultEvalCases.useMutation({
    onSuccess: async (result) => {
      setNotice(result.inserted > 0 ? `Seeded ${result.inserted} eval cases.` : 'Default eval cases already exist.')
      await evalCasesQuery.refetch()
    },
  })
  const runEvalCases = trpc.aiProfile.runEvalCases.useMutation({
    onSuccess: async (result) => {
      setEvalResult(result as EvalRunResult)
      setNotice(`Eval run completed: ${result.passed}/${result.total} passed.`)
      await Promise.all([evalCasesQuery.refetch(), tracesQuery.refetch()])
    },
  })

  useEffect(() => {
    const profile = profileQuery.data?.profile
    if (!profile) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      setProfileForm({
        assistantName: profile.assistantName ?? 'Support Assistant',
        companyName: profile.companyName ?? '',
        companySummary: profile.companySummary ?? '',
        websiteUrl: profile.websiteUrl ?? '',
        industry: profile.industry ?? '',
        targetCustomers: profile.targetCustomers ?? '',
        valueProposition: profile.valueProposition ?? '',
        supportScope: profile.supportScope ?? '',
        outOfScope: profile.outOfScope ?? '',
        brandVoice: profile.brandVoice ?? EMPTY_PROFILE.brandVoice,
        defaultLanguage: profile.defaultLanguage ?? 'auto',
        formattingStyle: profile.formattingStyle ?? EMPTY_PROFILE.formattingStyle,
        handoffPolicy: profile.handoffPolicy ?? EMPTY_PROFILE.handoffPolicy,
        forbiddenPhrases: joinLines(profile.forbiddenPhrases),
        goodAnswerExamples: joinLines(profile.goodAnswerExamples),
        badAnswerExamples: joinLines(profile.badAnswerExamples),
      })

      setCompanySource((current) => {
        if (current.trim()) return current
        const parts = [
          profile.companySummary ? `Company summary:\n${profile.companySummary}` : '',
          profile.valueProposition ? `Value proposition:\n${profile.valueProposition}` : '',
          profile.targetCustomers ? `Target customers:\n${profile.targetCustomers}` : '',
          profile.supportScope ? `Support scope:\n${profile.supportScope}` : '',
        ].filter(Boolean)
        return parts.join('\n\n')
      })
    })

    return () => {
      cancelled = true
    }
  }, [profileQuery.data?.profile])

  const profileReady = Boolean(profileForm.companyName.trim() && profileForm.companySummary.trim())
  const guidanceRules = (guidanceQuery.data ?? []) as Array<Record<string, unknown>>
  const evalCases = evalCasesQuery.data ?? []
  const traces = (tracesQuery.data ?? []) as Array<Record<string, unknown>>

  const profilePayload = useMemo(() => ({
    assistantName: profileForm.assistantName,
    companyName: profileForm.companyName,
    companySummary: profileForm.companySummary || null,
    websiteUrl: profileForm.websiteUrl || null,
    industry: profileForm.industry || null,
    targetCustomers: profileForm.targetCustomers || null,
    valueProposition: profileForm.valueProposition || null,
    supportScope: profileForm.supportScope || null,
    outOfScope: profileForm.outOfScope || null,
    brandVoice: profileForm.brandVoice,
    defaultLanguage: profileForm.defaultLanguage,
    formattingStyle: profileForm.formattingStyle,
    handoffPolicy: profileForm.handoffPolicy || null,
    forbiddenPhrases: splitLines(profileForm.forbiddenPhrases),
    goodAnswerExamples: splitLines(profileForm.goodAnswerExamples),
    badAnswerExamples: splitLines(profileForm.badAnswerExamples),
  }), [profileForm])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <BrainCircuitIcon className="size-3.5" />
            AI Identity Layer
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Profile & Guidance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Train the assistant to represent this company clearly, answer identity questions directly,
            follow guidance rules, and expose answer traces for debugging.
          </p>
        </div>
        <Badge variant={profileReady ? 'default' : 'outline'} className="w-fit gap-1.5">
          <ShieldCheckIcon className="size-3.5" />
          {profileReady ? 'Profile ready' : 'Profile needs summary'}
        </Badge>
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-xl border bg-muted/25 px-4 py-3 text-sm">
          <span>{notice}</span>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Identity profile" value={profileQuery.data?.exists ? 'Saved' : 'Draft'} hint={profileForm.companyName || 'Company name missing'} icon={BotIcon} />
        <StatCard title="Pinned chunks" value={profileQuery.data?.pinnedCompanyChunks ?? 0} hint="Company profile source" icon={DatabaseZapIcon} />
        <StatCard title="Guidance rules" value={guidanceRules.length} hint="Active + inactive rules" icon={ClipboardCheckIcon} />
        <StatCard title="Eval cases" value={evalCases.length} hint="Identity test coverage" icon={GaugeIcon} />
      </div>

      <Tabs defaultValue="profile" className="gap-5">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="source">Pinned Source</TabsTrigger>
          <TabsTrigger value="guidance">Guidance</TabsTrigger>
          <TabsTrigger value="evals">Eval Suite</TabsTrigger>
          <TabsTrigger value="debugger">Debugger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Organization AI Profile</CardTitle>
              <CardDescription>
                This profile is injected into chat, actions, and voice prompts so the AI knows who it represents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Assistant name">
                  <Input value={profileForm.assistantName} onChange={(event) => setProfileForm({ ...profileForm, assistantName: event.target.value })} />
                </Field>
                <Field label="Company name">
                  <Input value={profileForm.companyName} onChange={(event) => setProfileForm({ ...profileForm, companyName: event.target.value })} />
                </Field>
                <Field label="Website URL">
                  <Input value={profileForm.websiteUrl} onChange={(event) => setProfileForm({ ...profileForm, websiteUrl: event.target.value })} placeholder="https://example.com" />
                </Field>
                <Field label="Industry">
                  <Input value={profileForm.industry} onChange={(event) => setProfileForm({ ...profileForm, industry: event.target.value })} placeholder="SaaS, ecommerce, healthcare..." />
                </Field>
              </div>

              <Field label="Company summary" hint='Used for "tell me about your company", "who are you", and similar questions.'>
                <Textarea className="min-h-28" value={profileForm.companySummary} onChange={(event) => setProfileForm({ ...profileForm, companySummary: event.target.value })} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Target customers">
                  <Textarea value={profileForm.targetCustomers} onChange={(event) => setProfileForm({ ...profileForm, targetCustomers: event.target.value })} />
                </Field>
                <Field label="Value proposition">
                  <Textarea value={profileForm.valueProposition} onChange={(event) => setProfileForm({ ...profileForm, valueProposition: event.target.value })} />
                </Field>
                <Field label="Support scope">
                  <Textarea value={profileForm.supportScope} onChange={(event) => setProfileForm({ ...profileForm, supportScope: event.target.value })} />
                </Field>
                <Field label="Out-of-scope topics">
                  <Textarea value={profileForm.outOfScope} onChange={(event) => setProfileForm({ ...profileForm, outOfScope: event.target.value })} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Brand voice">
                  <Textarea value={profileForm.brandVoice} onChange={(event) => setProfileForm({ ...profileForm, brandVoice: event.target.value })} />
                </Field>
                <Field label="Formatting style">
                  <Textarea value={profileForm.formattingStyle} onChange={(event) => setProfileForm({ ...profileForm, formattingStyle: event.target.value })} />
                </Field>
                <Field label="Handoff policy">
                  <Textarea value={profileForm.handoffPolicy} onChange={(event) => setProfileForm({ ...profileForm, handoffPolicy: event.target.value })} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Forbidden phrases" hint="One per line. These are checked in evals and prompt guidance.">
                  <Textarea value={profileForm.forbiddenPhrases} onChange={(event) => setProfileForm({ ...profileForm, forbiddenPhrases: event.target.value })} />
                </Field>
                <Field label="Good answer examples">
                  <Textarea value={profileForm.goodAnswerExamples} onChange={(event) => setProfileForm({ ...profileForm, goodAnswerExamples: event.target.value })} />
                </Field>
                <Field label="Bad answer examples">
                  <Textarea value={profileForm.badAnswerExamples} onChange={(event) => setProfileForm({ ...profileForm, badAnswerExamples: event.target.value })} />
                </Field>
              </div>

              <Button
                className="gap-2"
                disabled={saveProfile.isPending || !profileForm.companyName.trim()}
                onClick={() => saveProfile.mutate(profilePayload)}
              >
                {saveProfile.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                Save AI Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="source">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Pinned Company Profile Source</CardTitle>
              <CardDescription>
                This source is always boosted for company identity and product overview questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Source title">
                <Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
              </Field>
              <Field label="Pinned source content" hint="Include company intro, what you offer, audience, core benefits, and support scope.">
                <Textarea className="min-h-72" value={companySource} onChange={(event) => setCompanySource(event.target.value)} />
              </Field>
              <Button
                className="gap-2"
                disabled={saveCompanySource.isPending || companySource.trim().length < 50}
                onClick={() => saveCompanySource.mutate({ content: companySource, title: sourceTitle, replaceExisting: true })}
              >
                {saveCompanySource.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <DatabaseZapIcon className="size-4" />}
                Save as Pinned Company Source
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidance">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{guidanceForm.id ? 'Edit Guidance' : 'New Guidance Rule'}</CardTitle>
                <CardDescription>Natural-language rules that shape AI behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Name">
                  <Input value={guidanceForm.name} onChange={(event) => setGuidanceForm({ ...guidanceForm, name: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Category">
                    <NativeSelect value={guidanceForm.category} onChange={(event) => setGuidanceForm({ ...guidanceForm, category: event.target.value as GuidanceForm['category'] })}>
                      {['general', 'brand_voice', 'content', 'escalation', 'formatting', 'safety', 'channel'].map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Channel">
                    <NativeSelect value={guidanceForm.channel} onChange={(event) => setGuidanceForm({ ...guidanceForm, channel: event.target.value as GuidanceForm['channel'] })}>
                      {['all', 'chat', 'email', 'whatsapp', 'voice'].map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Priority">
                    <Input type="number" value={guidanceForm.priority} onChange={(event) => setGuidanceForm({ ...guidanceForm, priority: Number(event.target.value) || 100 })} />
                  </Field>
                </div>
                <Field label="When should this apply?">
                  <Textarea value={guidanceForm.conditionText} onChange={(event) => setGuidanceForm({ ...guidanceForm, conditionText: event.target.value })} placeholder='Example: When the customer asks about "your company"...' />
                </Field>
                <Field label="Guidance">
                  <Textarea className="min-h-28" value={guidanceForm.guidanceText} onChange={(event) => setGuidanceForm({ ...guidanceForm, guidanceText: event.target.value })} />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch checked={guidanceForm.isActive} onCheckedChange={(checked) => setGuidanceForm({ ...guidanceForm, isActive: checked })} />
                  <span className="text-sm">Active</span>
                </div>
                <div className="flex gap-2">
                  <Button className="gap-2" disabled={saveGuidance.isPending || !guidanceForm.name || !guidanceForm.guidanceText} onClick={() => saveGuidance.mutate(guidanceForm)}>
                    {saveGuidance.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                    Save Guidance
                  </Button>
                  {guidanceForm.id ? <Button variant="outline" onClick={() => setGuidanceForm(EMPTY_GUIDANCE)}>Cancel</Button> : null}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Guidance Rules</CardTitle>
                <CardDescription>Higher priority rules are injected first.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {guidanceRules.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No guidance rules yet.
                  </div>
                ) : guidanceRules.map((rule) => (
                  <div key={String(rule.id)} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{String(rule.name)}</p>
                          <Badge variant="outline">{String(rule.category)}</Badge>
                          <Badge variant={rule.is_active === false ? 'outline' : 'default'}>{rule.is_active === false ? 'Inactive' : 'Active'}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{String(rule.guidance_text)}</p>
                        {rule.condition_text ? <p className="mt-2 text-xs text-muted-foreground">When: {String(rule.condition_text)}</p> : null}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setGuidanceForm({
                          id: String(rule.id),
                          name: String(rule.name ?? ''),
                          category: String(rule.category ?? 'general') as GuidanceForm['category'],
                          conditionText: String(rule.condition_text ?? ''),
                          guidanceText: String(rule.guidance_text ?? ''),
                          channel: String(rule.channel ?? 'all') as GuidanceForm['channel'],
                          priority: Number(rule.priority ?? 100),
                          isActive: rule.is_active !== false,
                        })}>Edit</Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteGuidance.mutate({ id: String(rule.id) })}>
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evals">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Curated Eval Suite</CardTitle>
                  <CardDescription>Replay important identity questions and catch regressions before launch.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" disabled={seedEvalCases.isPending} onClick={() => seedEvalCases.mutate()}>
                    {seedEvalCases.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                    Seed Defaults
                  </Button>
                  <Button className="gap-2" disabled={runEvalCases.isPending || evalCases.length === 0} onClick={() => runEvalCases.mutate({ limit: 30 })}>
                    {runEvalCases.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}
                    Run Evals
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {evalResult ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard title="Total" value={evalResult.total} hint="Cases executed" icon={FileTextIcon} />
                  <StatCard title="Passed" value={evalResult.passed} hint="Healthy answers" icon={CheckCircle2Icon} />
                  <StatCard title="Failed" value={evalResult.failed} hint="Needs tuning" icon={SearchIcon} />
                </div>
              ) : null}

              <div className="space-y-3">
                {evalCases.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Seed default evals to start testing identity behavior.
                  </div>
                ) : evalCases.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          <Badge variant="outline">{item.expectedIntent}</Badge>
                          {item.lastPassed === null ? <Badge variant="outline">Not run</Badge> : <Badge variant={item.lastPassed ? 'default' : 'destructive'}>{item.lastPassed ? 'Passed' : 'Failed'}</Badge>}
                        </div>
                        <p className="mt-2 text-sm">{item.inputMessage}</p>
                        {item.lastOutput ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">Last output: {item.lastOutput}</p> : null}
                      </div>
                      <div className="text-sm font-medium">{item.lastScore ?? '-'}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debugger">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>AI Answer Debugger</CardTitle>
                  <CardDescription>Recent answer traces with detected intent, rewrite, sources, latency, and tokens.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => tracesQuery.refetch()}>Refresh</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {traces.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No traces yet. Ask the widget a question or run evals.
                </div>
              ) : traces.map((trace) => {
                const sources = Array.isArray(trace.sources_used) ? trace.sources_used : []
                return (
                  <div key={String(trace.id)} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{String(trace.channel)}</Badge>
                          <Badge>{String(trace.detected_intent)}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(String(trace.created_at)).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium">{String(trace.query)}</p>
                        {trace.rewritten_query ? <p className="mt-1 text-xs text-muted-foreground">Rewrite: {String(trace.rewritten_query)}</p> : null}
                        {trace.response_preview ? <p className="mt-2 text-sm text-muted-foreground">{String(trace.response_preview)}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{Number(trace.latency_ms ?? 0)}ms</span>
                          <span>{Number(trace.tokens_used ?? 0)} tokens</span>
                          <span>{sources.length} sources</span>
                        </div>
                      </div>
                      <div className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium',
                        Number(trace.confidence ?? 0) >= 0.7 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted/40'
                      )}>
                        {Math.round(Number(trace.confidence ?? 0) * 100)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
