import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminBooksPage() {
  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      series: true,
      genre: true,
      _count: { select: { chapters: true } },
    },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl" style={{ fontFamily: 'Playfair Display, serif' }}>
          All Books
        </h1>
        <Link
          href="/admin/books/new"
          className="px-5 py-2 text-sm tracking-wide transition-colors"
          style={{ background: 'var(--gold)', color: 'var(--ink)', fontWeight: 500 }}
        >
          + Add Book
        </Link>
      </div>

      {books.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          No books yet.{' '}
          <Link href="/admin/books/new" style={{ color: 'var(--gold)' }}>
            Add your first.
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/admin/books/${book.id}/edit`}
              className="flex items-center justify-between px-5 py-4 transition-colors hover:border-amber-700 group"
              style={{ background: '#1a1714', border: '1px solid #2a2520' }}
            >
              <div>
                <p className="font-medium group-hover:text-white transition-colors">
                  {book.title}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {book._count.chapters} chapter{book._count.chapters !== 1 ? 's' : ''}
                  {book.series ? ` · ${book.series}` : ' · Standalone'}
                  {book.genre ? ` · ${book.genre}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-2 py-1 tracking-widest uppercase"
                  style={{
                    background:
                      book.status === 'PUBLISHED'
                        ? 'rgba(201,168,76,0.15)'
                        : 'rgba(255,255,255,0.05)',
                    color:
                      book.status === 'PUBLISHED' ? 'var(--gold)' : 'var(--muted)',
                    border: `1px solid ${
                      book.status === 'PUBLISHED' ? 'var(--gold-dim)' : '#3a3530'
                    }`,
                  }}
                >
                  {book.status}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Edit →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
