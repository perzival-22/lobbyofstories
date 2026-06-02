import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

// Admin only — create a new book
export async function POST(req: NextRequest) {
  const { userId } = await auth()

  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, description, series, genre, coverUrl } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) + `-${Date.now()}`

    const book = await prisma.book.create({
      data: {
        slug,
        title,
        author: author || 'Kelvin Wilch',
        description: description || null,
        series: series || null,
        genre: genre || null,
        coverUrl: coverUrl || null,
        status: 'DRAFT',
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (err) {
    console.error('POST /api/books error:', err)
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }
}
