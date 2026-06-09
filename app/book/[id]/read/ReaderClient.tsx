'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SignInButton } from '@clerk/nextjs'
import type { ProgressEntry } from './page'

type Chapter = {
  id: string
  title: string
  order: number
  content: string
  wordCount?: number
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
  const [readProgress, setReadProgress] = useState(0)
  const [backHref, setBackHref] = useState(`/book/${bookId}`)
  const [backLabel, setBackLabel] = useState('← Back')

  const [localProgress, setLocalProgress] = useState<Record<string, ProgressEntry>>(progressMap)

  const contentRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const currentChapter = chapters.find(c => c.id === currentChapterId) ?? chapters[0]
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

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

  // TASK-14: Detect referrer for back navigation
  useEffect(() => {
    if (document.referrer.includes('/discover')) {
      setBackHref('/discover')
      setBackLabel('← Discover')
    }
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
      saveProgress(currentChapterId, position, completed)
    }, 1500)
  }, [currentChapterId, saveProgress])

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

  // TASK-07: Keyboard shortcuts for chapter navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && nextChapter) {
        switchChapter(nextChapter.id)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && prevChapter) {
        switchChapter(prevChapter.id)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [nextChapter, prevChapter, switchChapter])

  // ------- URL Sync + Scroll Restoration -------

  useEffect(() => {
    router.replace(`/book/${bookId}/read?chapter=${currentChapterId}`, { scroll: false })

    const el = contentRef.current
    if (!el) return

    // TASK-05: Reset or restore progress bar
    const progress = localProgress[currentChapterId]
    if (progress && progress.scrollPosition > 0.01) {
      setReadProgress(Math.round(progress.scrollPosition * 100))
    } else {
      setReadProgress(0)
    }

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (progress && progress.scrollPosition > 0.01) {
          el.scrollTop = progress.scrollPosition * (el.scrollHeight - el.clientHeight)
        } else {
          el.scrollTop = 0
        }
      })
    )
  }, [currentChapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  // ------- Content Rendering -------

  const paragraphs = currentChapter.content
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)

  const completedCount = Object.values(localProgress).filter(p => p.completed).length

  // ------- Render -------

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--ink)' }}>

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

      {/* Toolbar */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 gap-4"
        style={{ borderBottom: '1px solid #2a2520', background: '#0e0c0a', minHeight: '52px' }}
      >
        {/* Left */}
        <div className="flex items-center gap-5">
          <Link
            href={backHref}
            className="text-xs tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'var(--muted)' }}
          >
            {backLabel}
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

      {/* TASK-06: Sign-in nudge for guest readers */}
      {!isSignedIn && (
        <div
          style={{
            padding: '6px 24px',
            fontSize: '0.72rem',
            background: '#16140f',
            borderBottom: '1px solid #2a2520',
            color: 'var(--muted)',
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
            {/* TASK-10: Reading time estimate */}
            {currentChapter.wordCount != null && (
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                ~{Math.ceil(currentChapter.wordCount / 200)} min read
              </p>
            )}
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
