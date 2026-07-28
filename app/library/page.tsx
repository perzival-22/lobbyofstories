import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import AppShell from '@/components/AppShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My Library — Lobby of Stories',
}

type ShelfEntry = {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  series: string | null
  totalChapters: number
  completedChapters: number
  resumeChapterId: string
  resumeChapterTitle: string
}

function ShelfCard({ entry, finished }: { entry: ShelfEntry; finished: boolean }) {
  const pct =
    entry.totalChapters > 0
      ? Math.min(100, Math.round((entry.completedChapters / entry.totalChapters) * 100))
      : 0

  const href = finished
    ? `/book/${entry.bookId}`
    : `/book/${entry.bookId}/read?chapter=${entry.resumeChapterId}`

  return (
    <Link href={href} className="group">
      <div
        className="flex gap-5 p-5 h-full transition-colors group-hover:bg-[#1e1c18]"
        style={{ border: '1px solid #3a3530', borderRadius: 2 }}
      >
        {/* Thumbnail */}
        <div
          style={{
            flexShrink: 0,
            width: 60,
            height: 90,
            background: '#22201c',
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid #2a2520',
          }}
        >
          {entry.coverUrl ? (
            <Image
              src={entry.coverUrl}
              alt={entry.title}
              width={60}
              height={90}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                textAlign: 'center',
                fontFamily: 'var(--font-playfair), serif',
                fontSize: '0.6rem',
                color: 'var(--gold-dim)',
              }}
            >
              {entry.title}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {entry.series && (
            <p
              className="text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--gold-dim)' }}
            >
              {entry.series}
            </p>
          )}
          <h3
            className="text-lg truncate"
            style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--paper)' }}
          >
            {entry.title}
          </h3>
          <p className="text-sm mb-2 truncate" style={{ color: 'var(--muted)' }}>
            {entry.author}
          </p>

          {finished ? (
            <p className="text-xs" style={{ color: 'var(--gold-dim)' }}>
              Completed ✓ · {entry.totalChapters}{' '}
              {entry.totalChapters === 1 ? 'chapter' : 'chapters'}
            </p>
          ) : (
            <>
              <p className="text-xs mb-2 truncate" style={{ color: 'var(--gold-dim)' }}>
                {entry.resumeChapterTitle}
              </p>
              <div style={{ height: 2, background: '#2a2520', borderRadius: 1 }}>
                <div
                  style={{
                    height: 2,
                    width: `${pct}%`,
                    background: 'var(--gold)',
                    borderRadius: 1,
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                {entry.completedChapters} of {entry.totalChapters}{' '}
                {entry.totalChapters === 1 ? 'chapter' : 'chapters'} read
              </p>
            </>
          )}
        </div>

        {/* Arrow */}
        <div
          className="flex-shrink-0 flex items-center"
          style={{ color: 'var(--gold)', opacity: 0.6 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default async function LibraryPage() {
  const { userId: clerkId } = await auth()

  // Middleware redirects signed-out visitors to /sign-in; the user record can
  // still be missing if the Clerk webhook hasn't fired yet — treat as empty.
  const user = clerkId ? await prisma.user.findUnique({ where: { clerkId } }) : null

  const records = user
    ? await prisma.readingProgress.findMany({
        where: { userId: user.id, chapter: { book: { status: 'PUBLISHED' } } },
        orderBy: { lastReadAt: 'desc' },
        include: {
          chapter: {
            select: {
              id: true,
              title: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                  coverUrl: true,
                  series: true,
                  _count: { select: { chapters: true } },
                },
              },
            },
          },
        },
      })
    : []

  // Group progress records by book. Records arrive most-recent-first, so the
  // first entry seen for a book is also its most recently read chapter.
  const grouped = new Map<string, typeof records>()
  for (const r of records) {
    const bookId = r.chapter.book.id
    const list = grouped.get(bookId)
    if (list) list.push(r)
    else grouped.set(bookId, [r])
  }

  const shelf: ShelfEntry[] = []
  for (const list of grouped.values()) {
    const book = list[0].chapter.book
    // Resume at the most recently touched unfinished chapter, falling back to
    // the most recent one overall (same logic as the book detail page).
    const resume = list.find(r => !r.completed) ?? list[0]
    shelf.push({
      bookId: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      series: book.series,
      totalChapters: book._count.chapters,
      completedChapters: list.filter(r => r.completed).length,
      resumeChapterId: resume.chapterId,
      resumeChapterTitle: resume.chapter.title,
    })
  }

  const inProgress = shelf.filter(b => b.completedChapters < b.totalChapters)
  const finished = shelf.filter(b => b.totalChapters > 0 && b.completedChapters >= b.totalChapters)

  return (
    <AppShell active="book">
      <div className="px-4 sm:px-8 py-10 sm:py-12 max-w-6xl mx-auto">
        <div className="mb-10">
          <h2 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            My Library
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Every story you&apos;ve started, right where you left it.
          </p>
        </div>

        {shelf.length === 0 ? (
          <div className="py-24 text-center">
            <p className="mb-6" style={{ color: 'var(--muted)' }}>
              You haven&apos;t started reading yet.
            </p>
            <Link
              href="/discover"
              className="inline-block px-8 py-3 text-sm tracking-wide font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--gold)', color: 'var(--ink)' }}
            >
              Browse Stories
            </Link>
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <div className="mb-14">
                <p
                  className="mb-5"
                  style={{
                    fontSize: '0.65rem',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: 'var(--gold-dim)',
                  }}
                >
                  Continue Reading
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {inProgress.map(entry => (
                    <ShelfCard key={entry.bookId} entry={entry} finished={false} />
                  ))}
                </div>
              </div>
            )}

            {finished.length > 0 && (
              <div>
                <p
                  className="mb-5"
                  style={{
                    fontSize: '0.65rem',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: 'var(--gold-dim)',
                  }}
                >
                  Finished
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {finished.map(entry => (
                    <ShelfCard key={entry.bookId} entry={entry} finished />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
