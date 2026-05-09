"use client"

import type { ComponentType } from "react"
import {
  MailIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  PhoneCallIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

type ChannelCard = {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  availability: "starter" | "pro-scale"
  tone: "chat" | "email" | "whatsapp" | "voice"
}

const CHANNELS: ChannelCard[] = [
  {
    title: "Website chat",
    description: "Start with the fastest support surface: widget conversations, AI replies, history, and human takeover.",
    icon: MessageSquareTextIcon,
    availability: "starter",
    tone: "chat",
  },
  {
    title: "Email",
    description: "Handle structured conversations where customers expect complete context and a polished response.",
    icon: MailIcon,
    availability: "pro-scale",
    tone: "email",
  },
  {
    title: "WhatsApp",
    description: "Support high-intent mobile conversations with concise answers and channel-specific formatting.",
    icon: MessageCircleIcon,
    availability: "pro-scale",
    tone: "whatsapp",
  },
  {
    title: "Voice",
    description: "Use AI voice for calls, transcripts, summaries, and follow-up context inside the support workspace.",
    icon: PhoneCallIcon,
    availability: "pro-scale",
    tone: "voice",
  },
]

const TONE_ACCENT: Record<ChannelCard["tone"], string> = {
  chat: "bg-primary",
  email: "bg-amber-500",
  whatsapp: "bg-emerald-500",
  voice: "bg-teal-500",
}

export function ChannelsSection() {
  return (
    <section id="channels" className="relative overflow-hidden bg-background py-20 md:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-28 -z-10 h-[30rem] w-[72rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 10%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.62fr)] lg:items-end">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Channels
            </div>
            <h2 className="mt-5 max-w-4xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Meet customers where they already ask for help.
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-muted-foreground lg:justify-self-end">
            Start simple with website chat, then add email, WhatsApp, and voice when your support volume needs more surfaces without splitting the team across tools.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CHANNELS.map((channel) => (
            <ChannelCard key={channel.title} channel={channel} />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 text-sm leading-6 text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            <span className="font-medium text-foreground">Starter</span> includes website chat only.
          </p>
          <p>
            <span className="font-medium text-foreground">Pro and Scale</span> include email, WhatsApp, and voice with usage limits.
          </p>
        </div>
      </div>
    </section>
  )
}

function ChannelCard({ channel }: { channel: ChannelCard }) {
  const Icon = channel.icon
  const planLabel = channel.availability === "starter" ? "Starter" : "Pro + Scale"

  return (
    <article className="group relative min-h-[330px] overflow-hidden rounded-[1.35rem] border border-border bg-card transition-colors hover:border-primary/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 72% 12%, color-mix(in oklch, var(--foreground) 3.5%, transparent), transparent 42%)",
        }}
      />

      <div className="relative h-44 overflow-hidden border-b border-border bg-muted/20">
        <ChannelVisual tone={channel.tone} />
      </div>

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{planLabel}</p>
            <h3 className="mt-2 text-2xl font-medium tracking-tight text-foreground">{channel.title}</h3>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:text-primary">
            <Icon className="size-[1.125rem]" />
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{channel.description}</p>
      </div>
    </article>
  )
}

function ChannelVisual({ tone }: { tone: ChannelCard["tone"] }) {
  if (tone === "chat") return <ChatVisual />
  if (tone === "email") return <EmailVisual />
  if (tone === "whatsapp") return <WhatsAppVisual />
  return <VoiceVisual />
}

function SkeletonLine({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-full bg-foreground/10", className)} />
}

function ChatVisual() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-5 right-5 top-5 h-[7.8rem] overflow-hidden rounded-[1.05rem] border border-border bg-background">
        <div className="flex h-9 items-center gap-2 border-b border-border px-3">
          <span className="size-2 rounded-full bg-primary" />
          <SkeletonLine className="h-2 w-24" />
          <SkeletonLine className="ml-auto h-2 w-10" />
        </div>

        <div className="space-y-2 px-3 py-3">
          <div className="w-[68%] rounded-[0.7rem] rounded-bl-sm border border-border bg-muted/30 px-3 py-2">
            <SkeletonLine className="h-1.5 w-24" />
            <SkeletonLine className="mt-1.5 h-1.5 w-16" />
          </div>
          <div className="ml-auto w-[62%] rounded-[0.7rem] rounded-br-sm bg-primary/12 px-3 py-2">
            <SkeletonLine className="ml-auto h-1.5 w-20 bg-primary/30" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-5 right-[4.75rem] h-8 rounded-full border border-border bg-background px-3 py-2">
        <SkeletonLine className="h-1.5 w-28" />
      </div>
      <div className="absolute bottom-3.5 right-5 flex size-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
        <MessageSquareTextIcon className="size-4 text-primary" />
      </div>
    </div>
  )
}

function EmailVisual() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-5 right-5 top-5 h-[7.9rem] overflow-hidden rounded-[1.05rem] border border-border bg-background">
        <div className="grid h-full grid-cols-[38%_1fr]">
          <div className="border-r border-border bg-muted/20 p-3">
            <SkeletonLine className="h-2 w-20 bg-amber-500/20" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-1.5">
                  <SkeletonLine className={cn("h-1.5", item === 0 ? "w-24" : "w-20")} />
                  <SkeletonLine className="h-1.5 w-14" />
                </div>
              ))}
            </div>
          </div>

          <div className="p-3">
            <SkeletonLine className="h-2.5 w-32" />
            <SkeletonLine className="mt-3 h-1.5 w-full" />
            <SkeletonLine className="mt-2 h-1.5 w-5/6" />
            <SkeletonLine className="mt-2 h-1.5 w-3/5" />
            <div className="mt-4 flex gap-2">
              <SkeletonLine className="h-6 w-14 bg-amber-500/20" />
              <SkeletonLine className="h-6 w-16" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between rounded-full border border-border bg-background px-3 py-2">
        <SkeletonLine className="h-1.5 w-24" />
        <span className="size-2 rounded-full bg-amber-500/50" />
      </div>
    </div>
  )
}

function WhatsAppVisual() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-4 h-[8.8rem] w-[6.7rem] -translate-x-1/2 rounded-[1.35rem] border border-border bg-background p-2">
        <div className="mx-auto h-1 w-7 rounded-full bg-foreground/12" />
        <div className="mt-4 space-y-2">
          <div className="ml-auto w-[68%] rounded-[0.55rem] rounded-br-sm bg-emerald-500/12 px-2 py-1.5">
            <SkeletonLine className="h-1.5 w-9 bg-emerald-500/25" />
          </div>
          <div className="w-[72%] rounded-[0.55rem] rounded-bl-sm border border-border bg-muted/20 px-2 py-1.5">
            <SkeletonLine className="h-1.5 w-10" />
          </div>
          <div className="ml-auto w-[82%] rounded-[0.55rem] rounded-br-sm bg-emerald-500/12 px-2 py-1.5">
            <SkeletonLine className="h-1.5 w-12 bg-emerald-500/25" />
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2 h-5 rounded-full border border-border bg-muted/20" />
      </div>

      <div className="absolute left-7 top-12 h-px w-20 bg-border">
        <span className={cn("absolute right-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full", TONE_ACCENT.whatsapp)} />
      </div>
      <div className="absolute right-7 top-[6.6rem] h-px w-20 bg-border">
        <span className={cn("absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full", TONE_ACCENT.whatsapp)} />
      </div>
    </div>
  )
}

function VoiceVisual() {
  const bars = [26, 46, 72, 42, 88, 58, 34, 76, 52, 66, 38, 84, 48, 30]

  return (
    <div className="absolute inset-0">
      <div className="absolute left-5 right-5 top-5 rounded-[1.05rem] border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full border border-teal-500/25 bg-teal-500/10">
            <PhoneCallIcon className="size-4 text-teal-600" />
          </span>
          <div>
            <SkeletonLine className="h-2 w-24 bg-teal-500/20" />
            <SkeletonLine className="mt-2 h-1.5 w-16" />
          </div>
          <span className="ml-auto size-2 rounded-full bg-teal-500" />
        </div>
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex h-16 items-center justify-between gap-1.5 rounded-[1rem] border border-border bg-background px-4">
        {bars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="w-full rounded-full bg-teal-500/28"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}
