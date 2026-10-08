#!/usr/bin/env python3
"""Precompute English sentence syntax annotations to data/syntax-en.json.

Reads every english sentence in data/textbooks.json, runs spaCy's
en_core_web_sm over it, and writes { sentence_en: { tokens: [{text, pos,
dep, head}] } } for the frontend SyntaxView to render (FR-ENG-13, Q-ENG-03).

Graceful degradation: if spaCy or the model is unavailable, prints a warning
and writes {"_skipped": true} then exits 0 — the frontend falls back to plain
text. Re-runnable and idempotent; atomic write (tmp + os.replace).
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_JSON = ROOT / "data" / "textbooks.json"
OUT_JSON = ROOT / "data" / "syntax-en.json"
MODEL_NAME = "en_core_web_sm"


def collect_sentences(tb: dict) -> list[str]:
    """Unique sentence `en` strings, in textbook order."""
    seen: set[str] = set()
    result: list[str] = []
    english = tb.get("english") or {}
    for grade in english.get("grades", []):
        for volume in grade.get("volumes", []):
            for unit in volume.get("units", []):
                for sentence in unit.get("sentences", []):
                    en = sentence.get("en")
                    if isinstance(en, str) and en.strip() and en not in seen:
                        seen.add(en)
                        result.append(en)
    return result


def load_nlp():
    """Import spaCy and load the model, or return (None, reason)."""
    try:
        import spacy
    except ImportError:
        return None, "spaCy 未安装（pip install spacy）"
    try:
        return spacy.load(MODEL_NAME), None
    except OSError:
        return None, f"模型缺失（python -m spacy download {MODEL_NAME}）"


def analyze(nlp, sentences: list[str]) -> dict:
    out: dict[str, dict] = {}
    for en in sentences:
        doc = nlp(en)
        out[en] = {
            "tokens": [
                {"text": tok.text, "pos": tok.pos_, "dep": tok.dep_, "head": tok.head.i}
                for tok in doc
            ]
        }
    return out


def atomic_write(path: Path, payload: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main() -> int:
    if not BOOKS_JSON.exists():
        print(f"[build_syntax] 缺少 {BOOKS_JSON}", file=sys.stderr)
        return 1
    tb = json.loads(BOOKS_JSON.read_text(encoding="utf-8"))
    sentences = collect_sentences(tb)
    if not sentences:
        print("[build_syntax] 教材中无英文语句，写入空标注", file=sys.stderr)
        atomic_write(OUT_JSON, {})
        return 0

    nlp, reason = load_nlp()
    if nlp is None:
        print(f"[build_syntax] 跳过句法预计算：{reason}；前端将按无标注降级渲染", file=sys.stderr)
        atomic_write(OUT_JSON, {"_skipped": True})
        return 0

    payload = analyze(nlp, sentences)
    atomic_write(OUT_JSON, payload)
    print(f"[build_syntax] {len(payload)} 句 → {OUT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
