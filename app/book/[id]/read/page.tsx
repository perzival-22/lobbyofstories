import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
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
    include: { chapters: { orderBy: { order: 'asc' } } },
  })

  if (!book || book.chapters.length === 0) notFound()

  const requestedChapter = chapterParam
    ? book.chapters.find(c => c.id === chapterParam)
    : null
  const initialChapter = requestedChapter ?? book.chapters[0]

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

  const chaptersWithWordCount = book.chapters.map(ch => ({
    ...ch,
    wordCount: ch.content.split(/\s+/).length,
  }))

  return (
    <ReaderClient
      bookId={book.id}
      bookTitle={book.title}
      chapters={chaptersWithWordCount}
      initialChapterId={initialChapter.id}
      progressMap={progressMap}
      isSignedIn={!!userId}
    />
  )
}
