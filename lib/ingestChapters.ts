/**
 * lib/ingestChapters.ts
 *
 * Shared, non-destructive chapter-replacement logic used by both the admin
 * ingest route (POST /api/admin/ingest, mode "replace") and the book update
 * route (PUT /api/books/[id], rawText branch).
 *
 * Both paths parse the formatted book text with `parseBook.ts` (Book title +
 * Chapters format) and then UPSERT every chapter by its [bookId, order] key.
 * Upserting (rather than deleteMany + create) preserves each Chapter's id for
 * orders that already exist, which in turn preserves every reader's
 * ReadingProgress (the FK points at chapterId).
 *
 * Chapters whose `order` no longer exists in the new parse ("orphans") are the
 * only rows that get deleted — and only when the caller passes
 * `confirmReset: true`, since deleting them cascade-deletes reader progress.
 * Without that flag, the function reports how many chapters and progress rows
 * the operation would remove so the caller can return a 409.
 */

import { prisma } from './db';
import { parseBookText, countWords } from './parseBook';

export type IngestResult =
  // No chapters parsed from the text.
  | { status: 'empty' }
  // Destructive: orphan chapters would be deleted; caller must confirm.
  | { status: 'needs-confirm'; chaptersToDelete: number; progressRowsToDelete: number }
  // Applied successfully.
  | {
      status: 'ok';
      title: string | null; // book title parsed from the `# …` line, if any
      chaptersIngested: number;
      chaptersDeleted: number;
      chapters: { order: number; title: string }[];
    };

export async function replaceBookChapters(
  bookId: string,
  rawText: string,
  opts: { confirmReset?: boolean } = {}
): Promise<IngestResult> {
  const { title, chapters } = parseBookText(rawText);
  if (chapters.length === 0) {
    return { status: 'empty' };
  }

  const newOrders = new Set(chapters.map((c) => c.order));

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

  // Upsert every chapter by [bookId, order]. Existing orders are updated in
  // place (id preserved → ReadingProgress preserved); new orders are created.
  await prisma.$transaction(
    chapters.map((chapter) =>
      prisma.chapter.upsert({
        where: { bookId_order: { bookId, order: chapter.order } },
        update: {
          title: chapter.title,
          content: chapter.body,
          wordCount: countWords(chapter.body),
        },
        create: {
          bookId,
          order: chapter.order,
          title: chapter.title,
          content: chapter.body,
          wordCount: countWords(chapter.body),
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
    title,
    chaptersIngested: chapters.length,
    chaptersDeleted,
    chapters: chapters.map((c) => ({ order: c.order, title: c.title })),
  };
}
