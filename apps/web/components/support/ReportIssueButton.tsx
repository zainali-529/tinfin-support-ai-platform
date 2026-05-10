'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircleIcon, BugIcon, Loader2Icon, SendIcon } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/sonner'
import { useActiveOrg } from '@/components/org/OrgContext'

type IssueType = 'bug' | 'slow' | 'data' | 'billing' | 'channel' | 'other'
type IssueSeverity = 'blocker' | 'high' | 'normal' | 'low'

type ReportIssueButtonProps = {
  user: {
    id: string
    email?: string | null
    name?: string | null
  }
}

const ISSUE_TYPES: Array<{ value: IssueType; label: string; helper: string }> = [
  { value: 'bug', label: 'Something is broken', helper: 'Unexpected errors, broken UI, or failed actions.' },
  { value: 'slow', label: 'Something is slow', helper: 'Realtime, page load, or API delay.' },
  { value: 'data', label: 'Data looks wrong', helper: 'Counts, conversations, usage, or analytics mismatch.' },
  { value: 'billing', label: 'Billing or plan issue', helper: 'Checkout, add-ons, plan access, or limits.' },
  { value: 'channel', label: 'Channel issue', helper: 'Widget, email, WhatsApp, voice, or actions.' },
  { value: 'other', label: 'Other', helper: 'Anything that does not fit above.' },
]

const SEVERITIES: Array<{ value: IssueSeverity; label: string; helper: string }> = [
  { value: 'blocker', label: 'Blocker', helper: 'I cannot continue my work.' },
  { value: 'high', label: 'High', helper: 'Important workflow is affected.' },
  { value: 'normal', label: 'Normal', helper: 'Needs attention, but there is a workaround.' },
  { value: 'low', label: 'Low', helper: 'Small issue or polish request.' },
]

const DEFAULT_ISSUE_TYPE = ISSUE_TYPES[0]!
const DEFAULT_SEVERITY = SEVERITIES[2]!

const initialForm = {
  type: 'bug' as IssueType,
  severity: 'normal' as IssueSeverity,
  summary: '',
  description: '',
  steps: '',
  expected: '',
  actual: '',
}

function readClientMetadata(pathname: string) {
  if (typeof window === 'undefined') {
    return {
      page: { url: '', pathname, title: '', referrer: '' },
      client: {},
    }
  }

  return {
    page: {
      url: window.location.href,
      pathname,
      title: document.title,
      referrer: document.referrer,
    },
    client: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    },
  }
}

export function ReportIssueButton({ user }: ReportIssueButtonProps) {
  const pathname = usePathname()
  const activeOrg = useActiveOrg()
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [form, setForm] = React.useState(initialForm)

  const selectedType = ISSUE_TYPES.find((item) => item.value === form.type) ?? DEFAULT_ISSUE_TYPE
  const selectedSeverity = SEVERITIES.find((item) => item.value === form.severity) ?? DEFAULT_SEVERITY

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submitIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const summary = form.summary.trim()
    const description = form.description.trim()

    if (summary.length < 4 || description.length < 10) {
      toast.error('Add a little more detail', {
        description: 'A short summary and a clear description help us debug faster.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const metadata = readClientMetadata(pathname)
      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          summary,
          description,
          steps: form.steps.trim(),
          expected: form.expected.trim(),
          actual: form.actual.trim(),
          metadata: {
            ...metadata,
            org: {
              id: activeOrg.id,
              name: activeOrg.name,
              plan: activeOrg.plan,
              role: activeOrg.role,
            },
            user: {
              id: user.id,
              email: user.email ?? null,
              name: user.name ?? null,
            },
          },
        }),
      })

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        issueId?: string
        message?: string
      } | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? `Issue report failed with status ${response.status}`)
      }

      toast.success('Issue report sent', {
        description: result.issueId
          ? `Reference ${result.issueId} has been created.`
          : 'Thanks, we captured the details with workspace metadata.',
      })
      setForm(initialForm)
      setOpen(false)
    } catch (error) {
      toast.error('Could not send report', {
        description: error instanceof Error ? error.message : 'Please try again in a moment.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl px-2.5"
          aria-label="Report an issue"
        >
          <BugIcon className="size-4" />
          <span className="hidden lg:inline">Report issue</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Send a focused report with page, workspace, and browser metadata attached automatically.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submitIssue}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue-type">Issue type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => updateField('type', value as IssueType)}
              >
                <SelectTrigger id="issue-type">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">{selectedType.helper}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-severity">Impact</Label>
              <Select
                value={form.severity}
                onValueChange={(value) => updateField('severity', value as IssueSeverity)}
              >
                <SelectTrigger id="issue-severity">
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">{selectedSeverity.helper}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-summary">Short summary</Label>
            <Input
              id="issue-summary"
              value={form.summary}
              maxLength={140}
              placeholder="Example: Inbox assignment did not update in realtime"
              onChange={(event) => updateField('summary', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-description">What happened?</Label>
            <Textarea
              id="issue-description"
              value={form.description}
              maxLength={4000}
              rows={5}
              placeholder="Tell us what you were trying to do, what happened, and whether refreshing helped."
              onChange={(event) => updateField('description', event.target.value)}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {form.description.length}/4000
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="issue-steps">Steps</Label>
              <Textarea
                id="issue-steps"
                value={form.steps}
                rows={4}
                maxLength={1600}
                placeholder="1. Open inbox&#10;2. Assign chat&#10;3. Watch other account"
                onChange={(event) => updateField('steps', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-expected">Expected</Label>
              <Textarea
                id="issue-expected"
                value={form.expected}
                rows={4}
                maxLength={1000}
                placeholder="What should have happened?"
                onChange={(event) => updateField('expected', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-actual">Actual</Label>
              <Textarea
                id="issue-actual"
                value={form.actual}
                rows={4}
                maxLength={1000}
                placeholder="What happened instead?"
                onChange={(event) => updateField('actual', event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/35 p-3">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-xs leading-5 text-muted-foreground">
                <p className="font-medium text-foreground">Attached automatically</p>
                <p className="truncate">Page: {pathname}</p>
                <p className="truncate">Workspace: {activeOrg.name} ({activeOrg.plan})</p>
                <p className="truncate">User: {user.email ?? user.id}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
