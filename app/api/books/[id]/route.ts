import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { replaceBookChapters } from '@/lib/ingestChapters'
import { isAdmin } from '@/lib/auth'

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

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, description, series, genre, coverUrl, rawText, status, confirmReset } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Ensure the book exists before doing any chapter work.
    const existing = await prisma.book.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
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

    // If new story text is provided: replace chapters non-destructively.
    // Standardized on parseBook.ts (via replaceBookChapters) so reader progress
    // is preserved by upserting on [bookId, order] instead of wiping everything.
    if (rawText && rawText.trim()) {
      const result = await replaceBookChapters(id, rawText, { confirmReset })

      if (result.status === 'empty') {
        return NextResponse.json(
          {
            error:
              'No chapters found. Expected "## Chapter 1: Title" headings ' +
              '(optionally preceded by a "# Book Title" line).',
          },
          { status: 422 }
        )
      }

      if (result.status === 'needs-confirm') {
        return NextResponse.json(
          {
            error:
              'Updating the story text would delete chapters and their reader ' +
              'progress. Resend with confirmReset: true to proceed.',
            chaptersToDelete: result.chaptersToDelete,
            progressRowsToDelete: result.progressRowsToDelete,
          },
          { status: 409 }
        )
      }

      // The book title in the pasted text (the `# …` line) takes precedence
      // over the form's title field when present.
      if (result.status === 'ok' && result.title) {
        updateData.title = result.title
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

  if (!isAdmin(userId)) {
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
