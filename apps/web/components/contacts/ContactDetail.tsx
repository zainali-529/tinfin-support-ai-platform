'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { useContact, useDeleteContact } from '@/hooks/useContacts'
import { useActiveOrg } from '@/components/org/OrgContext'
import { EditContactDialog } from './EditContactDialog'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@workspace/ui/components/tabs'
import { Separator } from '@workspace/ui/components/separator'
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
import { cn } from '@workspace/ui/lib/utils'
import {
  UsersIcon,
  MailIcon,
  PhoneCallIcon,
  MessageSquareIcon,
  CheckCircleIcon,
  EditIcon,
  Trash2Icon,
  PhoneOffIcon,
  InboxIcon,
  ClockIcon,
  UserCheckIcon,
  ZapIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Status styles (same as inbox) ───────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  bot:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  open:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground',
  closed:   'bg-muted text-muted-foreground',
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-muted/30 px-3 py-3 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{label}</span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function ContactDetailEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
        <UsersIcon className="size-8 text-muted-foreground/40" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Select a contact</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Choose a contact from the list to view their details, conversations, and call history.
        </p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  contactId: string
  onDeleted?: () => void
}

export function ContactDetail({ contactId, onDeleted }: Props) {
  const { contact, isLoading } = useContact(contactId)
  const activeOrg = useActiveOrg()
  const isAdmin = activeOrg.role === 'admin'
  const router = useRouter()
  const deleteContact = useDeleteContact()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!contact) return null

  const displayName = contact.name || contact.email || 'Anonymous'
  const initials = displayName.slice(0, 2).toUpperCase()
  const editContact = {
    id: contact.id ?? contactId,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
  }

  const handleDelete = async () => {
    await deleteContact.mutateAsync({ id: contactId })
    setDeleteOpen(false)
    onDeleted?.()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 border-b bg-card/50 px-6 py-4 shrink-0">
        <Avatar className="size-14 shrink-0">
          <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{displayName}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {contact.email && (
              <span className="flex items-center gap-1">
                <MailIcon className="size-3 shrink-0" />
                <span className="truncate max-w-[200px]">{contact.email}</span>
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1">
                <PhoneCallIcon className="size-3" />
                {contact.phone}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Added {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="h-7 gap-1.5 text-xs">
            <EditIcon className="size-3.5" />
            Edit
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="h-7 gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b shrink-0">
        <StatCard label="Conversations" value={contact.stats.totalConversations} icon={MessageSquareIcon} />
        <StatCard label="Resolved" value={contact.stats.resolvedConversations} icon={CheckCircleIcon} />
        <StatCard label="Calls" value={contact.stats.totalCalls} icon={PhoneCallIcon} />
        <StatCard label="Emails" value={contact.stats.totalEmails} icon={MailIcon} />
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs defaultValue="conversations" className="flex flex-col h-full">
          <div className="border-b px-6 pt-3 pb-0 shrink-0">
            <TabsList className="h-8 gap-0 bg-transparent p-0 border-0">
              {[
                { value: 'conversations', label: 'Conversations', count: contact.stats.totalConversations },
                { value: 'calls', label: 'Calls', count: contact.stats.totalCalls },
                { value: 'emails', label: 'Emails', count: contact.stats.totalEmails },
              ].map(({ value, label, count }) => (
                <button
                  key={value}
                  onClick={() => {}}
                  data-value={value}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                    'text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0">
            {/* Conversations Tab */}
            <TabsContent value="conversations" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {contact.conversations.length === 0 ? (
                    <EmptyTabState icon={InboxIcon} message="No conversations yet" />
                  ) : (
                    contact.conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => router.push(`/inbox?conversation=${conv.id}`)}
                        className="w-full flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              STATUS_CLASSES[conv.status] ?? STATUS_CLASSES.resolved
                            )}>
                              {conv.status === 'bot' && <ZapIcon className="size-2.5" />}
                              {conv.status === 'pending' && <ClockIcon className="size-2.5" />}
                              {conv.status === 'open' && <UserCheckIcon className="size-2.5" />}
                              {(conv.status === 'resolved' || conv.status === 'closed') && <CheckCircleIcon className="size-2.5" />}
                              {conv.status}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                              {conv.channel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {format(new Date(conv.startedAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {conv.lastMessagePreview && (
                            <p className="text-xs text-muted-foreground truncate">{conv.lastMessagePreview}</p>
                          )}
                        </div>
                        <ExternalLinkIcon className="size-3 text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Calls Tab */}
            <TabsContent value="calls" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {contact.calls.length === 0 ? (
                    <EmptyTabState icon={PhoneOffIcon} message="No calls yet" />
                  ) : (
                    contact.calls.map(call => (
                      <div key={call.id} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                              {call.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <ClockIcon className="size-2.5" />
                              {formatDuration(call.durationSeconds)}
                            </span>
                            {call.startedAt && (
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {format(new Date(call.startedAt), 'MMM d, h:mm a')}
                              </span>
                            )}
                          </div>
                          {call.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{call.summary}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {contact.emailThreads.length === 0 ? (
                    <EmptyTabState icon={MailIcon} message="No emails yet" />
                  ) : (
                    contact.emailThreads.map(thread => (
                      <button
                        key={thread.conversationId}
                        onClick={() => router.push(`/email?conversation=${thread.conversationId}`)}
                        className="w-full flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:bg-muted/40 transition-colors group"
                      >
                        <MailIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{thread.subject}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                              {thread.direction}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(thread.createdAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                        <ExternalLinkIcon className="size-3 text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      {editOpen && (
        <EditContactDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          contact={editContact}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{displayName}</strong> and cannot be undone.
              Their conversations may be preserved but will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyTabState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-5 text-muted-foreground opacity-40" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}