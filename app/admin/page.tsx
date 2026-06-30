'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

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

export default function NewBookPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    try {
      // Upload cover if provided
      let coverUrl: string | undefined = undefined
      if (coverFile) {
        const uploadData = new FormData()
        uploadData.append('file', coverFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
        if (!uploadRes.ok) throw new Error('Cover upload failed')
        const { url } = await uploadRes.json()
        coverUrl = url
      }

      const payload = {
        ...form,
        rawText: rawText.trim() || undefined,
        coverUrl,
      }

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create book')
      }

      const book = await res.json()
      // Redirect to the edit page so the author can continue refining
      router.push(`/admin/books/${book.id}/edit`)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-10">
        <Link
          href="/admin"
          className="text-xs tracking-widest uppercase hover:text-white transition-colors mb-3 block"
          style={{ color: 'var(--muted)' }}
        >
          ← Dashboard
        </Link>
        <h1 className="text-3xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Add New Book
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Paste your story text below and the chapters will be parsed automatically.
        </p>
      </div>

      {saveError && (
        <div
          className="mb-6 px-4 py-3 text-sm"
          style={{
            background: 'rgba(200,50,50,0.15)',
            border: '1px solid rgba(200,50,50,0.4)',
            color: '#f87171',
          }}
        >
          {saveError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                {coverFile ? coverFile.name : 'Click to upload cover image (optional)'}
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
            placeholder="e.g. Valerie Klaś"
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
            placeholder="A short blurb readers will see on the book page."
          />
        </div>

        {/* Story text */}
        <div>
          <label style={labelStyle}>Story Text</label>
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
            Paste the full story in the Book title + Chapters format: an optional
            <code> # Book Title</code> line, then a <code>## Chapter N: Title</code> heading
            before each chapter&apos;s prose. A <code># Book Title</code> line overrides the
            title above.
          </p>
          <textarea
            rows={20}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder={
              '# Book Title\n\n## Chapter 1: The Beginning\n\nYour story text here...\n\n## Chapter 2: What Comes Next\n\nMore story...'
            }
          />
          {rawText.trim() && (
            <p className="text-xs mt-2" style={{ color: 'var(--gold-dim)' }}>
              {rawText.trim().split(/\n\n+/).length} paragraphs detected — chapters will be
              determined by headings on save.
            </p>
          )}
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

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 text-sm tracking-wide font-medium transition-opacity"
            style={{
              background: 'var(--gold)',
              color: 'var(--ink)',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Creating…' : 'Create Book'}
          </button>
          <Link
            href="/admin/books"
            className="px-6 py-3 text-sm transition-colors hover:text-white"
            style={{ color: 'var(--muted)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}