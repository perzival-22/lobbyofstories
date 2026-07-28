'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * The shell's scroll tube.
 *
 * Because the window no longer scrolls, Next's own scroll-to-top on navigation
 * has nothing to act on — and React reuses this element between routes, so its
 * offset would otherwise carry over and drop the reader into the middle of the
 * page they just opened. Reset it whenever the route changes.
 */
export default function ScrollPane({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <main className="app-main" ref={ref}>
      {children}
    </main>
  )
}
