/**
 * parseBook.ts
 *
 * Parses the formatted Book text (produced by the admin formatting tool)
 * into structured episodes and scenes, with metadata extracted separately
 * from prose body.
 *
 * Input format per scene:
 *
 *   # Episode N — "Title"
 *
 *   ## SCENE N | SCENE TITLE
 *
 *   TYPE      Cold Open
 *   LOCATION  Caelford Rooftop, Downtown
 *   AGE       22
 *   TIME      7:42 PM
 *
 *   Prose body begins here...
 */

export interface SceneMetadata {
  type?: string;
  location?: string;
  age?: string;
  time?: string;
}

export interface ParsedScene {
  sceneNumber: number;
  sceneTitle: string;         // e.g. "THE EDGE"
  sceneHeading: string;       // e.g. "SCENE 1 | THE EDGE"
  metadata: SceneMetadata;
  body: string;               // prose only, no metadata lines
  orderInEpisode: number;
}

export interface ParsedEpisode {
  episodeNumber: number;
  episodeTitle: string;       // e.g. "The Weight of Normal"
  episodeHeading: string;     // e.g. 'Episode 1 — "The Weight of Normal"'
  scenes: ParsedScene[];
}

// ─── Metadata line detection ─────────────────────────────────────────────────

const METADATA_KEYS = ['TYPE', 'LOCATION', 'AGE', 'TIME'] as const;
type MetadataKey = typeof METADATA_KEYS[number];

function isMetadataLine(line: string): boolean {
  return METADATA_KEYS.some((key) => line.startsWith(key + ' '));
}

function parseMetadataBlock(lines: string[]): {
  metadata: SceneMetadata;
  bodyStartIndex: number;
} {
  const metadata: SceneMetadata = {};
  let i = 0;

  // Skip leading blank lines
  while (i < lines.length && lines[i].trim() === '') i++;

  // Read metadata lines (TYPE / LOCATION / AGE / TIME)
  while (i < lines.length && (isMetadataLine(lines[i]) || lines[i].trim() === '')) {
    const line = lines[i].trim();
    if (isMetadataLine(line)) {
      // Key is the first word, value is everything after (trimmed of extra spaces)
      const [key, ...valueParts] = line.split(/\s{2,}/);
      const value = valueParts.join(' ').trim();
      switch (key as MetadataKey) {
        case 'TYPE':     metadata.type     = value; break;
        case 'LOCATION': metadata.location  = value; break;
        case 'AGE':      metadata.age       = value; break;
        case 'TIME':     metadata.time      = value; break;
      }
    }
    i++;
  }

  // Skip the blank line(s) separating metadata from prose
  while (i < lines.length && lines[i].trim() === '') i++;

  return { metadata, bodyStartIndex: i };
}

// ─── Scene parser ─────────────────────────────────────────────────────────────

const SCENE_HEADING_RE = /^##\s+SCENE\s+(\d+)\s*\|\s*(.+)$/;

function parseSceneBlock(
  sceneHeadingLine: string,
  sceneBodyLines: string[],
  orderInEpisode: number
): ParsedScene {
  const match = sceneHeadingLine.match(SCENE_HEADING_RE);
  if (!match) throw new Error(`Invalid scene heading: "${sceneHeadingLine}"`);

  const sceneNumber = parseInt(match[1], 10);
  const sceneTitle = match[2].trim();
  const sceneHeading = `SCENE ${sceneNumber} | ${sceneTitle}`;

  const { metadata, bodyStartIndex } = parseMetadataBlock(sceneBodyLines);

  // Everything from bodyStartIndex onward is prose
  const bodyLines = sceneBodyLines.slice(bodyStartIndex);

  // Trim trailing blank lines from body
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop();
  }

  const body = bodyLines.join('\n').trim();

  return {
    sceneNumber,
    sceneTitle,
    sceneHeading,
    metadata,
    body,
    orderInEpisode,
  };
}

// ─── Episode parser ───────────────────────────────────────────────────────────

const EPISODE_HEADING_RE = /^#\s+Episode\s+(\d+)\s*[—–-]\s*["""']?(.+?)["""']?\s*$/;

function parseEpisodeBlock(
  episodeHeadingLine: string,
  episodeBodyLines: string[]
): ParsedEpisode {
  const match = episodeHeadingLine.match(EPISODE_HEADING_RE);
  if (!match) throw new Error(`Invalid episode heading: "${episodeHeadingLine}"`);

  const episodeNumber = parseInt(match[1], 10);
  const episodeTitle = match[2].trim();
  const episodeHeading = episodeHeadingLine.replace(/^#\s+/, '').trim();

  // Split episode body into scene blocks
  const scenes: ParsedScene[] = [];
  const lines = episodeBodyLines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (SCENE_HEADING_RE.test(line.trim())) {
      const sceneHeadingLine = line.trim();
      i++;

      // Collect all lines until next scene heading or end
      const sceneBodyLines: string[] = [];
      while (i < lines.length && !SCENE_HEADING_RE.test(lines[i].trim())) {
        sceneBodyLines.push(lines[i]);
        i++;
      }

      scenes.push(
        parseSceneBlock(sceneHeadingLine, sceneBodyLines, scenes.length + 1)
      );
    } else {
      i++;
    }
  }

  return {
    episodeNumber,
    episodeTitle,
    episodeHeading,
    scenes,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseBookText(rawText: string): ParsedEpisode[] {
  const lines = rawText.split('\n');
  const episodes: ParsedEpisode[] = [];

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (EPISODE_HEADING_RE.test(line.trim())) {
      const episodeHeadingLine = line.trim();
      i++;

      // Collect all lines until next episode heading or end
      const episodeBodyLines: string[] = [];
      while (i < lines.length && !EPISODE_HEADING_RE.test(lines[i].trim())) {
        episodeBodyLines.push(lines[i]);
        i++;
      }

      try {
        episodes.push(parseEpisodeBlock(episodeHeadingLine, episodeBodyLines));
      } catch (err) {
        console.error(`Failed to parse episode at "${episodeHeadingLine}":`, err);
      }
    } else {
      i++;
    }
  }

  return episodes;
}

// ─── Utility: flat scene list with global order ───────────────────────────────

export interface FlatScene extends ParsedScene {
  episodeNumber: number;
  episodeTitle: string;
  globalOrder: number;  // 1-based across all episodes
}

export function flattenScenes(episodes: ParsedEpisode[]): FlatScene[] {
  const flat: FlatScene[] = [];
  let globalOrder = 1;

  for (const ep of episodes) {
    for (const scene of ep.scenes) {
      flat.push({
        ...scene,
        episodeNumber: ep.episodeNumber,
        episodeTitle: ep.episodeTitle,
        globalOrder: globalOrder++,
      });
    }
  }

  return flat;
}
