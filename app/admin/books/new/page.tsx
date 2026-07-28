'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { parseBookText } from '@/lib/parseBook'
import { clipboardToBookMarkup } from '@/lib/richPaste'

export default function NewBookPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')

  const [form, setForm] = useState({
    title: '',
    author: 'Kelvin Wilch',
    description: '',
    series: '',
    genre: '',
    status: 'DRAFT',
  })

  const [rawText, setRawText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const set = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  // Same live parse the server will run on submit.
  const parsed = useMemo(() => {
    if (rawText.trim().length < 20) return null
    try {
      return parseBookText(rawText)
    } catch {
      return null
    }
  }, [rawText])

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current
    if (!el || !e.clipboardData) return

    const { text, fromHtml } = clipboardToBookMarkup(e.clipboardData, { allowHeadings: true })
    if (!text) return

    e.preventDefault()
    const start = el.selectionStart
    const end = el.selectionEnd
    setRawText(el.value.slice(0, start) + text + el.value.slice(end))
    if (fromHtml) setNotice('Converted headings, bold and italics from your clipboard.')

    requestAnimationFrame(() => {
      const caret = start + text.length
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    try {
      let coverUrl: string | undefined
      if (coverFile) {
        const uploadData = new FormData()
        uploadData.append('file', coverFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
        if (!uploadRes.ok) throw new Error('Cover upload failed')
        coverUrl = (await uploadRes.json()).url
      }

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rawText: rawText.trim() || undefined, coverUrl }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create book')
      }

      const book = await res.json()
      // Straight into the workspace so the author can keep writing.
      router.push(`/admin/books/${book.id}/edit`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const chapterCount = parsed?.chapters.length ?? 0

  return (
    <div className="admin-page admin-page--narrow">
      <div className="admin-page__head">
        <div>
          <Link href="/admin" className="admin-link admin-link--small">← Dashboard</Link>
          <h1 className="admin-page__title">Add a book</h1>
          <p className="admin-muted">
            Paste a manuscript and its chapters are detected automatically — or create the
            book now and write chapter by chapter in the workspace.
          </p>
        </div>
      </div>

      {saveError && <p className="admin-editor__error">{saveError}</p>}
      {notice && <p className="admin-editor__notice">{notice}</p>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="admin-field">
          <label className="admin-label">Cover image</label>
          <div className="admin-cover">
            {coverPreview && (
              <Image
                src={coverPreview}
                alt="Cover preview"
                width={96}
                height={144}
                unoptimized
                className="admin-cover__img"
              />
            )}
            <label className="admin-cover__drop">
              <span>{coverFile ? coverFile.name : 'Click to upload a cover (optional)'}</span>
              <input type="file" accept="image/*" onChange={handleCoverChange} hidden />
            </label>
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="new-title">Title *</label>
          <input
            id="new-title"
            className="admin-input"
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Valerie Klaś"
          />
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="new-author">Author</label>
            <input
              id="new-author"
              className="admin-input"
              value={form.author}
              onChange={e => set('author', e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="new-status">Status</label>
            <select
              id="new-status"
              className="admin-input"
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              <option value="DRAFT">Draft — not visible to readers</option>
              <option value="PUBLISHED">Published — visible to readers</option>
            </select>
          </div>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="new-series">Series</label>
            <input
              id="new-series"
              className="admin-input"
              value={form.series}
              onChange={e => set('series', e.target.value)}
              placeholder="e.g. Valerie Klaś"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="new-genre">Genre</label>
            <input
              id="new-genre"
              className="admin-input"
              value={form.genre}
              onChange={e => set('genre', e.target.value)}
              placeholder="e.g. Sci-fi / Drama"
            />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="new-description">Description</label>
          <textarea
            id="new-description"
            className="admin-input admin-input--area"
            rows={3}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="A short blurb readers will see on the book page."
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="new-text">Manuscript (optional)</label>
          <p className="admin-hint">
            An optional <code># Book Title</code> line, then a{' '}
            <code>## Chapter N: Title</code> heading before each chapter. Pasting from Word
            or Google Docs keeps bold, italics and headings.
          </p>
          <textarea
            id="new-text"
            ref={textareaRef}
            className="admin-input admin-input--code"
            rows={16}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            onPaste={handlePaste}
            spellCheck={false}
            placeholder={
              '# Book Title\n\n## Chapter 1: The Beginning\n\nYour story text here…\n\n' +
              '## Chapter 2: What Comes Next\n\nMore story…'
            }
          />
          {parsed && (
            <p className={chapterCount === 0 ? 'admin-hint admin-hint--warn' : 'admin-hint'}>
              {chapterCount === 0
                ? 'No chapter headings found yet — add a "## Chapter 1: Title" line.'
                : `${chapterCount} chapter${chapterCount !== 1 ? 's' : ''} detected${
                    parsed.title ? ` · title “${parsed.title}” will be used` : ''
                  }`}
            </p>
          )}
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create book'}
          </button>
          <Link href="/admin/books" className="admin-btn">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
