import { Fragment } from 'react'

function inline(text: string, keyPrefix: string) {
  const parts: (string | { bold: string } | { code: string } | { italic: string })[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) parts.push({ bold: token.slice(2, -2) })
    else if (token.startsWith('`')) parts.push({ code: token.slice(1, -1) })
    else parts.push({ italic: token.slice(1, -1) })
    last = m.index + token.length
    i += 1
  }
  if (last < text.length) parts.push(text.slice(last))

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`
    if (typeof part === 'string') return <Fragment key={key}>{part}</Fragment>
    if ('bold' in part) return <strong key={key}>{part.bold}</strong>
    if ('code' in part) return <code key={key} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-primary dark:bg-dark-300">{part.code}</code>
    return <em key={key}>{part.italic}</em>
  })
}

function renderTable(lines: string[], keyPrefix: string) {
  const parseRow = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
  const head = parseRow(lines[0])
  const body = lines.slice(2).filter((l) => l.trim()).map(parseRow)
  return (
    <div key={keyPrefix} className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border border-gray-200 bg-gray-50 px-3 py-2 font-semibold dark:border-dark-300 dark:bg-dark-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {head.map((_, ci) => (
                <td key={ci} className="border border-gray-200 px-3 py-2 align-top dark:border-dark-300">{inline(row[ci] ?? '', `${keyPrefix}-t${ri}c${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AiMarkdown({ content, className = '' }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[][] = []
  let current: string[] = []
  let inCode = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (inCode) {
        current.push(line)
        blocks.push(current)
        current = []
        inCode = false
      } else {
        if (current.length) blocks.push(current)
        current = [line]
        inCode = true
      }
      continue
    }
    if (inCode) {
      current.push(line)
      continue
    }
    if (!trimmed) {
      if (current.length) {
        blocks.push(current)
        current = []
      }
      continue
    }
    current.push(line)
  }
  if (current.length) blocks.push(current)

  let blockIndex = 0
  return (
    <div className={`space-y-3 text-sm leading-relaxed ${className}`}>
      {blocks.map((block) => {
        const blockKey = `b${blockIndex++}`
        const first = block[0]?.trim() ?? ''

        if (first.startsWith('```')) {
          const code = block.slice(1, block[0].trim().startsWith('```') && block.at(-1)?.trim() === '```' ? -1 : block.length).join('\n')
          return (
            <pre key={blockKey} className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100 dark:bg-dark-300">
              <code>{code}</code>
            </pre>
          )
        }

        if (block.length > 2 && block[1].trim().replace(/\s/g, '').match(/^\|?[-:]+(\|[-:]+)*\|?$/)) {
          return renderTable(block, blockKey)
        }

        const joined = block.join('\n')
        const heading = joined.match(/^(#{1,4})\s+(.+)$/m)
        if (heading && block.length === 1) {
          const level = heading[1].length
          const text = heading[2]
          if (level === 1) return <h2 key={blockKey} className="text-lg font-bold">{inline(text, blockKey)}</h2>
          if (level === 2) return <h3 key={blockKey} className="text-base font-bold">{inline(text, blockKey)}</h3>
          return <h4 key={blockKey} className="text-sm font-bold">{inline(text, blockKey)}</h4>
        }

        if (block.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={blockKey} className="list-disc space-y-1 pl-5">
              {block.map((l, i) => (
                <li key={i}>{inline(l.trim().slice(2), `${blockKey}-li${i}`)}</li>
              ))}
            </ul>
          )
        }

        if (block.every((l) => /^\d+[.)]\s/.test(l.trim()))) {
          return (
            <ol key={blockKey} className="list-decimal space-y-1 pl-5">
              {block.map((l, i) => (
                <li key={i}>{inline(l.trim().replace(/^\d+[.)]\s+/, ''), `${blockKey}-ol${i}`)}</li>
              ))}
            </ol>
          )
        }

        if (block.every((l) => l.trim().startsWith('>'))) {
          return (
            <blockquote key={blockKey} className="border-l-4 border-primary/40 pl-4 text-gray-500 dark:text-gray-400">
              {block.map((l, i) => (
                <p key={i}>{inline(l.trim().replace(/^>\s?/, ''), `${blockKey}-q${i}`)}</p>
              ))}
            </blockquote>
          )
        }

        if (first === '---' || first === '***') return <hr key={blockKey} className="border-gray-200 dark:border-dark-300" />

        return (
          <div key={blockKey}>
            {block.map((l, i) => (
              <p key={i}>{inline(l, `${blockKey}-p${i}`)}</p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
