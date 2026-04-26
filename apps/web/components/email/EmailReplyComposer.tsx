'use client'

/**
 * apps/web/components/email/EmailReplyComposer.tsx
 *
 * Compose and send an email reply for an email-channel conversation.
 * Used as the input area in EmailConversationView.
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import { useEmailReply } from '@/hooks/useEmail'
import {
  useCannedResponsesList,
  useCannedResponseSuggestions,
  useCannedResponseUsage,
} from '@/hooks/useCannedResponses'
import { CannedResponsePicker } from '@/components/canned/CannedResponsePicker'
import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'
import { Badge } from '@workspace/ui/components/badge'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'
import {
  SendIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from 'lucide-react'
import type { CannedResponse } from '@/types/database'

interface Props {
  conversationId: string
  /** Conversation status — disable input when resolved/closed */
  status: string
  /** Recipient email for display */
  toEmail: string | null
}

export function EmailReplyComposer({ conversationId, status, toEmail }: Props) {
  const { sendReply } = useEmailReply()
  const [content, setContent] = useState('')
  const [cannedOpen, setCannedOpen] = useState(false)
  const [cannedQuery, setCannedQuery] = useState('')
  const [sentOk, setSentOk] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { data: cannedResponses = [], isLoading: cannedLoading } = useCannedResponsesList({
    query: cannedQuery || undefined,
    limit: 50,
  })
  const { data: cannedSuggestions = [] } = useCannedResponseSuggestions(conversationId, 3)
  const cannedUsage = useCannedResponseUsage()
  const orderedCannedResponses = useMemo(() => {
    if (cannedQuery.trim().length > 0) return cannedResponses

    const merged: CannedResponse[] = []
    const seen = new Set<string>()

    for (const item of cannedSuggestions) {
      if (!seen.has(item.id)) {
        merged.push(item)
        seen.add(item.id)
      }
    }
    for (const item of cannedResponses) {
      if (!seen.has(item.id)) {
        merged.push(item)
        seen.add(item.id)
      }
    }

    return merged
  }, [cannedQuery, cannedResponses, cannedSuggestions])

  const isResolved = status === 'resolved' || status === 'closed'
  const canSend = content.trim().length > 0 && !isResolved && !sendReply.isPending

  const handleSend = useCallback(async () => {
    if (!canSend) return
    const text = content.trim()
    setContent('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      await sendReply.mutateAsync({ conversationId, content: text })
      setSentOk(true)
      setTimeout(() => setSentOk(false), 3000)
    } catch {
      // Error displayed from mutation
      setContent(text) // restore on error
    }
  }, [canSend, content, conversationId, sendReply])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && cannedOpen) {
      setCannedOpen(false)
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSend()
    }
  }

  const handleCannedSelect = useCallback((item: CannedResponse) => {
    setContent((prev) => {
      const slashMatch = prev.match(/(?:^|\s)\/[a-z0-9_-]*$/i)
      if (!slashMatch) return prev.trim().length > 0 ? `${prev}\n${item.content}` : item.content

      const start = slashMatch.index ?? prev.length
      const prefix = prev.slice(0, start).trimEnd()
      return prefix.length > 0 ? `${prefix}\n${item.content}` : item.content
    })
    setCannedOpen(false)
    setCannedQuery('')
    void cannedUsage.mutateAsync({ id: item.id }).catch(() => undefined)
  }, [cannedUsage])

  if (isResolved) {
    return (
      <div className="border-t bg-muted/30 px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          ✅ This conversation is resolved. Re-open it to send a reply.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t bg-card/50 p-3 shrink-0">
      <div className="relative rounded-xl border bg-background ring-1 ring-border/50 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
        <CannedResponsePicker
          open={cannedOpen}
          query={cannedQuery}
          loading={cannedLoading}
          responses={orderedCannedResponses}
          onSelect={handleCannedSelect}
        />

        {/* To: header bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20 rounded-t-xl">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">To:</span>
          <span className="text-xs text-foreground font-mono">
            {toEmail ?? '—'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {sentOk && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-[10px] h-5">
                <CheckCircleIcon className="size-3 mr-1" /> Sent
              </Badge>
            )}
            {sendReply.isError && (
              <span className="text-[10px] text-destructive flex items-center gap-1">
                <AlertCircleIcon className="size-3" />
                {sendReply.error?.message?.slice(0, 60) ?? 'Send failed'}
              </span>
            )}
          </div>
        </div>

        {/* Reply textarea */}
        <Textarea
          ref={textareaRef}
          placeholder="Write your reply… (Use / for canned responses, ⌘+Enter to send)"
          className="min-h-[96px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
          value={content}
          onChange={(e) => {
            const value = e.target.value
            setContent(value)

            const slashMatch = value.match(/(?:^|\s)\/([a-z0-9_-]*)$/i)
            if (slashMatch) {
              setCannedOpen(true)
              setCannedQuery(slashMatch[1] ?? '')
            } else {
              setCannedOpen(false)
              setCannedQuery('')
            }
          }}
          onKeyDown={handleKey}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <p className="text-[11px] text-muted-foreground/50">
            Reply via email · ⌘+Enter to send
          </p>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!canSend}
            className="h-7 gap-1.5 px-3 text-xs"
          >
            {sendReply.isPending ? (
              <>
                <Spinner className="size-3" />
                Sending…
              </>
            ) : (
              <>
                <SendIcon className="size-3" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
