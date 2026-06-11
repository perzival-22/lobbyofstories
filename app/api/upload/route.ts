import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { put } from '@vercel/blob'
import { isAdmin } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/rateLimit'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Map allowed MIME types to a canonical extension for the generated filename.
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit per admin user: 20 uploads / minute.
  const limit = rateLimit(`upload:${userId}`, 20, 60_000)
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many uploads. Please slow down.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate MIME type — only allow known image formats.
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PNG, JPEG, WebP.' },
        { status: 415 }
      )
    }

    // Enforce a max size.
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5 MB.' },
        { status: 413 }
      )
    }

    // Generate a random filename instead of trusting file.name (avoids path
    // tricks, collisions, and content sniffing on attacker-controlled names).
    const ext = EXT_BY_MIME[file.type] ?? 'bin'
    const filename = `covers/${crypto.randomUUID()}.${ext}`

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    })

    return NextResponse.json(
      { url: blob.url },
      { headers: rateLimitHeaders(limit) }
    )
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
