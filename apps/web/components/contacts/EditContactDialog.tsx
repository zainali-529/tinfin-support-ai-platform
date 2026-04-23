'use client'

import { useState, useEffect } from 'react'
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
import { OctagonXIcon } from 'lucide-react'
import { useUpdateContact } from '@/hooks/useContacts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  }
}

export function EditContactDialog({ open, onOpenChange, contact }: Props) {
  const [name, setName] = useState(contact.name ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [error, setError] = useState('')

  const updateContact = useUpdateContact()

  useEffect(() => {
    if (open) {
      setName(contact.name ?? '')
      setEmail(contact.email ?? '')
      setPhone(contact.phone ?? '')
      setError('')
    }
  }, [open, contact])

  const handleSave = async () => {
    setError('')

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    try {
      await updateContact.mutateAsync({
        id: contact.id,
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            <Input
              placeholder="John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Email</Label>
            <Input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
            <Input
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <OctagonXIcon className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={updateContact.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateContact.isPending}>
            {updateContact.isPending && <Spinner className="mr-1.5 size-3.5" />}
            {updateContact.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}