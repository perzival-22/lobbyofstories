import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/books/[id]/chapters/[chapterId]
//
// Returns a single chapter's full content on demand so the reader can
// lazy-load chapter bodies instead of shipping the whole book up front.
//
// Public: the parent book must be PUBLISHED. Mirrors the visibility rule used
// by the reader page (app/book/[id]/read/page.tsx).
type RouteContext = { params: Promise<{ id: string; chapterId: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id, chapterId } = await params

  try {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId: id,
        book: { status: 'PUBLISHED' },
      },
      select: { id: true, content: true },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    return NextResponse.json(chapter)
  } catch (err) {
    console.error('GET /api/books/[id]/chapters/[chapterId] error:', err)
    return NextResponse.json({ error: 'Failed to fetch chapter' }, { status: 500 })
  }
}
