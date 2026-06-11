'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Chapter = {
  id: string
  title: string
  order: number
  content: string
}

type Book = {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  series: string | null
  genre: string | null
  status: 'DRAFT' | 'PUBLISHED'
  chapters: Chapter[]
}

const inputStyle = {
  background: '#1a1714',
  border: '1px solid #3a3530',
  color: 'var(--paper)',
  padding: '10px 14px',
  width: '100%',
  outline: 'none',
  fontFamily: 'var(--font-lora), serif',
  fontSize: '0.95rem',
  borderRadius: '2px',
} as const

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
  marginBottom: '6px',
}

export default function EditBookPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [book, setBook] = useState<Book | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Cover state
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')

  // Chapter replacement state
  const [showReplaceText, setShowReplaceText] = useState(false)
  const [rawText, setRawText] = useState('')

  const [form, setForm] = useState({
    title: '',
    author: '',
    description: '',
    series: '',
    genre: '',
    status: 'DRAFT',
  })

  const loadBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}`)
      if (!res.ok) throw new Error('Book not found')
      const data: Book = await res.json()
      setBook(data)
      setForm({
        title: data.title,
        author: data.author,
        description: data.description ?? '',
        series: data.series ?? '',
        genre: data.genre ?? '',
        status: data.status,
      })
      if (data.coverUrl) setCoverPreview(data.coverUrl)
    } catch {
      setLoadError('Failed to load book. It may have been deleted.')
    }
  }, [bookId])

  useEffect(() => {
    loadBook()
  }, [loadBook])

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      // Upload new cover if selected
      let coverUrl: string | undefined = undefined
      if (coverFile) {
        const uploadData = new FormData()
        uploadData.append('file', coverFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
        if (!uploadRes.ok) throw new Error('Cover upload failed')
        const { url } = await uploadRes.json()
        coverUrl = url
      }

      const payload: Record<string, unknown> = { ...form }
      if (coverUrl !== undefined) payload.coverUrl = coverUrl
      if (showReplaceText && rawText.trim()) payload.rawText = rawText

      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }

      const updated: Book = await res.json()
      setBook(updated)
      setRawText('')
      setShowReplaceText(false)
      setCoverFile(null)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/admin')
    } catch {
      setSaveError('Failed to delete book')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loadError) {
    return (
      <div className="max-w-3xl">
        <p style={{ color: '#f87171' }}>{loadError}</p>
        <Link href="/admin" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  if (!book) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading...</div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <Link
            href="/admin"
            className="text-xs tracking-widest uppercase hover:text-white transition-colors mb-3 block"
            style={{ color: 'var(--muted)' }}
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Edit Book
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''} ·{' '}
            <span style={{ color: book.status === 'PUBLISHED' ? 'var(--gold)' : 'var(--muted)' }}>
              {book.status}
            </span>
          </p>
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 text-xs tracking-wide transition-colors"
          style={{
            border: '1px solid rgba(200,50,50,0.4)',
            color: confirmDelete ? '#f87171' : '#a87878',
            background: confirmDelete ? 'rgba(200,50,50,0.1)' : 'transparent',
          }}
        >
          {deleting ? 'Deleting...' : confirmDelete ? 'Confirm delete' : 'Delete book'}
        </button>
      </div>

      {saveError && (
        <div className="mb-6 px-4 py-3 text-sm" style={{ background: 'rgba(200,50,50,0.15)', border: '1px solid rgba(200,50,50,0.4)', color: '#f87171' }}>
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-6 px-4 py-3 text-sm" style={{ background: 'rgba(100,180,100,0.1)', border: '1px solid rgba(100,180,100,0.3)', color: '#86efac' }}>
          Saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Cover */}
        <div>
          <label style={labelStyle}>Cover Image</label>
          <div className="flex gap-6 items-start">
            {coverPreview && (
              <Image
                src={coverPreview}
                alt="Cover preview"
                width={96}
                height={144}
                unoptimized
                className="w-24 h-36 object-cover flex-shrink-0"
                style={{ border: '1px solid #3a3530' }}
              />
            )}
            <label className="cursor-pointer flex-1">
              <div
                className="flex items-center justify-center py-8 text-sm"
                style={{ border: '1px dashed #3a3530', color: 'var(--muted)', background: '#1a1714' }}
              >
                {coverFile ? coverFile.name : coverPreview ? 'Click to replace cover' : 'Click to upload cover image'}
              </div>
              <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>Title *</label>
          <input
            required
            style={inputStyle}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Author */}
        <div>
          <label style={labelStyle}>Author</label>
          <input
            style={inputStyle}
            value={form.author}
            onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
          />
        </div>

        {/* Series + Genre */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Series</label>
            <input
              style={inputStyle}
              value={form.series}
              onChange={e => setForm(f => ({ ...f, series: e.target.value }))}
              placeholder="e.g. Valerie Klaś"
            />
          </div>
          <div>
            <label style={labelStyle}>Genre</label>
            <input
              style={inputStyle}
              value={form.genre}
              onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
              placeholder="e.g. Sci-fi / Drama"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Status */}
        <div>
          <label style={labelStyle}>Status</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            <option value="DRAFT">Draft (not visible to readers)</option>
            <option value="PUBLISHED">Published (visible to readers)</option>
          </select>
        </div>

        {/* Current chapters summary */}
        <div>
          <label style={labelStyle}>Current Chapters</label>
          <div style={{ border: '1px solid #2a2520', borderRadius: '2px', overflow: 'hidden' }}>
            {book.chapters.map((ch, i) => (
              <div
                key={ch.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
                style={{
                  borderBottom: i < book.chapters.length - 1 ? '1px solid #2a2520' : 'none',
                  color: 'var(--muted)',
                }}
              >
                <span>
                  <span className="mr-3 text-xs" style={{ color: '#3a3530' }}>
                    {String(ch.order).padStart(2, '0')}
                  </span>
                  {ch.title}
                </span>
                <span className="text-xs" style={{ color: '#3a3530' }}>
                  {ch.content.length.toLocaleString()} chars
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Replace story text (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowReplaceText(v => !v)}
            className="text-sm tracking-wide transition-colors"
            style={{ color: showReplaceText ? 'var(--gold)' : 'var(--muted)' }}
          >
            {showReplaceText ? '▾ Cancel chapter replacement' : '▸ Replace story text (re-parse all chapters)'}
          </button>

          {showReplaceText && (
            <div className="mt-4">
              <p className="text-xs mb-2" style={{ color: '#a87878' }}>
                Warning: this deletes all existing chapters and reading progress, then re-parses the new text.
              </p>
              <textarea
                rows={18}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={'Chapter 1: The Beginning\n\nYour story text here...\n\nChapter 2: What Comes Next\n\nMore story...'}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 text-sm tracking-wide font-medium transition-opacity"
            style={{ background: 'var(--gold)', color: 'var(--ink)', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/book/${bookId}`}
            target="_blank"
            className="px-6 py-3 text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Preview →
          </Link>
        </div>
      </form>
    </div>
  )
}
