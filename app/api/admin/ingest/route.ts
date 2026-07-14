/**
 * app/api/admin/ingest/route.ts
 *
 * POST /api/admin/ingest
 *
 * Body (JSON):
 *   {
 *     bookId:       string,   // existing Book record id
 *     text:         string,   // full pasted book text (Book title + Chapters)
 *     mode:         "replace" | "append"   // default: "replace"
 *     confirmReset: boolean   // required to delete now-orphaned chapters
 *   }
 *
 * Auth: Clerk — admin only (same guard as other admin routes).
 *
 * Expected text format (see lib/parseBook.ts):
 *
 *   # Book Title
 *
 *   ## Chapter 1: The Beginning
 *   Prose…
 *
 *   ## Chapter 2: What Comes Next
 *   Prose…
 *
 * What it does:
 *   1. Parses the pasted text into a Book title + Chapters via parseBookText()
 *   2. In "replace" mode: upserts each chapter by [bookId, order] (preserving
 *      reader progress) and deletes only chapters whose order no longer exists.
 *      That deletion is destructive, so it requires confirmReset: true — without
 *      it the route returns 409 with the chapter/progress counts at risk.
 *   3. In "append" mode: upserts chapters after the current last chapter.
 *   4. When the text carries a `# …` title line, the Book title is updated to it.
 *   5. Returns a summary
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseBookText, countWords } from '@/lib/parseBook';
import { replaceBookChapters } from '@/lib/ingestChapters';
import { isAdmin } from '@/lib/auth';

const NO_CHAPTERS_ERROR =
  'No chapters found. Expected "## Chapter 1: Title" headings (optionally preceded by a "# Book Title" line).';

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
      return NextResponse.json({ error: NO_CHAPTERS_ERROR }, { status: 422 });
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

    // Book title comes from the pasted text when a `# …` line is present.
    if (result.title) {
      await prisma.book.update({
        where: { id: bookId },
        data: { title: result.title },
      });
    }

    return NextResponse.json({
      ok: true,
      summary: {
        bookId,
        mode,
        title: result.title,
        chaptersIngested: result.chaptersIngested,
        chaptersDeleted: result.chaptersDeleted,
        chapters: result.chapters,
      },
    });
  }

  // ── Append mode: add chapters after the existing last chapter ──────────────
  const { title, chapters } = parseBookText(text);
  if (chapters.length === 0) {
    return NextResponse.json({ error: NO_CHAPTERS_ERROR }, { status: 422 });
  }

  const lastChapter = await prisma.chapter.findFirst({
    where: { bookId },
    orderBy: { order: 'desc' },
  });
  const orderOffset = lastChapter?.order ?? 0;

  const created = await prisma.$transaction(
    chapters.map((chapter) =>
      prisma.chapter.upsert({
        where: {
          bookId_order: {
            bookId,
            order: chapter.order + orderOffset,
          },
        },
        update: {
          title: chapter.title,
          content: chapter.body,
          wordCount: countWords(chapter.body),
        },
        create: {
          bookId,
          order: chapter.order + orderOffset,
          title: chapter.title,
          content: chapter.body,
          wordCount: countWords(chapter.body),
        },
      })
    )
  );

  if (title) {
    await prisma.book.update({ where: { id: bookId }, data: { title } });
  }

  return NextResponse.json({
    ok: true,
    summary: {
      bookId,
      mode,
      title,
      chaptersIngested: created.length,
      chapters: chapters.map((c) => ({ order: c.order, title: c.title })),
    },
  });
}
