import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { parseChapterBlocks, countWords } from '@/lib/parseBook'
import { isAdmin } from '@/lib/auth'

// GET /api/books/[id]/chapters/[chapterId]
//
// Returns a single chapter's body — parsed into typed prose blocks — on
// demand so the reader can lazy-load chapters instead of shipping the whole
// book up front.
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

    return NextResponse.json({ id: chapter.id, blocks: parseChapterBlocks(chapter.content) })
  } catch (err) {
    console.error('GET /api/books/[id]/chapters/[chapterId] error:', err)
    return NextResponse.json({ error: 'Failed to fetch chapter' }, { status: 500 })
  }
}

// PATCH /api/books/[id]/chapters/[chapterId]
//
// Admin only — edits one chapter in place. This is the non-destructive
// counterpart to PUT /api/books/[id] with rawText: it never touches the other
// chapters, so chapter ids (and therefore every reader's ReadingProgress)
// survive a typo fix.
//
// Accepts any of `title`, `content`, and `move` ('up' | 'down' — swaps this
// chapter's order with its neighbour).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id, chapterId } = await params
  const { userId } = await auth()

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { title, content, move } = await req.json()

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId: id },
      select: { id: true, order: true },
    })
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    if (move === 'up' || move === 'down') {
      const neighbour = await prisma.chapter.findFirst({
        where: {
          bookId: id,
          order: move === 'up' ? { lt: chapter.order } : { gt: chapter.order },
        },
        orderBy: { order: move === 'up' ? 'desc' : 'asc' },
        select: { id: true, order: true },
      })

      if (!neighbour) {
        return NextResponse.json({ error: 'Chapter is already at the end' }, { status: 400 })
      }

      // [bookId, order] is unique, so the two rows cannot hold the same order
      // even momentarily — park this chapter on a free negative slot first.
      await prisma.$transaction([
        prisma.chapter.update({ where: { id: chapter.id }, data: { order: -1 } }),
        prisma.chapter.update({ where: { id: neighbour.id }, data: { order: chapter.order } }),
        prisma.chapter.update({ where: { id: chapter.id }, data: { order: neighbour.order } }),
      ])
    }

    const data: { title?: string; content?: string; wordCount?: number } = {}

    if (typeof title === 'string') {
      const trimmed = title.trim()
      if (!trimmed) {
        return NextResponse.json({ error: 'Chapter title cannot be empty' }, { status: 400 })
      }
      data.title = trimmed
    }

    if (typeof content === 'string') {
      data.content = content
      data.wordCount = countWords(content)
    }

    const updated = Object.keys(data).length
      ? await prisma.chapter.update({ where: { id: chapterId }, data })
      : await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/books/[id]/chapters/[chapterId] error:', err)
    return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 })
  }
}

// DELETE /api/books/[id]/chapters/[chapterId]
//
// Admin only. Cascade-deletes this chapter's reading progress, then closes the
// gap in `order` so the book stays contiguous at 1..N — the numbering
// parseBook.ts produces. Leaving a hole would make the next full-text replace
// treat unrelated chapters as orphans.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id, chapterId } = await params
  const { userId } = await auth()

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId: id },
      select: { id: true, order: true },
    })
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const following = await prisma.chapter.findMany({
      where: { bookId: id, order: { gt: chapter.order } },
      orderBy: { order: 'asc' },
      select: { id: true, order: true },
    })

    // Ascending order matters: each target slot is vacated by the previous
    // statement before the next one claims it, so the unique index never trips.
    await prisma.$transaction([
      prisma.chapter.delete({ where: { id: chapterId } }),
      ...following.map(c =>
        prisma.chapter.update({ where: { id: c.id }, data: { order: c.order - 1 } })
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/books/[id]/chapters/[chapterId] error:', err)
    return NextResponse.json({ error: 'Failed to delete chapter' }, { status: 500 })
  }
}
