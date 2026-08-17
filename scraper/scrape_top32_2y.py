"""Scrape up to 2 years of 중식(L) history for 은행골식당/행단골식당, then keep
only the 32 most FREQUENTLY recurring menu names per cafeteria (popularity by
repeat appearance), instead of merely the 32 most recent distinct menus.
"""
import json
import time
import datetime
from collections import Counter
import requests
from scrape import fetch_week, parse_week

WEEKS_BACK = 104  # ~2 years
TOP_N = 32

TARGETS = [
    ("자연과학캠퍼스", "행단골식당", "20201104", "3"),
    ("인문사회과학캠퍼스", "은행골식당", "10201031", "2"),
]


def collect_history(campus, cafeteria, conspace, res_id):
    dt = datetime.date.today().isoformat()
    all_entries = []
    weeks_tried = 0
    seen_weeks = set()

    while weeks_tried < WEEKS_BACK:
        html = None
        for attempt in range(3):
            try:
                html = fetch_week(conspace, res_id, "L", dt)
                break
            except requests.exceptions.RequestException as ex:
                print(f"  ! fetch error at {dt} (attempt {attempt + 1}/3): {ex}")
                time.sleep(1.5)
        if html is None:
            print(f"  giving up at {dt} after retries, stopping here")
            break

        entries, prev_date = parse_week(html, campus, cafeteria, "L", conspace)
        all_entries.extend(entries)

        weeks_tried += 1
        if not prev_date or prev_date in seen_weeks or prev_date == dt:
            break
        seen_weeks.add(prev_date)
        dt = prev_date
        time.sleep(0.2)

    return all_entries, weeks_tried


def top_n_by_frequency(entries, n):
    counts = Counter(e["main_item"].strip() for e in entries)
    # entries are appended in chronological-descending order (newest week first),
    # so the FIRST occurrence seen for a name is the most recent one - keep that
    # as the representative record (price/corner may drift slightly over time)
    representative = {}
    for e in entries:
        key = e["main_item"].strip()
        if key not in representative:
            representative[key] = e

    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:n]
    result = []
    for name, count in ranked:
        rec = dict(representative[name])
        rec["appearance_count"] = count
        result.append(rec)
    return result


def main():
    top32_by_cafeteria = {}

    for campus, cafeteria, conspace, res_id in TARGETS:
        print(f"Scraping 2y of 중식 for {cafeteria} ...")
        entries, weeks = collect_history(campus, cafeteria, conspace, res_id)
        distinct = len({e["main_item"].strip() for e in entries})
        print(f"  -> {weeks} weeks scraped, {len(entries)} entries, {distinct} distinct names")
        top32 = top_n_by_frequency(entries, TOP_N)
        for r in top32:
            r.pop("appearance_count_debug", None)
        print(f"  top {len(top32)} by frequency:")
        for r in top32[:5]:
            print(f"    {r['main_item']} x{r['appearance_count']}")
        top32_by_cafeteria[cafeteria] = top32

    for path in ("data/menus.json", "docs/data/menus.json"):
        all_menus = json.load(open(path, encoding="utf-8"))
        for cafeteria, top32 in top32_by_cafeteria.items():
            all_menus = [e for e in all_menus if e["cafeteria"] != cafeteria]
            clean = [{k: v for k, v in r.items() if k != "appearance_count"} for r in top32]
            all_menus.extend(clean)
        json.dump(all_menus, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"wrote {path}: {len(all_menus)} total entries")


if __name__ == "__main__":
    main()
