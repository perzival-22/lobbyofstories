"use client";

/**
 * components/reader/SceneHeader.tsx
 *
 * Renders the scene metadata card that appears at the top of each scene
 * in the reader. Visually distinct from prose — never reads as body text.
 *
 * Displays: TYPE · LOCATION · AGE · TIME
 * Collapses gracefully when fields are absent.
 */

import React from "react";

interface SceneHeaderProps {
  episodeNumber: number;
  episodeTitle: string;
  sceneHeading: string;   // e.g. "SCENE 1 | THE EDGE"
  sceneType?: string | null;
  sceneLocation?: string | null;
  sceneAge?: string | null;
  sceneTime?: string | null;
}

// Maps TYPE values to display labels and accent colours
const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  "Cold Open":        { label: "COLD OPEN",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  "Present":          { label: "PRESENT",    color: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
  "Past":             { label: "PAST",       color: "#f59e0b", bg: "rgba(245,158,11,0.07)"  },
  "Flashback":        { label: "FLASHBACK",  color: "#f59e0b", bg: "rgba(245,158,11,0.07)"  },
  "Night":            { label: "NIGHT",      color: "#60a5fa", bg: "rgba(96,165,250,0.07)"  },
  "Dimensional Space":{ label: "VOID",       color: "#c084fc", bg: "rgba(192,132,252,0.09)" },
};

function getTypeConfig(type?: string | null) {
  if (!type) return null;
  return (
    TYPE_CONFIG[type] ?? {
      label: type.toUpperCase(),
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.06)",
    }
  );
}

export function SceneHeader({
  episodeNumber,
  episodeTitle,
  sceneHeading,
  sceneType,
  sceneLocation,
  sceneAge,
  sceneTime,
}: SceneHeaderProps) {
  const typeConfig = getTypeConfig(sceneType);

  const hasMetadata = sceneLocation || sceneAge || sceneTime;

  return (
    <header className="scene-header" aria-label="Scene information">

      {/* Episode label */}
      <div className="scene-header__episode">
        <span className="scene-header__ep-number">EP. {episodeNumber}</span>
        <span className="scene-header__ep-divider">·</span>
        <span className="scene-header__ep-title">{episodeTitle}</span>
      </div>

      {/* Scene title */}
      <h2 className="scene-header__title">{sceneHeading}</h2>

      {/* Metadata row — only rendered if we have at least one field */}
      {hasMetadata && (
        <div
          className="scene-header__meta"
          style={typeConfig ? { borderColor: typeConfig.color + "33", background: typeConfig.bg } : undefined}
        >
          {/* Type badge */}
          {typeConfig && (
            <span
              className="scene-header__badge"
              style={{ color: typeConfig.color, borderColor: typeConfig.color + "44" }}
            >
              {typeConfig.label}
            </span>
          )}

          {/* Location */}
          {sceneLocation && (
            <span className="scene-header__meta-item">
              <SceneIcon type="location" />
              {sceneLocation}
            </span>
          )}

          {/* Age */}
          {sceneAge && (
            <span className="scene-header__meta-item">
              <SceneIcon type="age" />
              Age {sceneAge}
            </span>
          )}

          {/* Time */}
          {sceneTime && (
            <span className="scene-header__meta-item">
              <SceneIcon type="time" />
              {sceneTime}
            </span>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="scene-header__rule" aria-hidden="true" />
    </header>
  );
}

// ─── Minimal inline SVG icons ─────────────────────────────────────────────────

function SceneIcon({ type }: { type: "location" | "age" | "time" }) {
  const icons = {
    location: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M6 1C3.79 1 2 2.79 2 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
        />
      </svg>
    ),
    age: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    time: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  };
  return icons[type];
}
