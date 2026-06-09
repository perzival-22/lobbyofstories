import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const book = await prisma.book.findUnique({
    where: { id, status: 'PUBLISHED' },
    select: { title: true, description: true, coverUrl: true },
  })
  if (!book) return { title: 'Story not found' }
  return {
    title: `${book.title} — Lobby of Stories`,
    description: book.description ?? `Read ${book.title} on Lobby of Stories.`,
    openGraph: {
      title: book.title,
      description: book.description ?? `Read ${book.title} on Lobby of Stories.`,
      images: book.coverUrl ? [{ url: book.coverUrl }] : [],
    },
  }
}

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params
  const { userId } = await auth()

  const book = await prisma.book.findUnique({
    where: { id, status: 'PUBLISHED' },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, order: true, content: true },
      },
    },
  })

  if (!book) notFound()

  // Determine resume chapter for signed-in users
  let resumeChapterId: string | null = null

  if (userId && book.chapters.length > 0) {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (user) {
      const progress = await prisma.readingProgress.findMany({
        where: {
          userId: user.id,
          chapterId: { in: book.chapters.map(c => c.id) },
        },
        orderBy: { lastReadAt: 'desc' },
      })
      if (progress.length > 0) {
        // Prefer the most recently touched in-progress chapter;
        // fall back to the most recently touched one overall
        const inProgress = progress.find(p => !p.completed)
        resumeChapterId = inProgress?.chapterId ?? progress[0].chapterId
      }
    }
  }

  const firstChapterId = book.chapters[0]?.id
  const ctaChapterId = resumeChapterId ?? firstChapterId

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <SiteHeader />

      <div className="px-8 py-16 max-w-5xl mx-auto">
        <Link
          href="/discover"
          className="text-xs tracking-widest uppercase mb-12 block transition-colors hover:text-white"
          style={{ color: 'var(--muted)' }}
        >
          ← All Stories
        </Link>

        {/* Hero row */}
        <div className="flex flex-col md:flex-row gap-12 mb-20">
          {/* Cover */}
          <div className="flex-shrink-0 w-full md:w-56">
            <div
              className="aspect-[2/3] relative overflow-hidden"
              style={{ background: '#22201c', border: '1px solid #2a2520' }}
            >
              {book.coverUrl ? (
                <Image src={book.coverUrl} alt={book.title} fill priority className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6 text-center">
                  <span className="text-2xl leading-snug" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold-dim)' }}>
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex-1">
            {book.series && (
              <p className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--gold)' }}>
                {book.series}
              </p>
            )}
            <h1 className="text-5xl mb-3 leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              {book.title}
            </h1>
            <p className="mb-5 text-sm" style={{ color: 'var(--muted)' }}>by {book.author}</p>

            {book.genre && (
              <span
                className="inline-block text-xs px-3 py-1 tracking-widest uppercase mb-3"
                style={{ border: '1px solid #3a3530', color: 'var(--muted)' }}
              >
                {book.genre}
              </span>
            )}
            <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
              Last updated {new Date(book.updatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>

            {book.description && (
              <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--paper)', maxWidth: '58ch' }}>
                {book.description}
              </p>
            )}

            <div className="flex items-center gap-6">
              {ctaChapterId && (
                <Link
                  href={`/book/${book.id}/read?chapter=${ctaChapterId}`}
                  className="px-8 py-3 text-sm tracking-wide font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'var(--gold)', color: 'var(--ink)' }}
                >
                  {resumeChapterId ? 'Continue Reading' : 'Start Reading'}
                </Link>
              )}
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {book.chapters.length} {book.chapters.length === 1 ? 'chapter' : 'chapters'}
              </span>
            </div>
          </div>
        </div>

        {/* Table of contents */}
        <div>
          <p className="text-xs tracking-widest uppercase mb-5" style={{ color: 'var(--muted)' }}>
            Table of Contents
          </p>
          <div className="flex flex-col">
            {book.chapters.map((chapter, i) => {
              const wordCount = chapter.content.split(/\s+/).length
              const readMins = Math.ceil(wordCount / 200)
              return (
                <Link
                  key={chapter.id}
                  href={`/book/${book.id}/read?chapter=${chapter.id}`}
                  className="flex items-center gap-6 px-5 py-4 text-sm transition-colors hover:text-white group"
                  style={{
                    borderTop: i === 0 ? '1px solid #2a2520' : 'none',
                    borderBottom: '1px solid #2a2520',
                    color: 'var(--muted)',
                  }}
                >
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--gold-dim)', minWidth: '2.5rem', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(chapter.order).padStart(2, '0')}
                  </span>
                  <span className="flex-1 group-hover:text-white transition-colors">{chapter.title}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    ~{readMins} min
                  </span>
                  <span
                    className="text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--gold-dim)' }}
                  >
                    Read →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
