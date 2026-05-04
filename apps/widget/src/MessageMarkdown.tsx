import { Fragment, type ReactNode } from 'react'

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
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

function parseText(segment: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const paragraph: string[] = []

  const flush = () => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraph.length = 0
  }

  const lines = segment.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? ''
    const line = rawLine.trim()

    if (!line) {
      flush()
      continue
    }

    const heading = /^#{1,3}\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', text: heading[1]!.trim() })
      continue
    }

    const ordered = /^(\d+)\.\s+(.+)$/.exec(line)
    if (ordered) {
      flush()
      const items = [ordered[2]!.trim()]
      while (index + 1 < lines.length) {
        let nextIndex = index + 1
        while (nextIndex < lines.length && !(lines[nextIndex] ?? '').trim()) {
          nextIndex += 1
        }
        const next = (lines[nextIndex] ?? '').trim()
        const match = /^(\d+)\.\s+(.+)$/.exec(next)
        if (!match) break
        items.push(match[2]!.trim())
        index = nextIndex
      }
      blocks.push({ type: 'ordered', items })
      continue
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line)
    if (unordered) {
      flush()
      const items = [unordered[1]!.trim()]
      while (index + 1 < lines.length) {
        let nextIndex = index + 1
        while (nextIndex < lines.length && !(lines[nextIndex] ?? '').trim()) {
          nextIndex += 1
        }
        const next = (lines[nextIndex] ?? '').trim()
        const match = /^[-*]\s+(.+)$/.exec(next)
        if (!match) break
        items.push(match[1]!.trim())
        index = nextIndex
      }
      blocks.push({ type: 'unordered', items })
      continue
    }

    paragraph.push(line)
  }

  flush()
  return blocks
}

function parse(content: string): MarkdownBlock[] {
  const normalized = normalize(content)
  const blocks: MarkdownBlock[] = []
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
  const token = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = token.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${match.index}:${match[0]}`

    if (match[2] && match[3]) {
      nodes.push(
        <a key={key} href={match[3]} target="_blank" rel="noreferrer">
          {match[2]}
        </a>
      )
    } else if (match[4]) {
      nodes.push(<code key={key}>{match[4]}</code>)
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

export function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="md-message">
      {parse(content).map((block, index) => {
        if (block.type === 'heading') {
          return <h4 key={index}>{inline(block.text)}</h4>
        }
        if (block.type === 'ordered') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === 'unordered') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'code') {
          return (
            <pre key={index}>
              <code>{block.code}</code>
            </pre>
          )
        }
        return (
          <p key={index}>
            {inline(block.text).map((node, nodeIndex) => (
              <Fragment key={nodeIndex}>{node}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
