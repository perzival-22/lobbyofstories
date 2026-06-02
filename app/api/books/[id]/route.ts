import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { parseChapters } from '@/lib/parseChapters'

type RouteContext = { params: Promise<{ id: string }> }

// Public — readers + admin
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  try {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: 'asc' } },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json(book)
  } catch (err) {
    console.error('GET /api/books/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch book' }, { status: 500 })
  }
}

// Admin only — update metadata and/or replace chapters
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const { userId } = await auth()

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, description, series, genre, coverUrl, rawText, status } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Base metadata update
    const updateData: Parameters<typeof prisma.book.update>[0]['data'] = {
      title,
      author: author || 'Kelvin Wilch',
      description: description || null,
      series: series || null,
      genre: genre || null,
      status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    }

    // Only update coverUrl if explicitly passed (allows keeping existing cover)
    if (coverUrl !== undefined) {
      updateData.coverUrl = coverUrl || null
    }

    // If new story text is provided: delete old chapters + recreate
    // Note: this cascade-deletes ReadingProgress for those chapters
    if (rawText && rawText.trim()) {
      const parsed = parseChapters(rawText)
      await prisma.chapter.deleteMany({ where: { bookId: id } })
      updateData.chapters = {
        create: parsed.map((ch, i) => ({
          title: ch.title,
          content: ch.content,
          order: i + 1,
        })),
      }
    }

    const book = await prisma.book.update({
      where: { id },
      data: updateData,
      include: { chapters: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json(book)
  } catch (err) {
    console.error('PUT /api/books/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 })
  }
}

// Admin only — hard delete (cascades to chapters + progress)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const { userId } = await auth()

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.book.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/books/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 })
  }
}
