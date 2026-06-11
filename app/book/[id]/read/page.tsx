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
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        // Pull `content` so we can compute wordCount server-side, but it is
        // stripped from every chapter except the initial one before being sent
        // to the client (see below) — the reader lazy-fetches the rest.
        select: {
          id: true,
          title: true,
          order: true,
          content: true,
          sceneType: true,
          sceneLocation: true,
          sceneAge: true,
          sceneTime: true,
        },
      },
    },
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

  // Send only chapter metadata (no `content`) to keep the initial HTML payload
  // small. The body of the initial chapter is sent separately; the client
  // lazy-fetches the rest via GET /api/books/[id]/chapters/[chapterId].
  const chapterMeta = book.chapters.map(ch => ({
    id: ch.id,
    title: ch.title,
    order: ch.order,
    wordCount: ch.content.split(/\s+/).filter(Boolean).length,
    sceneType: ch.sceneType,
    sceneLocation: ch.sceneLocation,
    sceneAge: ch.sceneAge,
    sceneTime: ch.sceneTime,
  }))

  return (
    <ReaderClient
      bookId={book.id}
      bookTitle={book.title}
      chapters={chapterMeta}
      initialChapterId={initialChapter.id}
      initialChapterContent={initialChapter.content}
      progressMap={progressMap}
      isSignedIn={!!userId}
    />
  )
}
