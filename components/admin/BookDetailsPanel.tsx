'use client'

/**
 * components/admin/BookDetailsPanel.tsx
 *
 * Book metadata (cover, title, author, series, genre, blurb, status) plus the
 * delete action, in a drawer. Saves via PUT /api/books/[id] *without* rawText,
 * so touching the blurb never goes near the chapter table.
 */

import { useState } from 'react'
import Image from 'next/image'
import AdminDrawer from './AdminDrawer'

export type BookMeta = {
  title: string
  author: string
  description: string
  series: string
  genre: string
  status: string
  coverUrl: string | null
}

type Props = {
  bookId: string
  open: boolean
  meta: BookMeta
  chapterCount: number
  onClose: () => void
  onSaved: (meta: BookMeta) => void
  onDeleted: () => void
}

export default function BookDetailsPanel({
  bookId,
  open,
  meta,
  chapterCount,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [form, setForm] = useState<BookMeta>(meta)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState(meta.coverUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof BookMeta>(key: K, value: BookMeta[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      let coverUrl: string | undefined
      if (coverFile) {
        const data = new FormData()
        data.append('file', coverFile)
        const upload = await fetch('/api/upload', { method: 'POST', body: data })
        if (!upload.ok) throw new Error('Cover upload failed')
        coverUrl = (await upload.json()).url
      }

      // No rawText here — metadata edits must never re-parse chapters.
      const payload: Record<string, unknown> = { ...form }
      if (coverUrl !== undefined) payload.coverUrl = coverUrl

      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }

      const updated = await res.json()
      const next: BookMeta = {
        title: updated.title,
        author: updated.author,
        description: updated.description ?? '',
        series: updated.series ?? '',
        genre: updated.genre ?? '',
        status: updated.status,
        coverUrl: updated.coverUrl ?? null,
      }
      setForm(next)
      setCoverFile(null)
      onSaved(next)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
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
      onDeleted()
    } catch {
      setError('Failed to delete book')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <AdminDrawer
      open={open}
      title="Book details"
      subtitle={`${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
          <button type="button" className="admin-btn" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      {error && <p className="admin-editor__error">{error}</p>}

      <form onSubmit={handleSave} className="admin-form">
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
              <span>
                {coverFile
                  ? coverFile.name
                  : coverPreview
                    ? 'Click to replace cover'
                    : 'Click to upload a cover'}
              </span>
              <input type="file" accept="image/*" onChange={handleCoverChange} hidden />
            </label>
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="book-title">Title *</label>
          <input
            id="book-title"
            className="admin-input"
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="book-author">Author</label>
          <input
            id="book-author"
            className="admin-input"
            value={form.author}
            onChange={e => set('author', e.target.value)}
          />
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label className="admin-label" htmlFor="book-series">Series</label>
            <input
              id="book-series"
              className="admin-input"
              value={form.series}
              onChange={e => set('series', e.target.value)}
              placeholder="e.g. Valerie Klaś"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="book-genre">Genre</label>
            <input
              id="book-genre"
              className="admin-input"
              value={form.genre}
              onChange={e => set('genre', e.target.value)}
              placeholder="e.g. Sci-fi / Drama"
            />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="book-description">Description</label>
          <textarea
            id="book-description"
            className="admin-input admin-input--area"
            rows={4}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="A short blurb readers will see on the book page."
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="book-status">Status</label>
          <select
            id="book-status"
            className="admin-input"
            value={form.status}
            onChange={e => set('status', e.target.value)}
          >
            <option value="DRAFT">Draft — not visible to readers</option>
            <option value="PUBLISHED">Published — visible to readers</option>
          </select>
        </div>

        {/* Submitting via Enter in a text field should save, not reload. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      <div className="admin-danger">
        <p className="admin-danger__title">Danger zone</p>
        <p className="admin-danger__text">
          Deleting this book removes all {chapterCount} chapter
          {chapterCount !== 1 ? 's' : ''} and every reader’s progress. This cannot be undone.
        </p>
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : confirmDelete ? 'Click again to confirm' : 'Delete book'}
        </button>
      </div>
    </AdminDrawer>
  )
}
