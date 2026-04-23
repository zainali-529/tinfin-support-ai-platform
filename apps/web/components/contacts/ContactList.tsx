'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Input } from '@workspace/ui/components/input'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import {
  SearchIcon,
  UsersIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  PlusIcon,
  UploadIcon,
} from 'lucide-react'

interface Contact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  createdAt: string
  conversationCount: number
  lastConversationAt: string | null
  channel: string | null
  callCount: number
}

interface Props {
  contacts: Contact[]
  loading: boolean
  totalCount: number
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearchChange: (s: string) => void
  onAddContact: () => void
  onImport: () => void
}

const CHANNEL_DOT: Record<string, string> = {
  chat:    'bg-blue-400',
  email:   'bg-amber-400',
  voice:   'bg-emerald-400',
  manual:  'bg-muted-foreground',
  import:  'bg-muted-foreground',
}

const CHANNEL_LABEL: Record<string, string> = {
  chat:  'Chat',
  email: 'Email',
  voice: 'Voice',
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

function getDisplayName(contact: Contact) {
  return contact.name || contact.email || contact.phone || 'Anonymous'
}

export function ContactList({
  contacts,
  loading,
  totalCount,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  onAddContact,
  onImport,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Contacts</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {loading ? '...' : `${totalCount} total`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onImport} title="Import contacts">
            <UploadIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onAddContact} title="Add contact">
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2.5 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, phone…"
            className="h-8 border-0 bg-muted/50 pl-8 text-xs shadow-none focus-visible:ring-0"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col gap-0.5 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg p-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-40" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <UsersIcon className="size-5 text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'No contacts match your search' : 'No contacts yet'}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={onAddContact} className="gap-1.5">
                <PlusIcon className="size-3.5" />
                Add Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {contacts.map(contact => {
              const isSelected = contact.id === selectedId
              const initials = getInitials(contact.name, contact.email)
              const displayName = getDisplayName(contact)
              const channelKey = contact.channel ?? 'manual'
              const dotColor = CHANNEL_DOT[channelKey] ?? CHANNEL_DOT.manual

              return (
                <button
                  key={contact.id}
                  onClick={() => onSelect(contact.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-100',
                    'hover:bg-muted/60 active:scale-[0.99]',
                    isSelected ? 'bg-primary/8 ring-1 ring-primary/15' : ''
                  )}
                >
                  <Avatar className="size-9 shrink-0 mt-0.5">
                    <AvatarFallback className={cn(
                      'text-xs font-semibold',
                      isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className={cn(
                        'truncate text-xs font-semibold',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {displayName}
                      </span>
                      {contact.lastConversationAt && (
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                          {formatDistanceToNow(new Date(contact.lastConversationAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>

                    {contact.email && (
                      <p className="mb-1 truncate text-[11px] text-muted-foreground">
                        {contact.email}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Channel dot */}
                      {contact.channel && CHANNEL_LABEL[contact.channel] && (
                        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span className={cn('size-1.5 rounded-full shrink-0', dotColor)} />
                          {CHANNEL_LABEL[contact.channel]}
                        </span>
                      )}

                      {/* Conversation count */}
                      {contact.conversationCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <MessageSquareIcon className="size-2.5" />
                          {contact.conversationCount}
                        </span>
                      )}

                      {/* Call count */}
                      {contact.callCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <PhoneCallIcon className="size-2.5" />
                          {contact.callCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}