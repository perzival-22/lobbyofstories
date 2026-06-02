import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { parseChapters } from '@/lib/parseChapters'

export async function GET() {
  try {
    const books = await prisma.book.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { chapters: true } } },
    })
    return NextResponse.json(books)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, description, series, genre, coverUrl, rawText, status } = body

    if (!title || !rawText) {
      return NextResponse.json({ error: 'Title and story text are required' }, { status: 400 })
    }

    const parsedChapters = parseChapters(rawText)

    const book = await prisma.book.create({
      data: {
        title,
        author: author || 'Kelvin Wilch',
        description: description || null,
        series: series || null,
        genre: genre || null,
        coverUrl: coverUrl || null,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        chapters: {
          create: parsedChapters.map((ch, i) => ({
            title: ch.title,
            content: ch.content,
            order: i + 1,
          })),
        },
      },
      include: { chapters: true },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (err) {
    console.error('POST /api/books error:', err)
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }
}
