'use client'

import Link from 'next/link'
import {
  ExternalLinkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'

interface AiAnswerSource {
  title: string | null
  url: string | null
  similarity: number | null
  sourceType: string | null
  pinned: boolean
}

interface AITrustPanelProps {
  messageId: string
  conversationId: string
  metadata: Record<string, unknown>
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readSources(metadata: Record<string, unknown>): AiAnswerSource[] {
  if (!Array.isArray(metadata.sources)) return []

  return metadata.sources
    .map((item) => {
      const source = readRecord(item)
      return {
        title: readString(source.title),
        url: readString(source.url),
        similarity: readNumber(source.similarity),
        sourceType: readString(source.sourceType),
        pinned: source.pinned === true,
      }
    })
    .filter((source) => Boolean(source.title || source.url))
    .slice(0, 5)
}

function answerType(metadata: Record<string, unknown>): string | null {
  return readString(metadata.type) ?? readString(metadata.answerType)
}

function hasActionLog(metadata: Record<string, unknown>): boolean {
  const actionLog = metadata.actionLog
  return Boolean(actionLog && typeof actionLog === 'object' && !Array.isArray(actionLog))
}

function classifyTrust(metadata: Record<string, unknown>, sources: AiAnswerSource[]) {
  const confidence = readNumber(metadata.confidence)
  const type = answerType(metadata)
  const noVerified =
    metadata.noVerifiedAnswer === true ||
    type === 'ask_handoff' ||
    (type === 'answer' && sources.length === 0 && !hasActionLog(metadata))

  if (noVerified) {
    return {
      label: 'No verified answer',
      detail: 'AI did not find enough approved knowledge.',
      icon: ShieldAlertIcon,
      className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
      shouldImproveKb: true,
    }
  }

  if (confidence === null) {
    return {
      label: sources.length > 0 ? 'Sources attached' : 'Trust metadata',
      detail: sources.length > 0 ? `${sources.length} source${sources.length === 1 ? '' : 's'} found.` : 'No confidence score recorded.',
      icon: ShieldCheckIcon,
      className: 'border-border bg-muted/60 text-muted-foreground',
      shouldImproveKb: false,
    }
  }

  const percent = Math.round(confidence * 100)
  if (confidence < 0.45) {
    return {
      label: `Low confidence (${percent}%)`,
      detail: 'Agent review recommended before relying on this answer.',
      icon: ShieldAlertIcon,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
      shouldImproveKb: true,
    }
  }

  if (confidence < 0.75) {
    return {
      label: `Medium confidence (${percent}%)`,
      detail: 'AI found relevant context, but this may need review.',
      icon: ShieldAlertIcon,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
      shouldImproveKb: false,
    }
  }

  return {
    label: `High confidence (${percent}%)`,
    detail: sources.length > 0 ? 'Grounded with approved knowledge.' : 'High model confidence recorded.',
    icon: ShieldCheckIcon,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
    shouldImproveKb: false,
  }
}

function sourceLabel(source: AiAnswerSource, index: number): string {
  return source.title || source.url || `Source ${index + 1}`
}

export function AITrustPanel({
  messageId,
  conversationId,
  metadata,
}: AITrustPanelProps) {
  const sources = readSources(metadata)
  const confidence = readNumber(metadata.confidence)
  const type = answerType(metadata)

  if (type === 'casual') return null

  const hasTrustMetadata =
    confidence !== null ||
    type !== null ||
    sources.length > 0 ||
    metadata.noVerifiedAnswer === true

  if (!hasTrustMetadata) return null

  const trust = classifyTrust(metadata, sources)
  const TrustIcon = trust.icon

  return (
    <div className="mt-2 w-full max-w-[520px] rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('h-6 gap-1.5 rounded-full px-2 text-[10px]', trust.className)}>
          <TrustIcon className="size-3" />
          {trust.label}
        </Badge>
        {sources.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {sources.length} verified source{sources.length === 1 ? '' : 's'}
          </span>
        )}
        {type && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {trust.detail}
      </p>

      {sources.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-foreground/80">
            View answer sources
          </summary>
          <div className="mt-2 space-y-1.5">
            {sources.map((source, index) => {
              const similarity = source.similarity === null ? null : Math.round(source.similarity * 100)
              const label = sourceLabel(source, index)
              return (
                <div key={`${label}:${index}`} className="rounded-lg border bg-muted/30 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-foreground">{label}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {source.sourceType ?? 'knowledge'}{similarity !== null ? ` - ${similarity}% match` : ''}
                        {source.pinned ? ' - pinned' : ''}
                      </p>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {trust.shouldImproveKb && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
            <Link href={`/knowledge?from=ai-trust&conversation=${conversationId}&message=${messageId}`}>
              Improve KB
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
