'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useContacts, useCreateContact } from '@/hooks/useContacts'
import { ContactList } from './ContactList'
import { ContactDetail, ContactDetailEmpty } from './ContactDetail'
import { EditContactDialog } from './EditContactDialog'
import { ImportContactsDialog } from './ImportContactsDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Spinner } from '@workspace/ui/components/spinner'
import { OctagonXIcon, UsersIcon } from 'lucide-react'

// ─── Add Contact Dialog ───────────────────────────────────────────────────────

function AddContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createContact = useCreateContact()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setError('')
    if (!name && !email && !phone) {
      setError('Please fill in at least one field.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    try {
      await createContact.mutateAsync({ name: name || undefined, email: email || undefined, phone: phone || undefined })
      setName('')
      setEmail('')
      setPhone('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Email</Label>
            <Input type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
            <Input placeholder="+1 234 567 8900" value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
          </div>
          {error && (
            <Alert variant="destructive">
              <OctagonXIcon className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createContact.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={createContact.isPending}>
            {createContact.isPending && <Spinner className="mr-1.5 size-3.5" />}
            {createContact.isPending ? 'Creating…' : 'Add Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ContactsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { contacts, totalCount, isLoading, hasMore, isFetchingMore, loadMore } = useContacts({
    search: debouncedSearch,
    limit: 20,
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleDeleted = useCallback(() => {
    setSelectedId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('contact')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [pathname, router, searchParams])

  useEffect(() => {
    const contactId = searchParams.get('contact')
    setSelectedId((current) => (current === contactId ? current : contactId))
  }, [searchParams])

  const handleSelectContact = useCallback((contactId: string) => {
    setSelectedId(contactId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('contact', contactId)
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 flex-col gap-0 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UsersIcon className="size-6 text-primary" />
            Contacts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your customer contacts and communication history.
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
        {/* Left Panel */}
        <div className="w-[300px] xl:w-[380px] shrink-0 min-h-0 border-r overflow-hidden flex flex-col">
          <ContactList
            contacts={contacts}
            loading={isLoading}
            totalCount={totalCount}
            selectedId={selectedId}
            onSelect={handleSelectContact}
            search={search}
            onSearchChange={setSearch}
            onAddContact={() => setAddOpen(true)}
            onImport={() => setImportOpen(true)}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={loadMore}
          />
        </div>

        {/* Right Panel */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {selectedId ? (
            <ContactDetail
              contactId={selectedId}
              onDeleted={handleDeleted}
            />
          ) : (
            <ContactDetailEmpty />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
