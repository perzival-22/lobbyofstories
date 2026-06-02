import { prisma } from '@/lib/db'
import SiteHeader from '@/components/SiteHeader'
import DiscoverClient from './DiscoverClient'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const books = await prisma.book.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { chapters: true } } },
  })

  const genres = [...new Set(books.flatMap(b => (b.genre ? [b.genre] : [])))]
  const series = [...new Set(books.flatMap(b => (b.series ? [b.series] : [])))]

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
        <DiscoverClient books={books} genres={genres} series={series} />
      </div>
    </div>
  )
}
