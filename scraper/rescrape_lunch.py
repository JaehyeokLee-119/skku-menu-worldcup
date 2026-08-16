"""Re-scrape 중식(L) only for 행단골식당/은행골식당, replacing their previously
collected 조식(B) entries (the original run stopped after B alone hit the
distinct-menu target, so L/D/S were never queried for these two)."""
import json
import datetime
from scrape import (
    fetch_week, parse_week, dedup_key, TARGET_DISTINCT, MAX_WEEKS_BACK,
)
import time

TARGETS = [
    ("자연과학캠퍼스", "행단골식당", "20201104", "3"),
    ("인문사회과학캠퍼스", "은행골식당", "10201031", "2"),
]


def collect_lunch(campus, cafeteria, conspace, res_id):
    seen = set()
    collected = []
    dt = datetime.date.today().isoformat()
    weeks_tried = 0
    stale_weeks = 0
    while weeks_tried < MAX_WEEKS_BACK:
        distinct = len({dedup_key(e) for e in collected})
        if distinct >= TARGET_DISTINCT:
            break
        html = fetch_week(conspace, res_id, "L", dt)
        entries, prev_date = parse_week(html, campus, cafeteria, "L", conspace)

        new_count = 0
        for e in entries:
            k = dedup_key(e)
            if k not in seen:
                seen.add(k)
                collected.append(e)
                new_count += 1

        weeks_tried += 1
        stale_weeks = stale_weeks + 1 if new_count == 0 else 0
        if not prev_date or prev_date == dt or stale_weeks > 16:
            break
        dt = prev_date
        time.sleep(0.25)

    return collected


def main():
    lunch_by_cafeteria = {}
    for campus, cafeteria, conspace, res_id in TARGETS:
        print(f"Scraping 중식 for {cafeteria} ...")
        lunch = collect_lunch(campus, cafeteria, conspace, res_id)
        print(f"  -> {len(lunch)} distinct 중식 menus")
        lunch_by_cafeteria[cafeteria] = lunch

    for path in ("data/menus.json", "docs/data/menus.json"):
        all_menus = json.load(open(path, encoding="utf-8"))
        for cafeteria, lunch in lunch_by_cafeteria.items():
            all_menus = [e for e in all_menus if e["cafeteria"] != cafeteria]
            all_menus.extend(lunch)
        json.dump(all_menus, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"wrote {path}: {len(all_menus)} total entries")


if __name__ == "__main__":
    main()
