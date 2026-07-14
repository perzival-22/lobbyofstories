'use client'

import { Fragment, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SignInButton } from '@clerk/nextjs'
import type { ChapterBlock, InlineRun } from '@/lib/parseBook'
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

// ------- Prose block rendering -------
// Blocks arrive pre-parsed from the server (lib/parseBook.ts) and are rendered
// as React elements — no HTML strings, so nothing to sanitize.

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

function ProseBlocks({ blocks }: { blocks: ChapterBlock[] }) {
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
  const [readProgress, setReadProgress] = useState(0)
  const [backHref, setBackHref] = useState(`/book/${bookId}`)
  const [backLabel, setBackLabel] = useState('← Back')
  // Immersive mode: tapping the prose area on touch devices hides the toolbar
  const [chromeVisible, setChromeVisible] = useState(true)
  const coarsePointerRef = useRef(false)

  const [localProgress, setLocalProgress] = useState<Record<string, ProgressEntry>>(progressMap)

  const contentRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const tocRef = useRef<HTMLDivElement>(null)
  const contentsBtnRef = useRef<HTMLButtonElement>(null)
  const tocWasOpen = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const currentChapter = chapters.find(c => c.id === currentChapterId) ?? chapters[0]
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

  const currentContent = contentCache[currentChapterId]
  const isCurrentLoaded = currentContent !== undefined

  // Lazy-fetch the current chapter's body when it isn't cached yet.
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

  // TASK-02: Restore font size from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reader-font-size')
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed)) setFontSize(parsed)
      }
    } catch {}
  }, [])

  // TASK-02: Persist font size to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('reader-font-size', String(fontSize))
    } catch {}
  }, [fontSize])

  // Restore theme from localStorage on mount (same pattern as font size)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reader-theme')
      if (stored === 'sepia' || stored === 'dark') setTheme(stored)
    } catch {}
  }, [])

  // Persist theme to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('reader-theme', theme)
    } catch {}
  }, [theme])

  // TASK-14: Detect referrer for back navigation
  useEffect(() => {
    if (document.referrer.includes('/discover')) {
      setBackHref('/discover')
      setBackLabel('← Discover')
    }
  }, [])

  // Tap-to-hide is touch-only; on mouse devices the toolbar stays put.
  useEffect(() => {
    coarsePointerRef.current = window.matchMedia('(pointer: coarse)').matches
  }, [])

  // ------- Progress Saving -------

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

  // Debounced scroll handler – fires 1.5 s after the user stops scrolling
  const handleScroll = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) return
    const position = el.scrollTop / maxScroll
    const completed = position > 0.95
    // TASK-05: Update progress bar
    setReadProgress(Math.round((el.scrollTop / maxScroll) * 100))
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      // Null the ref when the save actually runs — the pagehide flush uses a
      // non-null ref as its "there's an unsaved position" signal.
      saveTimeoutRef.current = null
      saveProgress(currentChapterId, position, completed)
    }, 1500)
  }, [currentChapterId, saveProgress])

  // Latest chapter id for event handlers registered once (pagehide flush).
  const currentChapterIdRef = useRef(currentChapterId)
  useEffect(() => {
    currentChapterIdRef.current = currentChapterId
  }, [currentChapterId])

  // Flush the debounced save when the tab is hidden or closed — without this,
  // closing the tab within 1.5s of the last scroll silently loses the
  // reader's position. sendBeacon survives page teardown; fetch would not.
  useEffect(() => {
    if (!isSignedIn) return

    const flush = () => {
      if (!saveTimeoutRef.current) return // nothing pending
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
      const el = contentRef.current
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return
      const position = el.scrollTop / maxScroll
      const payload = JSON.stringify({
        chapterId: currentChapterIdRef.current,
        scrollPosition: position,
        completed: position > 0.95,
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

  // ------- Chapter Switching -------

  const switchChapter = useCallback(
    async (newChapterId: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      const el = contentRef.current
      if (isSignedIn && el) {
        const maxScroll = el.scrollHeight - el.clientHeight
        if (maxScroll > 0) {
          const position = el.scrollTop / maxScroll
          saveProgress(currentChapterId, position, position > 0.95)
        }
      }

      setCurrentChapterId(newChapterId)
      setShowTOC(false)
    },
    [currentChapterId, isSignedIn, saveProgress]
  )

  // TASK-07: Keyboard shortcuts. ←/→ flip chapters; ↑/↓/PageUp/PageDown/Space
  // scroll — they must never change chapters, or a reader pressing ↓ to read
  // further gets thrown out of the page they're on. The prose lives in an
  // inner scroll container that never holds focus, so the browser's native
  // key scrolling can't reach it; the reading keys are driven manually here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if (showTOC) return // the TOC overlay has its own key handling

      if (e.key === 'ArrowRight' && nextChapter) {
        switchChapter(nextChapter.id)
        return
      }
      if (e.key === 'ArrowLeft' && prevChapter) {
        switchChapter(prevChapter.id)
        return
      }

      const el = contentRef.current
      if (!el) return
      const page = el.clientHeight * 0.85
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          el.scrollBy({ top: 60 })
          break
        case 'ArrowUp':
          e.preventDefault()
          el.scrollBy({ top: -60 })
          break
        case 'PageDown':
          e.preventDefault()
          el.scrollBy({ top: page, behavior: 'smooth' })
          break
        case 'PageUp':
          e.preventDefault()
          el.scrollBy({ top: -page, behavior: 'smooth' })
          break
        case ' ':
          // A focused button/link keeps Space for its native activation.
          if (target.closest('button, a')) return
          e.preventDefault()
          el.scrollBy({ top: e.shiftKey ? -page : page, behavior: 'smooth' })
          break
        case 'Home':
          e.preventDefault()
          el.scrollTo({ top: 0 })
          break
        case 'End':
          e.preventDefault()
          el.scrollTo({ top: el.scrollHeight })
          break
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [nextChapter, prevChapter, switchChapter, showTOC])

  // ------- Mobile swipe navigation -------
  // Horizontal-dominant swipes flip chapters; vertical scroll is untouched
  // (we never preventDefault and ignore gestures where dy dominates).
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
      // Require a clearly horizontal swipe of meaningful length.
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0 && nextChapter) {
        switchChapter(nextChapter.id)
      } else if (dx > 0 && prevChapter) {
        switchChapter(prevChapter.id)
      }
    },
    [nextChapter, prevChapter, switchChapter]
  )

  // Tap the prose area (touch devices) to toggle the toolbar — immersive
  // reading mode. Taps on links/buttons and active text selections are
  // ignored; a tap while the TOC is open just closes the TOC.
  const handleContentTap = useCallback(
    (e: React.MouseEvent) => {
      if (!coarsePointerRef.current) return
      if ((e.target as HTMLElement).closest('a, button')) return
      if (window.getSelection()?.toString()) return
      if (showTOC) {
        setShowTOC(false)
        return
      }
      setChromeVisible(v => !v)
    },
    [showTOC]
  )

  // ------- TOC accessibility: Esc to close + focus trap while open -------
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

  // Return focus to the Contents trigger when the TOC closes.
  useEffect(() => {
    if (tocWasOpen.current && !showTOC) {
      contentsBtnRef.current?.focus()
    }
    tocWasOpen.current = showTOC
  }, [showTOC])

  // ------- URL Sync + Scroll Restoration -------

  useEffect(() => {
    router.replace(`/book/${bookId}/read?chapter=${currentChapterId}`, { scroll: false })

    // TASK-05: Reset or restore progress bar
    const progress = localProgress[currentChapterId]
    if (progress && progress.scrollPosition > 0.01) {
      setReadProgress(Math.round(progress.scrollPosition * 100))
    } else {
      setReadProgress(0)
    }
  }, [currentChapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll restoration must wait until the chapter body is actually rendered,
  // otherwise scrollHeight is wrong and the restore is a no-op.
  useEffect(() => {
    if (!isCurrentLoaded) return
    const el = contentRef.current
    if (!el) return

    const progress = localProgress[currentChapterId]
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (progress && progress.scrollPosition > 0.01) {
          el.scrollTop = progress.scrollPosition * (el.scrollHeight - el.clientHeight)
        } else {
          el.scrollTop = 0
        }
      })
    )
  }, [currentChapterId, isCurrentLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // A chapter that fits entirely on screen has nothing to scroll, so the
  // scroll handler never fires and the chapter could never be marked read —
  // it would block the book from ever reaching 100%. Complete it on view.
  // (Delayed until after the double-rAF scroll restore so layout is settled.)
  useEffect(() => {
    if (!isCurrentLoaded) return
    const el = contentRef.current
    if (!el) return
    const chapterId = currentChapterId
    const t = setTimeout(() => {
      if (el.scrollHeight - el.clientHeight <= 0) {
        setReadProgress(100)
        if (!localProgress[chapterId]?.completed) {
          saveProgress(chapterId, 1, true)
        }
      }
    }, 400)
    return () => clearTimeout(t)
  }, [currentChapterId, isCurrentLoaded, saveProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  const completedCount = Object.values(localProgress).filter(p => p.completed).length

  // ------- Render -------

  return (
    <div
      className="reader-root flex flex-col"
      data-theme={theme}
      style={{ height: '100dvh', background: 'var(--reader-bg)' }}
    >

      {/* TASK-05: Reading progress bar */}
      <div style={{ position: 'relative', width: '100%', height: '2px', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '2px',
            background: 'var(--gold)',
            width: `${readProgress}%`,
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {/* Collapsible chrome: toolbar + guest nudge hide in immersive mode */}
      <div
        style={{
          flexShrink: 0,
          overflow: 'hidden',
          maxHeight: chromeVisible ? 240 : 0,
          opacity: chromeVisible ? 1 : 0,
          transition: 'max-height 0.3s ease, opacity 0.25s ease',
        }}
      >
      {/* Toolbar */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 gap-3 sm:gap-4"
        style={{ borderBottom: '1px solid var(--reader-border)', background: 'var(--reader-surface)', minHeight: '52px' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href={backHref}
            className="text-xs tracking-widest uppercase transition-colors reader-link"
            style={{ color: 'var(--reader-muted)' }}
          >
            {backLabel}
          </Link>
          <button
            ref={contentsBtnRef}
            onClick={() => setShowTOC(v => !v)}
            aria-expanded={showTOC}
            aria-haspopup="dialog"
            className="text-xs tracking-widest uppercase transition-colors reader-link"
            style={{ color: showTOC ? 'var(--gold)' : 'var(--reader-muted)' }}
          >
            Contents
          </button>
        </div>

        {/* Centre: titles */}
        <div className="flex-1 text-center min-w-0">
          <p
            className="text-sm truncate"
            style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--reader-text)' }}
          >
            {bookTitle}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--reader-muted)' }}>
            {currentChapter.title}
          </p>
        </div>

        {/* Right: theme + font controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setTheme(t => (t === 'dark' ? 'sepia' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to sepia theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Sepia theme' : 'Dark theme'}
            className="leading-none transition-colors reader-link"
            style={{ color: 'var(--reader-muted)', fontSize: '0.95rem' }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            onClick={() => setFontSize(s => Math.max(13, s - 1))}
            aria-label="Decrease font size"
            className="leading-none transition-colors reader-link"
            style={{ color: 'var(--reader-muted)', fontSize: '1rem' }}
          >
            A−
          </button>
          <span
            className="hidden sm:block"
            style={{
              color: 'var(--reader-muted)',
              fontSize: '0.7rem',
              minWidth: '2.2rem',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fontSize}px
          </span>
          <button
            onClick={() => setFontSize(s => Math.min(28, s + 1))}
            aria-label="Increase font size"
            className="leading-none transition-colors reader-link"
            style={{ color: 'var(--reader-muted)', fontSize: '1.15rem' }}
          >
            A+
          </button>
        </div>
      </header>

      {/* TASK-06: Sign-in nudge for guest readers */}
      {!isSignedIn && (
        <div
          style={{
            padding: '6px 24px',
            fontSize: '0.72rem',
            background: 'var(--reader-surface-2)',
            borderBottom: '1px solid var(--reader-border)',
            color: 'var(--reader-muted)',
          }}
        >
          Sign in to save your reading progress across devices.
          <SignInButton mode="modal">
            <button
              style={{
                color: 'var(--gold)',
                marginLeft: 8,
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'inherit',
              }}
            >
              Sign in
            </button>
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
          className="absolute z-50 left-0 right-0 overflow-y-auto"
          style={{ top: '52px', maxHeight: '55vh', background: 'var(--reader-surface)', borderBottom: '1px solid var(--reader-border)' }}
        >
          <div className="px-6 py-3">
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--reader-muted)' }}>
              {completedCount} / {chapters.length} chapters read
            </p>
            {chapters.map(ch => {
              const done = localProgress[ch.id]?.completed ?? false
              const active = ch.id === currentChapterId
              return (
                <button
                  key={ch.id}
                  onClick={() => switchChapter(ch.id)}
                  className="flex items-center gap-4 w-full text-left py-3 text-sm transition-colors reader-link"
                  style={{
                    color: active ? 'var(--gold)' : done ? 'var(--reader-text)' : 'var(--reader-muted)',
                    borderBottom: '1px solid var(--reader-border-dim)',
                  }}
                >
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--gold-dim)', minWidth: '2rem', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(ch.order).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{ch.title}</span>
                  {done && <span className="text-xs flex-shrink-0" style={{ color: 'var(--gold-dim)' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Reading content */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleContentTap}
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="px-6 py-12">
          {/* Chapter heading */}
          <div className="max-w-[68ch] mx-auto mb-8">
            <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--gold-dim)' }}>
              Chapter {String(currentChapter.order).padStart(2, '0')}
            </p>
            <h2 className="text-3xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              {currentChapter.title}
            </h2>
            {currentChapter.wordCount > 0 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--reader-muted)', marginTop: '0.5rem' }}>
                ~{Math.ceil(currentChapter.wordCount / 200)} min read
              </p>
            )}
          </div>

          {/* Opening ornament */}
          <div className="chapter-ornament max-w-[68ch] mx-auto mb-8">✦ ✦ ✦</div>

          {/* Prose body */}
          <div key={currentChapterId + (isCurrentLoaded ? ':loaded' : ':loading')} className="prose-reader" style={{ fontSize: `${fontSize}px` }}>
            {isCurrentLoaded ? (
              <ProseBlocks blocks={currentContent ?? []} />
            ) : contentError ? (
              <p style={{ color: 'var(--reader-muted)', fontStyle: 'italic' }}>
                This chapter could not be loaded. Switch away and back to retry.
              </p>
            ) : (
              <p className="reader-loading" style={{ color: 'var(--reader-muted)', fontStyle: 'italic' }}>
                Loading chapter…
              </p>
            )}
          </div>

          {/* End-of-chapter marker */}
          <div className="max-w-[68ch] mx-auto mt-16 mb-8 text-center">
            <div className="chapter-ornament">✦ ✦ ✦</div>
            <p style={{ fontSize: '0.68rem', color: 'var(--gold-dim)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '0.75rem' }}>
              End of Chapter {String(currentChapter.order).padStart(2, '0')}
            </p>
          </div>

          {/* Prev / Next navigation */}
          <div
            className="max-w-[68ch] mx-auto mt-2 pb-16 flex items-start justify-between"
            style={{ borderTop: '1px solid var(--reader-border)', paddingTop: '2rem' }}
          >
            {prevChapter ? (
              <button
                onClick={() => switchChapter(prevChapter.id)}
                className="text-sm text-left transition-colors reader-link"
                style={{ color: 'var(--reader-muted)', maxWidth: '45%' }}
              >
                <span className="block text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold-dim)' }}>
                  ← Previous
                </span>
                {prevChapter.title}
              </button>
            ) : <div />}

            {nextChapter ? (
              <button
                onClick={() => switchChapter(nextChapter.id)}
                className="text-sm text-right transition-colors reader-link"
                style={{ color: 'var(--reader-muted)', maxWidth: '45%' }}
              >
                <span className="block text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold-dim)' }}>
                  Next →
                </span>
                {nextChapter.title}
              </button>
            ) : (
              <Link
                href={`/book/${bookId}`}
                className="text-sm text-right transition-colors reader-link"
                style={{ color: 'var(--reader-muted)', maxWidth: '45%' }}
              >
                <span className="block text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold-dim)' }}>
                  Finished →
                </span>
                Back to book page
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
