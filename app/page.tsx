import Link from 'next/link'
import { prisma } from '@/lib/db'
import SiteHeader from '@/components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const books = await prisma.book.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { chapters: true } } },
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <SiteHeader activePage="home" />

      {/* Hero */}
      <section className="px-8 py-20 max-w-4xl mx-auto text-center">
        <p className="text-xs tracking-widest uppercase mb-6" style={{ color: 'var(--gold)' }}>
          Welcome to the Lobby
        </p>
        <h2 className="text-5xl mb-6 leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
          Stories worth<br />
          <em>sitting with.</em>
        </h2>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
          Original fiction, serialized and growing. Take a seat. The story is already in progress.
        </p>
      </section>

      {/* Books */}
      <section className="px-8 pb-24 max-w-6xl mx-auto">
        {books.length === 0 ? (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>
            <p className="text-lg">The shelves are being stocked. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {books.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`} className="group">
                <article
                  className="h-full transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ border: '1px solid #2a2520', borderRadius: '2px' }}
                >
                  {/* Cover */}
                  <div className="aspect-[2/3] relative overflow-hidden" style={{ background: '#22201c' }}>
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-8 text-center">
                        <span className="text-3xl leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold-dim)' }}>
                          {book.title}
                        </span>
                      </div>
                    )}
                    {book.series && (
                      <div className="absolute top-3 left-3">
                        <span className="text-xs px-2 py-1 tracking-widest uppercase" style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
                          {book.series}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-xl mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>{book.title}</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>{book.author}</p>
                    {book.description && (
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--muted)' }}>{book.description}</p>
                    )}
                    <div className="mt-4 text-xs tracking-widest uppercase" style={{ color: 'var(--gold-dim)' }}>
                      {book._count.chapters} {book._count.chapters === 1 ? 'Chapter' : 'Chapters'}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
