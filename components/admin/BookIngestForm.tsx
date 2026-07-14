"use client";

/**
 * components/admin/BookIngestForm.tsx
 *
 * Admin UI for pasting formatted book text and ingesting it into the DB.
 * Shows a live parse preview (chapter count) before committing.
 *
 * Expected format (see lib/parseBook.ts):
 *   # Book Title
 *   ## Chapter 1: Title
 *   prose…
 *
 * Usage:
 *   <BookIngestForm bookId="clxyz..." bookTitle="Valerie Klaś: Origins" />
 */

import React, { useState, useCallback } from "react";
import { parseBookText } from "@/lib/parseBook";

interface Props {
  bookId: string;
  bookTitle: string;
}

type IngestMode = "replace" | "append";
type Status = "idle" | "previewing" | "submitting" | "success" | "error";

interface ParsePreview {
  bookTitle: string | null;
  chapterCount: number;
  chapters: { order: number; title: string }[];
}

export function BookIngestForm({ bookId, bookTitle }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<IngestMode>("replace");
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Live parse preview (runs client-side, no network call)
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      if (val.trim().length < 50) {
        setPreview(null);
        return;
      }

      try {
        const { title, chapters } = parseBookText(val);
        setPreview({
          bookTitle: title,
          chapterCount: chapters.length,
          chapters: chapters.map((c) => ({ order: c.order, title: c.title })),
        });
      } catch {
        setPreview(null);
      }
    },
    []
  );

  const handleSubmit = async () => {
    if (!text.trim() || !preview) return;

    setStatus("submitting");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, text, mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Ingest failed");
      }

      setSuccessMsg(
        `Ingested ${data.summary.chaptersIngested} chapter${data.summary.chaptersIngested !== 1 ? "s" : ""}.`
      );
      setStatus("success");
      setText("");
      setPreview(null);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unknown error");
      setStatus("error");
    }
  };

  const isReady = preview && preview.chapterCount > 0 && status !== "submitting";

  return (
    <div className="ingest-form">
      <div className="ingest-form__header">
        <h2 className="ingest-form__title">Paste Book Text</h2>
        <p className="ingest-form__subtitle">
          <strong>{bookTitle}</strong> — paste the fully formatted book text
          below. The book title and chapters are auto-detected. Inside chapter
          prose: *italic*, **bold**, --- for a scene break, &gt; for quoted
          lines (epigraphs, letters), | for verse (line breaks preserved).
        </p>
      </div>

      {/* Mode toggle */}
      <div className="ingest-form__mode">
        <label className="ingest-form__mode-label">Ingest mode</label>
        <div className="ingest-form__mode-options">
          {(["replace", "append"] as IngestMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`ingest-form__mode-btn ${mode === m ? "ingest-form__mode-btn--active" : ""}`}
            >
              {m === "replace" ? "Replace all" : "Append"}
            </button>
          ))}
        </div>
        {mode === "replace" && (
          <p className="ingest-form__mode-warning">
            ⚠ Replace mode will delete all existing chapters for this book.
          </p>
        )}
      </div>

      {/* Textarea */}
      <textarea
        className="ingest-form__textarea"
        value={text}
        onChange={handleTextChange}
        placeholder={`Paste the formatted book text here…\n\nExpected format:\n# Book Title\n\n## Chapter 1: The Beginning\n\nProse with *italics* and **bold**…\n\n---\n\nA new scene after the break…\n\n> A quoted epigraph or letter,\n> line breaks preserved.\n\n| Verse, poems, or songs —\n| kept line by line.\n\n## Chapter 2: What Comes Next\n\nMore prose…`}
        rows={20}
        disabled={status === "submitting"}
        spellCheck={false}
      />

      {/* Parse preview */}
      {preview && (
        <div className="ingest-form__preview">
          <div className="ingest-form__preview-summary">
            {preview.bookTitle && (
              <>
                Title: <strong>{preview.bookTitle}</strong>
                {" · "}
              </>
            )}
            Detected{" "}
            <strong>{preview.chapterCount} chapter{preview.chapterCount !== 1 ? "s" : ""}</strong>
          </div>
          <ul className="ingest-form__preview-list">
            {preview.chapters.map((ch) => (
              <li key={ch.order}>
                <span className="ingest-form__preview-ep">{String(ch.order).padStart(2, "0")}</span>
                {ch.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status messages */}
      {status === "success" && (
        <p className="ingest-form__success">✓ {successMsg}</p>
      )}
      {status === "error" && (
        <p className="ingest-form__error">✗ {errorMsg}</p>
      )}

      {/* Submit */}
      <button
        className="ingest-form__submit"
        onClick={handleSubmit}
        disabled={!isReady}
      >
        {status === "submitting"
          ? "Ingesting…"
          : `Ingest ${preview?.chapterCount ?? 0} chapter${preview?.chapterCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
