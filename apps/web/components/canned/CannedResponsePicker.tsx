'use client'

import { Badge } from '@workspace/ui/components/badge'
import { SlashIcon } from 'lucide-react'
import type { CannedResponse } from '@/types/database'

interface Props {
  open: boolean
  query: string
  loading: boolean
  responses: CannedResponse[]
  onSelect: (response: CannedResponse) => void
}

export function CannedResponsePicker({ open, query, loading, responses, onSelect }: Props) {
  if (!open) return null

  return (
    <div className="absolute inset-x-3 bottom-full mb-1.5 z-20 rounded-lg border bg-background p-2 shadow-md">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <SlashIcon className="size-3" />
        Canned Replies
        {query && <span className="font-mono text-[10px] text-foreground">/{query}</span>}
      </div>

      <div className="max-h-52 overflow-y-auto space-y-1">
        {loading ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">Loading...</p>
        ) : responses.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">No replies found.</p>
        ) : (
          responses.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-md border px-2 py-1.5 text-left hover:bg-muted/40"
            >
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[11px] font-semibold">{item.title}</p>
                <Badge variant="outline" className="h-4 px-1 text-[9px] capitalize">{item.category}</Badge>
                {item.shortcut && <Badge variant="outline" className="h-4 px-1 text-[9px]">{item.shortcut}</Badge>}
              </div>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{item.content}</p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
