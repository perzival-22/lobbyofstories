'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SignInButton } from '@clerk/nextjs'
import type { ChapterBlock } from '@/lib/parseBook'
import ProseBlocks from '@/components/ProseBlocks'
import type { ProgressEntry } from './page'

// Chapter metadata only — the body is lazy-loaded on demand as typed blocks.
type Chapter = {
  id: string
  title: string
  order: number
  wordCount: number
}

type Props = {
  bookId: string
  bookTitle: string
  chapters: Chapter[]
  initialChapterId: string
  initialChapterBlocks: ChapterBlock[]
  progressMap: Record<string, ProgressEntry>
  isSignedIn: boolean
}

type Theme = 'dark' | 'sepia'

// ─── Pagination constants ────────────────────────────────────────────────────

/** Gutter between columns, in px. Also the gap between facing pages. */
const COLUMN_GAP = 56

/** Below this stage width a spread would make each column too narrow to read. */
const TWO_COLUMN_MIN = 1100

/** Caps on the reading measure, so prose never runs the full width of a monitor. */
const MAX_WIDTH_ONE_COL = 660
const MAX_WIDTH_TWO_COL = 1320

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

export default function ReaderClient({
  bookId,
  bookTitle,
  chapters,
  initialChapterId,
  initialChapterBlocks,
  progressMap,
  isSignedIn,
}: Props) {
  const router = useRouter()

  const [currentChapterId, setCurrentChapterId] = useState(initialChapterId)

  // Cache of chapter bodies (as parsed blocks) keyed by chapter id. Seeded
  // with the initial chapter (sent by the server); other chapters are fetched
  // on first visit and kept here so re-visits don't refetch.
  const [contentCache, setContentCache] = useState<Record<string, ChapterBlock[]>>({
    [initialChapterId]: initialChapterBlocks,
  })
  const [contentError, setContentError] = useState(false)
  const [fontSize, setFontSize] = useState(19)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showTOC, setShowTOC] = useState(false)
  const [backHref, setBackHref] = useState(`/book/${bookId}`)
  const [backLabel, setBackLabel] = useState('← Back')
  // Immersive mode: tapping the middle of the page on touch devices hides chrome
  const [chromeVisible, setChromeVisible] = useState(true)

  // ─── Paged layout state ────────────────────────────────────────────────────
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [advance, setAdvance] = useState(0)

  const [localProgress, setLocalProgress] = useState<Record<string, ProgressEntry>>(progressMap)

  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLDivElement>(null)
  const contentsBtnRef = useRef<HTMLButtonElement>(null)
  const tocWasOpen = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const coarsePointerRef = useRef(false)

  // Where to land after the next pagination pass (a restored fraction, or the
  // end of the chapter when paging backwards into it). null = keep position.
  const pendingFractionRef = useRef<number | null>(null)
  // Latest unsaved reading position, flushed on pagehide / chapter switch.
  const pendingSaveRef = useRef<{
    chapterId: string
    fraction: number
    completed: boolean
  } | null>(null)

  const pageRef = useRef(0)
  const pageCountRef = useRef(1)
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { pageCountRef.current = pageCount }, [pageCount])

  // Page turns slide; jumping to a new chapter must not slide back through
  // forty pages of the old one, so the transition is suppressed for a frame.
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    setAnimate(false)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
    return () => cancelAnimationFrame(id)
  }, [currentChapterId])

  const currentChapter = chapters.find(c => c.id === currentChapterId) ?? chapters[0]
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

  const currentContent = contentCache[currentChapterId]
  const isCurrentLoaded = currentContent !== undefined

  // ─── Content loading ───────────────────────────────────────────────────────

  useEffect(() => {
    if (contentCache[currentChapterId] !== undefined) return

    let cancelled = false
    setContentError(false)

    fetch(`/api/books/${bookId}/chapters/${currentChapterId}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { blocks?: ChapterBlock[] }) => {
        if (cancelled) return
        setContentCache(prev => ({ ...prev, [currentChapterId]: data.blocks ?? [] }))
      })
      .catch(err => {
        if (cancelled) return
        console.error('Chapter content fetch failed:', err)
        setContentError(true)
      })

    return () => { cancelled = true }
  }, [currentChapterId, bookId, contentCache])

  // ─── Preferences ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const storedSize = localStorage.getItem('reader-font-size')
      if (storedSize) {
        const parsed = parseInt(storedSize, 10)
        if (!isNaN(parsed)) setFontSize(parsed)
      }
      const storedTheme = localStorage.getItem('reader-theme')
      if (storedTheme === 'sepia' || storedTheme === 'dark') setTheme(storedTheme)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('reader-font-size', String(fontSize)) } catch {}
  }, [fontSize])

  useEffect(() => {
    try { localStorage.setItem('reader-theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    if (document.referrer.includes('/discover')) {
      setBackHref('/discover')
      setBackLabel('← Discover')
    }
  }, [])

  useEffect(() => {
    coarsePointerRef.current = window.matchMedia('(pointer: coarse)').matches
  }, [])

  // ─── Pagination ────────────────────────────────────────────────────────────

  /**
   * Lays the chapter out as fixed-height CSS columns and measures how many
   * pages it makes. The track is exactly one page wide and overflows to the
   * right; flipping a page is a transform, not a scroll.
   */
  const paginate = useCallback(() => {
    const stage = stageRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!stage || !viewport || !track) return

    // clientWidth includes padding, so measure the content box — sizing the
    // viewport off the padded width overflows the stage and clips a column.
    const styles = getComputedStyle(stage)
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    const available = stage.clientWidth - padX
    if (available <= 0 || stage.clientHeight <= 0) return

    const cols = available >= TWO_COLUMN_MIN ? 2 : 1
    const maxWidth = cols === 2 ? MAX_WIDTH_TWO_COL : MAX_WIDTH_ONE_COL
    const width = Math.min(available, maxWidth)
    const columnWidth = (width - COLUMN_GAP * (cols - 1)) / cols

    viewport.style.width = `${width}px`
    track.style.width = `${width}px`
    track.style.columnWidth = `${columnWidth}px`
    track.style.columnGap = `${COLUMN_GAP}px`

    // Reading scrollWidth forces the layout we just asked for.
    const contentWidth = track.scrollWidth
    const totalColumns = Math.max(
      1,
      Math.round((contentWidth + COLUMN_GAP) / (columnWidth + COLUMN_GAP))
    )
    const count = Math.max(1, Math.ceil(totalColumns / cols))
    const step = width + COLUMN_GAP

    setAdvance(step)
    setPageCount(count)

    // Keep the reader where they were: either an explicitly requested position
    // (chapter switch / restore) or the same relative point after a resize.
    const requested = pendingFractionRef.current
    if (requested !== null) {
      pendingFractionRef.current = null
      setPage(clamp(Math.round(requested * (count - 1)), 0, count - 1))
      return
    }

    const previousCount = pageCountRef.current
    const fraction = previousCount > 1 ? pageRef.current / (previousCount - 1) : 0
    setPage(clamp(Math.round(fraction * (count - 1)), 0, count - 1))
  }, [])

  // Re-paginate whenever anything that affects layout changes.
  useLayoutEffect(() => {
    paginate()
  }, [paginate, currentChapterId, isCurrentLoaded, currentContent, fontSize, chromeVisible])

  // Web fonts land after first paint and change every metric — measure again.
  useEffect(() => {
    if (!document.fonts?.ready) return
    let cancelled = false
    document.fonts.ready.then(() => { if (!cancelled) paginate() })
    return () => { cancelled = true }
  }, [paginate])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => paginate())
    observer.observe(stage)
    return () => observer.disconnect()
  }, [paginate])

  // ─── Progress ──────────────────────────────────────────────────────────────

  const saveProgress = useCallback(
    (chapterId: string, scrollPosition: number, completed: boolean) => {
      if (!isSignedIn) return
      setLocalProgress(prev => ({ ...prev, [chapterId]: { scrollPosition, completed } }))
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, scrollPosition, completed }),
      }).catch(err => console.error('Progress save failed:', err))
    },
    [isSignedIn]
  )

  // `scrollPosition` stays a 0–1 fraction so rows written by the old scrolling
  // reader still restore correctly — it is just derived from the page index now.
  useEffect(() => {
    if (!isSignedIn || !isCurrentLoaded || pageCount <= 0) return

    const fraction = pageCount > 1 ? page / (pageCount - 1) : 0
    const completed = page >= pageCount - 1
    pendingSaveRef.current = { chapterId: currentChapterId, fraction, completed }

    const timer = setTimeout(() => {
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      saveProgress(pending.chapterId, pending.fraction, pending.completed)
    }, 900)

    return () => clearTimeout(timer)
  }, [page, pageCount, isCurrentLoaded, currentChapterId, isSignedIn, saveProgress])

  // Closing the tab within the debounce window would otherwise lose the page.
  // sendBeacon survives teardown; fetch would not.
  useEffect(() => {
    if (!isSignedIn) return

    const flush = () => {
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      const payload = JSON.stringify({
        chapterId: pending.chapterId,
        scrollPosition: pending.fraction,
        completed: pending.completed,
      })
      navigator.sendBeacon('/api/progress', new Blob([payload], { type: 'application/json' }))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isSignedIn])

  // ─── Navigation ────────────────────────────────────────────────────────────

  const switchChapter = useCallback(
    (newChapterId: string, landing: 'restore' | 'end' = 'restore') => {
      // Commit the outgoing chapter's position before leaving it.
      const pending = pendingSaveRef.current
      if (pending) {
        pendingSaveRef.current = null
        saveProgress(pending.chapterId, pending.fraction, pending.completed)
      }

      pendingFractionRef.current =
        landing === 'end' ? 1 : (localProgress[newChapterId]?.scrollPosition ?? 0)
      setPage(0)
      setCurrentChapterId(newChapterId)
      setShowTOC(false)
    },
    [localProgress, saveProgress]
  )

  const goNext = useCallback(() => {
    if (pageRef.current < pageCountRef.current - 1) {
      setPage(p => p + 1)
    } else if (nextChapter) {
      switchChapter(nextChapter.id)
    }
  }, [nextChapter, switchChapter])

  const goPrev = useCallback(() => {
    if (pageRef.current > 0) {
      setPage(p => p - 1)
    } else if (prevChapter) {
      switchChapter(prevChapter.id, 'end')
    }
  }, [prevChapter, switchChapter])

  // Keyboard. Every reading key turns a page; chapters move with Shift.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if (showTOC) return // the TOC overlay has its own key handling

      if (e.shiftKey && e.key === 'ArrowRight') {
        if (nextChapter) { e.preventDefault(); switchChapter(nextChapter.id) }
        return
      }
      if (e.shiftKey && e.key === 'ArrowLeft') {
        if (prevChapter) { e.preventDefault(); switchChapter(prevChapter.id) }
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          goPrev()
          break
        case ' ':
          // A focused button/link keeps Space for its native activation.
          if (target.closest('button, a')) return
          e.preventDefault()
          if (e.shiftKey) goPrev()
          else goNext()
          break
        case 'Home':
          e.preventDefault()
          setPage(0)
          break
        case 'End':
          e.preventDefault()
          setPage(pageCountRef.current - 1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, nextChapter, prevChapter, switchChapter, showTOC])

  // Click the outer quarter of the page to flip; the middle toggles chrome on
  // touch devices. Deliberately not an overlay element — an overlay would make
  // the prose unselectable.
  const handleStageClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button')) return
      if (window.getSelection()?.toString()) return
      if (showTOC) {
        setShowTOC(false)
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      if (x < 0.25) goPrev()
      else if (x > 0.75) goNext()
      else if (coarsePointerRef.current) setChromeVisible(v => !v)
    },
    [goNext, goPrev, showTOC]
  )

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y

      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext()
        else goPrev()
        return
      }
      // There is nothing to scroll any more, so a vertical swipe would feel
      // dead — map it to a page turn too.
      if (Math.abs(dy) >= 60 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) goNext()
        else goPrev()
      }
    },
    [goNext, goPrev]
  )

  // ─── TOC accessibility: Esc to close + focus trap while open ───────────────

  useEffect(() => {
    if (!showTOC) return
    const overlay = tocRef.current
    if (!overlay) return

    const getFocusable = () =>
      Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'))

    getFocusable()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowTOC(false)
        return
      }
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showTOC])

  useEffect(() => {
    if (tocWasOpen.current && !showTOC) {
      contentsBtnRef.current?.focus()
    }
    tocWasOpen.current = showTOC
  }, [showTOC])

  // ─── URL sync ──────────────────────────────────────────────────────────────

  useEffect(() => {
    router.replace(`/book/${bookId}/read?chapter=${currentChapterId}`, { scroll: false })
  }, [currentChapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  const completedCount = Object.values(localProgress).filter(p => p.completed).length
  const readProgress = pageCount > 1 ? ((page + 1) / pageCount) * 100 : 100
  const atLastPage = page >= pageCount - 1
  const atFirstPage = page === 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="reader-root" data-theme={theme}>
      {/* Reading progress bar */}
      <div className="reader-progress">
        <div className="reader-progress__fill" style={{ width: `${readProgress}%` }} />
      </div>

      {/* Collapsible chrome: toolbar + guest nudge hide in immersive mode */}
      <div className={`reader-chrome${chromeVisible ? '' : ' reader-chrome--hidden'}`}>
        <header className="reader-bar">
          <div className="reader-bar__side">
            <Link href={backHref} className="reader-link reader-bar__btn">
              {backLabel}
            </Link>
            <button
              ref={contentsBtnRef}
              onClick={() => setShowTOC(v => !v)}
              aria-expanded={showTOC}
              aria-haspopup="dialog"
              className="reader-link reader-bar__btn"
              style={{ color: showTOC ? 'var(--gold)' : undefined }}
            >
              Contents
            </button>
          </div>

          <div className="reader-bar__centre">
            <p className="reader-bar__book">{bookTitle}</p>
            <p className="reader-bar__chapter">{currentChapter.title}</p>
          </div>

          <div className="reader-bar__side reader-bar__side--end">
            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'sepia' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to sepia theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Sepia theme' : 'Dark theme'}
              className="reader-link reader-bar__icon"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              onClick={() => setFontSize(s => Math.max(13, s - 1))}
              aria-label="Decrease font size"
              className="reader-link reader-bar__icon"
            >
              A−
            </button>
            <span className="reader-bar__size">{fontSize}px</span>
            <button
              onClick={() => setFontSize(s => Math.min(28, s + 1))}
              aria-label="Increase font size"
              className="reader-link reader-bar__icon reader-bar__icon--lg"
            >
              A+
            </button>
          </div>
        </header>

        {!isSignedIn && (
          <div className="reader-nudge">
            Sign in to save your reading progress across devices.
            <SignInButton mode="modal">
              <button className="reader-nudge__btn">Sign in</button>
            </SignInButton>
          </div>
        )}
      </div>

      {/* TOC overlay */}
      {showTOC && (
        <div
          ref={tocRef}
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents"
          className="reader-toc"
        >
          <p className="reader-toc__count">
            {completedCount} / {chapters.length} chapters read
          </p>
          {chapters.map(ch => {
            const done = localProgress[ch.id]?.completed ?? false
            const active = ch.id === currentChapterId
            return (
              <button
                key={ch.id}
                onClick={() => switchChapter(ch.id)}
                className="reader-toc__item reader-link"
                style={{
                  color: active ? 'var(--gold)' : done ? 'var(--reader-text)' : undefined,
                }}
              >
                <span className="reader-toc__num">{String(ch.order).padStart(2, '0')}</span>
                <span className="reader-toc__name">{ch.title}</span>
                {done && <span className="reader-toc__done">✓</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Paged reading surface */}
      <div
        ref={stageRef}
        className="reader-stage"
        onClick={handleStageClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div ref={viewportRef} className="reader-viewport">
          <div
            ref={trackRef}
            className={`reader-track${animate ? '' : ' reader-track--instant'}`}
            style={{ transform: `translateX(-${page * advance}px)` }}
          >
            <div
              key={currentChapterId + (isCurrentLoaded ? ':loaded' : ':loading')}
              className="prose-reader"
              style={{ fontSize: `${fontSize}px` }}
            >
              {/* Chapter opening */}
              <div className="chapter-open">
                <p className="chapter-open__eyebrow">
                  Chapter {String(currentChapter.order).padStart(2, '0')}
                  {currentChapter.wordCount > 0 &&
                    ` · ~${Math.ceil(currentChapter.wordCount / 200)} min`}
                </p>
                <h2 className="chapter-open__title">{currentChapter.title}</h2>
              </div>

              {isCurrentLoaded ? (
                <ProseBlocks blocks={currentContent ?? []} />
              ) : contentError ? (
                <p className="reader-notice">
                  This chapter could not be loaded. Switch away and back to retry.
                </p>
              ) : (
                <p className="reader-notice reader-loading">Loading chapter…</p>
              )}

              {/* Chapter close */}
              {isCurrentLoaded && (
                <div className="chapter-close">
                  <div className="chapter-ornament">✦ ✦ ✦</div>
                  <p className="chapter-close__label">
                    End of Chapter {String(currentChapter.order).padStart(2, '0')}
                  </p>
                  {nextChapter ? (
                    <button
                      onClick={() => switchChapter(nextChapter.id)}
                      className="reader-link chapter-close__next"
                    >
                      Next: {nextChapter.title} →
                    </button>
                  ) : (
                    <Link href={`/book/${bookId}`} className="reader-link chapter-close__next">
                      Back to book page →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pager */}
      <footer className={`reader-pager${chromeVisible ? '' : ' reader-pager--dim'}`}>
        <button
          onClick={goPrev}
          disabled={atFirstPage && !prevChapter}
          className="reader-link reader-pager__arrow"
          aria-label={atFirstPage ? 'Previous chapter' : 'Previous page'}
          title={atFirstPage ? 'Previous chapter' : 'Previous page'}
        >
          ‹
        </button>
        <span className="reader-pager__label">
          Page {Math.min(page + 1, pageCount)} of {pageCount}
        </span>
        <button
          onClick={goNext}
          disabled={atLastPage && !nextChapter}
          className="reader-link reader-pager__arrow"
          aria-label={atLastPage ? 'Next chapter' : 'Next page'}
          title={atLastPage ? 'Next chapter' : 'Next page'}
        >
          ›
        </button>
      </footer>
    </div>
  )
}
