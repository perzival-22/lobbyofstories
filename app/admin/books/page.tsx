import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminBooksPage() {
  const books = await prisma.book.findMany({
    orderBy: { updatedAt: 'desc' },
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
    <div className="admin-page">
      <div className="admin-page__head">
        <h1 className="admin-page__title">All books</h1>
        <Link href="/admin/books/new" className="admin-btn admin-btn--primary">
          + Add book
        </Link>
      </div>

      {books.length === 0 ? (
        <p className="admin-muted">
          No books yet.{' '}
          <Link href="/admin/books/new" className="admin-link">Add your first.</Link>
        </p>
      ) : (
        <ul className="admin-list">
          {books.map(book => (
            <li key={book.id}>
              <Link href={`/admin/books/${book.id}/edit`} className="admin-list__row">
                <span className="admin-list__main">
                  <span className="admin-list__name">{book.title}</span>
                  <span className="admin-list__meta">
                    {book._count.chapters} chapter{book._count.chapters !== 1 ? 's' : ''}
                    {book.series ? ` · ${book.series}` : ' · Standalone'}
                    {book.genre ? ` · ${book.genre}` : ''}
                  </span>
                </span>
                <span className="admin-list__end">
                  <span
                    className={`admin-pill${book.status === 'PUBLISHED' ? ' admin-pill--live' : ''}`}
                  >
                    {book.status}
                  </span>
                  <span className="admin-list__go">Edit →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
