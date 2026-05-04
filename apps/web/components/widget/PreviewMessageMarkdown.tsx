'use client'

import { Fragment, type ReactNode } from 'react'

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] }
  | { type: 'code'; code: string }

function normalize(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])(```[a-zA-Z0-9_-]*\n?)/g, '$1\n$2')
    .replace(/(```)([^\n])/g, '$1\n$2')
    .replace(/([^\n])(\s+\d+\.\s+(?=["'`*A-Z]))/g, '$1\n$2')
    .replace(/:\s+-\s+/g, ':\n- ')
    .trim()
}

function parseText(segment: string): Block[] {
  const blocks: Block[] = []
  const paragraph: string[] = []

  const flush = () => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraph.length = 0
  }

  const lines = segment.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim()
    if (!line) {
      flush()
      continue
    }

    const ordered = /^(\d+)\.\s+(.+)$/.exec(line)
    if (ordered) {
      flush()
      const items = [ordered[2]!.trim()]
      while (index + 1 < lines.length) {
        const next = (lines[index + 1] ?? '').trim()
        const match = /^(\d+)\.\s+(.+)$/.exec(next)
        if (!match) break
        items.push(match[2]!.trim())
        index += 1
      }
      blocks.push({ type: 'ordered', items })
      continue
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line)
    if (unordered) {
      flush()
      const items = [unordered[1]!.trim()]
      while (index + 1 < lines.length) {
        const next = (lines[index + 1] ?? '').trim()
        const match = /^[-*]\s+(.+)$/.exec(next)
        if (!match) break
        items.push(match[1]!.trim())
        index += 1
      }
      blocks.push({ type: 'unordered', items })
      continue
    }

    paragraph.push(line.replace(/^#{1,3}\s+/, ''))
  }

  flush()
  return blocks
}

function parse(content: string): Block[] {
  const normalized = normalize(content)
  const blocks: Block[] = []
  const fence = /```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fence.exec(normalized))) {
    blocks.push(...parseText(normalized.slice(lastIndex, match.index)))
    blocks.push({ type: 'code', code: (match[1] ?? '').trim() })
    lastIndex = match.index + match[0].length
  }

  blocks.push(...parseText(normalized.slice(lastIndex)))
  return blocks
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const token = /(`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = token.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${match.index}:${match[0]}`
    if (match[2]) nodes.push(<code key={key}>{match[2]}</code>)
    else if (match[3]) nodes.push(<strong key={key}>{match[3]}</strong>)
    else if (match[4]) nodes.push(<em key={key}>{match[4]}</em>)
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function PreviewMessageMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-1.5">
      {parse(content).map((block, index) => {
        if (block.type === 'ordered') {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === 'unordered') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'code') {
          return (
            <pre key={index} className="overflow-x-auto rounded-md border bg-black/5 p-2 font-mono text-[10px]">
              <code>{block.code}</code>
            </pre>
          )
        }
        return (
          <p key={index} className="m-0">
            {inline(block.text).map((node, nodeIndex) => (
              <Fragment key={nodeIndex}>{node}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
