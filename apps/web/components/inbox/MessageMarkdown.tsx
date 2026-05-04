'use client'

import { Fragment, type ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] }
  | { type: 'code'; language: string | null; code: string }

interface MessageMarkdownProps {
  content: string
  className?: string
  compact?: boolean
  inverted?: boolean
}

function normalizeMessageMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])(```[a-zA-Z0-9_-]*\n?)/g, '$1\n$2')
    .replace(/(```)([^\n])/g, '$1\n$2')
    .replace(/([^\n])(\s+\d+\.\s+(?=["'`*A-Z]))/g, '$1\n$2')
    .replace(/:\s+-\s+/g, ':\n- ')
    .trim()
}

function pushParagraph(blocks: MarkdownBlock[], lines: string[]) {
  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  if (text) blocks.push({ type: 'paragraph', text })
  lines.length = 0
}

function parseTextSegment(segment: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = segment.split('\n')
  const paragraphLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? ''
    const line = rawLine.trim()

    if (!line) {
      pushParagraph(blocks, paragraphLines)
      continue
    }

    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(line)
    if (headingMatch) {
      pushParagraph(blocks, paragraphLines)
      blocks.push({
        type: 'heading',
        level: headingMatch[1]!.length === 2 ? 2 : 3,
        text: headingMatch[2]!.trim(),
      })
      continue
    }

    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line)
    if (orderedMatch) {
      pushParagraph(blocks, paragraphLines)
      const items = [orderedMatch[2]!.trim()]
      while (index + 1 < lines.length) {
        const next = (lines[index + 1] ?? '').trim()
        const nextMatch = /^(\d+)\.\s+(.+)$/.exec(next)
        if (!nextMatch) break
        items.push(nextMatch[2]!.trim())
        index += 1
      }
      blocks.push({ type: 'ordered', items })
      continue
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(line)
    if (unorderedMatch) {
      pushParagraph(blocks, paragraphLines)
      const items = [unorderedMatch[1]!.trim()]
      while (index + 1 < lines.length) {
        const next = (lines[index + 1] ?? '').trim()
        const nextMatch = /^[-*]\s+(.+)$/.exec(next)
        if (!nextMatch) break
        items.push(nextMatch[1]!.trim())
        index += 1
      }
      blocks.push({ type: 'unordered', items })
      continue
    }

    paragraphLines.push(line)
  }

  pushParagraph(blocks, paragraphLines)
  return blocks
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const normalized = normalizeMessageMarkdown(content)
  const blocks: MarkdownBlock[] = []
  const fenceRegex = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fenceRegex.exec(normalized))) {
    const before = normalized.slice(lastIndex, match.index)
    blocks.push(...parseTextSegment(before))
    blocks.push({
      type: 'code',
      language: match[1] ?? null,
      code: (match[2] ?? '').trim(),
    })
    lastIndex = match.index + match[0].length
  }

  blocks.push(...parseTextSegment(normalized.slice(lastIndex)))
  return blocks
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${match.index}:${match[0]}`

    if (match[2] && match[3]) {
      nodes.push(
        <a key={key} href={match[3]} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {match[2]}
        </a>
      )
    } else if (match[4]) {
      nodes.push(
        <code key={key} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.92em]">
          {match[4]}
        </code>
      )
    } else if (match[5]) {
      nodes.push(<strong key={key}>{match[5]}</strong>)
    } else if (match[6]) {
      nodes.push(<em key={key}>{match[6]}</em>)
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function MessageMarkdown({
  content,
  className,
  compact = false,
  inverted = false,
}: MessageMarkdownProps) {
  const blocks = parseMarkdown(content)

  return (
    <div
      className={cn(
        'message-markdown max-w-full break-words',
        compact ? 'space-y-1.5' : 'space-y-2',
        inverted && '[&_code]:bg-white/15 [&_pre]:border-white/15 [&_pre]:bg-black/20',
        className
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = block.level === 2 ? 'h2' : 'h3'
          return (
            <Tag key={index} className="text-[1em] font-semibold leading-snug">
              {renderInline(block.text)}
            </Tag>
          )
        }

        if (block.type === 'ordered') {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }

        if (block.type === 'unordered') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'code') {
          return (
            <pre key={index} className="max-w-full overflow-x-auto rounded-lg border bg-background/80 p-3 text-xs leading-relaxed">
              <code>{block.code}</code>
            </pre>
          )
        }

        return (
          <p key={index} className="m-0">
            {renderInline(block.text).map((node, nodeIndex) => (
              <Fragment key={nodeIndex}>{node}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
