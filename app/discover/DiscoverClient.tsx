'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Book = {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  series: string | null
  genre: string | null
  updatedAt: Date
  _count: { chapters: number }
}

type CurrentlyReading = {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  series: string | null
  chapterId: string
  chapterTitle: string
  totalChapters: number
} | null

type Props = {
  books: Book[]
  genres: string[]
  series: string[]
  currentlyReading: CurrentlyReading
  // Completed-chapter count per book id (signed-in users only)
  progressByBook: Record<string, number>
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

export default function DiscoverClient({ books, genres, series, currentlyReading, progressByBook }: Props) {
  const [search, setSearch] = useState('')
  const [activeGenre, setActiveGenre] = useState<string | null>(null)
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return books.filter((book) => {
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
  const clearFilters = () => {
    setSearch('')
    setActiveGenre(null)
    setActiveSeries(null)
  }

  return (
    <div>
      {/* Continue Reading */}
      {currentlyReading && (
        <div className="mb-12">
          <p
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'var(--gold-dim)',
              marginBottom: '1rem',
            }}
          >
            Continue Reading
          </p>
          <Link href={`/book/${currentlyReading.bookId}/read?chapter=${currentlyReading.chapterId}`}>
            <div
              className="group flex gap-5 p-5 transition-colors"
              style={{
                border: '1px solid #3a3530',
                borderRadius: 2,
                maxWidth: 500,
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = '#1e1c18'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
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
                {currentlyReading.coverUrl ? (
                  <Image
                    src={currentlyReading.coverUrl}
                    alt={currentlyReading.title}
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
                    {currentlyReading.title}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontSize: '1.15rem',
                    color: 'var(--paper)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {currentlyReading.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  {currentlyReading.author}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--gold-dim)' }}>
                  {currentlyReading.chapterTitle}
                </p>
              </div>

              {/* Arrow */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--gold)',
                  opacity: 0.6,
                }}
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
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title, author, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: '#1a1714',
            border: '1px solid #3a3530',
            color: 'var(--paper)',
            padding: '10px 16px',
            width: '100%',
            maxWidth: '480px',
            outline: 'none',
            fontFamily: 'var(--font-lora), serif',
            fontSize: '0.95rem',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Filter chips */}
      {(genres.length > 0 || series.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-8 items-center">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(activeGenre === g ? null : g)}
              style={chipStyle(activeGenre === g)}
            >
              {g}
            </button>
          ))}
          {series.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSeries(activeSeries === s ? null : s)}
              style={chipStyle(activeSeries === s)}
            >
              {s}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                fontSize: '0.7rem',
                color: 'var(--muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
              }}
            >
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
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 justify-items-center">
          {filtered.map((book) => {
            const completedChapters = progressByBook[book.id] ?? 0
            const readPct =
              book._count.chapters > 0
                ? Math.min(100, Math.round((completedChapters / book._count.chapters) * 100))
                : 0
            return (
            <Link key={book.id} href={`/book/${book.id}`} className="group w-full max-w-[200px] mx-auto">
              <article
                className="h-full w-full transition-transform duration-300 group-hover:-translate-y-1"
                style={{ border: '1px solid #2a2520', borderRadius: '2px' }}
              >
                <div
                  className="aspect-[2/3] relative overflow-hidden"
                  style={{ background: '#22201c' }}
                >
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={book.title}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 text-center">
                      <span
                        className="text-xs sm:text-sm md:text-lg leading-tight"
                        style={{
                          fontFamily: 'var(--font-playfair), serif',
                          color: 'var(--gold-dim)',
                        }}
                      >
                        {book.title}
                      </span>
                    </div>
                  )}
                  {book.series && (
                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 max-w-[90%]">
                      <span
                        className="block truncate text-[0.55rem] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 tracking-widest uppercase"
                        style={{ background: 'var(--gold)', color: 'var(--ink)' }}
                      >
                        {book.series}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2 sm:p-4">
                  <h3
                    className="text-xs sm:text-sm md:text-base mb-0.5 sm:mb-1 line-clamp-2"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {book.title}
                  </h3>
                  <p className="text-[0.65rem] sm:text-xs mb-2 truncate" style={{ color: 'var(--muted)' }}>
                    {book.author}
                  </p>
                  {book.description && (
                    <p className="hidden sm:block text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>
                      {book.description}
                    </p>
                  )}
                  <div
                    className="hidden sm:block mt-3 text-[0.65rem] tracking-widest uppercase"
                    style={{ color: 'var(--gold-dim)' }}
                  >
                    {book._count.chapters} {book._count.chapters === 1 ? 'Chapter' : 'Chapters'}
                  </div>
                  <div className="hidden sm:block text-[0.65rem] mt-1" style={{ color: 'var(--gold-dim)' }}>
                    Updated {new Date(book.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                  {completedChapters > 0 && (
                    <div className="mt-2 sm:mt-3">
                      <div style={{ height: 2, background: '#2a2520', borderRadius: 1 }}>
                        <div
                          style={{
                            height: 2,
                            width: `${readPct}%`,
                            background: 'var(--gold)',
                            borderRadius: 1,
                          }}
                        />
                      </div>
                      <p className="text-[0.6rem] sm:text-xs mt-1.5" style={{ color: 'var(--gold-dim)' }}>
                        {readPct >= 100 ? 'Finished ✓' : `${readPct}% read`}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
