#!/usr/bin/env python3
"""Build data/textbooks.json by merging words-raw.json with the eight research notes.

Read-only on inputs; re-runnable (always rewrites data/textbooks.json).
Stdlib only: json / re / datetime / pathlib.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES = ROOT / ".omo" / "notepads" / "new-english-json"
WORDS_JSON = ROOT / "data" / "words-raw.json"
OUT_JSON = ROOT / "data" / "textbooks.json"

EN_NOTES = {
    (1, 1): "sentences-g1s.md",
    (1, 2): "sentences-g1x.md",
    (2, 1): "sentences-g2s.md",
    (2, 2): "sentences-g2x.md",
}
ZH_NOTES = {
    (1, 1): "chinese-g1s.md",
    (1, 2): "chinese-g1x.md",
    (2, 1): "chinese-g2s.md",
    (2, 2): "chinese-g2x.md",
}

G1_VOL1_TITLES = {
    1: "Hello!",
    2: "Numbers",
    3: "Family",
    4: "My classroom",
    5: "School things",
    6: "Colours",
}

RE_URL = re.compile(r"https?://\S+")
RE_SRC_EQ = re.compile(r"^\s*(?:-\s+)?([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$")
RE_SRC_LBL = re.compile(r"^\s*-\s*([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$")
RE_SRC_COLON = re.compile(r"^\s*(?:-\s+)?[Ss]ource\s+([A-Za-z][A-Za-z0-9]*)\s*[:=]\s*(.+)$")
RE_HEADER = re.compile(r"^#{1,6}\s")


def read_lines(name: str) -> list[str]:
    return (NOTES / name).read_text(encoding="utf-8").splitlines()


def unwrap(text: str) -> str:
    """Drop a wrapping delimiter pair (quotes / markdown emphasis)."""
    t = text.strip()
    for mark in ("**", "*", '"'):
        if len(t) > 2 * len(mark) and t.startswith(mark) and t.endswith(mark):
            return t[len(mark):-len(mark)].strip()
    return t


def strip_wrapping_quote(text: str) -> str:
    t = text.strip()
    if len(t) >= 2 and t.startswith('"') and t.endswith('"'):
        return t[1:-1]
    return t


def source_map_line(line: str) -> tuple[str, str] | None:
    """Recognise a `X = URL` / `Source A = URL` / `source A: URL` mapping line."""
    m = RE_SRC_COLON.match(line) or RE_SRC_LBL.match(line)
    if not m:
        return None
    url = RE_URL.search(m.group(2))
    if not url:
        return None
    return m.group(1).upper(), url.group(0).rstrip(".,;)]>")


def resolve_source(raw: str, smap: dict[str, str]) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    first = re.split(r"[,;/，、]", raw)[0].strip().upper()
    return smap.get(first, raw)


def close_unit(unit: dict | None, smap: dict[str, str]) -> None:
    if unit is None:
        return
    for sent in unit["sentences"]:
        sent["source"] = resolve_source(sent.pop("_src", ""), smap)


# ---------------------------------------------------------------- english g1s
RE_G1S_UNIT = re.compile(r"^## Unit (\d+) (.+)$")
RE_G1S_SENT = re.compile(r"^\s*(\d+)\.\s+en:\s*(.*?)\s+—\s+zh:\s*(.*)$")
RE_SRC_TAIL = re.compile(r"\(([^()]*\bsrc:\s*[^()]*)\)\s*$")


def parse_g1s() -> list[dict]:
    units: list[dict] = []
    smap: dict[str, str] = {}
    cur: dict | None = None
    for line in read_lines("sentences-g1s.md"):
        m = RE_G1S_UNIT.match(line)
        if m:
            close_unit(cur, smap)
            smap = {}
            cur = {"unit": int(m.group(1)), "title": m.group(2).strip(), "sentences": []}
            units.append(cur)
            continue
        if cur is None:
            continue
        hit = source_map_line(line)
        if hit and not line.lstrip().startswith(("Research", "Book", "TOC", "Unit titles")):
            smap.setdefault(hit[0], hit[1])
        m = RE_G1S_SENT.match(line)
        if m:
            rest = m.group(3)
            tail = RE_SRC_TAIL.search(rest)
            if tail:
                inner = tail.group(1)
                src_raw = inner.split("src:", 1)[1].strip() if "src:" in inner else ""
                zh = rest[: tail.start()].rstrip()
            else:
                any_src = re.search(r"src:\s*([^)]*)\)", rest)
                src_raw = any_src.group(1).strip() if any_src else ""
                zh = rest
            cur["sentences"].append(
                {"en": unwrap(m.group(2)), "zh": unwrap(zh), "_src": src_raw}
            )
    close_unit(cur, smap)
    return units


# ---------------------------------------------------------------- english g1x
RE_G1X_UNIT = re.compile(r"^## Unit (\d+) (.+?) — example sentences\s*$")
RE_G1X_SRC = re.compile(r"^\s*Source\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$")
RE_ZH_MARK = re.compile(r"\[(原文|译)\]")


def parse_g1x() -> list[dict]:
    units: list[dict] = []
    smap: dict[str, str] = {}
    cur: dict | None = None
    for line in read_lines("sentences-g1x.md"):
        m = RE_G1X_UNIT.match(line)
        if m:
            close_unit(cur, smap)
            smap = {}
            cur = {"unit": int(m.group(1)), "title": m.group(2).strip(), "sentences": []}
            units.append(cur)
            continue
        if cur is None:
            continue
        m = RE_G1X_SRC.match(line)
        if m:
            url = RE_URL.search(m.group(2))
            if url:
                smap.setdefault(m.group(1).upper(), url.group(0).rstrip(".,;)]>"))
            continue
        if not line.lstrip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 4:
            continue
        idx, en, zh, src = cells[0], cells[1], cells[2], cells[3]
        if not idx.isdigit() or not en:
            continue
        marks = RE_ZH_MARK.findall(zh)
        if marks:
            zh = RE_ZH_MARK.sub("", zh).strip()
        entry: dict = {"en": unwrap(en), "zh": unwrap(zh), "_src": src}
        if marks:
            entry["zh_note"] = marks[0]
        cur["sentences"].append(entry)
    close_unit(cur, smap)
    return units


# ---------------------------------------------------------------- english g2s
RE_G2S_UNIT = re.compile(r"^## UNIT (\d+) — (.+)$")
RE_G2S_SENT = re.compile(r"^\s*(\d+)\.\s+en:\s*(.*?)\s+/\s+zh:\s*(.*)$")


def parse_g2s() -> list[dict]:
    units: list[dict] = []
    smap: dict[str, str] = {}
    cur: dict | None = None
    for line in read_lines("sentences-g2s.md"):
        hit = source_map_line(line)
        if hit:
            smap.setdefault(hit[0], hit[1])
        m = RE_G2S_UNIT.match(line)
        if m:
            close_unit(cur, smap)
            cur = {"unit": int(m.group(1)), "title": m.group(2).strip(), "sentences": []}
            units.append(cur)
            continue
        if cur is None:
            continue
        m = RE_G2S_SENT.match(line)
        if m:
            parts = re.split(r"\s+/\s+", m.group(3))
            cur["sentences"].append(
                {
                    "en": strip_wrapping_quote(m.group(2)),
                    "zh": unwrap(parts[0]),
                    "_src": parts[1] if len(parts) > 1 else "",
                }
            )
    close_unit(cur, smap)
    return units


# ---------------------------------------------------------------- english g2x
RE_G2X_UNIT = re.compile(r"^## Unit (\d+)\s+—\s+title:\s*(.+?)\s*$")
RE_G2X_SENT = re.compile(
    r"^\s*-\s+en:\s*\"(.*?)\"\s+zh:\s*\"(.*?)\"\s+src:\s*(.*?)\s*$"
)
RE_G2X_SENT_LOOSE = re.compile(r"^\s*-\s+en:\s*(.*?)\s+zh:\s*(.*?)\s+src:\s*(.*?)\s*$")
RE_G2X_SRC = re.compile(r"^\s*(?:-\s+)?[Ss]ource\s+([A-Za-z][A-Za-z0-9]*)\s*:\s*(.+)$")


def parse_g2x() -> list[dict]:
    units: list[dict] = []
    smap: dict[str, str] = {}
    cur: dict | None = None
    for line in read_lines("sentences-g2x.md"):
        m = RE_G2X_UNIT.match(line)
        if m:
            close_unit(cur, smap)
            smap = {}
            title = re.sub(r"\s*\(VERIFIED.*$", "", m.group(2)).strip()
            cur = {"unit": int(m.group(1)), "title": title, "sentences": []}
            units.append(cur)
            continue
        if cur is None:
            continue
        m = RE_G2X_SRC.match(line)
        if m:
            url = RE_URL.search(m.group(2))
            if url:
                smap.setdefault(m.group(1).upper(), url.group(0).rstrip(".,;)]>"))
            continue
        m = RE_G2X_SENT.match(line) or RE_G2X_SENT_LOOSE.match(line)
        if m:
            cur["sentences"].append(
                {
                    "en": unwrap(m.group(1)),
                    "zh": unwrap(m.group(2)),
                    "_src": m.group(3),
                }
            )
    close_unit(cur, smap)
    return units


EN_PARSERS = {
    (1, 1): parse_g1s,
    (1, 2): parse_g1x,
    (2, 1): parse_g2s,
    (2, 2): parse_g2x,
}

# ------------------------------------------------------------------ chinese
RE_PAGE_SUFFIX = re.compile(r"[（(]p\.\s*\d+[）)]\s*$")
RE_ZH_UNIT_HASH = re.compile(r"^#\s+(第.+单元.*?)\s*$")
RE_ZH_UNIT = re.compile(r"^##\s+UNIT:\s*(.+?)\s*$")
RE_ZH_LESSON = re.compile(r"^###\s+LESSON:\s*(.+?)\s*$")
RE_ZH_SUPP = re.compile(r"^##\s+SUPP:\s*(.+?)\s*$")
RE_GARDEN = re.compile(r"(语文园地[一二三四五六七八])")


def parse_chinese(name: str, unit_re: re.Pattern, unit_is_hash1: bool) -> list[dict]:
    """Sentences = every `- ` bullet inside a lesson (or SUPP) block.

    Headings, prose notes, `> 注：` notes and HTML comments are ignored;
    a `##`-level section header closes the current block.
    SUPP sections (g1s) are folded into their matching 语文园地N lesson so
    the lesson list stays exactly the `### LESSON:` block list.
    """
    units: list[dict] = []
    supp_blocks: list[dict] = []
    cur_u: dict | None = None
    cur_l: dict | None = None
    bucket: list[str] | None = None
    in_comment = False

    def close_block() -> None:
        nonlocal cur_u, cur_l, bucket
        cur_l = None
        bucket = None

    for raw in read_lines(name):
        s = raw.strip()
        if in_comment:
            if "-->" in s:
                in_comment = False
            continue
        if "<!--" in s:
            if "-->" not in s.split("<!--", 1)[1]:
                in_comment = True
            continue

        m = RE_ZH_SUPP.match(s)
        if m:
            close_block()
            block = {"ref": m.group(1), "sentences": []}
            supp_blocks.append(block)
            bucket = block["sentences"]
            continue

        m = unit_re.match(s)
        if m:
            close_block()
            cur_u = {"unit": m.group(1).strip(), "lessons": []}
            units.append(cur_u)
            continue

        if unit_is_hash1 and re.match(r"^#\s+第", s):
            close_block()
            cur_u = None
            continue

        m = RE_ZH_LESSON.match(s)
        if m:
            close_block()
            cur_l = {"title": RE_PAGE_SUFFIX.sub("", m.group(1)).strip(), "sentences": []}
            if cur_u is not None:
                cur_u["lessons"].append(cur_l)
            bucket = cur_l["sentences"]
            continue

        if RE_HEADER.match(s):
            close_block()
            if not unit_is_hash1 and not RE_ZH_SUPP.match(s):
                cur_u = None
            continue

        if bucket is not None and s.startswith("-") and not s.startswith("--"):
            bucket.append(unwrap(s[1:].strip()))

    lessons = {l["title"]: l for u in units for l in u["lessons"]}
    for block in supp_blocks:
        m = RE_GARDEN.search(block["ref"])
        if m and m.group(1) in lessons:
            lessons[m.group(1)]["sentences"].extend(block["sentences"])
        else:
            orphan = {"title": block["ref"], "sentences": block["sentences"]}
            units[-1]["lessons"].append(orphan)
    return units


def parse_zh(key: tuple[int, int]) -> list[dict]:
    name = ZH_NOTES[key]
    if key == (1, 2):
        return parse_chinese(name, RE_ZH_UNIT_HASH, True)
    return parse_chinese(name, RE_ZH_UNIT, False)


# ------------------------------------------------------------------ assembly
def build_english(words: dict) -> dict:
    grades_out = []
    for grade in words["grades"]:
        g_no = grade["grade"]
        volumes_out = []
        for v_idx, vol in enumerate(grade["volumes"], start=1):
            note_units = {u["unit"]: u for u in EN_PARSERS[(g_no, v_idx)]()}
            units_out = []
            for u in vol["units"]:
                note = note_units.get(u["unit"], {"title": None, "sentences": []})
                title = u.get("title") or note.get("title")
                if g_no == 1 and v_idx == 1:
                    title = G1_VOL1_TITLES.get(u["unit"], title)
                units_out.append(
                    {
                        "unit": u["unit"],
                        "title": title,
                        "words": u["words"],
                        "sentences": [
                            {k: v for k, v in s.items() if k in ("en", "zh", "source", "zh_note")}
                            for s in note.get("sentences", [])
                        ],
                    }
                )
            volumes_out.append(
                {
                    "volume": v_idx,
                    "volume_name": vol["volume"],
                    "units": units_out,
                }
            )
        grades_out.append({"grade": g_no, "volumes": volumes_out})
    return {"textbook": "新交际英语 (2024)", "grades": grades_out}


def build_chinese() -> dict:
    grades_out = []
    for g_no in (1, 2):
        volumes_out = []
        for v_idx in (1, 2):
            units = parse_zh((g_no, v_idx))
            volumes_out.append(
                {"volume": v_idx, "volume_name": "上册" if v_idx == 1 else "下册", "units": units}
            )
        grades_out.append({"grade": g_no, "volumes": volumes_out})
    return {"textbook": "统编版语文", "grades": grades_out}


def report(doc: dict) -> None:
    en, zh = doc["english"], doc["chinese"]
    per_file: dict[str, int] = {}
    g_units = g_words = g_sents = 0
    for grade in en["grades"]:
        for vol in grade["volumes"]:
            for u in vol["units"]:
                g_units += 1
                g_words += len(u["words"])
                g_sents += len(u["sentences"])
    for key, name in EN_NOTES.items():
        per_file[name] = sum(
            len(x["sentences"]) for x in EN_PARSERS[key]()
        )
    print(f"english: grades={len(en['grades'])} units={g_units} "
          f"words={g_words} sentences={g_sents} per_file={per_file}")
    for grade in zh["grades"]:
        for vol in grade["volumes"]:
            units = vol["units"]
            lessons = [l for u in units for l in u["lessons"]]
            sents = sum(len(l["sentences"]) for l in lessons)
            print(f"chinese g{grade['grade']}v{vol['volume']}: "
                  f"units={len(units)} lessons={len(lessons)} sentences={sents}")


def main() -> None:
    words = json.loads(WORDS_JSON.read_text(encoding="utf-8"))
    doc = {
        "_meta": {
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "sources": [
                ".omo/notepads/new-english-json/sentences-g1s.md",
                ".omo/notepads/new-english-json/sentences-g1x.md",
                ".omo/notepads/new-english-json/sentences-g2s.md",
                ".omo/notepads/new-english-json/sentences-g2x.md",
                ".omo/notepads/new-english-json/chinese-g1s.md",
                ".omo/notepads/new-english-json/chinese-g1x.md",
                ".omo/notepads/new-english-json/chinese-g2s.md",
                ".omo/notepads/new-english-json/chinese-g2x.md",
                "data/words-raw.json",
            ],
            "edition_notes": [
                "语文一上/一下=官方PDF版",
                "语文二上=统编版2025秋修订版（无页码，多源交叉核验）",
                "语文二下=新版TOC（24篇课文，6篇★★逐字核验）",
                "英语=新交际英语2024",
            ],
            "caveats": [
                "英语一下例句来源为教师资源（en高可信 zh多为[译]）",
                "二上U6含2个unverified词（paper-cutup疑粘连）",
                "一上U1/U2词表来源站重叠（原样保留）",
                "语文二下快乐读书吧《读读儿童故事》未处理",
                "园地/口语交际 lessons 为合规空数组（口语交际内嵌于园地）",
                "一上Unit2词表标题Number与核验标题Numbers不一致（以标题为准）",
            ],
        },
        "english": build_english(words),
        "chinese": build_chinese(),
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    report(doc)
    print(f"wrote {OUT_JSON.relative_to(ROOT)} ({OUT_JSON.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
