'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProgressEntry } from './page'

type Chapter = {
  id: string
  title: string
  order: number
  content: string
}

type Props = {
  bookId: string
  bookTitle: string
  chapters: Chapter[]
  initialChapterId: string
  progressMap: Record<string, ProgressEntry>
  isSignedIn: boolean
}

export default function ReaderClient({
  bookId,
  bookTitle,
  chapters,
  initialChapterId,
  progressMap,
  isSignedIn,
}: Props) {
  const router = useRouter()

  const [currentChapterId, setCurrentChapterId] = useState(initialChapterId)
  const [fontSize, setFontSize] = useState(18)
  const [showTOC, setShowTOC] = useState(false)

  // Merge server-provided progress with live updates (keeps TOC checkmarks current)
  const [localProgress, setLocalProgress] = useState<Record<string, ProgressEntry>>(progressMap)

  const contentRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const currentChapter = chapters.find(c => c.id === currentChapterId) ?? chapters[0]
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

  // ------- Progress Saving -------

  const saveProgress = useCallback(
    (chapterId: string, scrollPosition: number, completed: boolean) => {
      if (!isSignedIn) return
      // Optimistic local update so TOC checkmarks update without waiting for the server
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
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(currentChapterId, position, completed)
    }, 1500)
  }, [currentChapterId, saveProgress])

  // ------- Chapter Switching -------

  const switchChapter = useCallback(
    async (newChapterId: string) => {
      // Cancel pending debounce save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      // Immediately save current scroll position before switching
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

  // ------- URL Sync + Scroll Restoration -------

  useEffect(() => {
    // Keep URL in sync so page refresh and link sharing work correctly
    router.replace(`/book/${bookId}/read?chapter=${currentChapterId}`, { scroll: false })

    const el = contentRef.current
    if (!el) return

    // Double rAF waits for layout to settle after chapter content changes
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const progress = localProgress[currentChapterId]
        if (progress && progress.scrollPosition > 0.01) {
          el.scrollTop = progress.scrollPosition * (el.scrollHeight - el.clientHeight)
        } else {
          el.scrollTop = 0
        }
      })
    )
  }, [currentChapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  // ------- Content Rendering -------

  // Split raw text into paragraphs; single newlines within a paragraph become spaces
  const paragraphs = currentChapter.content
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)

  const completedCount = Object.values(localProgress).filter(p => p.completed).length

  // ------- Render -------

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--ink)' }}>

      {/* Toolbar */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 gap-4"
        style={{ borderBottom: '1px solid #2a2520', background: '#0e0c0a', minHeight: '52px' }}
      >
        {/* Left */}
        <div className="flex items-center gap-5">
          <Link
            href={`/book/${bookId}`}
            className="text-xs tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'var(--muted)' }}
          >
            ← Back
          </Link>
          <button
            onClick={() => setShowTOC(v => !v)}
            className="text-xs tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: showTOC ? 'var(--gold)' : 'var(--muted)' }}
          >
            Contents
          </button>
        </div>

        {/* Centre: titles */}
        <div className="flex-1 text-center min-w-0">
          <p
            className="text-sm truncate"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--paper)' }}
          >
            {bookTitle}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
            {currentChapter.title}
          </p>
        </div>

        {/* Right: font controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setFontSize(s => Math.max(14, s - 1))}
            aria-label="Decrease font size"
            className="leading-none transition-colors hover:text-white"
            style={{ color: 'var(--muted)', fontSize: '1rem' }}
          >
            A−
          </button>
          <button
            onClick={() => setFontSize(s => Math.min(26, s + 1))}
            aria-label="Increase font size"
            className="leading-none transition-colors hover:text-white"
            style={{ color: 'var(--muted)', fontSize: '1.15rem' }}
          >
            A+
          </button>
        </div>
      </header>

      {/* TOC overlay */}
      {showTOC && (
        <div
          className="absolute z-50 left-0 right-0 overflow-y-auto"
          style={{ top: '52px', maxHeight: '55vh', background: '#0e0c0a', borderBottom: '1px solid #2a2520' }}
        >
          <div className="px-6 py-3">
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>
              {completedCount} / {chapters.length} chapters read
            </p>
            {chapters.map(ch => {
              const done = localProgress[ch.id]?.completed ?? false
              const active = ch.id === currentChapterId
              return (
                <button
                  key={ch.id}
                  onClick={() => switchChapter(ch.id)}
                  className="flex items-center gap-4 w-full text-left py-3 text-sm transition-colors hover:text-white"
                  style={{
                    color: active ? 'var(--gold)' : done ? 'var(--paper)' : 'var(--muted)',
                    borderBottom: '1px solid #1a1714',
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
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="px-6 py-12">
          {/* Chapter heading */}
          <div className="max-w-[68ch] mx-auto mb-10">
            <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--gold-dim)' }}>
              Chapter {String(currentChapter.order).padStart(2, '0')}
            </p>
            <h2 className="text-3xl" style={{ fontFamily: 'Playfair Display, serif' }}>
              {currentChapter.title}
            </h2>
          </div>

          {/* Prose body */}
          <div className="prose-reader" style={{ fontSize: `${fontSize}px` }}>
            {paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Prev / Next navigation */}
          <div
            className="max-w-[68ch] mx-auto mt-20 pb-16 flex items-start justify-between"
            style={{ borderTop: '1px solid #2a2520', paddingTop: '2rem' }}
          >
            {prevChapter ? (
              <button
                onClick={() => switchChapter(prevChapter.id)}
                className="text-sm text-left transition-colors hover:text-white"
                style={{ color: 'var(--muted)', maxWidth: '45%' }}
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
                className="text-sm text-right transition-colors hover:text-white"
                style={{ color: 'var(--muted)', maxWidth: '45%' }}
              >
                <span className="block text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold-dim)' }}>
                  Next →
                </span>
                {nextChapter.title}
              </button>
            ) : (
              <Link
                href={`/book/${bookId}`}
                className="text-sm text-right transition-colors hover:text-white"
                style={{ color: 'var(--muted)', maxWidth: '45%' }}
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
