'use client'

import { useRouter } from 'next/navigation'

type Props = {
  /** Where to go when there is no in-app history to step back through. */
  fallbackHref: string
}

export default function BackButton({ fallbackHref }: Props) {
  const router = useRouter()

  const goBack = () => {
    // Next stamps each of its own history entries with an index; anything above
    // zero means there is a previous page inside the app to return to. Read at
    // click time — the value changes with every client-side navigation.
    const index = (window.history.state as { idx?: number } | null)?.idx
    if (typeof index === 'number' && index > 0) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button type="button" onClick={goBack} className="app-back" aria-label="Go back">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
