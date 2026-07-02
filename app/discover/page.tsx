import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import DiscoverClient from './DiscoverClient'

export const revalidate = 60

export default async function DiscoverPage() {
  const { userId: clerkId } = await auth()

  const [books, recentProgress, completedRecords] = await Promise.all([
    prisma.book.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { chapters: true } } },
    }),
    clerkId
      ? prisma.readingProgress.findFirst({
          where: {
            user: { clerkId },
            completed: false,
          },
          orderBy: { lastReadAt: 'desc' },
          include: {
            chapter: {
              include: {
                book: {
                  include: { _count: { select: { chapters: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
    clerkId
      ? prisma.readingProgress.findMany({
          where: { user: { clerkId }, completed: true },
          select: { chapter: { select: { bookId: true } } },
        })
      : Promise.resolve([]),
  ])

  // Completed-chapter counts per book, for the progress bar on each card
  const progressByBook: Record<string, number> = {}
  for (const record of completedRecords) {
    const bookId = record.chapter.bookId
    progressByBook[bookId] = (progressByBook[bookId] ?? 0) + 1
  }

  const currentlyReading = recentProgress
    ? {
        bookId: recentProgress.chapter.book.id,
        title: recentProgress.chapter.book.title,
        author: recentProgress.chapter.book.author,
        coverUrl: recentProgress.chapter.book.coverUrl,
        series: recentProgress.chapter.book.series,
        chapterId: recentProgress.chapterId,
        chapterTitle: recentProgress.chapter.title,
        totalChapters: recentProgress.chapter.book._count.chapters,
      }
    : null

  const genres = [...new Set(books.flatMap((b) => (b.genre ? [b.genre] : [])))]
  const series = [...new Set(books.flatMap((b) => (b.series ? [b.series] : [])))]

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <SiteHeader activePage="discover" />
      <div className="px-8 py-12 max-w-6xl mx-auto">
        <div className="mb-10">
          <h2 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Discover
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {books.length} {books.length === 1 ? 'story' : 'stories'} in the library
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Sorted by recent activity
            </p>
          </div>
        </div>
        <DiscoverClient
          books={books}
          genres={genres}
          series={series}
          currentlyReading={currentlyReading}
          progressByBook={progressByBook}
        />
      </div>
      <SiteFooter />
    </div>
  )
}
