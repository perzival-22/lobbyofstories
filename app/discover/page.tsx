import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import DiscoverClient from './DiscoverClient'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const { userId: clerkId } = await auth()

  const [books, recentProgress] = await Promise.all([
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
  ])

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
          <h2 className="text-4xl mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Discover
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {books.length} {books.length === 1 ? 'story' : 'stories'} in the library
          </p>
        </div>
        <DiscoverClient
          books={books}
          genres={genres}
          series={series}
          currentlyReading={currentlyReading}
        />
      </div>
      <SiteFooter />
    </div>
  )
}
