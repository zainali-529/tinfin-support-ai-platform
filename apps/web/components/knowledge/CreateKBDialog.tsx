'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Spinner } from '@workspace/ui/components/spinner'
import { OctagonXIcon, BookOpenIcon, GlobeIcon, FileTextIcon, PencilLineIcon } from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string, sourceType: string) => Promise<void>
}

const SOURCE_TYPES = [
  {
    id: 'mixed',
    label: 'Mixed Sources',
    description: 'URLs, files, and text combined',
    icon: BookOpenIcon,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
  },
  {
    id: 'url',
    label: 'Web URLs',
    description: 'Crawl web pages and articles',
    icon: GlobeIcon,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    id: 'file',
    label: 'Documents',
    description: 'Upload PDFs and Word files',
    icon: FileTextIcon,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    id: 'text',
    label: 'Text Notes',
    description: 'Write content directly',
    icon: PencilLineIcon,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
  },
]

export function CreateKBDialog({ open, onOpenChange, onConfirm }: Props) {
  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState('mixed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(name.trim(), sourceType)
      setName('')
      setSourceType('mixed')
      onOpenChange(false)
    } catch {
      setError('Failed to create knowledge base. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 mb-1">
            <BookOpenIcon className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-base">New Knowledge Base</DialogTitle>
          <DialogDescription className="text-sm">
            Create a knowledge base to power your AI assistant with custom information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="kb-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="kb-name"
              placeholder="e.g. Product Documentation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Primary Source Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSourceType(type.id)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all duration-150',
                    'hover:border-primary/40 hover:shadow-sm',
                    sourceType === type.id
                      ? `${type.border} ${type.bg} ring-1 ring-primary/20`
                      : 'border-border bg-muted/30'
                  )}
                >
                  <div className={cn('flex size-7 items-center justify-center rounded-lg', type.bg)}>
                    <type.icon className={cn('size-3.5', type.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{type.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {type.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <OctagonXIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? <Spinner className="mr-1.5 size-3.5" /> : null}
              {loading ? 'Creating...' : 'Create Knowledge Base'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}