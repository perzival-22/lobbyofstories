import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { countWords } from '@/lib/parseBook'
import { isAdmin } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/books/[id]/chapters
//
// Admin only — appends a new empty chapter to the end of the book. Paired with
// PATCH/DELETE on the [chapterId] route, this lets the admin workspace build a
// book chapter by chapter instead of re-pasting the whole manuscript.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const { userId } = await auth()

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const book = await prisma.book.findUnique({ where: { id }, select: { id: true } })
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Body is optional — the common case is "add an empty chapter and start
    // typing", so an empty request is valid.
    const body = await req.json().catch(() => ({}))
    const content = typeof body.content === 'string' ? body.content : ''

    const last = await prisma.chapter.findFirst({
      where: { bookId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const order = (last?.order ?? 0) + 1

    const chapter = await prisma.chapter.create({
      data: {
        bookId: id,
        order,
        title: typeof body.title === 'string' && body.title.trim()
          ? body.title.trim()
          : `Chapter ${order}`,
        content,
        wordCount: countWords(content),
      },
    })

    return NextResponse.json(chapter, { status: 201 })
  } catch (err) {
    console.error('POST /api/books/[id]/chapters error:', err)
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 })
  }
}
