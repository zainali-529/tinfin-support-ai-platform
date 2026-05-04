'use client'

import { useState, useCallback, type KeyboardEvent } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Separator } from '@workspace/ui/components/separator'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
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
  BookOpenIcon, PlusIcon, SearchIcon, GlobeIcon, FileTextIcon,
  PencilLineIcon, MoreHorizontalIcon, Trash2Icon, ZapIcon,
  LayersIcon, ClockIcon, CheckCircleIcon, ChevronRightIcon,
  InboxIcon, SparklesIcon, RefreshCwIcon, DatabaseIcon,
} from 'lucide-react'
import {
  useDeleteKBSource,
  useKnowledgeBases,
  useKBSources,
  useReindexKBSource,
  type KnowledgeBase,
  type KBSource,
} from '@/hooks/useKnowledgeBases'
import { CreateKBDialog } from './CreateKBDialog'
import { AddSourceDialog } from './AddSourceDialog'

// Source type helpers

const SOURCE_ICONS = {
  url: GlobeIcon,
  file: FileTextIcon,
  text: PencilLineIcon,
}

const SOURCE_COLORS = {
  url: 'text-blue-500',
  file: 'text-emerald-500',
  text: 'text-amber-500',
}

const SOURCE_BACKGROUNDS = {
  url: 'bg-blue-50 dark:bg-blue-900/20',
  file: 'bg-emerald-50 dark:bg-emerald-900/20',
  text: 'bg-amber-50 dark:bg-amber-900/20',
}

const KB_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  mixed:   { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', label: 'Mixed' },
  url:     { color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30',     label: 'Web' },
  file:    { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Docs' },
  text:    { color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30',   label: 'Notes' },
}

const STATUS_CONFIG: Record<KBSource['status'], { label: string; className: string }> = {
  indexed: {
    label: 'Indexed',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  indexing: {
    label: 'Indexing',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  failed: {
    label: 'Failed',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  stale: {
    label: 'Stale',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
}

const WARNING_LABELS: Record<string, string> = {
  duplicate_source: 'Duplicate',
  ingestion_failed: 'Failed',
  low_chunk_count: 'Low coverage',
  no_chunks: 'No chunks',
  short_source: 'Short source',
  missing_page_title: 'Missing title',
}

function sourceHealthSummary(source: KBSource): string {
  if (source.status === 'failed') return source.error_message ?? 'Indexing failed.'
  if (source.warning_codes.includes('duplicate_source')) return 'Duplicate source detected.'
  if (source.warning_codes.includes('low_chunk_count')) return 'Only one chunk was indexed. Add more detail for better AI answers.'
  if (source.warning_codes.includes('short_source')) return 'This source is very short. AI may need more context.'
  if (source.warning_codes.includes('no_chunks')) return 'No searchable chunks were created.'
  if (source.status === 'stale') return 'This source should be refreshed.'
  return 'Healthy source.'
}

// Empty states

function EmptyKBList({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="relative">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpenIcon className="size-8 text-primary opacity-60" />
        </div>
        <div className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <PlusIcon className="size-3.5" />
        </div>
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-semibold">No knowledge bases yet</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Create your first knowledge base to start powering your AI with custom information.
        </p>
      </div>
      <Button size="sm" onClick={onNew} className="gap-1.5">
        <PlusIcon className="size-3.5" />
        New Knowledge Base
      </Button>
    </div>
  )
}

function EmptySourceList({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <DatabaseIcon className="size-6 text-muted-foreground opacity-40" />
      </div>
      <div>
        <p className="text-sm font-medium">No sources added yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          Add URLs, documents, or text notes to populate this knowledge base.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5 mt-1">
        <PlusIcon className="size-3.5" />
        Add First Source
      </Button>
    </div>
  )
}

function EmptySelectState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
        <LayersIcon className="size-8 text-muted-foreground opacity-40" />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-semibold">Select a knowledge base</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Choose a knowledge base from the left panel to view and manage its sources.
        </p>
      </div>
    </div>
  )
}

// Source row

function SourceRow({
  source,
  deleting,
  reindexing,
  onDelete,
  onReindex,
}: {
  source: KBSource
  deleting?: boolean
  reindexing?: boolean
  onDelete: () => void
  onReindex: () => void
}) {
  const Icon = SOURCE_ICONS[source.type]
  const color = SOURCE_COLORS[source.type]
  const bg = SOURCE_BACKGROUNDS[source.type]
  const displayName = source.source_title ?? source.source_url ?? 'Untitled'
  const isUrl = source.type === 'url'
  const status = STATUS_CONFIG[source.status] ?? STATUS_CONFIG.indexed
  const warningLabels = source.warning_codes.map((code) => WARNING_LABELS[code] ?? code)
  const lastIndexed = source.last_indexed_at ?? source.updated_at ?? source.created_at
  const canReindex =
    source.source_type === 'url' ||
    (source.source_type === 'text_note' && typeof source.metadata?.rawText === 'string')

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-muted/40">
      <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', bg)}>
        <Icon className={cn('size-3.5', color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs font-medium text-foreground leading-snug">{displayName}</p>
          <Badge variant="outline" className={cn('h-4 shrink-0 px-1.5 text-[9px] font-semibold uppercase tracking-wide', status.className)}>
            {status.label}
          </Badge>
        </div>
        {isUrl && source.source_url && (
          <p className="truncate text-[10px] text-muted-foreground font-mono mt-0.5">{source.source_url}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <ClockIcon className="size-2.5" />
            Indexed {formatDistanceToNow(new Date(lastIndexed), { addSuffix: true })}
          </span>
          <span className="text-muted-foreground/30">-</span>
          <span className="text-[10px] text-muted-foreground/70">{source.chunk_count} chunks</span>
          {source.quality_score !== null && (
            <>
          <span className="text-muted-foreground/30">-</span>
              <span className="text-[10px] text-muted-foreground/70">Quality {source.quality_score}%</span>
            </>
          )}
        </div>
        {(warningLabels.length > 0 || source.status !== 'indexed') && (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] leading-relaxed text-muted-foreground">{sourceHealthSummary(source)}</p>
            {warningLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {warningLabels.map((label) => (
                  <Badge key={label} variant="outline" className="h-4 border-amber-500/20 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Badge variant="outline" className={cn('mt-0.5 h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide shrink-0', color)}>
        {source.type}
      </Badge>
      {canReindex && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={reindexing || source.status === 'indexing'}
          title={source.source_type === 'url' ? 'Re-index / recrawl source' : 'Re-index source'}
          onClick={onReindex}
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
        >
          <RefreshCwIcon className={cn('size-3.5', reindexing && 'animate-spin')} />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={deleting || reindexing}
        title="Delete source"
        onClick={onDelete}
        className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  )
}

// KB card

function KBCard({
  kb, isSelected, onClick, onDelete,
}: {
  kb: KnowledgeBase
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const typeKey = kb.source_type ?? 'mixed'
  const config = KB_TYPE_CONFIG[typeKey] ?? KB_TYPE_CONFIG.mixed!
  const initials = kb.name.slice(0, 2).toUpperCase()
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-100',
        'hover:bg-muted/60 active:scale-[0.99]',
        isSelected
          ? 'bg-primary/8 ring-1 ring-primary/15'
          : 'bg-transparent'
      )}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className={cn('text-xs font-bold', config.bg, config.color)}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('truncate text-xs font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
            {kb.name}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {format(new Date(kb.created_at), 'MMM d, yyyy')}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Badge className={cn('h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide border-0', config.bg, config.color)}>
          {config.label}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground">
              <MoreHorizontalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="gap-2"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChevronRightIcon className={cn(
          'size-3 text-muted-foreground/50 transition-transform',
          isSelected && 'rotate-90'
        )} />
      </div>
    </div>
  )
}

// KB detail panel

function KBDetailPanel({
  kb, orgId, onAddSource,
}: {
  kb: KnowledgeBase
  orgId: string
  onAddSource: () => void
}) {
  const { sources, chunkCount, loading, refetch } = useKBSources(kb.id, orgId)
  const deleteSource = useDeleteKBSource()
  const reindexSource = useReindexKBSource()
  const [search, setSearch] = useState('')
  const [sourceToDelete, setSourceToDelete] = useState<KBSource | null>(null)

  const filtered = sources.filter(s => {
    const q = search.toLowerCase()
    return (
      s.source_title?.toLowerCase().includes(q) ||
      s.source_url?.toLowerCase().includes(q)
    )
  })

  const urlCount = sources.filter(s => s.type === 'url').length
  const fileCount = sources.filter(s => s.type === 'file').length
  const textCount = sources.filter(s => s.type === 'text').length
  const attentionCount = sources.filter(s => s.status !== 'indexed' || s.warning_codes.length > 0).length
  const sourceDeleteName =
    sourceToDelete?.source_title ?? sourceToDelete?.source_url ?? 'this source'

  const handleDeleteSource = async () => {
    if (!sourceToDelete) return

    await deleteSource.mutateAsync({
      sourceId: sourceToDelete.id,
    })
    setSourceToDelete(null)
    await refetch()
  }

  const handleReindexSource = async (source: KBSource) => {
    await reindexSource.mutateAsync({ sourceId: source.id })
    await refetch()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b bg-card/50 px-6 py-4 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold truncate">{kb.name}</h2>
            {(() => {
              const typeKey = kb.source_type ?? 'mixed'
              const config = KB_TYPE_CONFIG[typeKey] ?? KB_TYPE_CONFIG.mixed!
              return (
                <Badge className={cn('h-4 px-1.5 text-[9px] border-0 font-semibold uppercase tracking-wide', config.bg, config.color)}>
                  {config.label}
                </Badge>
              )
            })()}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Created {format(new Date(kb.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={refetch} className="h-7 px-2 gap-1">
            <RefreshCwIcon className="size-3" />
          </Button>
          <Button size="sm" onClick={onAddSource} className="h-7 gap-1.5 text-xs">
            <PlusIcon className="size-3.5" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 border-b bg-muted/20 shrink-0">
        {[
          { label: 'Total Chunks', value: loading ? '-' : chunkCount.toString(), icon: LayersIcon, color: 'text-primary' },
          { label: 'URLs', value: loading ? '-' : urlCount.toString(), icon: GlobeIcon, color: 'text-blue-500' },
          { label: 'Notes & Docs', value: loading ? '-' : (fileCount + textCount).toString(), icon: FileTextIcon, color: 'text-emerald-500' },
          { label: 'Need Review', value: loading ? '-' : attentionCount.toString(), icon: PencilLineIcon, color: attentionCount > 0 ? 'text-amber-500' : 'text-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className={cn('flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-center', i < 3 && 'border-r')}>
            <stat.icon className={cn('size-3.5 mb-0.5', stat.color)} />
            <span className="text-sm font-bold tabular-nums">{stat.value}</span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      {sources.length > 0 && (
        <div className="border-b px-4 py-2.5 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search sources..."
              className="h-7 pl-8 text-xs border-0 bg-muted/50 shadow-none focus-visible:ring-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Sources List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {reindexSource.isError && (
            <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {reindexSource.error?.message ?? 'Failed to re-index source.'}
            </div>
          )}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                  <Skeleton className="size-7 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            sources.length === 0 ? (
              <EmptySourceList onAdd={onAddSource} />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <SearchIcon className="size-6 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">No sources match your search</p>
              </div>
            )
          ) : (
            <div className="space-y-0.5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {filtered.length} source{filtered.length !== 1 ? 's' : ''}
              </p>
              {filtered.map((source, i) => (
                <SourceRow
                  key={source.id ?? `${source.type}:${source.source_url ?? source.source_title ?? i}`}
                  source={source}
                  deleting={deleteSource.isPending}
                  reindexing={reindexSource.isPending && reindexSource.variables?.sourceId === source.id}
                  onDelete={() => {
                    deleteSource.reset()
                    setSourceToDelete(source)
                  }}
                  onReindex={() => {
                    reindexSource.reset()
                    void handleReindexSource(source)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* KB AI Tip Banner */}
      {chunkCount > 0 && (
        <div className="border-t bg-gradient-to-r from-primary/5 via-transparent to-transparent px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <SparklesIcon className="size-3.5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{chunkCount} chunks</span> indexed and ready for AI-powered responses
            </p>
          </div>
        </div>
      )}

      <AlertDialog open={!!sourceToDelete} onOpenChange={(open) => !open && setSourceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Source</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{sourceDeleteName}</strong> and remove all indexed chunks from this knowledge base.
            </AlertDialogDescription>
            {deleteSource.isError && (
              <p className="text-xs font-medium text-destructive">
                {deleteSource.error?.message ?? 'Failed to delete source.'}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSource.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSource()
              }}
              disabled={deleteSource.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSource.isPending ? 'Deleting...' : 'Delete Source'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Main component

interface Props {
  orgId: string
}

export function KnowledgeBasePage({ orgId }: Props) {
  const { kbs, isLoading, createKB, deleteKB, ingestUrl, ingestFile, ingestText } = useKnowledgeBases(orgId)
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourcesKey, setSourcesKey] = useState(0) // forces KBDetail remount on source add

  const selectedKB = kbs.find(kb => kb.id === selectedKBId) ?? null

  const filteredKBs = kbs.filter(kb =>
    kb.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateKB = async (name: string, sourceType: string) => {
    const result = await createKB.mutateAsync({ orgId, name, sourceType })
    if (result?.id) setSelectedKBId(result.id)
  }

  const handleDeleteKB = async () => {
    if (!deleteConfirmId) return
    await deleteKB.mutateAsync({ id: deleteConfirmId })
    if (selectedKBId === deleteConfirmId) setSelectedKBId(null)
    setDeleteConfirmId(null)
  }

  const handleSourceSuccess = useCallback(() => {
    setSourcesKey(k => k + 1)
  }, [])

  return (
    <div className="flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] min-h-0 flex-1 flex-col gap-0 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpenIcon className="size-5 text-primary" />
            Knowledge Base
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage knowledge sources that power your AI assistant
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="gap-1.5 shrink-0">
          <PlusIcon className="size-3.5" />
          New Knowledge Base
        </Button>
      </div>

      {/* Main Layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
        {/* Left: KB List */}
        <div className="w-[280px] xl:w-[320px] shrink-0 min-h-0 border-r flex flex-col overflow-hidden bg-card">
          {/* List Header */}
          <div className="flex items-center justify-between border-b px-4 py-3.5 shrink-0">
            <div>
              <h2 className="text-xs font-semibold">Your Knowledge Bases</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isLoading ? '...' : `${kbs.length} base${kbs.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => setCreateDialogOpen(true)}>
              <PlusIcon className="size-3.5" />
            </Button>
          </div>

          {/* Search */}
          {kbs.length > 3 && (
            <div className="border-b px-3 py-2 shrink-0">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search..."
                  className="h-7 pl-7 text-xs border-0 bg-muted/50 shadow-none focus-visible:ring-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* KB List */}
          <ScrollArea className="min-h-0 flex-1">
            {isLoading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                    <Skeleton className="size-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredKBs.length === 0 ? (
              <EmptyKBList onNew={() => setCreateDialogOpen(true)} />
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredKBs.map(kb => (
                  <KBCard
                    key={kb.id}
                    kb={kb}
                    isSelected={kb.id === selectedKBId}
                    onClick={() => setSelectedKBId(kb.id)}
                    onDelete={() => setDeleteConfirmId(kb.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {kbs.length > 0 && (
            <div className="border-t px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircleIcon className="size-3 text-emerald-500" />
                All knowledge bases active
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {selectedKB ? (
            <KBDetailPanel
              key={`${selectedKB.id}-${sourcesKey}`}
              kb={selectedKB}
              orgId={orgId}
              onAddSource={() => setAddSourceDialogOpen(true)}
            />
          ) : (
            <EmptySelectState />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateKBDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onConfirm={handleCreateKB}
      />

      {selectedKB && (
        <AddSourceDialog
          key={selectedKB.id}
          open={addSourceDialogOpen}
          onOpenChange={setAddSourceDialogOpen}
          kbId={selectedKB.id}
          orgId={orgId}
          kbName={selectedKB.name}
          onIngestUrl={async (params) => {
            const result = await ingestUrl.mutateAsync(params)
            return { chunksStored: result?.chunksStored ?? 0 }
          }}
          onIngestFile={async (params) => {
            const result = await ingestFile.mutateAsync(params)
            return { chunksStored: result?.chunksStored ?? 0 }
          }}
          onIngestText={async (params) => {
            const result = await ingestText.mutateAsync(params)
            return {
              chunksStored: result?.chunksStored ?? 0,
              success: result?.success ?? true,
              error: result?.error,
            }
          }}
          onSuccess={handleSourceSuccess}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Base</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this knowledge base and all its indexed content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKB} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
