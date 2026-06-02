'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Book = {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  series: string | null
  genre: string | null
  _count: { chapters: number }
}

type Props = {
  books: Book[]
  genres: string[]
  series: string[]
}

const chipStyle = (active: boolean) => ({
  padding: '4px 12px',
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  border: `1px solid ${active ? 'var(--gold)' : '#3a3530'}`,
  color: active ? 'var(--gold)' : 'var(--muted)',
  background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
  borderRadius: '2px',
  transition: 'all 0.15s',
})

export default function DiscoverClient({ books, genres, series }: Props) {
  const [search, setSearch] = useState('')
  const [activeGenre, setActiveGenre] = useState<string | null>(null)
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return books.filter(book => {
      const query = search.toLowerCase()
      const matchesSearch =
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        (book.description?.toLowerCase().includes(query) ?? false)
      const matchesGenre = !activeGenre || book.genre === activeGenre
      const matchesSeries = !activeSeries || book.series === activeSeries
      return matchesSearch && matchesGenre && matchesSeries
    })
  }, [books, search, activeGenre, activeSeries])

  const hasFilters = search || activeGenre || activeSeries
  const clearFilters = () => { setSearch(''); setActiveGenre(null); setActiveSeries(null) }

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title, author, or description…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#1a1714',
            border: '1px solid #3a3530',
            color: 'var(--paper)',
            padding: '10px 16px',
            width: '100%',
            maxWidth: '480px',
            outline: 'none',
            fontFamily: 'Lora, serif',
            fontSize: '0.95rem',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Filter chips */}
      {(genres.length > 0 || series.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-8 items-center">
          {genres.map(g => (
            <button key={g} onClick={() => setActiveGenre(activeGenre === g ? null : g)} style={chipStyle(activeGenre === g)}>
              {g}
            </button>
          ))}
          {series.map(s => (
            <button key={s} onClick={() => setActiveSeries(activeSeries === s ? null : s)} style={chipStyle(activeSeries === s)}>
              {s}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} style={{ fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none' }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Results grid */}
      {filtered.length === 0 ? (
        <div className="py-24 text-center" style={{ color: 'var(--muted)' }}>
          <p>No stories match those filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(book => (
            <Link key={book.id} href={`/book/${book.id}`} className="group">
              <article
                className="h-full transition-transform duration-300 group-hover:-translate-y-1"
                style={{ border: '1px solid #2a2520', borderRadius: '2px' }}
              >
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
    </div>
  )
}
