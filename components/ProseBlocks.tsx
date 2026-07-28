/**
 * components/ProseBlocks.tsx
 *
 * Renders parsed chapter blocks (lib/parseBook.ts) as React elements — no HTML
 * strings, so there is nothing to sanitize.
 *
 * Shared by the reader and by the admin chapter editor's live preview, so what
 * an author sees while writing is what a reader gets.
 */

import { Fragment, type ReactNode } from 'react'
import type { ChapterBlock, InlineRun } from '@/lib/parseBook'

function renderRuns(runs: InlineRun[]) {
  return runs.map((run, i) => {
    let node: ReactNode = run.text
    if (run.strong) node = <strong>{node}</strong>
    if (run.em) node = <em>{node}</em>
    return <Fragment key={i}>{node}</Fragment>
  })
}

// Hard-break-preserving lines for blockquote/verse; an empty line is a
// stanza/paragraph gap.
function renderLines(lines: InlineRun[][]) {
  return lines.map((line, i) =>
    line.length === 0 ? (
      <span key={i} className="line-gap" aria-hidden="true" />
    ) : (
      <span key={i} className="line">
        {renderRuns(line)}
      </span>
    )
  )
}

// The chapter-opening paragraph gets a span-based drop cap. A plain
// ::first-letter rule scooped up opening dialogue quotes ("G…) and rendered
// them at display size — so the cap only applies when the chapter opens with
// an unformatted letter, and falls back to a normal paragraph otherwise.
function OpeningParagraph({ runs }: { runs: InlineRun[] }) {
  const first = runs[0]
  const chars = first ? Array.from(first.text) : []
  if (!first || first.em || first.strong || !/^\p{L}$/u.test(chars[0] ?? '')) {
    return <p>{renderRuns(runs)}</p>
  }
  const rest: InlineRun[] = [{ ...first, text: chars.slice(1).join('') }, ...runs.slice(1)]
  return (
    <p>
      <span className="drop-cap">{chars[0]}</span>
      {renderRuns(rest)}
    </p>
  )
}

export function ProseBlocks({ blocks }: { blocks: ChapterBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'scene-break':
            return <div key={i} className="scene-break" aria-hidden="true">✦</div>
          case 'blockquote':
            return <blockquote key={i}>{renderLines(block.lines)}</blockquote>
          case 'verse':
            return <div key={i} className="verse">{renderLines(block.lines)}</div>
          case 'paragraph':
            return i === 0 ? (
              <OpeningParagraph key={i} runs={block.runs} />
            ) : (
              <p key={i}>{renderRuns(block.runs)}</p>
            )
        }
      })}
    </>
  )
}

export default ProseBlocks
