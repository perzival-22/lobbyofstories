/**
 * app/api/admin/ingest/route.ts
 *
 * POST /api/admin/ingest
 *
 * Body (JSON):
 *   {
 *     bookId:       string,   // existing Book record id
 *     text:         string,   // full pasted book text (formatted output)
 *     mode:         "replace" | "append"   // default: "replace"
 *     confirmReset: boolean   // required to delete now-orphaned chapters
 *   }
 *
 * Auth: Clerk — admin only (same guard as other admin routes).
 *
 * What it does:
 *   1. Parses the pasted text into episodes → scenes via parseBookText()
 *   2. In "replace" mode: upserts each scene by [bookId, order] (preserving
 *      reader progress) and deletes only chapters whose order no longer exists.
 *      That deletion is destructive, so it requires confirmReset: true — without
 *      it the route returns 409 with the chapter/progress counts at risk.
 *   3. In "append" mode: upserts scenes after the current last chapter.
 *   4. Returns a summary
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseBookText, flattenScenes } from '@/lib/parseBook';
import { replaceBookChapters } from '@/lib/ingestChapters';

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

  let body: {
    bookId: string;
    text: string;
    mode?: 'replace' | 'append';
    confirmReset?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bookId, text, mode = 'replace', confirmReset } = body;

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

  // ── Replace mode: non-destructive upsert-by-order via shared helper ────────
  if (mode === 'replace') {
    const result = await replaceBookChapters(bookId, text, { confirmReset });

    if (result.status === 'empty') {
      return NextResponse.json(
        { error: 'No episodes found. Check that the text starts with # Episode headings.' },
        { status: 422 }
      );
    }

    if (result.status === 'needs-confirm') {
      return NextResponse.json(
        {
          error:
            'This replace would delete chapters and their reader progress. ' +
            'Resend with confirmReset: true to proceed.',
          chaptersToDelete: result.chaptersToDelete,
          progressRowsToDelete: result.progressRowsToDelete,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      summary: {
        bookId,
        mode,
        episodesFound: result.episodesFound,
        scenesIngested: result.scenesIngested,
        chaptersDeleted: result.chaptersDeleted,
        episodes: result.episodes,
      },
    });
  }

  // ── Append mode: add scenes after the existing last chapter ────────────────
  const episodes = parseBookText(text);
  if (episodes.length === 0) {
    return NextResponse.json(
      { error: 'No episodes found. Check that the text starts with # Episode headings.' },
      { status: 422 }
    );
  }

  const scenes = flattenScenes(episodes);

  const lastChapter = await prisma.chapter.findFirst({
    where: { bookId },
    orderBy: { order: 'desc' },
  });
  const orderOffset = lastChapter?.order ?? 0;

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
