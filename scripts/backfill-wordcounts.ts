/**
 * scripts/backfill-wordcounts.ts
 *
 * One-off backfill for Chapter.wordCount.
 *
 * Background:
 *   Chapter.wordCount was added so the reader page, book detail page, and TOC
 *   can show "~N min read" without selecting full chapter bodies from the
 *   database. New/updated chapters get it computed at ingest
 *   (lib/ingestChapters.ts + the append branch of /api/admin/ingest); rows
 *   that existed before the column default to 0 and are filled in here.
 *
 * Run once, after `npx prisma db push`:
 *   npx tsx scripts/backfill-wordcounts.ts
 *
 * Safe to re-run: it only touches rows where wordCount is still 0.
 */

import { prisma } from '../lib/db';
import { countWords } from '../lib/parseBook';

async function main() {
  const chapters = await prisma.chapter.findMany({
    where: { wordCount: 0 },
    select: { id: true, title: true, content: true },
  });

  if (chapters.length === 0) {
    console.log('✅ No chapters need backfilling.');
    return;
  }

  for (const ch of chapters) {
    const wordCount = countWords(ch.content);
    await prisma.chapter.update({
      where: { id: ch.id },
      data: { wordCount },
    });
    console.log(`  - "${ch.title}" → ${wordCount} words`);
  }

  console.log(`\n✅ Backfilled ${chapters.length} chapter(s).`);
}

main()
  .catch((err) => {
    console.error('backfill-wordcounts failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
