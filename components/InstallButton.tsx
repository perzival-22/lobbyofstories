'use client'

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Surfaces the browser's own install prompt. Renders nothing at all unless the
 * browser has told us the app is installable and not already installed, so
 * iOS (which never fires the event) and installed sessions stay uncluttered.
 */
export default function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const onAvailable = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => setPrompt(null)

    window.addEventListener('beforeinstallprompt', onAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!prompt) return null

  return (
    <button
      type="button"
      className="app-install"
      onClick={async () => {
        setPrompt(null)
        await prompt.prompt()
      }}
    >
      Install
    </button>
  )
}
