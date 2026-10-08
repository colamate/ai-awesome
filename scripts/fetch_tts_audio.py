#!/usr/bin/env python3
"""Pre-generate standard-pronunciation MP3s for every English utterance.

Reads unique `en` strings (words + sentences) from data/textbooks.json, synthesises
each once with the Microsoft neural voice `en-US-JennyNeural` via edge-tts into
public/audio/<sha1(raw)>.mp3, and writes data/tts-manifest.json mapping the exact
raw text -> filename. Runtime (src/core/english/tts.ts) plays manifest hits through
HTMLAudioElement and falls back to the Web Speech API, so offline behaviour (NFR-02)
is preserved after this one-time network run.

Idempotent: existing non-empty files are skipped (--force regenerates). Failures are
retried; files are written atomically (.part + os.replace). Exit 1 if any utterance
failed after retries (partial manifest still written; missing keys fall back to Web
Speech at runtime).

Requires: python3 -m pip install edge-tts certifi
Usage: python3 scripts/fetch_tts_audio.py [--dry-run] [--force] [--limit N]
       [--concurrency N] [--voice en-US-JennyNeural]
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from pathlib import Path

try:
    import certifi
except ImportError:
    sys.exit("certifi missing — run: python3 -m pip install certifi edge-tts")

# must precede edge_tts: framework Python's default CA bundle is broken here,
# so pin aiohttp's TLS trust to certifi's cacert.pem
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

import edge_tts  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BOOKS_JSON = ROOT / "data" / "textbooks.json"
AUDIO_DIR = ROOT / "public" / "audio"
MANIFEST_JSON = ROOT / "data" / "tts-manifest.json"
DEFAULT_VOICE = "en-US-JennyNeural"
RETRIES = 3


def collect_utterances() -> list[str]:
    """Exact raw `en` strings in file order, de-duplicated (keys must match runtime)."""
    data = json.loads(BOOKS_JSON.read_text(encoding="utf-8"))
    seen: set[str] = set()
    out: list[str] = []
    for grade in data["english"]["grades"]:
        for volume in grade["volumes"]:
            for unit in volume["units"]:
                for entry in [*unit["words"], *unit["sentences"]]:
                    raw = entry["en"]
                    if raw and raw not in seen:
                        seen.add(raw)
                        out.append(raw)
    return out


def clean_for_speech(raw: str) -> str:
    """Strip teacher-note parens/brackets and symbol noise so the voice reads prose."""
    text = raw
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"（[^）]*）", " ", text)
    text = text.replace("[", " ").replace("]", " ")
    text = re.sub(r"(^|\s)-\s*", r"\1", text)  # speaker-turn dashes, not hyphens (T-shirt)
    text = re.sub(r"\s*/\s*", ", ", text)  # alternative forms -> pause
    text = text.replace("=", ", ")  # "let's=let us" -> pause, never speak "equals"
    text = re.sub(r"\s*[—–]+\s*", " ", text)
    text = re.sub(r"\s*,\s*", ", ", text)
    text = re.sub(r"[\u4e00-\u9fff]+", " ", text)  # safety: no CJK left inside en voice
    text = re.sub(r"\s+", " ", text).strip(" ,")
    return text


def filename_for(raw: str) -> str:
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16] + ".mp3"


async def synthesise(raw: str, voice: str, sem: asyncio.Semaphore) -> bool:
    async with sem:
        target = AUDIO_DIR / filename_for(raw)
        part = target.with_suffix(target.suffix + ".part")
        for attempt in range(1, RETRIES + 1):
            try:
                await edge_tts.Communicate(clean_for_speech(raw), voice).save(str(part))
                os.replace(part, target)
                return True
            except Exception as exc:  # network / throttling — retry then give up
                part.unlink(missing_ok=True)
                if attempt == RETRIES:
                    print(f"  FAIL {raw[:60]!r}: {exc}", file=sys.stderr)
                    return False
                await asyncio.sleep(1.5 * attempt)
        return False


async def run(raws: list[str], voice: str, concurrency: int, force: bool) -> tuple[int, int, int]:
    sem = asyncio.Semaphore(concurrency)
    todo: list[str] = []
    skipped = 0
    for raw in raws:
        target = AUDIO_DIR / filename_for(raw)
        if not force and target.exists() and target.stat().st_size > 0:
            skipped += 1
        else:
            todo.append(raw)
    print(f"utterances={len(raws)} existing={skipped} to-generate={len(todo)}")
    done = 0
    failed = 0
    for batch_start in range(0, len(todo), 25):
        batch = todo[batch_start : batch_start + 25]
        results = await asyncio.gather(*(synthesise(r, voice, sem) for r in batch))
        failed += results.count(False)
        done += len(batch)
        print(f"  progress {done}/{len(todo)} (failed={failed})")
    return len(todo), done - failed, failed


def write_manifest(raws: list[str]) -> int:
    entries: dict[str, str] = {}
    for raw in raws:
        if not clean_for_speech(raw):
            continue
        target = AUDIO_DIR / filename_for(raw)
        if target.exists() and target.stat().st_size > 0:
            entries[raw] = target.name
    payload = json.dumps(entries, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    tmp = MANIFEST_JSON.with_suffix(".json.part")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, MANIFEST_JSON)
    return len(entries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="list work, no network")
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument("--limit", type=int, default=0, help="only first N utterances")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    args = parser.parse_args()

    raws = collect_utterances()
    if args.limit > 0:
        raws = raws[: args.limit]
    print(f"unique utterances: {len(raws)}")

    if args.dry_run:
        empty = [r for r in raws if not clean_for_speech(r)]
        print(f"would generate into {AUDIO_DIR} (empty after cleaning: {len(empty)})")
        for raw in raws[:5]:
            print(f"  {raw!r} -> {clean_for_speech(raw)!r}")
        return 0

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    total, ok, failed = asyncio.run(run(raws, args.voice, args.concurrency, args.force))
    # manifest always reflects every utterance whose file exists on disk, even on
    # --limit runs, so partial runs never shrink the mapping
    manifest_n = write_manifest(collect_utterances())
    bytes_total = sum(f.stat().st_size for f in AUDIO_DIR.glob("*.mp3"))
    print(
        f"generated={ok}/{total} failed={failed} manifest={manifest_n} "
        f"files={len(list(AUDIO_DIR.glob('*.mp3')))} size={bytes_total / 1024 / 1024:.1f}MB"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
