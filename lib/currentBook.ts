import { cache } from 'react'
import { auth } from '@clerk/nextjs/server'
import { prisma } from './db'

export type CurrentBook = {
  bookId: string
  title: string
  /** The chapter to resume at — the most recently read one. */
  chapterId: string
}

/**
 * The book the reader is currently in, for the middle slot of the nav island.
 *
 * Wrapped in React's `cache` so a page that also needs it (Discover) shares the
 * one query with the nav rather than issuing a second.
 */
export const getCurrentBook = cache(async (): Promise<CurrentBook | null> => {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const progress = await prisma.readingProgress.findFirst({
    where: {
      user: { clerkId },
      chapter: { book: { status: 'PUBLISHED' } },
    },
    orderBy: { lastReadAt: 'desc' },
    select: {
      chapterId: true,
      chapter: { select: { book: { select: { id: true, title: true } } } },
    },
  })

  if (!progress) return null

  return {
    bookId: progress.chapter.book.id,
    title: progress.chapter.book.title,
    chapterId: progress.chapterId,
  }
})
