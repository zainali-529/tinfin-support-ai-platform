import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardList, Info, ListChecks } from 'lucide-react'

import type { DocsBlock, DocsPage } from '@/lib/docs'
import { getDocsHref, getDocsPreviousNext } from '@/lib/docs'
import { cn } from '@workspace/ui/lib/utils'
import { DocsScreenshot } from './DocsScreenshot'

function getHeadings(blocks: DocsBlock[]) {
  return blocks.filter((block): block is Extract<DocsBlock, { type: 'heading' }> => block.type === 'heading')
}

function CalloutIcon({ tone }: { tone?: 'info' | 'success' | 'warning' }) {
  if (tone === 'success') return <CheckCircle2 className="size-4" />
  if (tone === 'warning') return <AlertTriangle className="size-4" />
  return <Info className="size-4" />
}

function DocsBlockView({ block }: { block: DocsBlock }) {
  if (block.type === 'paragraph') {
    return <p className="text-[15px] leading-7 text-muted-foreground">{block.text}</p>
  }

  if (block.type === 'heading') {
    return (
      <h2 id={block.id} className="scroll-m-24 pt-6 text-2xl font-semibold tracking-tight text-foreground">
        {block.title}
      </h2>
    )
  }

  if (block.type === 'list') {
    return (
      <div className="border-l border-border pl-5">
        {block.title ? <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3> : null}
        <ul className="space-y-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
              <span className="mt-2.5 size-1 shrink-0 rounded-full bg-foreground/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'steps') {
    return (
      <div className="py-1">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="size-4" />
          {block.title ?? 'Steps'}
        </div>
        <ol className="space-y-4 border-l border-border">
          {block.items.map((item, index) => (
            <li key={item} className="grid grid-cols-[34px_1fr] gap-3 text-sm leading-6 text-muted-foreground">
              <span className="-ml-[14px] flex size-7 items-center justify-center rounded-full border bg-background text-xs font-semibold text-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (block.type === 'callout') {
    return (
      <div
        className={cn(
          'border-l-2 py-1 pl-4 text-sm leading-6',
          block.tone === 'success' && 'border-emerald-500 text-emerald-950 dark:text-emerald-100',
          block.tone === 'warning' && 'border-amber-500 text-amber-950 dark:text-amber-100',
          (!block.tone || block.tone === 'info') && 'border-sky-500 text-sky-950 dark:text-sky-100'
        )}
      >
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <CalloutIcon tone={block.tone} />
          {block.title}
        </div>
        <p className="text-current/80">{block.body}</p>
      </div>
    )
  }

  if (block.type === 'code') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-zinc-950 text-zinc-50">
        <div className="border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-zinc-400">{block.language}</div>
        <pre className="overflow-x-auto p-4 text-sm leading-6">
          <code>{block.code}</code>
        </pre>
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                {block.headers.map((header) => (
                  <th key={header} className="border-b px-4 py-3 font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('-')} className="border-b last:border-b-0">
                  {row.map((cell) => (
                    <td key={cell} className="px-4 py-3 align-top text-muted-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (block.type === 'screenshot') {
    return (
      <DocsScreenshot
        title={block.title}
        description={block.description}
        src={block.suggestedPath}
      />
    )
  }

  return null
}

export function DocsArticle({ page }: { page: DocsPage }) {
  const headings = getHeadings(page.blocks)
  const { previous, next } = getDocsPreviousNext(page.slug)

  return (
    <div className="grid min-w-0 grid-cols-1 gap-10 xl:grid-cols-[minmax(0,820px)_220px]">
      <article className="min-w-0 pb-20">
        <div className="border-b pb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full border bg-muted/30 px-2.5 py-1">{page.section}</span>
            <span>{page.readingTime}</span>
            <span>Updated {page.updatedAt}</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{page.description}</p>
        </div>

        <div className="mt-8 space-y-6">
          {page.blocks.map((block, index) => (
            <DocsBlockView key={`${block.type}-${index}`} block={block} />
          ))}
        </div>

        <div className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
          {previous ? (
            <Link href={getDocsHref(previous.slug)} className="rounded-2xl border p-4 transition-colors hover:bg-muted/40">
              <div className="text-xs text-muted-foreground">Previous</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{previous.title}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link href={getDocsHref(next.slug)} className="rounded-2xl border p-4 text-right transition-colors hover:bg-muted/40">
              <div className="text-xs text-muted-foreground">Next</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{next.title}</div>
            </Link>
          ) : null}
        </div>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-24 rounded-2xl border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ClipboardList className="size-3.5" />
            On this page
          </div>
          {headings.length > 0 ? (
            <nav className="space-y-2">
              {headings.map((heading) => (
                <a key={heading.id} href={`#${heading.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {heading.title}
                </a>
              ))}
            </nav>
          ) : (
            <p className="text-sm text-muted-foreground">No section headings on this page.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
