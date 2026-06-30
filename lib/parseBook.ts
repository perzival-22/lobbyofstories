/**
 * parseBook.ts
 *
 * Parses the formatted Book text into a Book title + ordered Chapters.
 *
 * This is the single source of truth for what counts as valid book text.
 * The ONLY format recognized is:
 *
 *   # Book Title
 *
 *   ## Chapter 1: The Beginning
 *
 *   Prose body for chapter one…
 *
 *   ## Chapter 2: What Comes Next
 *
 *   More prose…
 *
 * Rules:
 *   - A single `#` line is the Book title (the first one wins). It is optional;
 *     when absent, `title` is null and the caller keeps the existing book title.
 *   - A `##` line starting with `Chapter <N>` opens a chapter. The title after
 *     the number is optional and may be separated by `:`, `.`, `-`, `–` or `—`.
 *     When omitted, the title falls back to `Chapter <N>`.
 *   - Chapters are renumbered into a clean 1..N global `order` regardless of the
 *     numbers the author typed, so ordering is always contiguous.
 *   - Everything between one chapter heading and the next is that chapter's prose.
 *   - Text before the first chapter heading (other than the title line) is ignored.
 */

export interface ParsedChapter {
  order: number; // 1-based, contiguous across the whole book
  title: string; // e.g. "The Beginning"
  body: string;  // prose only
}

export interface ParsedBook {
  title: string | null; // from the `# …` line, or null when absent
  chapters: ParsedChapter[];
}

// ─── Heading detection ────────────────────────────────────────────────────────

// `## Chapter 1: Title` / `## Chapter 1` / `## Chapter 1 — Title`
const CHAPTER_HEADING_RE = /^##\s+Chapter\s+(\d+)\s*(?:[:.\-–—]\s*(.+))?$/i;

// `# Book Title` — a single-hash line (won't match `##` chapter lines).
const TITLE_RE = /^#\s+(.+)$/;

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseBookText(rawText: string): ParsedBook {
  const lines = rawText.split('\n');

  let title: string | null = null;
  const chapters: ParsedChapter[] = [];

  let current: { order: number; title: string; bodyLines: string[] } | null = null;
  let order = 0;

  const flush = () => {
    if (!current) return;
    const bodyLines = [...current.bodyLines];
    // Trim leading + trailing blank lines from the prose body.
    while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
    chapters.push({
      order: current.order,
      title: current.title,
      body: bodyLines.join('\n').trim(),
    });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const chapterMatch = trimmed.match(CHAPTER_HEADING_RE);
    if (chapterMatch) {
      flush();
      order += 1;
      const number = chapterMatch[1];
      const chapterTitle = chapterMatch[2]?.trim() || `Chapter ${number}`;
      current = { order, title: chapterTitle, bodyLines: [] };
      continue;
    }

    // Capture the book title only from the preamble (before the first chapter),
    // and only the first one we see.
    if (!current && title === null) {
      const titleMatch = trimmed.match(TITLE_RE);
      if (titleMatch) {
        title = titleMatch[1].trim();
        continue;
      }
    }

    if (current) {
      current.bodyLines.push(line);
    }
    // Lines before the first chapter (other than the title) are ignored.
  }

  flush();

  return { title, chapters };
}
