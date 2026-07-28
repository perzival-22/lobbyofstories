/**
 * lib/richPaste.ts
 *
 * Converts rich clipboard HTML (Word, Google Docs, Scrivener, another browser
 * tab) into the book markup that lib/parseBook.ts understands.
 *
 * Authors write in a word processor and paste here. Without this, every
 * italicised thought and every styled chapter heading arrives as flat text and
 * has to be re-marked by hand. The mapping is deliberately narrow — it only
 * emits constructs parseBook.ts can read back:
 *
 *   <b>/<strong>/font-weight:600+   → **bold**
 *   <i>/<em>/font-style:italic      → *italic*
 *   <blockquote>                    → "> " prefixed lines
 *   <hr>                            → ---            (scene break)
 *   <h1> (first one)                → # Book Title
 *   <h1> (later) / <h2>…<h6>        → ## Chapter N: Title
 *   <p>/<div>/<li>/<br>             → one line per paragraph
 *
 * Everything else (colour, underline, font family, size, links, images) is
 * dropped — the reader renders prose blocks, not arbitrary HTML, so there is
 * nowhere for it to go.
 *
 * Browser-only: uses DOMParser. Callers on the server get '' back.
 */

/** Block-level tags: each one closes the paragraph being accumulated. */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
])

/** Tags whose content is never prose. Word pastes a huge <style> block. */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT',
  'IMG', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME', 'O:P',
])

const HEADING_RE = /^H[1-6]$/

/** Selector form of BLOCK_TAGS, for spotting block content inside a wrapper. */
const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(',').toLowerCase()

/** Leading bullet glyphs Word/Docs bake into list paragraphs as literal text. */
const BULLET_RE = /^[•·▪◦‣⁃]\s*/

export interface RichPasteOptions {
  /**
   * Emit `# Title` / `## Chapter N: Title` lines for headings. True for the
   * whole-book textarea; false in the single-chapter editor, where a heading
   * would silently split the chapter in two on the next save.
   */
  allowHeadings?: boolean
}

/** Running state for heading conversion — the book title is claimed once. */
interface HeadingState {
  sawTitle: boolean
  chapterNo: number
}

// ─── Inline formatting detection ─────────────────────────────────────────────

/** Reads one declaration out of an element's inline `style` attribute. */
function styleValue(el: Element, prop: string): string {
  const style = el.getAttribute('style')
  if (!style) return ''
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))
  return m ? m[1].trim().toLowerCase() : ''
}

/**
 * Resolves boldness for an element, given what it inherits.
 *
 * An explicit inline `font-weight` outranks the tag. This is not a nicety:
 * Google Docs wraps its entire clipboard payload in
 * `<b style="font-weight:normal">`, so trusting the tag alone renders a whole
 * pasted manuscript in bold.
 */
function boldState(el: Element, inherited: boolean): boolean {
  const weight = styleValue(el, 'font-weight')
  if (weight) {
    if (weight === 'bold' || weight === 'bolder') return true
    if (weight === 'normal' || weight === 'lighter') return false
    // Google Docs writes numeric weights: 400 for normal, 700 for bold.
    const numeric = parseInt(weight, 10)
    if (Number.isFinite(numeric)) return numeric >= 600
  }
  if (el.tagName === 'B' || el.tagName === 'STRONG') return true
  return inherited
}

function italicState(el: Element, inherited: boolean): boolean {
  const style = styleValue(el, 'font-style')
  if (style) {
    if (style === 'italic' || style === 'oblique') return true
    if (style === 'normal') return false
  }
  if (el.tagName === 'I' || el.tagName === 'EM' || el.tagName === 'CITE') return true
  return inherited
}

/** True when an inline-looking element actually wraps block content. */
function containsBlock(el: Element): boolean {
  return el.querySelector(BLOCK_SELECTOR) !== null
}

// ─── Text handling ───────────────────────────────────────────────────────────

/**
 * Escapes characters the inline parser would otherwise treat as markers.
 *
 * `_` is deliberately left alone: parseInline only toggles underscore emphasis
 * at word edges, so ordinary prose survives, and escaping every one of them
 * would fill the editor with `\_` noise.
 */
function escapeText(text: string): string {
  return text
    // Source newlines and indentation inside a paragraph are just whitespace in
    // HTML. Collapsing them here keeps `\n` meaning exactly one thing further
    // down — a <br> — so pretty-printed markup doesn't shatter into paragraphs.
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
}

/** Collapses runs of whitespace (incl. nbsp) and strips list bullet glyphs. */
function tidy(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
    .replace(BULLET_RE, '')
    .trim()
}

/**
 * Wraps text in an emphasis marker, keeping surrounding whitespace outside it.
 * parseInline requires a non-space character on the inside of both markers, so
 * `* text *` would never close.
 */
function wrapMarker(text: string, marker: string): string {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!m || !m[2]) return text
  return `${m[1]}${marker}${m[2]}${marker}${m[3]}`
}

/**
 * Renders an inline subtree to markup. `ctx` carries emphasis inherited from
 * ancestors so nested <b><b>x</b></b> emits one pair of markers, not two.
 */
function inlineText(node: Node, ctx: { em: boolean; strong: boolean }): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return escapeText(node.nodeValue ?? '')
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return ''

  const el = node as Element
  if (SKIP_TAGS.has(el.tagName)) return ''
  if (el.tagName === 'BR') return '\n'

  const em = italicState(el, ctx.em)
  const strong = boldState(el, ctx.strong)

  let inner = ''
  el.childNodes.forEach(child => {
    inner += inlineText(child, { em, strong })
  })

  // Italic first so bold ends up on the outside: **bold *and italic* **.
  if (!ctx.em && em) inner = wrapMarker(inner, '*')
  if (!ctx.strong && strong) inner = wrapMarker(inner, '**')
  return inner
}

// ─── Heading conversion ──────────────────────────────────────────────────────

/**
 * Turns a heading element into a `#` or `##` line.
 *
 * The first <h1> becomes the book title. Everything after it is a chapter —
 * many manuscripts use Heading 1 per chapter with no separate title. A heading
 * that already reads "Chapter 4 — Ash" keeps its own number; anything else is
 * numbered sequentially, so styled-but-unnumbered headings still parse.
 */
function headingLine(text: string, tag: string, state: HeadingState): string {
  if (tag === 'H1' && !state.sawTitle && state.chapterNo === 0) {
    state.sawTitle = true
    return `# ${text}`
  }

  const existing = text.match(/^chapter\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i)
  if (existing) {
    const number = parseInt(existing[1], 10)
    state.chapterNo = Number.isFinite(number) ? number : state.chapterNo + 1
    const rest = existing[2].trim()
    return rest ? `## Chapter ${state.chapterNo}: ${rest}` : `## Chapter ${state.chapterNo}`
  }

  state.chapterNo += 1
  return `## Chapter ${state.chapterNo}: ${text}`
}

// ─── Block walk ──────────────────────────────────────────────────────────────

function walkBlocks(
  root: Node,
  lines: string[],
  inQuote: boolean,
  allowHeadings: boolean,
  state: HeadingState
): void {
  let buffer = ''

  // A buffered paragraph may contain \n from <br>; each becomes its own line,
  // which is what the format means by "one line per paragraph".
  const flush = () => {
    const pending = buffer
    buffer = ''
    for (const part of pending.split('\n')) {
      const text = tidy(part)
      if (!text) continue
      lines.push(inQuote ? `> ${text}` : text)
    }
  }

  root.childNodes.forEach(child => {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      buffer += escapeText(child.nodeValue ?? '')
      return
    }
    if (child.nodeType !== 1 /* ELEMENT_NODE */) return

    const el = child as Element
    const tag = el.tagName

    if (SKIP_TAGS.has(tag)) return

    if (tag === 'BR') {
      buffer += '\n'
      return
    }

    if (!BLOCK_TAGS.has(tag)) {
      // An inline tag wrapping block content is a clipboard artefact, not
      // emphasis — Google Docs wraps every paste in <b style="font-weight:normal">.
      // Descend as a block so the paragraphs inside survive.
      if (containsBlock(el)) {
        flush()
        walkBlocks(el, lines, inQuote, allowHeadings, state)
        return
      }
      buffer += inlineText(el, { em: false, strong: false })
      return
    }

    flush()

    if (tag === 'HR') {
      lines.push('---')
      return
    }

    if (tag === 'BLOCKQUOTE') {
      walkBlocks(el, lines, true, allowHeadings, state)
      lines.push('')
      return
    }

    if (HEADING_RE.test(tag)) {
      const text = tidy(el.textContent ?? '')
      if (!text) return
      if (allowHeadings) {
        lines.push('', headingLine(text, tag, state), '')
      } else {
        // Headings are meaningless inside a single chapter body — a stray `##`
        // line would split the chapter on the next save. Keep the words.
        lines.push(inQuote ? `> ${escapeText(text)}` : escapeText(text))
      }
      return
    }

    walkBlocks(el, lines, inQuote, allowHeadings, state)
  })

  flush()
}

/** Trims blank runs down to a single separating line. */
function normalize(lines: string[]): string {
  const out: string[] = []
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Converts a clipboard HTML fragment to book markup. Returns '' when there is
 * nothing usable, so callers can fall back to the plain-text flavour.
 */
export function htmlToBookMarkup(html: string, opts: RichPasteOptions = {}): string {
  if (typeof DOMParser === 'undefined' || !html.trim()) return ''

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return ''
  }
  if (!doc.body) return ''

  const lines: string[] = []
  walkBlocks(doc.body, lines, false, opts.allowHeadings !== false, {
    sawTitle: false,
    chapterNo: 0,
  })

  return normalize(lines)
}

/**
 * Tidies a plain-text paste: normalises line endings and drops the runs of
 * blank lines a PDF or email copy usually carries, without touching markup the
 * author may have typed themselves.
 */
export function plainTextToBookMarkup(text: string): string {
  return normalize(
    text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(line => line.replace(/ /g, ' ').trimEnd())
  )
}

/**
 * Picks the best available clipboard flavour. Rich HTML wins when it carries
 * structure the plain-text flavour lost; otherwise the plain text is used
 * as-is so an author pasting markup they already wrote gets it back verbatim.
 */
export function clipboardToBookMarkup(
  data: DataTransfer,
  opts: RichPasteOptions = {}
): { text: string; fromHtml: boolean } {
  const plain = plainTextToBookMarkup(data.getData('text/plain') ?? '')
  const html = data.getData('text/html')
  if (!html) return { text: plain, fromHtml: false }

  const converted = htmlToBookMarkup(html, opts)
  if (!converted) return { text: plain, fromHtml: false }

  // Only claim the rich path when it actually added something — otherwise the
  // plain flavour is identical and cheaper to reason about.
  const gainedMarkup = /[*>]|^---$/m.test(converted) || /^#{1,2} /m.test(converted)
  return gainedMarkup ? { text: converted, fromHtml: true } : { text: plain, fromHtml: false }
}
