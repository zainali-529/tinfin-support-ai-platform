'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Spinner } from '@workspace/ui/components/spinner'
import { OctagonXIcon, CheckCircleIcon, UploadIcon } from 'lucide-react'
import { useImportContacts } from '@/hooks/useContacts'

interface ParsedContact {
  name?: string
  email?: string
  phone?: string
}

function parseCSV(text: string): ParsedContact[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const result: ParsedContact[] = []

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))

    // Try to detect which field is which
    const contact: ParsedContact = {}
    for (const part of parts) {
      if (!part) continue
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
        contact.email = part.toLowerCase()
      } else if (/^[\+\d\s\-\(\)]{7,}$/.test(part)) {
        contact.phone = part
      } else if (part.length > 1) {
        contact.name = contact.name ? `${contact.name} ${part}` : part
      }
    }

    if (contact.email || contact.phone || contact.name) {
      result.push(contact)
    }
  }

  return result
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportContactsDialog({ open, onOpenChange }: Props) {
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState<ParsedContact[]>([])
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')

  const importContacts = useImportContacts()

  const handlePreview = () => {
    setError('')
    const contacts = parseCSV(csvText)
    if (contacts.length === 0) {
      setError('No valid contacts found. Each line should have name, email, or phone.')
      return
    }
    if (contacts.length > 500) {
      setError('Maximum 500 contacts per import.')
      return
    }
    setParsed(contacts)
    setIsPreviewing(true)
  }

  const handleImport = async () => {
    setError('')
    try {
      const res = await importContacts.mutateAsync({ contacts: parsed })
      setResult(res)
      setIsPreviewing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setCsvText('')
    setParsed([])
    setIsPreviewing(false)
    setResult(null)
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <UploadIcon className="size-4" />
            Import Contacts
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircleIcon className="size-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Import Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                Imported {result.imported} contacts{result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}
              </p>
            </div>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        ) : !isPreviewing ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste CSV data — one contact per line. Each line can have name, email, and/or phone separated by commas.
            </p>
            <div className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              John Doe, john@example.com, +1 234 567 8900<br />
              Jane Smith, jane@example.com<br />
              Bob Wilson, +44 20 1234 5678
            </div>
            <Textarea
              placeholder="Paste your CSV data here…"
              className="min-h-[120px] text-sm resize-none font-mono"
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
            />

            {error && (
              <Alert variant="destructive">
                <OctagonXIcon className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handlePreview} disabled={!csvText.trim()}>
                Preview Import
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Preview ({parsed.length} contacts)</p>
              <Badge variant="outline" className="text-[10px]">First 5 shown</Badge>
            </div>

            <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
              {parsed.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    {c.name && <p className="font-medium truncate">{c.name}</p>}
                    {c.email && <p className="text-muted-foreground truncate">{c.email}</p>}
                    {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                  </div>
                </div>
              ))}
              {parsed.length > 5 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  +{parsed.length - 5} more contacts
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <OctagonXIcon className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsPreviewing(false)}>
                Back
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importContacts.isPending}>
                {importContacts.isPending && <Spinner className="mr-1.5 size-3.5" />}
                {importContacts.isPending ? 'Importing…' : `Import ${parsed.length} Contacts`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}