'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    author: 'Kelvin Wilch',
    description: '',
    series: '',
    genre: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create book')
      }

      const book = await res.json()
      router.push(`/admin/books/${book.id}/edit`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <Link
          href="/admin"
          className="text-xs tracking-widest uppercase hover:text-white transition-colors mb-3 block"
          style={{ color: 'var(--muted)' }}
        >
          ← Dashboard
        </Link>
        <h1 className="text-3xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          New Book
        </h1>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 text-sm" style={{ background: 'rgba(200,50,50,0.15)', border: '1px solid rgba(200,50,50,0.4)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-6">
        <div>
          <label style={labelStyle}>Title *</label>
          <input
            required
            style={inputStyle}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Valerie Klaś: Origins"
          />
        </div>

        <div>
          <label style={labelStyle}>Author</label>
          <input
            style={inputStyle}
            value={form.author}
            onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
          />
        </div>

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

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 text-sm tracking-wide font-medium transition-opacity"
            style={{ background: 'var(--gold)', color: 'var(--ink)', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Book'}
          </button>
          <Link
            href="/admin"
            className="px-6 py-3 text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
