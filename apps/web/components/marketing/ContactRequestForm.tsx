"use client"

import * as React from "react"
import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/sonner"

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "sales", label: "Sales or demo" },
  { value: "support", label: "Product support" },
  { value: "billing", label: "Billing" },
  { value: "partnership", label: "Partnership" },
  { value: "security", label: "Security" },
] as const

type Topic = (typeof TOPICS)[number]["value"]

type ContactFormState = {
  name: string
  email: string
  company: string
  topic: Topic
  message: string
  botField: string
}

type ContactFormErrors = Partial<Record<keyof ContactFormState, string>>

const initialFormState: ContactFormState = {
  name: "",
  email: "",
  company: "",
  topic: "general",
  message: "",
  botField: "",
}

function validateForm(form: ContactFormState) {
  const errors: ContactFormErrors = {}

  if (form.name.trim().length < 2) errors.name = "Add your name."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Add a valid email."
  if (form.message.trim().length < 10) errors.message = "Add a short message."

  return errors
}

export function ContactRequestForm() {
  const [form, setForm] = React.useState<ContactFormState>(initialFormState)
  const [errors, setErrors] = React.useState<ContactFormErrors>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  function updateField<K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateForm(form)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please check the form fields before sending.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })

      const body = (await response.json().catch(() => null)) as { message?: string; delivered?: boolean } | null

      if (!response.ok) {
        throw new Error(body?.message ?? "We could not send your message.")
      }

      setSubmitted(true)
      toast.success(
        body?.delivered === false
          ? "Contact message validated locally. Configure the webhook to receive live messages."
          : "Message sent. We will reply soon.",
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not send your message."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.75rem] border border-border bg-background p-6 md:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <CheckCircle2Icon className="size-6" />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-tight text-foreground">Message received.</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Thanks for contacting Tinfiz. We will review your message and reply with the most useful next step.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setSubmitted(false)}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-border bg-background p-5 md:p-6">
      <div className="border-b border-border pb-5">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">Send a message</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tell us what you need. Use the demo page for a guided walkthrough, or this form for anything else.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Sara Khan"
            autoComplete="name"
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <Input
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="sara@company.com"
            type="email"
            autoComplete="email"
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Company" optional>
          <Input
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="Acme Support"
            autoComplete="organization"
            className="h-11 bg-background"
          />
        </Field>

        <Field label="Topic">
          <select
            value={form.topic}
            onChange={(event) => updateField("topic", event.target.value as Topic)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" error={errors.message} className="mt-5">
        <Textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          placeholder="How can we help?"
          rows={6}
          className="min-h-40 resize-none bg-background"
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
          For security reports, avoid sending passwords, full API keys, or unnecessary customer data.
        </p>
        <Button type="submit" disabled={isSubmitting} className="min-w-36">
          {isSubmitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Sending
            </>
          ) : (
            <>
              <SendIcon className="size-4" />
              Send
            </>
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
