'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [turning, setTurning] = useState(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const startXRef = useRef(0)
  const router = useRouter()

  useEffect(() => {
    router.prefetch('/discover')
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [router])

  const triggerTurn = useCallback(() => {
    if (turning) return
    setIsDragging(false)
    setDragDelta(0)
    setTurning(true)
    setTimeout(() => router.push('/discover'), 860)
  }, [turning, router])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (turning) return
      setIsDragging(true)
      startXRef.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [turning],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || turning) return
      setDragDelta(Math.max(0, startXRef.current - e.clientX))
    },
    [isDragging, turning],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragDelta > 80) {
      triggerTurn()
    } else {
      setDragDelta(0)
    }
  }, [isDragging, dragDelta, triggerTurn])

  const rotationAngle = turning ? -180 : -(Math.min(dragDelta / 280, 1) * 50)

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: '#0d0c09', perspective: '1400px' }}
    >
      {/* 3D book page */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'left center',
          transformStyle: 'preserve-3d',
          transition: turning
            ? 'transform 0.86s cubic-bezier(0.4, 0, 0.2, 1)'
            : isDragging
              ? 'none'
              : 'transform 0.4s ease-out',
          transform: `rotateY(${rotationAngle}deg)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--ink)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Spine shadow */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 72,
              background: 'linear-gradient(to right, rgba(0,0,0,0.55), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <div
            style={{
              textAlign: 'center',
              padding: '0 5rem',
              maxWidth: 740,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.9s ease, transform 0.9s ease',
            }}
          >
            <p
              style={{
                color: 'var(--gold)',
                fontSize: '0.65rem',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                marginBottom: '2rem',
              }}
            >
              Welcome to the Lobby
            </p>
            <h1
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: 'clamp(2rem, 5.5vw, 4rem)',
                lineHeight: 1.2,
                color: 'var(--paper)',
                marginBottom: '2rem',
              }}
            >
              Stories to get lost in.
              <br />
              <em>Worlds worth Exploring.</em>
            </h1>
            <p
              style={{
                fontFamily: 'Lora, serif',
                fontSize: '1rem',
                color: 'var(--muted)',
                lineHeight: 1.9,
              }}
            >
              Original fiction, serialized and growing.
              <br />
              Take a seat. The story is already in progress.
            </p>
            <button
              aria-label="Browse stories"
              onClick={(e) => {
                e.stopPropagation()
                triggerTurn()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                marginTop: '2.5rem',
                background: 'transparent',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                fontFamily: 'Lora, serif',
                fontSize: '0.7rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                padding: '10px 28px',
                cursor: 'pointer',
                opacity: mounted && !turning ? 1 : 0,
                transition: 'opacity 0.5s, background 0.2s',
                pointerEvents: turning ? 'none' : 'auto',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.08)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              Browse Stories
            </button>
          </div>

          {/* Swipe indicator */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              triggerTurn()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '28px 18px',
              opacity: mounted && !turning ? 1 : 0,
              transition: 'opacity 0.5s',
              pointerEvents: turning ? 'none' : 'auto',
            }}
            aria-label="Turn page to discover stories"
          >
            <div className="lobby-swipe-arrows" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                <path
                  d="M9 18l6-6-6-6"
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: '0.55rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                textAlign: 'center',
                lineHeight: 1.6,
              }}
            >
              swipe
              <br />
              here
            </span>
          </button>

          {/* Right edge highlight */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 5,
              background: 'linear-gradient(to left, rgba(201,168,76,0.12), transparent)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Back face — visible as page turns */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0a0908',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        />
      </div>
    </div>
  )
}
