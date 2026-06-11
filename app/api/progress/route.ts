import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rateLimit'

// GET /api/progress?bookId=xxx
// Returns all chapter progress for the current user within a book
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bookId = req.nextUrl.searchParams.get('bookId')
  if (!bookId) {
    return NextResponse.json({ error: 'bookId query param required' }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      // No user record yet (webhook hasn't fired) — return empty progress
      return NextResponse.json([])
    }

    const chapters = await prisma.chapter.findMany({
      where: { bookId },
      select: { id: true },
    })

    const chapterIds = chapters.map((c) => c.id)

    const progress = await prisma.readingProgress.findMany({
      where: {
        userId: user.id,
        chapterId: { in: chapterIds },
      },
    })

    return NextResponse.json(progress)
  } catch (err) {
    console.error('GET /api/progress error:', err)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

// POST /api/progress
// Body: { chapterId: string, scrollPosition: number, completed: boolean }
// Upserts the reading progress record for the current user
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit progress writes per user: 60 / minute (scroll saves are debounced
  // client-side, so this is generous headroom for normal reading).
  const limit = rateLimit(`progress:${clerkId}`, 60, 60_000)
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  try {
    const body = await req.json()
    const { chapterId, scrollPosition, completed } = body

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
    }

    // Upsert user record in case the Clerk webhook hasn't fired yet
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: `${clerkId}@placeholder.local`, // replaced on next webhook event
      },
    })

    const progress = await prisma.readingProgress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId,
        },
      },
      update: {
        scrollPosition: scrollPosition ?? 0,
        completed: completed ?? false,
      },
      create: {
        userId: user.id,
        chapterId,
        scrollPosition: scrollPosition ?? 0,
        completed: completed ?? false,
      },
    })

    return NextResponse.json(progress)
  } catch (err) {
    console.error('POST /api/progress error:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
