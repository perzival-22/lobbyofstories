import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'About — Lobby of Stories',
  description: 'About Lobby of Stories — a personal digital library of original serialized fiction.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <SiteHeader />

      <main className="px-8 py-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--gold)' }}>
            The Lobby
          </p>
          <h1
            className="text-4xl mb-4"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            About This Place
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            A personal library. A work in progress. Always open.
          </p>
        </div>

        <div
          className="text-sm leading-relaxed space-y-10"
          style={{ color: 'var(--paper)' }}
        >
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
            >
              What Is Lobby of Stories?
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Lobby of Stories is a personal digital library of original serialized writing. Every story
              here, every character, world, and chapter — is written solely by one author and published
              directly to this platform. Just stories, told at their own pace.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Think of it as a reading room you can return to. New chapters appear as they&apos;re
              finished. Old ones stay exactly where you left them.
            </p>
          </section>

          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
            >
              Why Serialized Fiction?
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Serialized storytelling has a long history — from Victorian magazines to modern web novels.
              There is something uniquely satisfying about a story that unfolds over time, that you grow
              alongside rather than consume all at once. This platform is built around that rhythm.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Stories here are released chapter by chapter. Some are ongoing; others are complete. All of
              them are worth sitting with.
            </p>
          </section>

          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
            >
              Reading &amp; Accounts
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              You can read everything on this platform without an account. Creating a free account
              unlocks one extra thing: your reading progress is saved. The platform remembers which
              chapters you&apos;ve finished and where you paused mid-scroll, so you can always pick up
              exactly where you left off — across devices, across sessions.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              No newsletters. No notifications. No data sold to anyone. Accounts exist purely to serve
              your reading.
            </p>
          </section>

          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
            >
              The Author
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Lobby of Stories is the work of one person — a writer who wanted a home for their fiction
              that felt as considered as the stories themselves. Every word published here is original.
              Every design decision was made to get out of the way and let the text breathe.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              All content on this platform is protected by copyright. If you&apos;d like to share
              something, a link is always welcome. For anything else, reach out.
            </p>
          </section>

          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--gold)' }}
            >
              Get in Touch
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Questions, feedback, or just want to say something about a story?
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Email:{' '}
              <a href="mailto:kelvinmusiomi99@gmail.com" style={{ color: 'var(--gold)' }}>
                kelvinmusiomi99@gmail.com
              </a>
            </p>
          </section>

          <div
            className="pt-8 text-center text-xs tracking-widest uppercase"
            style={{ color: 'var(--muted)', borderTop: '1px solid #2a2520' }}
          >
            Ready to read?{' '}
            <Link href="/discover" style={{ color: 'var(--gold)' }}>
              Browse the library →
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
