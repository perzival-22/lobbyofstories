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
 *
 * Chapter prose supports a small formatting subset (see parseChapterBlocks):
 *   - Every line is a paragraph (blank lines between them are optional)
 *   - *italic* / _italic_   → emphasis        (**bold** for strong)
 *   - `---` or `* * *`      → scene break (alone on a line)
 *   - `> line`              → blockquote (epigraphs, letters; line breaks kept)
 *   - `| line`              → verse (poems, songs, inscriptions; line breaks kept)
 *   - `\*` `\_` `\\`        → literal *, _, \
 *
 * Bodies are stored as this raw text (single source of truth) and parsed into
 * typed blocks server-side when a chapter is served — the reader renders the
 * blocks as React elements, so no HTML strings ever reach the client.
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

// ─── Chapter body → typed blocks ──────────────────────────────────────────────

/** One run of text inside a paragraph/line; flags are set only when true. */
export interface InlineRun {
  text: string;
  em?: true;
  strong?: true;
}

export type ChapterBlock =
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'scene-break' }
  // `lines` preserve hard line breaks; an empty line array is a stanza gap.
  | { type: 'blockquote'; lines: InlineRun[][] }
  | { type: 'verse'; lines: InlineRun[][] };

// `---` (3+ hyphens) or `***` / `* * *` alone on a line.
const SCENE_BREAK_RE = /^(?:-{3,}|\*(?:\s*\*){2,})$/;

/**
 * Parses inline emphasis: **bold**, *italic*, _italic_, with backslash escapes.
 * Deliberately tiny — markers only open against non-space and close against
 * non-space (so "3 * 4" stays literal), an opener without a closer later in
 * the text is treated as literal, and underscores only toggle at word edges
 * (so snake_case survives).
 */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let buf = '';
  let em: '*' | '_' | null = null;
  let strong = false;

  const flush = () => {
    if (!buf) return;
    const run: InlineRun = { text: buf };
    if (em) run.em = true;
    if (strong) run.strong = true;
    runs.push(run);
    buf = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '\\' && '*_\\'.includes(text[i + 1] ?? '')) {
      buf += text[i + 1];
      i++;
      continue;
    }

    if (ch === '*') {
      if (text[i + 1] === '*') {
        if (strong && /\S/.test(text[i - 1] ?? '')) {
          flush();
          strong = false;
          i++;
          continue;
        }
        if (!strong && /\S/.test(text[i + 2] ?? '') && text.indexOf('**', i + 2) !== -1) {
          flush();
          strong = true;
          i++;
          continue;
        }
        buf += '**';
        i++;
        continue;
      }
      if (em === '*' && /\S/.test(text[i - 1] ?? '')) {
        flush();
        em = null;
        continue;
      }
      if (!em && /\S/.test(text[i + 1] ?? '') && text.indexOf('*', i + 1) !== -1) {
        flush();
        em = '*';
        continue;
      }
      buf += ch;
      continue;
    }

    if (ch === '_') {
      const prev = text[i - 1] ?? '';
      const next = text[i + 1] ?? '';
      if (em === '_' && /\S/.test(prev) && !/[\p{L}\p{N}]/u.test(next)) {
        flush();
        em = null;
        continue;
      }
      if (!em && !/[\p{L}\p{N}]/u.test(prev) && /\S/.test(next) && text.indexOf('_', i + 1) !== -1) {
        flush();
        em = '_';
        continue;
      }
      buf += ch;
      continue;
    }

    buf += ch;
  }

  flush();
  return runs;
}

/** Collects consecutive `marker`-prefixed lines into hard-break-preserving lines. */
function collectPrefixedLines(
  lines: string[],
  start: number,
  marker: '>' | '|'
): { blockLines: InlineRun[][]; end: number } {
  const blockLines: InlineRun[][] = [];
  let i = start;
  while (i < lines.length && lines[i].trim().startsWith(marker)) {
    const stripped = lines[i].trim().slice(1).replace(/^\s/, '');
    blockLines.push(stripped ? parseInline(stripped) : []);
    i++;
  }
  while (blockLines.length && blockLines[blockLines.length - 1].length === 0) {
    blockLines.pop();
  }
  return { blockLines, end: i };
}

/**
 * Parses one chapter's raw prose into typed blocks. Every non-blank line is
 * its own paragraph: the ingested corpus uses one line per paragraph, so
 * joining lines until a blank one (what the reader historically did) fused
 * whole scenes into single wall-of-text paragraphs. Blank lines are allowed
 * but carry no extra meaning.
 */
export function parseChapterBlocks(body: string): ChapterBlock[] {
  const blocks: ChapterBlock[] = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '') continue;

    if (SCENE_BREAK_RE.test(trimmed)) {
      blocks.push({ type: 'scene-break' });
      continue;
    }

    if (trimmed.startsWith('>') || trimmed.startsWith('|')) {
      const marker = trimmed[0] as '>' | '|';
      const { blockLines, end } = collectPrefixedLines(lines, i, marker);
      if (blockLines.length > 0) {
        blocks.push({ type: marker === '>' ? 'blockquote' : 'verse', lines: blockLines });
      }
      i = end - 1;
      continue;
    }

    blocks.push({ type: 'paragraph', runs: parseInline(trimmed.replace(/\s+/g, ' ')) });
  }

  return blocks;
}

/** Word count of a raw chapter body — computed once at ingest, stored on Chapter. */
export function countWords(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}
