import Link from 'next/link'

export default function BookNotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'var(--ink)', color: 'var(--muted)' }}
    >
      <h1
        className="text-4xl mb-4"
        style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--paper)' }}
      >
        Story not found
      </h1>
      <p className="mb-8 text-sm">
        This story may not be published yet, or the link is outdated.
      </p>
      <Link
        href="/discover"
        className="text-sm tracking-widest uppercase transition-colors hover:text-white"
        style={{ color: 'var(--gold)' }}
      >
        Browse the library →
      </Link>
    </div>
  )
}
