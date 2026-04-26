'use client'

import { useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { Badge } from '@workspace/ui/components/badge'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'
import { useCannedResponsesAdmin } from '@/hooks/useCannedResponses'
import type { CannedResponseCategory } from '@/types/database'
import { MessageSquareQuoteIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'

function emptyForm() {
  return {
    title: '',
    category: 'general' as CannedResponseCategory,
    shortcut: '',
    content: '',
    tags: '',
    isActive: true,
  }
}

export function CannedResponsesAdminPage() {
  const { list, create, update, remove } = useCannedResponsesAdmin()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState<string | null>(null)

  const responses = list.data ?? []
  const selected = useMemo(
    () => responses.find((item) => item.id === selectedId) ?? null,
    [responses, selectedId]
  )
  const existingCategories = useMemo(() => {
    const values = new Set<string>()
    for (const item of responses) {
      if (item.category?.trim()) values.add(item.category.trim())
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [responses])

  const handleSelect = (id: string) => {
    const item = responses.find((entry) => entry.id === id)
    if (!item) return

    setSelectedId(item.id)
    setError(null)
    setForm({
      title: item.title,
      category: item.category,
      shortcut: item.shortcut ?? '',
      content: item.content,
      tags: item.tags.join(', '),
      isActive: item.isActive,
    })
  }

  const handleNew = () => {
    setSelectedId(null)
    setError(null)
    setForm(emptyForm())
  }

  const handleSave = async () => {
    setError(null)

    if (!form.title.trim() || !form.content.trim()) {
      setError('Title aur content required hain.')
      return
    }

    const payload = {
      title: form.title.trim(),
      category: form.category,
      shortcut: form.shortcut.trim() || null,
      content: form.content.trim(),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isActive: form.isActive,
    }

    try {
      if (selectedId) {
        await update.mutateAsync({ id: selectedId, ...payload })
      } else {
        const created = await create.mutateAsync(payload)
        setSelectedId(created.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setError(null)
    try {
      await remove.mutateAsync({ id: selectedId })
      handleNew()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <div className="mb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessageSquareQuoteIcon className="size-6 text-primary" />
            Canned Responses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin pre-written replies manage kare, agents slash command se use kar saken.
          </p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <PlusIcon className="size-3.5" />
          New Reply
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="w-[330px] shrink-0 border-r bg-card min-h-0 flex flex-col">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Saved Replies</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {list.isLoading ? 'Loading...' : `${responses.length} items`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {responses.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/40',
                  selectedId === item.id ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-semibold truncate">{item.title}</p>
                  {!item.isActive && <Badge variant="outline" className="h-4 text-[9px]">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] capitalize">{item.category}</Badge>
                  {item.shortcut && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{item.shortcut}</Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.content}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 max-w-3xl">
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Refund Policy Reply"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as CannedResponseCategory }))}
                  list="canned-category-options"
                  placeholder="Billing, Technical, Product, Sales..."
                />
                <datalist id="canned-category-options">
                  {existingCategories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div className="grid gap-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shortcut</label>
                <Input
                  value={form.shortcut}
                  onChange={(e) => setForm((prev) => ({ ...prev, shortcut: e.target.value }))}
                  placeholder="/refund"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reply Content</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="min-h-[180px]"
                placeholder="Write the full canned reply text..."
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags (comma separated)</label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="refund, invoice, payment"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active (agents can use this canned response)
            </label>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={create.isPending || update.isPending} className="gap-1.5">
                {(create.isPending || update.isPending) ? <Spinner className="size-3.5" /> : <SaveIcon className="size-3.5" />}
                Save
              </Button>
              <Button variant="outline" onClick={handleNew}>
                Reset
              </Button>
              {selected && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={remove.isPending}
                  className="gap-1.5 ml-auto"
                >
                  {remove.isPending ? <Spinner className="size-3.5" /> : <Trash2Icon className="size-3.5" />}
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
