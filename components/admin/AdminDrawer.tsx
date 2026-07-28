'use client'

/**
 * components/admin/AdminDrawer.tsx
 *
 * Slide-over panel used by the book workspace for anything that is not chapter
 * prose (book details, manuscript import). Keeping these off the main surface
 * is what lets the editor own the full viewport height.
 *
 * Handles Esc-to-close, a focus trap while open, and restoring focus to
 * whatever opened it — the same treatment the reader gives its TOC overlay.
 */

import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function AdminDrawer({ open, title, subtitle, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    if (!panel) return

    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'))

    focusable()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
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
    return () => {
      document.removeEventListener('keydown', onKey)
      openerRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="admin-drawer" role="presentation">
      <div className="admin-drawer__scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className="admin-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="admin-drawer__head">
          <div>
            <h2 className="admin-drawer__title">{title}</h2>
            {subtitle && <p className="admin-drawer__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="admin-tool"
            onClick={onClose}
            aria-label="Close panel"
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="admin-drawer__body">{children}</div>

        {footer && <footer className="admin-drawer__foot">{footer}</footer>}
      </div>
    </div>
  )
}
