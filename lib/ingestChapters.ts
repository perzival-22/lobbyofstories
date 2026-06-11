/**
 * lib/ingestChapters.ts
 *
 * Shared, non-destructive chapter-replacement logic used by both the admin
 * ingest route (POST /api/admin/ingest, mode "replace") and the book update
 * route (PUT /api/books/[id], rawText branch).
 *
 * Both paths parse the formatted book text with `parseBook.ts` and then
 * UPSERT every scene by its [bookId, order] key. Upserting (rather than
 * deleteMany + create) preserves each Chapter's id for orders that already
 * exist, which in turn preserves every reader's ReadingProgress (the FK points
 * at chapterId).
 *
 * Chapters whose `order` no longer exists in the new parse ("orphans") are the
 * only rows that get deleted — and only when the caller passes
 * `confirmReset: true`, since deleting them cascade-deletes reader progress.
 * Without that flag, the function reports how many chapters and progress rows
 * the operation would remove so the caller can return a 409.
 */

import { prisma } from './db';
import { parseBookText, flattenScenes } from './parseBook';

export type IngestResult =
  // No episodes parsed from the text.
  | { status: 'empty' }
  // Destructive: orphan chapters would be deleted; caller must confirm.
  | { status: 'needs-confirm'; chaptersToDelete: number; progressRowsToDelete: number }
  // Applied successfully.
  | {
      status: 'ok';
      episodesFound: number;
      scenesIngested: number;
      chaptersDeleted: number;
      episodes: { number: number; title: string; scenes: number }[];
    };

export async function replaceBookChapters(
  bookId: string,
  rawText: string,
  opts: { confirmReset?: boolean } = {}
): Promise<IngestResult> {
  const episodes = parseBookText(rawText);
  if (episodes.length === 0) {
    return { status: 'empty' };
  }

  const scenes = flattenScenes(episodes);
  const newOrders = new Set(scenes.map((s) => s.globalOrder));

  // Existing chapters whose order is not present in the new parse get orphaned.
  const existing = await prisma.chapter.findMany({
    where: { bookId },
    select: { id: true, order: true },
  });
  const orphanIds = existing
    .filter((c) => !newOrders.has(c.order))
    .map((c) => c.id);

  // Deleting orphans is the only destructive part — gate it behind confirmReset.
  if (orphanIds.length > 0 && opts.confirmReset !== true) {
    const progressRowsToDelete = await prisma.readingProgress.count({
      where: { chapterId: { in: orphanIds } },
    });
    return {
      status: 'needs-confirm',
      chaptersToDelete: orphanIds.length,
      progressRowsToDelete,
    };
  }

  // Upsert every scene by [bookId, order]. Existing orders are updated in place
  // (id preserved → ReadingProgress preserved); new orders are created.
  await prisma.$transaction(
    scenes.map((scene) =>
      prisma.chapter.upsert({
        where: { bookId_order: { bookId, order: scene.globalOrder } },
        update: {
          episodeNumber: scene.episodeNumber,
          episodeTitle: scene.episodeTitle,
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.sceneHeading,
          title: scene.sceneTitle,
          sceneType: scene.metadata.type ?? null,
          sceneLocation: scene.metadata.location ?? null,
          sceneAge: scene.metadata.age ?? null,
          sceneTime: scene.metadata.time ?? null,
          content: scene.body,
        },
        create: {
          bookId,
          order: scene.globalOrder,
          episodeNumber: scene.episodeNumber,
          episodeTitle: scene.episodeTitle,
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.sceneHeading,
          title: scene.sceneTitle,
          sceneType: scene.metadata.type ?? null,
          sceneLocation: scene.metadata.location ?? null,
          sceneAge: scene.metadata.age ?? null,
          sceneTime: scene.metadata.time ?? null,
          content: scene.body,
        },
      })
    )
  );

  let chaptersDeleted = 0;
  if (orphanIds.length > 0) {
    const del = await prisma.chapter.deleteMany({
      where: { id: { in: orphanIds } },
    });
    chaptersDeleted = del.count;
  }

  return {
    status: 'ok',
    episodesFound: episodes.length,
    scenesIngested: scenes.length,
    chaptersDeleted,
    episodes: episodes.map((ep) => ({
      number: ep.episodeNumber,
      title: ep.episodeTitle,
      scenes: ep.scenes.length,
    })),
  };
}
