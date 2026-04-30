'use client'

import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { ClockIcon, ShieldAlertIcon } from 'lucide-react'

export interface PendingApprovalItem {
  id: string
  logId: string
  conversationId: string | null
  actionName: string
  parameters: Record<string, unknown> | null
  requestedAt: string
  expiresAt: string | null
}

interface PendingApprovalsProps {
  items: PendingApprovalItem[]
  approvingLogId?: string | null
  rejectingLogId?: string | null
  title?: string
  emptyMessage?: string
  onApprove: (logId: string) => Promise<void> | void
  onReject: (logId: string) => Promise<void> | void
}

function formatRelative(value: string | null): string {
  if (!value) return 'Unknown'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function formatParams(parameters: Record<string, unknown> | null): string {
  if (!parameters || Object.keys(parameters).length === 0) return '{}'
  try {
    return JSON.stringify(parameters, null, 2)
  } catch {
    return '{}'
  }
}

export function PendingApprovals({
  items,
  approvingLogId,
  rejectingLogId,
  title = 'Action Approvals',
  emptyMessage = 'No approvals are pending right now.',
  onApprove,
  onReject,
}: PendingApprovalsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlertIcon className="size-4 text-amber-500" />
          {title}
          <Badge variant="outline" className="ml-1 h-5 text-[10px]">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          items.map((item) => {
            const approving = approvingLogId === item.logId
            const rejecting = rejectingLogId === item.logId
            const busy = approving || rejecting

            return (
              <div key={item.id} className="space-y-3 rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.actionName}</p>
                    <p className="text-xs text-muted-foreground">
                      Conversation: {item.conversationId ?? 'Not linked'}
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>

                <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed">
                  {formatParams(item.parameters)}
                </pre>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="size-3.5" />
                    Requested {formatRelative(item.requestedAt)}
                  </span>
                  <span>Expires {formatRelative(item.expiresAt)}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onApprove(item.logId)}
                    disabled={busy}
                  >
                    {approving ? 'Approving...' : 'Approve & Execute'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(item.logId)}
                    disabled={busy}
                  >
                    {rejecting ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
