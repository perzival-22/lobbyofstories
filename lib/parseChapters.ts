export function parseChapters(rawText: string): { title: string; content: string }[] {
  const lines = rawText.split('\n')
  const chapters: { title: string; content: string }[] = []
  let currentTitle = ''
  let currentLines: string[] = []

  const isHeading = (line: string) =>
    /^(chapter|part|episode|scene|prologue|epilogue|\d+\.)\s/i.test(line.trim()) ||
    /^#{1,3}\s/.test(line.trim())

  for (const line of lines) {
    if (isHeading(line) && line.trim().length > 0) {
      if (currentTitle) {
        chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() })
      }
      currentTitle = line.replace(/^#{1,3}\s/, '').trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentTitle) {
    chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() })
  }

  // If no headings found, treat entire text as one chapter
  if (chapters.length === 0 && rawText.trim()) {
    chapters.push({ title: 'Chapter 1', content: rawText.trim() })
  }

  return chapters
}
