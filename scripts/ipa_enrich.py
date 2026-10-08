#!/usr/bin/env python3
"""Enrich data/textbooks.json word entries with IPA from the CMU Pronouncing Dictionary.

Reads the CMU dict (ARPAbet) from data/cache/cmudict.0.7a — if absent, tries to
download it once into the cache. Converts ARPAbet -> IPA, writes an `ipa` field
(e.g. "/həˈloʊ/") onto every english word it can resolve. Re-runnable and
idempotent; atomic write (tmp + os.replace). Stdlib only: json / re / urllib.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_JSON = ROOT / "data" / "textbooks.json"
CMU_CACHE = ROOT / "data" / "cache" / "cmudict.0.7a"
CMU_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"

# ARPAbet -> IPA (stress digits stripped separately; AH0/ER0 get schwa forms).
ARPABET_TO_IPA = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "i",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}
SCHWA_OVERRIDES = {"AH0": "ə", "ER0": "ɚ"}
VOWEL_IPA = {"ɑ", "æ", "ʌ", "ɔ", "ɛ", "ɝ", "ɚ", "ə", "ɪ", "i", "ʊ", "u",
             "aɪ", "aʊ", "oʊ", "ɔɪ"}
PRIMARY, SECONDARY = "ˈ", "ˌ"

RE_CMU_LINE = re.compile(r"^([A-Za-z][A-Za-z0-9'(.-]*)\s+(.+)$")
RE_DIGIT = re.compile(r"(\d)$")

# British / compound spellings absent from CMUdict -> known CMU headwords.
CMU_ALIASES: dict[str, list[str]] = {
    "colour": ["color"],
    "maths": ["math"],
    "schoolbag": ["school", "bag"],
    "pe": ["pee"],
}


def ensure_cmu_dict() -> Path:
    """Return cache path, downloading CMU dict on first run (cached forever after)."""
    if CMU_CACHE.exists() and CMU_CACHE.stat().st_size > 0:
        return CMU_CACHE
    CMU_CACHE.parent.mkdir(parents=True, exist_ok=True)
    print(f"cache miss -> downloading {CMU_URL}")
    try:
        with urllib.request.urlopen(CMU_URL, timeout=30) as resp:
            data = resp.read()
    except OSError as exc:
        sys.exit(f"error: CMU dict unavailable and download failed: {exc}\n"
                 f"       place the file manually at {CMU_CACHE}")
    if not data:
        sys.exit("error: empty CMU dict download")
    tmp = CMU_CACHE.with_suffix(".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, CMU_CACHE)
    return CMU_CACHE


def load_cmu(path: Path) -> dict[str, str]:
    """Parse `WORD  PH PH PH` lines (skip ;;; comments, strip (n) variants)."""
    table: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not raw or raw.startswith(";;;"):
            continue
        line = raw.split("#", 1)[0].rstrip()
        m = RE_CMU_LINE.match(line)
        if not m:
            continue
        word, phonemes = m.group(1), m.group(2)
        base = re.sub(r"\(\d+\)$", "", word).lower()
        if base and base not in table:
            table[base] = phonemes
    return table


def arpabet_to_ipa(phonemes: str) -> str:
    """ARPAbet -> IPA. Stress marks are placed at the syllable onset (walked back
    over the consonants since the previous vowel), not directly before the vowel,
    so `HH AH0 L OW1` becomes /həˈloʊ/ rather than /həlˈoʊ/."""
    phones: list[str] = []
    marks: dict[int, str] = {}
    for token in phonemes.split():
        stress = ""
        m = RE_DIGIT.search(token)
        if m:
            stress, token = m.group(1), token[:-1]
        phone = SCHWA_OVERRIDES.get(token + stress)
        if phone is None:
            phone = ARPABET_TO_IPA.get(token)
            if phone is None:
                continue
        if stress == "1":
            marks[len(phones)] = PRIMARY
        elif stress == "2":
            marks[len(phones)] = SECONDARY
        phones.append(phone)

    insert_at: dict[int, list[str]] = {}
    for i, mark in marks.items():
        j = i
        while j > 0 and phones[j - 1] not in VOWEL_IPA:
            j -= 1
        insert_at.setdefault(j, []).append(mark)

    out: list[str] = []
    for idx, phone in enumerate(phones):
        out.extend(insert_at.get(idx, []))
        out.append(phone)
    return "".join(out)


def lookup_key(en: str) -> list[str]:
    """Reduce a corpus entry to lookup tokens (handles 'let's=…', 'a(n)', 'Good job!')."""
    cleaned = en.strip().lower()
    cleaned = re.sub(r"\([^)]*\)", "", cleaned)         # drop bracket notes entirely
    cleaned = re.sub(r"=\s*\S.*$", "", cleaned)         # drop '=gloss' tail
    cleaned = re.sub(r"[^a-z' ]+", " ", cleaned)        # keep letters/apostrophe
    return [t for t in cleaned.split() if t]


def lookup_ipa(en: str, table: dict[str, str]) -> str | None:
    tokens = lookup_key(en)
    if not tokens:
        return None
    expanded: list[str] = []
    for t in tokens:
        expanded.extend(CMU_ALIASES.get(t, [t]))
    parts = [table[t] for t in expanded if t in table]
    if len(parts) != len(expanded):
        return None
    return "/" + " ".join(arpabet_to_ipa(p) for p in parts) + "/"


def main() -> None:
    cmu_path = ensure_cmu_dict()
    table = load_cmu(cmu_path)
    if not table:
        sys.exit("error: CMU dict parsed to zero entries")

    books = json.loads(BOOKS_JSON.read_text(encoding="utf-8"))
    english = books["english"]
    total = matched = 0
    missing: list[str] = []

    for grade in english["grades"]:
        for volume in grade["volumes"]:
            for unit in volume["units"]:
                for word in unit["words"]:
                    total += 1
                    ipa = lookup_ipa(word["en"], table)
                    if ipa:
                        word["ipa"] = ipa
                        matched += 1
                    else:
                        word.pop("ipa", None)
                        missing.append(word["en"])

    tmp = BOOKS_JSON.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, BOOKS_JSON)

    pct = 100.0 * matched / total if total else 0.0
    print(f"IPA coverage: {matched}/{total} ({pct:.1f}%) -> {BOOKS_JSON.relative_to(ROOT)}")
    if missing:
        print(f"missing ({len(missing)}):")
        for en in missing:
            print(f"  - {en}")


if __name__ == "__main__":
    main()
