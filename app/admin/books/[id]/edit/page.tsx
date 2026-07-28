'use client'

/**
 * Admin book workspace.
 *
 * Two panes inside a single viewport height: a chapter rail on the left and a
 * full-height chapter editor on the right. Book metadata and manuscript import
 * live in drawers rather than stacked above the editor — the old single-column
 * form pushed the story text below a screenful of fields, so every prose edit
 * started with a scroll.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ChapterEditor, { type EditableChapter } from '@/components/admin/ChapterEditor'
import BookDetailsPanel, { type BookMeta } from '@/components/admin/BookDetailsPanel'
import BookImportPanel from '@/components/admin/BookImportPanel'

type Book = BookMeta & {
  id: string
  chapters: EditableChapter[]
}

type Drawer = 'details' | 'import' | null

export default function EditBookPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [book, setBook] = useState<Book | null>(null)
  const [loadError, setLoadError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [busy, setBusy] = useState(false)
  const [railError, setRailError] = useState('')

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadBook = useCallback(
    async (selectOrder?: number) => {
      try {
        const res = await fetch(`/api/books/${bookId}`)
        if (!res.ok) throw new Error('Book not found')
        const data = await res.json()

        const next: Book = {
          id: data.id,
          title: data.title,
          author: data.author ?? '',
          description: data.description ?? '',
          series: data.series ?? '',
          genre: data.genre ?? '',
          status: data.status,
          coverUrl: data.coverUrl ?? null,
          chapters: data.chapters ?? [],
        }
        setBook(next)

        setActiveId(prev => {
          if (selectOrder !== undefined) {
            const byOrder = next.chapters.find(c => c.order === selectOrder)
            if (byOrder) return byOrder.id
          }
          if (prev && next.chapters.some(c => c.id === prev)) return prev
          return next.chapters[0]?.id ?? null
        })
      } catch {
        setLoadError('Failed to load book. It may have been deleted.')
      }
    },
    [bookId]
  )

  useEffect(() => {
    loadBook()
  }, [loadBook])

  // Unsaved prose is real work — don't let a stray reload take it.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const chapters = useMemo(() => book?.chapters ?? [], [book])
  const active = chapters.find(c => c.id === activeId) ?? null

  // ─── Rail actions ──────────────────────────────────────────────────────────

  const guardUnsaved = useCallback(() => {
    if (!dirty) return true
    return window.confirm('This chapter has unsaved changes. Discard them?')
  }, [dirty])

  const selectChapter = useCallback(
    (id: string) => {
      if (id === activeId) return
      if (!guardUnsaved()) return
      setDirty(false)
      setActiveId(id)
    },
    [activeId, guardUnsaved]
  )

  const addChapter = useCallback(async () => {
    if (!guardUnsaved()) return
    setBusy(true)
    setRailError('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters`, { method: 'POST' })
      if (!res.ok) throw new Error('Could not add a chapter')
      const created = await res.json()
      setDirty(false)
      await loadBook(created.order)
    } catch (err) {
      setRailError(err instanceof Error ? err.message : 'Could not add a chapter')
    } finally {
      setBusy(false)
    }
  }, [bookId, guardUnsaved, loadBook])

  const deleteChapter = useCallback(
    async (chapter: EditableChapter) => {
      const ok = window.confirm(
        `Delete “${chapter.title}”? Reading progress for this chapter is removed too. ` +
          'This cannot be undone.'
      )
      if (!ok) return

      setBusy(true)
      setRailError('')
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapter.id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Could not delete the chapter')
        if (chapter.id === activeId) setDirty(false)
        // Orders shift down after a delete; land on whatever now sits here.
        await loadBook(Math.min(chapter.order, chapters.length - 1) || 1)
      } catch (err) {
        setRailError(err instanceof Error ? err.message : 'Could not delete the chapter')
      } finally {
        setBusy(false)
      }
    },
    [activeId, bookId, chapters.length, loadBook]
  )

  const moveChapter = useCallback(
    async (chapter: EditableChapter, move: 'up' | 'down') => {
      if (!guardUnsaved()) return
      setBusy(true)
      setRailError('')
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ move }),
        })
        if (!res.ok) throw new Error('Could not reorder the chapter')
        setDirty(false)
        await loadBook(move === 'up' ? chapter.order - 1 : chapter.order + 1)
      } catch (err) {
        setRailError(err instanceof Error ? err.message : 'Could not reorder the chapter')
      } finally {
        setBusy(false)
      }
    },
    [bookId, guardUnsaved, loadBook]
  )

  const handleChapterSaved = useCallback((updated: EditableChapter) => {
    setBook(prev =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters.map(c => (c.id === updated.id ? { ...c, ...updated } : c)),
          }
        : prev
    )
    setDirty(false)
  }, [])

  // ─── States ────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="admin-page">
        <p className="admin-editor__error">{loadError}</p>
        <Link href="/admin" className="admin-link">← Back to dashboard</Link>
      </div>
    )
  }

  if (!book) {
    return <div className="admin-page admin-muted">Loading…</div>
  }

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0)

  return (
    <div className="admin-workspace">
      {/* Top bar */}
      <header className="admin-workspace__bar">
        <div className="admin-workspace__ident">
          <Link href="/admin" className="admin-link admin-link--small">← Dashboard</Link>
          <h1 className="admin-workspace__title" title={book.title}>{book.title}</h1>
          <span className={`admin-pill${book.status === 'PUBLISHED' ? ' admin-pill--live' : ''}`}>
            {book.status}
          </span>
        </div>

        <div className="admin-workspace__actions">
          <button type="button" className="admin-btn" onClick={() => setDrawer('details')}>
            Details
          </button>
          <button type="button" className="admin-btn" onClick={() => setDrawer('import')}>
            Import
          </button>
          <Link
            href={`/book/${book.id}`}
            target="_blank"
            className="admin-btn"
          >
            Preview ↗
          </Link>
        </div>
      </header>

      {/* Panes */}
      <div className="admin-workspace__panes">
        <aside className="admin-rail">
          <div className="admin-rail__head">
            <span className="admin-label">Chapters</span>
            <button
              type="button"
              className="admin-tool"
              onClick={addChapter}
              disabled={busy}
              title="Add a chapter"
              aria-label="Add a chapter"
            >
              +
            </button>
          </div>

          {railError && <p className="admin-editor__error">{railError}</p>}

          <ol className="admin-rail__list">
            {chapters.map((chapter, i) => {
              const isActive = chapter.id === activeId
              return (
                <li
                  key={chapter.id}
                  className={`admin-rail__item${isActive ? ' admin-rail__item--active' : ''}`}
                >
                  <button
                    type="button"
                    className="admin-rail__select"
                    onClick={() => selectChapter(chapter.id)}
                  >
                    <span className="admin-rail__num">
                      {String(chapter.order).padStart(2, '0')}
                    </span>
                    <span className="admin-rail__name">
                      {chapter.title}
                      {isActive && dirty && (
                        <span className="admin-rail__dot" title="Unsaved changes">●</span>
                      )}
                    </span>
                    <span className="admin-rail__words">
                      {(chapter.wordCount ?? 0).toLocaleString()}
                    </span>
                  </button>

                  <div className="admin-rail__tools">
                    <button
                      type="button"
                      className="admin-tool admin-tool--tiny"
                      onClick={() => moveChapter(chapter, 'up')}
                      disabled={busy || i === 0}
                      title="Move up"
                      aria-label={`Move ${chapter.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-tool admin-tool--tiny"
                      onClick={() => moveChapter(chapter, 'down')}
                      disabled={busy || i === chapters.length - 1}
                      title="Move down"
                      aria-label={`Move ${chapter.title} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="admin-tool admin-tool--tiny admin-tool--danger"
                      onClick={() => deleteChapter(chapter)}
                      disabled={busy}
                      title="Delete chapter"
                      aria-label={`Delete ${chapter.title}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="admin-rail__foot">
            {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} ·{' '}
            {totalWords.toLocaleString()} words
          </div>
        </aside>

        <div className="admin-workspace__main">
          {active ? (
            <ChapterEditor
              key={active.id}
              bookId={book.id}
              chapter={active}
              onSaved={handleChapterSaved}
              onDirtyChange={setDirty}
            />
          ) : (
            <div className="admin-empty">
              <p className="admin-empty__title">No chapters yet</p>
              <p className="admin-empty__text">
                Import a manuscript to split it into chapters automatically, or start a
                blank chapter and write here.
              </p>
              <div className="admin-empty__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => setDrawer('import')}
                >
                  Import manuscript
                </button>
                <button type="button" className="admin-btn" onClick={addChapter} disabled={busy}>
                  Add blank chapter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BookDetailsPanel
        bookId={book.id}
        open={drawer === 'details'}
        meta={book}
        chapterCount={chapters.length}
        onClose={() => setDrawer(null)}
        onSaved={meta => setBook(prev => (prev ? { ...prev, ...meta } : prev))}
        onDeleted={() => router.push('/admin')}
      />

      <BookImportPanel
        bookId={book.id}
        bookTitle={book.title}
        open={drawer === 'import'}
        onClose={() => setDrawer(null)}
        onImported={() => {
          setDirty(false)
          loadBook(1)
        }}
      />
    </div>
  )
}
