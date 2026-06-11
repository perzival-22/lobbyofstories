/**
 * app/api/admin/ingest/route.ts
 *
 * POST /api/admin/ingest
 *
 * Body (JSON):
 *   {
 *     bookId: string,   // existing Book record id
 *     text:   string,   // full pasted book text (formatted output)
 *     mode:   "replace" | "append"   // default: "replace"
 *   }
 *
 * Auth: Clerk — admin only (same guard as other admin routes).
 *
 * What it does:
 *   1. Parses the pasted text into episodes → scenes via parseBookText()
 *   2. In "replace" mode: deletes all existing chapters for the book first
 *   3. Upserts every scene as a Chapter row with metadata fields populated
 *   4. Returns a summary
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseBookText, flattenScenes } from '@/lib/parseBook';

// ─── Auth guard ───────────────────────────────────────────────────────────────

function isAdmin(userId: string | null): boolean {
  const adminUserId = process.env.ADMIN_USER_ID;
  // If the admin id is not configured, fail closed (treat nobody as admin)
  // rather than crashing the route.
  if (!adminUserId) return false;
  return userId === adminUserId;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { bookId: string; text: string; mode?: 'replace' | 'append' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bookId, text, mode = 'replace' } = body;

  if (!bookId || !text) {
    return NextResponse.json(
      { error: 'bookId and text are required' },
      { status: 400 }
    );
  }

  // Verify book exists
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // Parse
  const episodes = parseBookText(text);
  if (episodes.length === 0) {
    return NextResponse.json(
      { error: 'No episodes found. Check that the text starts with # Episode headings.' },
      { status: 422 }
    );
  }

  const scenes = flattenScenes(episodes);
  const totalScenes = scenes.length;

  // In replace mode, wipe existing chapters first
  if (mode === 'replace') {
    await prisma.chapter.deleteMany({ where: { bookId } });
  }

  // Determine starting global order for append mode
  let orderOffset = 0;
  if (mode === 'append') {
    const lastChapter = await prisma.chapter.findFirst({
      where: { bookId },
      orderBy: { order: 'desc' },
    });
    orderOffset = lastChapter?.order ?? 0;
  }

  // Upsert all scenes
  const created = await prisma.$transaction(
    scenes.map((scene) =>
      prisma.chapter.upsert({
        where: {
          bookId_order: {
            bookId,
            order: scene.globalOrder + orderOffset,
          },
        },
        update: {
          episodeNumber: scene.episodeNumber,
          episodeTitle:  scene.episodeTitle,
          sceneNumber:   scene.sceneNumber,
          sceneHeading:  scene.sceneHeading,
          title:         scene.sceneTitle,
          sceneType:     scene.metadata.type     ?? null,
          sceneLocation: scene.metadata.location ?? null,
          sceneAge:      scene.metadata.age      ?? null,
          sceneTime:     scene.metadata.time     ?? null,
          content:       scene.body,
        },
        create: {
          bookId,
          order:         scene.globalOrder + orderOffset,
          episodeNumber: scene.episodeNumber,
          episodeTitle:  scene.episodeTitle,
          sceneNumber:   scene.sceneNumber,
          sceneHeading:  scene.sceneHeading,
          title:         scene.sceneTitle,
          sceneType:     scene.metadata.type     ?? null,
          sceneLocation: scene.metadata.location ?? null,
          sceneAge:      scene.metadata.age      ?? null,
          sceneTime:     scene.metadata.time     ?? null,
          content:       scene.body,
        },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    summary: {
      bookId,
      mode,
      episodesFound:  episodes.length,
      scenesIngested: created.length,
      episodes: episodes.map((ep) => ({
        number: ep.episodeNumber,
        title:  ep.episodeTitle,
        scenes: ep.scenes.length,
      })),
    },
  });
}
