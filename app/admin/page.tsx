import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Admin dashboard.
 *
 * This route previously rendered a duplicate of the "Add book" form, so the
 * sidebar's Dashboard link and every "← Dashboard" back-link landed on a second
 * new-book page. It is now an actual overview.
 */
export default async function AdminDashboardPage() {
  const [books, chapters, readers] = await Promise.all([
    prisma.book.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        series: true,
        genre: true,
        updatedAt: true,
        _count: { select: { chapters: true } },
      },
    }),
    prisma.chapter.aggregate({ _count: { _all: true }, _sum: { wordCount: true } }),
    prisma.user.count(),
  ])

  const published = books.filter(b => b.status === 'PUBLISHED').length
  const stats = [
    { label: 'Books', value: books.length },
    { label: 'Published', value: published },
    { label: 'Chapters', value: chapters._count._all },
    { label: 'Words', value: chapters._sum.wordCount ?? 0 },
    { label: 'Readers', value: readers },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">Dashboard</h1>
          <p className="admin-muted">
            {books.length === 0
              ? 'Nothing here yet — add your first book.'
              : `${published} of ${books.length} book${books.length !== 1 ? 's' : ''} live.`}
          </p>
        </div>
        <Link href="/admin/books/new" className="admin-btn admin-btn--primary">
          + Add book
        </Link>
      </div>

      <div className="admin-stats">
        {stats.map(stat => (
          <div key={stat.label} className="admin-stat">
            <p className="admin-stat__value">{stat.value.toLocaleString()}</p>
            <p className="admin-stat__label">{stat.label}</p>
          </div>
        ))}
      </div>

      <h2 className="admin-section__title">Recently updated</h2>

      {books.length === 0 ? (
        <p className="admin-muted">
          No books yet.{' '}
          <Link href="/admin/books/new" className="admin-link">Add your first.</Link>
        </p>
      ) : (
        <ul className="admin-list">
          {books.slice(0, 8).map(book => (
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
