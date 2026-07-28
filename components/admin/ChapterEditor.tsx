'use client'

/**
 * components/admin/ChapterEditor.tsx
 *
 * The right-hand pane of the admin book workspace: edits one chapter in place
 * via PATCH /api/books/[id]/chapters/[chapterId].
 *
 * Owns its own draft state and is mounted with `key={chapter.id}`, so switching
 * chapters in the rail resets the draft. The parent watches `onDirtyChange` to
 * guard against navigating away from unsaved edits.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseChapterBlocks, countWords } from '@/lib/parseBook'
import { clipboardToBookMarkup } from '@/lib/richPaste'
import ProseBlocks from '@/components/ProseBlocks'

export type EditableChapter = {
  id: string
  title: string
  order: number
  content: string
  wordCount: number
}

type Props = {
  bookId: string
  chapter: EditableChapter
  onSaved: (chapter: EditableChapter) => void
  onDirtyChange: (dirty: boolean) => void
}

type View = 'write' | 'split' | 'preview'

// ─── Textarea editing primitives ─────────────────────────────────────────────

/**
 * Writes a value React's controlled textarea will notice. Used only as the
 * fallback when execCommand is unavailable — React overrides the value setter
 * on the element, so the prototype's setter has to be called directly for the
 * synthetic change event to fire.
 */
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Replaces [start, end) with `text` and leaves the selection at `select`.
 *
 * Prefers execCommand('insertText') despite its deprecation: it is still the
 * only way to edit a textarea without destroying the browser's native undo
 * stack, and an author who loses Ctrl+Z on a chapter of prose loses real work.
 */
function spliceText(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  select: [number, number]
) {
  el.focus()
  el.setSelectionRange(start, end)

  let inserted = false
  try {
    inserted = document.execCommand('insertText', false, text)
  } catch {
    inserted = false
  }
  if (!inserted) {
    setNativeValue(el, el.value.slice(0, start) + text + el.value.slice(end))
  }

  // The value round-trips through React state, so restore the caret after the
  // re-render rather than immediately.
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(select[0], select[1])
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChapterEditor({ bookId, chapter, onSaved, onDirtyChange }: Props) {
  const [title, setTitle] = useState(chapter.title)
  const [content, setContent] = useState(chapter.content)
  const [view, setView] = useState<View>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const dirty = title !== chapter.title || content !== chapter.content

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Transient "formatting converted" confirmation after a rich paste.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const blocks = useMemo(() => parseChapterBlocks(content), [content])
  const words = useMemo(() => countWords(content), [content])

  // ─── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!dirty || saving) return
    if (!title.trim()) {
      setError('Chapter title cannot be empty.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save chapter')
      }
      const updated = await res.json()
      onSaved({
        id: updated.id,
        title: updated.title,
        order: updated.order,
        content: updated.content,
        wordCount: updated.wordCount,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [bookId, chapter.id, content, dirty, onSaved, saving, title])

  // Ctrl/Cmd+S saves — the muscle memory every writing tool trains.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [save])

  // ─── Toolbar actions ───────────────────────────────────────────────────────

  const wrapSelection = useCallback((marker: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.slice(start, end)

    if (!selected) {
      spliceText(el, start, end, marker + marker, [start + marker.length, start + marker.length])
      return
    }

    // Already wrapped → unwrap, so the button toggles.
    if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length > marker.length * 2
    ) {
      const inner = selected.slice(marker.length, -marker.length)
      spliceText(el, start, end, inner, [start, start + inner.length])
      return
    }

    // Keep whitespace outside the markers — parseInline needs a non-space
    // character on the inside of both or the emphasis never closes.
    const lead = selected.match(/^\s*/)![0]
    const tail = selected.match(/\s*$/)![0]
    const core = selected.slice(lead.length, selected.length - tail.length)
    if (!core) return

    const next = `${lead}${marker}${core}${marker}${tail}`
    const coreStart = start + lead.length + marker.length
    spliceText(el, start, end, next, [coreStart, coreStart + core.length])
  }, [])

  const toggleLinePrefix = useCallback((marker: '>' | '|') => {
    const el = textareaRef.current
    if (!el) return
    const value = el.value

    // Grow the selection out to whole lines — these markers are line-scoped.
    const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    let lineEnd = value.indexOf('\n', el.selectionEnd)
    if (lineEnd === -1) lineEnd = value.length

    const lines = value.slice(lineStart, lineEnd).split('\n')
    const meaningful = lines.filter(l => l.trim())
    if (meaningful.length === 0) return

    const escaped = marker === '|' ? '\\|' : '>'
    const allPrefixed = meaningful.every(l => l.trimStart().startsWith(marker))
    const strip = new RegExp(`^(\\s*)${escaped}\\s?`)

    const next = lines
      .map(l => {
        if (!l.trim()) return l
        return allPrefixed ? l.replace(strip, '$1') : `${marker} ${l}`
      })
      .join('\n')

    spliceText(el, lineStart, lineEnd, next, [lineStart, lineStart + next.length])
  }, [])

  const insertSceneBreak = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = el.value.slice(0, start)
    const lead = before && !before.endsWith('\n') ? '\n' : ''
    const text = `${lead}---\n`
    spliceText(el, start, end, text, [start + text.length, start + text.length])
  }, [])

  // ─── Rich paste ────────────────────────────────────────────────────────────

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current
    if (!el || !e.clipboardData) return

    // Headings are disallowed here: a stray `## Chapter N` line inside a single
    // chapter body would silently split it in two on the next full-text save.
    const { text, fromHtml } = clipboardToBookMarkup(e.clipboardData, { allowHeadings: false })
    if (!text) return

    e.preventDefault()
    const start = el.selectionStart
    const end = el.selectionEnd
    spliceText(el, start, end, text, [start + text.length, start + text.length])
    if (fromHtml) setNotice('Pasted formatting converted to italics, bold and quotes.')
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  const tools: { label: string; title: string; onClick: () => void }[] = [
    { label: 'B', title: 'Bold  **text**', onClick: () => wrapSelection('**') },
    { label: 'I', title: 'Italic  *text*', onClick: () => wrapSelection('*') },
    { label: '❝', title: 'Quote block  > line', onClick: () => toggleLinePrefix('>') },
    { label: '⋮', title: 'Verse  | line', onClick: () => toggleLinePrefix('|') },
    { label: '✦', title: 'Scene break  ---', onClick: insertSceneBreak },
  ]

  return (
    <section className="admin-editor">
      {/* Chapter title + save */}
      <div className="admin-editor__head">
        <span className="admin-editor__order">
          {String(chapter.order).padStart(2, '0')}
        </span>
        <input
          className="admin-editor__title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Chapter title"
          aria-label="Chapter title"
        />
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : dirty ? 'Save chapter' : 'Saved'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="admin-editor__toolbar">
        <div className="admin-editor__tools">
          {tools.map(tool => (
            <button
              key={tool.label}
              type="button"
              className="admin-tool"
              title={tool.title}
              aria-label={tool.title}
              onClick={tool.onClick}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="admin-editor__views">
          {(['write', 'split', 'preview'] as View[]).map(v => (
            <button
              key={v}
              type="button"
              className={`admin-tool admin-tool--wide${view === v ? ' admin-tool--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="admin-editor__error">{error}</p>}
      {notice && <p className="admin-editor__notice">{notice}</p>}

      {/* Body */}
      <div className={`admin-editor__body admin-editor__body--${view}`}>
        {view !== 'preview' && (
          <textarea
            ref={textareaRef}
            className="admin-editor__textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            onPaste={handlePaste}
            spellCheck
            placeholder={
              'Write or paste this chapter’s prose.\n\n' +
              'Pasting from Word or Google Docs keeps bold and italics.\n\n' +
              '*italic*   **bold**   --- scene break\n' +
              '> quoted lines (epigraphs, letters)\n' +
              '| verse, line breaks preserved'
            }
          />
        )}

        {view !== 'write' && (
          <div className="admin-editor__preview">
            <div className="prose-reader">
              {blocks.length > 0 ? (
                <ProseBlocks blocks={blocks} />
              ) : (
                <p className="admin-editor__empty">Nothing to preview yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="admin-editor__status">
        <span>
          {words.toLocaleString()} word{words !== 1 ? 's' : ''} · {blocks.length} block
          {blocks.length !== 1 ? 's' : ''}
        </span>
        <span>
          {dirty
            ? 'Unsaved changes · ⌘/Ctrl+S'
            : savedAt
              ? 'All changes saved'
              : 'No changes'}
        </span>
      </div>
    </section>
  )
}
