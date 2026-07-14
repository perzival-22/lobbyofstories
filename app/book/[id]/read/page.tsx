import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { parseChapterBlocks } from '@/lib/parseBook'
import ReaderClient from './ReaderClient'

export const dynamic = 'force-dynamic'

export type ProgressEntry = { scrollPosition: number; completed: boolean }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chapter?: string }>
}

export default async function ReaderPage({ params, searchParams }: Props) {
  const { id } = await params
  const { chapter: chapterParam } = await searchParams
  const { userId } = await auth()

  const book = await prisma.book.findUnique({
    where: { id, status: 'PUBLISHED' },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        // Metadata only — chapter bodies stay in the database. The initial
        // chapter's body is fetched separately below; the client lazy-fetches
        // the rest via GET /api/books/[id]/chapters/[chapterId].
        select: {
          id: true,
          title: true,
          order: true,
          wordCount: true,
        },
      },
    },
  })

  if (!book || book.chapters.length === 0) notFound()

  const requestedChapter = chapterParam
    ? book.chapters.find(c => c.id === chapterParam)
    : null
  const initialChapter = requestedChapter ?? book.chapters[0]

  const initialBody = await prisma.chapter.findUnique({
    where: { id: initialChapter.id },
    select: { content: true },
  })

  // Load reading progress for signed-in users
  let progressMap: Record<string, ProgressEntry> = {}

  if (userId) {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (user) {
      const records = await prisma.readingProgress.findMany({
        where: {
          userId: user.id,
          chapterId: { in: book.chapters.map(c => c.id) },
        },
      })
      progressMap = Object.fromEntries(
        records.map(r => [r.chapterId, { scrollPosition: r.scrollPosition, completed: r.completed }])
      )
    }
  }

  return (
    <ReaderClient
      bookId={book.id}
      bookTitle={book.title}
      chapters={book.chapters}
      initialChapterId={initialChapter.id}
      initialChapterBlocks={parseChapterBlocks(initialBody?.content ?? '')}
      progressMap={progressMap}
      isSignedIn={!!userId}
    />
  )
}
