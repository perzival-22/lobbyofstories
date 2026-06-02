"use client";

/**
 * components/admin/BookIngestForm.tsx
 *
 * Admin UI for pasting formatted book text and ingesting it into the DB.
 * Shows a live parse preview (episode/scene count) before committing.
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
  episodeCount: number;
  sceneCount: number;
  episodes: { number: number; title: string; scenes: number }[];
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
        const episodes = parseBookText(val);
        setPreview({
          episodeCount: episodes.length,
          sceneCount: episodes.reduce((acc, ep) => acc + ep.scenes.length, 0),
          episodes: episodes.map((ep) => ({
            number: ep.episodeNumber,
            title: ep.episodeTitle,
            scenes: ep.scenes.length,
          })),
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
        `Ingested ${data.summary.scenesIngested} scenes across ${data.summary.episodesFound} episodes.`
      );
      setStatus("success");
      setText("");
      setPreview(null);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unknown error");
      setStatus("error");
    }
  };

  const isReady = preview && preview.sceneCount > 0 && status !== "submitting";

  return (
    <div className="ingest-form">
      <div className="ingest-form__header">
        <h2 className="ingest-form__title">Paste Book Text</h2>
        <p className="ingest-form__subtitle">
          <strong>{bookTitle}</strong> — paste the fully formatted book text
          below. Episodes and scenes are auto-detected.
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
        placeholder={`Paste the formatted book text here…\n\nExpected format:\n# Episode 1 — "Title"\n\n## SCENE 1 | SCENE NAME\n\nTYPE      Present\nLOCATION  …\nAGE       22\nTIME      …\n\nProse body…`}
        rows={20}
        disabled={status === "submitting"}
        spellCheck={false}
      />

      {/* Parse preview */}
      {preview && (
        <div className="ingest-form__preview">
          <div className="ingest-form__preview-summary">
            Detected{" "}
            <strong>{preview.episodeCount} episode{preview.episodeCount !== 1 ? "s" : ""}</strong>
            {" · "}
            <strong>{preview.sceneCount} scene{preview.sceneCount !== 1 ? "s" : ""}</strong>
          </div>
          <ul className="ingest-form__preview-list">
            {preview.episodes.map((ep) => (
              <li key={ep.number}>
                <span className="ingest-form__preview-ep">Ep. {ep.number}</span>
                {ep.title}
                <span className="ingest-form__preview-count">
                  {ep.scenes} scene{ep.scenes !== 1 ? "s" : ""}
                </span>
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
          : `Ingest ${preview?.sceneCount ?? 0} scenes`}
      </button>
    </div>
  );
}
