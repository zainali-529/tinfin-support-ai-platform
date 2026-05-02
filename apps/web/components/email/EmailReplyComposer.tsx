'use client'

/**
 * apps/web/components/email/EmailReplyComposer.tsx
 *
 * Compose and send an email reply for an email-channel conversation.
 * Used as the input area in EmailConversationView.
 */

import { useState, useRef, useCallback } from 'react'
import { useEmailReply } from '@/hooks/useEmail'
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
  const [sentOk, setSentOk] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSend()
    }
  }

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
          placeholder="Write your reply… (⌘+Enter to send)"
          className="min-h-[96px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
