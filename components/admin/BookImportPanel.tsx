'use client'

/**
 * components/admin/BookImportPanel.tsx
 *
 * Bulk manuscript import: paste a whole book, see what the parser found, then
 * commit. Rich clipboard HTML is converted on paste, so a Word or Google Docs
 * manuscript arrives with its italics and chapter headings intact.
 *
 * Commits via PUT /api/books/[id] with rawText, which upserts chapters by
 * [bookId, order] and therefore preserves reader progress for every chapter
 * that still exists. When the parse would orphan chapters the API answers 409;
 * this panel surfaces the cost and offers to retry with confirmReset.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseBookText } from '@/lib/parseBook'
import { clipboardToBookMarkup } from '@/lib/richPaste'
import AdminDrawer from './AdminDrawer'

type Props = {
  bookId: string
  bookTitle: string
  open: boolean
  onClose: () => void
  onImported: () => void
}

type Confirm = { chaptersToDelete: number; progressRowsToDelete: number }

const PLACEHOLDER = `Paste the full manuscript here.

# Book Title

## Chapter 1: The Beginning

Prose with *italics* and **bold**…

---

A new scene after the break.

> A quoted epigraph or letter,
> line breaks preserved.

| Verse, poems or songs —
| kept line by line.

## Chapter 2: What Comes Next

More prose…`

export default function BookImportPanel({
  bookId,
  bookTitle,
  open,
  onClose,
  onImported,
}: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  // Live, client-side parse — the same function the server will use.
  const parsed = useMemo(() => {
    if (text.trim().length < 20) return null
    try {
      return parseBookText(text)
    } catch {
      return null
    }
  }, [text])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current
    if (!el || !e.clipboardData) return

    const { text: converted, fromHtml } = clipboardToBookMarkup(e.clipboardData, {
      allowHeadings: true,
    })
    if (!converted) return

    e.preventDefault()
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = el.value.slice(0, start) + converted + el.value.slice(end)
    setText(next)
    if (fromHtml) setNotice('Converted headings, bold and italics from your clipboard.')

    requestAnimationFrame(() => {
      const caret = start + converted.length
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }, [])

  const submit = useCallback(
    async (confirmReset: boolean) => {
      if (!parsed || parsed.chapters.length === 0) return

      setBusy(true)
      setError('')
      try {
        const res = await fetch(`/api/books/${bookId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          // Only title + rawText: the PUT route leaves omitted metadata alone.
          body: JSON.stringify({
            title: parsed.title ?? bookTitle,
            rawText: text,
            confirmReset,
          }),
        })

        if (res.status === 409) {
          const data = await res.json()
          setConfirm({
            chaptersToDelete: data.chaptersToDelete ?? 0,
            progressRowsToDelete: data.progressRowsToDelete ?? 0,
          })
          return
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? 'Import failed')
        }

        setText('')
        setConfirm(null)
        onImported()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setBusy(false)
      }
    },
    [bookId, bookTitle, onClose, onImported, parsed, text]
  )

  const chapterCount = parsed?.chapters.length ?? 0

  return (
    <AdminDrawer
      open={open}
      title="Import manuscript"
      subtitle="Paste a whole book — chapters are detected from headings"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => submit(false)}
            disabled={busy || chapterCount === 0}
          >
            {busy
              ? 'Importing…'
              : `Import ${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}`}
          </button>
          <button type="button" className="admin-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </>
      }
    >
      {error && <p className="admin-editor__error">{error}</p>}
      {notice && <p className="admin-editor__notice">{notice}</p>}

      {confirm && (
        <div className="admin-confirm">
          <p className="admin-confirm__title">This import removes existing chapters</p>
          <p className="admin-confirm__text">
            {confirm.chaptersToDelete} chapter
            {confirm.chaptersToDelete !== 1 ? 's' : ''} would be deleted, along with{' '}
            {confirm.progressRowsToDelete} saved reading position
            {confirm.progressRowsToDelete !== 1 ? 's' : ''}. Chapters that still exist keep
            their progress.
          </p>
          <div className="admin-confirm__actions">
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              onClick={() => submit(true)}
              disabled={busy}
            >
              {busy ? 'Importing…' : 'Import anyway'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setConfirm(null)}>
              Keep current chapters
            </button>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="admin-import__textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={handlePaste}
        placeholder={PLACEHOLDER}
        spellCheck={false}
      />

      {parsed && (
        <div className="admin-import__preview">
          <p className="admin-import__summary">
            {parsed.title && (
              <>
                Title: <strong>{parsed.title}</strong> ·{' '}
              </>
            )}
            <strong>
              {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
            </strong>{' '}
            detected
          </p>
          {chapterCount === 0 ? (
            <p className="admin-import__hint">
              No chapter headings found. Each chapter needs a{' '}
              <code>## Chapter N: Title</code> line above its prose.
            </p>
          ) : (
            <ol className="admin-import__list">
              {parsed.chapters.map(ch => (
                <li key={ch.order}>
                  <span className="admin-import__num">
                    {String(ch.order).padStart(2, '0')}
                  </span>
                  <span className="admin-import__name">{ch.title}</span>
                  <span className="admin-import__len">
                    {ch.body.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </AdminDrawer>
  )
}
