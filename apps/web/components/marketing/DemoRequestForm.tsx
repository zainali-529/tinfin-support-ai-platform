"use client"

import * as React from "react"
import Link from "next/link"
import {
  BotIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  PlugIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

const CHANNEL_OPTIONS = [
  {
    id: "website_chat",
    label: "Website chat",
    description: "AI chat widget and human handoff",
    icon: MessageCircleIcon,
  },
  {
    id: "email",
    label: "Email",
    description: "Shared inbox for support emails",
    icon: MailIcon,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Customer messages from WhatsApp",
    icon: MessageCircleIcon,
  },
  {
    id: "voice",
    label: "Voice",
    description: "AI voice calls and transcripts",
    icon: PhoneCallIcon,
  },
  {
    id: "ai_actions",
    label: "AI Actions",
    description: "Read or write to approved APIs",
    icon: PlugIcon,
  },
] as const

const TEAM_SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-100", "100+"] as const

type ChannelId = (typeof CHANNEL_OPTIONS)[number]["id"]

type DemoFormState = {
  name: string
  email: string
  company: string
  websiteUrl: string
  message: string
  teamSize: string
  currentTool: string
  botField: string
}

type DemoFormErrors = Partial<Record<keyof DemoFormState | "channels", string>>

const initialFormState: DemoFormState = {
  name: "",
  email: "",
  company: "",
  websiteUrl: "",
  message: "",
  teamSize: "",
  currentTool: "",
  botField: "",
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function validateForm(form: DemoFormState, channels: ChannelId[]) {
  const errors: DemoFormErrors = {}

  if (form.name.trim().length < 2) errors.name = "Add your name."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Add a valid work email."
  if (form.company.trim().length < 2) errors.company = "Add your company name."

  try {
    const url = normalizeUrl(form.websiteUrl)
    if (!url) throw new Error("Missing URL")
    new URL(url)
  } catch {
    errors.websiteUrl = "Add a valid website URL."
  }

  if (channels.length === 0) errors.channels = "Select at least one channel."
  if (form.message.trim().length < 10) errors.message = "Add a short note about what you want to improve."

  return errors
}

export function DemoRequestForm() {
  const [form, setForm] = React.useState<DemoFormState>(initialFormState)
  const [channels, setChannels] = React.useState<ChannelId[]>(["website_chat"])
  const [errors, setErrors] = React.useState<DemoFormErrors>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  function updateField(field: keyof DemoFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function toggleChannel(channelId: ChannelId) {
    setChannels((current) => {
      const exists = current.includes(channelId)
      const next = exists ? current.filter((item) => item !== channelId) : [...current, channelId]
      setErrors((currentErrors) => ({ ...currentErrors, channels: undefined }))
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateForm(form, channels)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please check the form fields before submitting.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          websiteUrl: normalizeUrl(form.websiteUrl),
          channels,
        }),
      })

      const body = (await response.json().catch(() => null)) as { message?: string; delivered?: boolean } | null

      if (!response.ok) {
        throw new Error(body?.message ?? "We could not submit your request.")
      }

      setSubmitted(true)
      toast.success(
        body?.delivered === false
          ? "Demo request validated locally. Configure the webhook to receive live requests."
          : "Demo request sent. We will follow up soon.",
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not submit your request."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="border border-border bg-background/86 p-6 backdrop-blur md:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <CheckCircle2Icon className="size-6" />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-tight text-foreground">Request received.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Thanks for reaching out. We will review your support workflow and reply with the best setup path for your team.
        </p>
        <div className="mt-6 border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Want to keep exploring? Compare the plans or read the setup docs while we prepare your demo.
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild>
            <Link href="/pricing">View pricing</Link>
          </Button>
          <Button asChild variant="outline" className="bg-background/70">
            <Link href="/docs">Open docs</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-background/86 p-4 backdrop-blur md:p-6">
      <div className="flex items-start gap-4 border-b border-border pb-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <BotIcon className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-medium tracking-tight text-foreground">Request a product demo</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Tell us what your support team handles today. We will map Tinfiz to your channels, AI, and reporting needs.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Sara Khan"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Work email" error={errors.email}>
          <Input
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="sara@company.com"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Company" error={errors.company}>
          <Input
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="Acme Support"
            autoComplete="organization"
            aria-invalid={Boolean(errors.company)}
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Website URL" error={errors.websiteUrl}>
          <Input
            value={form.websiteUrl}
            onChange={(event) => updateField("websiteUrl", event.target.value)}
            placeholder="https://company.com"
            inputMode="url"
            autoComplete="url"
            aria-invalid={Boolean(errors.websiteUrl)}
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Team size" optional>
          <select
            value={form.teamSize}
            onChange={(event) => updateField("teamSize", event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Select team size</option>
            {TEAM_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Current tool" optional>
          <Input
            value={form.currentTool}
            onChange={(event) => updateField("currentTool", event.target.value)}
            placeholder="Intercom, Zendesk, email inbox..."
            className="h-11 bg-background"
          />
        </Field>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-medium text-foreground">Support channels needed</Label>
          {errors.channels ? <p className="text-xs text-destructive">{errors.channels}</p> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHANNEL_OPTIONS.map((channel) => {
            const selected = channels.includes(channel.id)
            const Icon = channel.icon

            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => toggleChannel(channel.id)}
                className={cn(
                  "group flex items-start gap-3 border border-border bg-background p-3 text-left transition",
                  "hover:border-primary/40 hover:bg-primary/[0.035]",
                  selected && "border-primary/45 bg-primary/[0.07] text-foreground",
                )}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/35 text-muted-foreground transition",
                    selected && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{channel.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{channel.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Message" error={errors.message} className="mt-5">
        <Textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          placeholder="Tell us what you want to improve: response time, AI answers, handoff, channels, reporting..."
          rows={5}
          aria-invalid={Boolean(errors.message)}
          className="min-h-32 resize-none bg-background"
        />
      </Field>

      <input
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={form.botField}
        onChange={(event) => updateField("botField", event.target.value)}
        aria-hidden="true"
      />

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          No spam. Just a focused reply with the best setup path for your support workflow.
        </p>
        <Button type="submit" disabled={isSubmitting} className="min-w-40">
          {isSubmitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Sending
            </>
          ) : (
            "Request demo"
          )}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  optional,
  className,
  children,
}: {
  label: string
  error?: string
  optional?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : optional ? (
          <span className="text-xs text-muted-foreground">Optional</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
