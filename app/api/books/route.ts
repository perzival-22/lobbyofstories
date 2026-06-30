import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { parseBookText } from '@/lib/parseBook'

// Admin only — create a new book. When `rawText` is provided it is parsed with
// the Book title + Chapters format (lib/parseBook.ts) and the chapters are
// created with the book. A `# …` title line in the text overrides the title field.
export async function POST(req: NextRequest) {
  const { userId } = await auth()

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, description, series, genre, coverUrl, rawText } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Parse story text up front (when present) so we can fail before creating a
    // book if the format is wrong.
    let parsedTitle: string | null = null
    let chapters: { order: number; title: string; body: string }[] = []
    if (rawText && rawText.trim()) {
      const parsed = parseBookText(rawText)
      if (parsed.chapters.length === 0) {
        return NextResponse.json(
          {
            error:
              'No chapters found. Expected "## Chapter 1: Title" headings ' +
              '(optionally preceded by a "# Book Title" line).',
          },
          { status: 422 }
        )
      }
      parsedTitle = parsed.title
      chapters = parsed.chapters
    }

    const finalTitle = parsedTitle || title

    const slug =
      finalTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) + `-${Date.now()}`

    const book = await prisma.book.create({
      data: {
        slug,
        title: finalTitle,
        author: author || 'Kelvin Wilch',
        description: description || null,
        series: series || null,
        genre: genre || null,
        coverUrl: coverUrl || null,
        status: 'DRAFT',
        chapters: chapters.length
          ? {
              create: chapters.map((c) => ({
                order: c.order,
                title: c.title,
                content: c.body,
              })),
            }
          : undefined,
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (err) {
    console.error('POST /api/books error:', err)
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }
}
