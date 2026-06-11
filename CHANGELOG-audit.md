# Audit Remediation Changelog

Work from the audit brief (`CLAUDE_CODE_PROMPT.md`), implemented in phase order.
Each phase was developed on its own branch, stacked on the previous one:

| Phase | Branch |
|-------|--------|
| 1 | `fix/phase-1-broken-endpoints` |
| 2 | `fix/phase-2-lazy-chapters` |
| 3 | `fix/phase-3-protect-data` |
| 4 | `fix/phase-4-security` |
| 5 | `fix/phase-5-reader-polish` |
| 6 | `fix/phase-6-cleanup` |

Every phase passes `npm run build` (which runs `prisma generate` + TypeScript
type-checking + Next's lint step).

---

## Phase 1 — Broken endpoints

- **`app/api/admin/ingest/route.ts`**: read `ADMIN_USER_ID` instead of the
  non-existent `ADMIN_CLERK_USER_ID` (the endpoint was always 403-ing). Removed
  the `!` non-null assertion; the admin guard now fails closed (returns 403)
  when the env var is unset instead of crashing.
- **Prisma client deduped**: deleted `lib/prisma.ts`; standardized on
  `lib/db.ts`. Updated the only importer (`ingest`). Log config changed from
  `['query']` to `['error','warn']` (plus `query` only in development).
- **`app/api/webhooks/clerk/route.ts`**: confirmed it reads
  `process.env.CLERK_WEBHOOK_SECRET` and documents the requirement; no code
  change needed.
- **`scripts/backfill-emails.ts`** (new): reports users with
  `@placeholder.local` emails (no DB mutation), with a commented TODO to
  re-fetch real emails from Clerk once the webhook is live. **Not run.**

## Phase 2 — Lazy-load chapters (payload reduction)

- **`app/api/books/[id]/chapters/[chapterId]/route.ts`** (new): public route
  returning a single chapter's content; parent book must be `PUBLISHED`.
- **`app/book/[id]/read/page.tsx`**: sends only chapter metadata (id, title,
  order, computed `wordCount`, scene fields) + the **initial chapter's content**
  instead of every chapter body.
- **`ReaderClient.tsx`**: lazy-fetches chapter bodies on navigation, caches
  loaded chapters in state (no refetch on re-visit), gates scroll restoration on
  the body being rendered, and shows a subtle loading/error state.
- **Impact**: initial payload now scales with one chapter instead of the whole
  book (~`(N−1)·avg_chapter_size` smaller for an N-chapter book).

## Phase 3 — Protect reader data (non-destructive ingest)

- **`lib/ingestChapters.ts`** (new): `replaceBookChapters()` upserts each scene
  by `[bookId, order]` (preserving Chapter ids → preserving reader
  `ReadingProgress`) and deletes only chapters whose order no longer exists.
- **Destructive deletion gated** behind `confirmReset: true`; otherwise both
  routes return **409** with `chaptersToDelete` / `progressRowsToDelete` counts.
- **`app/api/admin/ingest/route.ts`** (replace mode) and
  **`app/api/books/[id]/route.ts`** (rawText branch) both use the helper.
- Standardized parsing on `lib/parseBook.ts`; **deleted** the now-unused
  `lib/parseChapters.ts`. Added a book-existence 404 check to `PUT`.

## Phase 4 — Security hardening

- **Upload validation** (`app/api/upload/route.ts`): allows only
  `image/png|jpeg|webp` (415 otherwise), enforces a 5 MB cap (413), and writes a
  random `crypto.randomUUID()` filename with an explicit `contentType` (no longer
  trusts `file.name`).
- **Rate limiting** (`lib/rateLimit.ts`, new): in-memory fixed-window limiter
  with `X-RateLimit-*` / `Retry-After` headers. Applied to `POST /api/progress`
  (60/min) and `/api/upload` (20/min) → 429 when exceeded.
- **Admin helper** (`lib/auth.ts`, new): `isAdmin(userId)`; every admin check
  (`middleware.ts`, `upload`, `books`, `books/[id]`, `ingest`) routes through it.
  Comment shows the Clerk `publicMetadata.role === 'admin'` migration path.
- **Security headers** (`next.config.ts`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a conservative CSP
  allowing Clerk, Vercel Blob, Google Fonts, and Cloudflare Turnstile.

## Phase 5 — Reader polish

- **Sepia/light theme toggle**: `theme` state persisted to
  `localStorage('reader-theme')` (same pattern as font size); toolbar toggle.
  Reader surfaces migrated to `--reader-*` CSS variables with a `[data-theme]`
  override; dark theme is visually unchanged.
- **Scene metadata** rendered in the chapter heading where present (type badge,
  location, age, time).
- **Mobile swipe navigation**: horizontal-dominant swipes flip chapters without
  affecting vertical scroll.
- **TOC accessibility**: `Esc` closes it, focus is trapped while open, focus
  returns to the trigger on close; overlay marked `role="dialog" aria-modal`.

## Phase 6 — Optimization & cleanup

- **Self-hosted fonts**: replaced the Google Fonts `<link>` tags in
  `app/layout.tsx` with `next/font/google` (Playfair Display + Lora), exposed as
  `--font-playfair` / `--font-lora` and wired through `globals.css` and all
  inline `fontFamily` usages.
- **`next/image` in admin**: `app/admin/page.tsx` and
  `app/admin/books/[id]/edit/page.tsx` cover previews now use `next/image`
  (`unoptimized`, since previews are blob/remote URLs).
- **Per-book SEO**: `app/book/[id]/page.tsx` `generateMetadata` now adds a
  canonical URL, `metadataBase`, and OpenGraph `url`/`type` (it already produced
  title, description, and the cover OG image).
- **Repo cleanup**: deleted the tracked duplicate `components/SiteHeader.tsx.TSX`;
  removed the two untracked root JPEGs (`Belonging_to_all_of_them.jpeg`,
  `Zandora_book I.jpeg`, unreferenced in code) and the untracked dot-less
  `env.local` (after confirming its keys are all present in the real
  `.env.local`). The real `.env`, `.env.local`, `.env.example` were left
  untouched. (No dot-less `env.example` existed.)

---

## Env vars you must set

| Var | When | Where | Notes |
|-----|------|-------|-------|
| `CLERK_WEBHOOK_SECRET` | **Required** (Phase 1) | `.env.local` + Vercel | Signing secret from Clerk Dashboard → Webhooks. Without it, new users get `@placeholder.local` emails. |
| `ADMIN_USER_ID` | **Required** (Phase 1) | `.env.local` + Vercel | Your Clerk user id. The ingest route now reads this (previously read a typo'd name). Admin routes fail closed if unset. |
| `UPSTASH_REDIS_REST_URL` | Optional (Phase 4) | `.env.local` + Vercel | Only if you upgrade the in-memory rate limiter to `@upstash/ratelimit`. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional (Phase 4) | `.env.local` + Vercel | Same as above. |

---

## Intentionally NOT done (and why)

- **No ESLint config added.** The repo has no ESLint config, so `next lint` only
  drops into an interactive setup prompt and can't run non-interactively. Adding
  Next's flat config was out of scope and would surface many pre-existing
  warnings across the codebase. The `build` gate already type-checks. Add
  `eslint.config.mjs` separately if you want lint enforcement.
- **No "confirm & proceed" button in the admin edit UI** for the new Phase 3
  `confirmReset` flag. The API guard is in place (returns 409 with counts), and
  the UI surfaces the error message, but it has no button to re-send with
  `confirmReset: true`. Small UI follow-up. (Relatedly, the edit page's warning
  text "deletes all existing chapters and reading progress" is now pessimistic —
  the operation is non-destructive unless chapters are actually removed.)
- **Did not adopt the full `components/reader/SceneHeader.tsx` card.** It expects
  `episodeNumber`/`episodeTitle` and would replace the existing chapter heading
  design. Rendered a compact inline metadata row instead to preserve the look.
- **Rate limiter left in-memory** rather than wiring Upstash, to avoid adding
  dependencies and requiring an external account. It is a per-instance
  speed-bump, not a cross-instance hard limit (documented in `lib/rateLimit.ts`).
- **Did not run `scripts/backfill-emails.ts`** (per the brief).
- **CSP not verified against a live Clerk auth flow.** It was built from the
  origins actually used in the code, but sign-in/sign-up and the admin dashboard
  should be exercised after deploy; CSP violations in the browser console will
  name any origin that needs adding.
