#!/usr/bin/env python3
"""
Make book covers small and centered on mobile.

Before: /discover renders one full-bleed 2:3 cover per row on phones, so a
single book eats the whole viewport. After: a centered 3-up grid on mobile,
4-up on tablet, 5-up on desktop, with card chrome scaled down to match. The
book detail hero cover is capped and centered instead of full-width.

Usage:
    python scripts/fix_cover_grid.py              # apply
    python scripts/fix_cover_grid.py --dry-run    # show what would change
    python scripts/fix_cover_grid.py --revert     # restore from .bak files

The script is idempotent: running it twice is a no-op. Every edit is an exact
string replacement, so it refuses to touch a file whose markup has drifted
rather than guessing.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Patch:
    """One exact-match replacement, with the post-state used to detect reruns."""

    label: str
    old: str
    new: str


@dataclass
class FilePatch:
    path: str
    patches: list[Patch] = field(default_factory=list)


DISCOVER = FilePatch(
    "app/discover/DiscoverClient.tsx",
    [
        Patch(
            "results grid -> 3 per row on mobile, centered",
            '        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">',
            '        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 '
            'gap-3 sm:gap-5 justify-items-center">',
        ),
        Patch(
            "card width cap + horizontal centering",
            """            <Link key={book.id} href={`/book/${book.id}`} className="group">
              <article
                className="h-full transition-transform duration-300 group-hover:-translate-y-1\"""",
            """            <Link key={book.id} href={`/book/${book.id}`} className="group w-full max-w-[200px] mx-auto">
              <article
                className="h-full w-full transition-transform duration-300 group-hover:-translate-y-1\"""",
        ),
        Patch(
            "cover image sizes hint matches the new column widths",
            '                      sizes="(max-width: 768px) 100vw, 33vw"',
            '                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"',
        ),
        Patch(
            "no-cover placeholder title scales down",
            """                    <div className="w-full h-full flex items-center justify-center p-8 text-center">
                      <span
                        className="text-3xl leading-tight\"""",
            """                    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 text-center">
                      <span
                        className="text-xs sm:text-sm md:text-lg leading-tight\"""",
        ),
        Patch(
            "series badge shrinks and truncates inside the small cover",
            """                    <div className="absolute top-3 left-3">
                      <span
                        className="text-xs px-2 py-1 tracking-widest uppercase\"""",
            """                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 max-w-[90%]">
                      <span
                        className="block truncate text-[0.55rem] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 tracking-widest uppercase\"""",
        ),
        Patch(
            "card body: smaller type, secondary metadata hidden on phones",
            """                <div className="p-5">
                  <h3
                    className="text-xl mb-1"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {book.title}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                    {book.author}
                  </p>
                  {book.description && (
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--muted)' }}>
                      {book.description}
                    </p>
                  )}
                  <div
                    className="mt-4 text-xs tracking-widest uppercase"
                    style={{ color: 'var(--gold-dim)' }}
                  >
                    {book._count.chapters} {book._count.chapters === 1 ? 'Chapter' : 'Chapters'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--gold-dim)' }}>""",
            """                <div className="p-2 sm:p-4">
                  <h3
                    className="text-xs sm:text-sm md:text-base mb-0.5 sm:mb-1 line-clamp-2"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {book.title}
                  </h3>
                  <p className="text-[0.65rem] sm:text-xs mb-2 truncate" style={{ color: 'var(--muted)' }}>
                    {book.author}
                  </p>
                  {book.description && (
                    <p className="hidden sm:block text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>
                      {book.description}
                    </p>
                  )}
                  <div
                    className="hidden sm:block mt-3 text-[0.65rem] tracking-widest uppercase"
                    style={{ color: 'var(--gold-dim)' }}
                  >
                    {book._count.chapters} {book._count.chapters === 1 ? 'Chapter' : 'Chapters'}
                  </div>
                  <div className="hidden sm:block text-[0.65rem] mt-1" style={{ color: 'var(--gold-dim)' }}>""",
        ),
        Patch(
            "progress bar spacing + label scale down",
            """                    <div className="mt-3">""",
            """                    <div className="mt-2 sm:mt-3">""",
        ),
        Patch(
            "progress label scales down",
            """                      <p className="text-xs mt-1.5" style={{ color: 'var(--gold-dim)' }}>
                        {readPct >= 100 ? 'Finished ✓' : `${readPct}% read`}""",
            """                      <p className="text-[0.6rem] sm:text-xs mt-1.5" style={{ color: 'var(--gold-dim)' }}>
                        {readPct >= 100 ? 'Finished ✓' : `${readPct}% read`}""",
        ),
    ],
)

BOOK_DETAIL = FilePatch(
    "app/book/[id]/page.tsx",
    [
        Patch(
            "hero cover capped and centered instead of full-width on mobile",
            '          <div className="flex-shrink-0 w-full md:w-56">',
            '          <div className="flex-shrink-0 w-40 sm:w-48 md:w-56 mx-auto md:mx-0">',
        ),
        Patch(
            "hero cover gets an explicit sizes hint",
            '                <Image src={book.coverUrl} alt={book.title} fill priority '
            'className="object-cover" />',
            '                <Image src={book.coverUrl} alt={book.title} fill priority '
            'sizes="(max-width: 640px) 160px, (max-width: 768px) 192px, 224px" '
            'className="object-cover" />',
        ),
    ],
)

TARGETS = [DISCOVER, BOOK_DETAIL]


def read(path: Path) -> tuple[str, str]:
    """Return (text with LF newlines, original newline style)."""
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else "\n"
    return raw.decode("utf-8").replace("\r\n", "\n"), newline


def write(path: Path, text: str, newline: str) -> None:
    path.write_bytes(text.replace("\n", newline).encode("utf-8"))


def apply_file(target: FilePatch, dry_run: bool) -> bool:
    """Apply one file's patches. Returns True if the file changed."""
    path = ROOT / target.path
    if not path.exists():
        print(f"  ! missing: {target.path}")
        return False

    text, newline = read(path)
    original = text
    applied, skipped, failed = [], [], []

    for patch in target.patches:
        if patch.new in text:
            skipped.append(patch.label)
        elif patch.old in text:
            text = text.replace(patch.old, patch.new, 1)
            applied.append(patch.label)
        else:
            failed.append(patch.label)

    print(f"\n{target.path}")
    for label in applied:
        print(f"  + {label}")
    for label in skipped:
        print(f"  = {label} (already applied)")
    for label in failed:
        print(f"  ! {label} (markup changed - edit this one by hand)")

    if failed:
        print("  -> refusing to write this file: not all anchors matched")
        return False
    if text == original:
        return False
    if dry_run:
        print("  -> would write (dry run)")
        return False

    backup = path.with_suffix(path.suffix + ".bak")
    if not backup.exists():
        shutil.copy2(path, backup)
    write(path, text, newline)
    print(f"  -> written (backup: {backup.name})")
    return True


def revert() -> int:
    restored = 0
    for target in TARGETS:
        path = ROOT / target.path
        backup = path.with_suffix(path.suffix + ".bak")
        if backup.exists():
            shutil.copy2(backup, path)
            backup.unlink()
            print(f"restored {target.path}")
            restored += 1
        else:
            print(f"no backup for {target.path}")
    return restored


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing")
    parser.add_argument("--revert", action="store_true", help="restore the .bak files")
    args = parser.parse_args()

    if args.revert:
        revert()
        return 0

    changed = sum(apply_file(t, args.dry_run) for t in TARGETS)
    print(
        f"\n{changed} file(s) changed."
        if not args.dry_run
        else "\ndry run complete - nothing written."
    )
    if changed:
        print("Restart the dev server if it does not pick the change up automatically.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
