"""Scrape up to 2 years of 중식(L) history for 은행골식당/행단골식당, then keep
only the 32 most FREQUENTLY recurring menu names per cafeteria (popularity by
repeat appearance), instead of merely the 32 most recent distinct menus.
"""
import json
import re
import time
import datetime
from collections import Counter
import requests
from scrape import fetch_week, parse_week

# Some corners show two size/price variants glued into one line, e.g.
# "등심돈가스(5.5)/점보돈가스(7.5)" or "자장면(5.0) / 계란볶음밥*자장소스(5.5)".
# These are two different dishes, not one - keep only the first as the
# representative dish for that corner instead of a mashed-together name.
COMBO_PATTERN = re.compile(r"^(.+?)\(([0-9.]+)\)\s*/\s*(.+?)\([0-9.]+\)$")


def dedupe_combo_name(main_item):
    """Returns (cleaned_name, price_in_won_or_None)."""
    m = COMBO_PATTERN.match(main_item.strip())
    if m:
        name, price = m.group(1).strip(), m.group(2)
        return name, str(int(round(float(price) * 1000)))
    return main_item, None


# Fixed corners (e.g. "가츠엔"/"피키피커스") list weekday-by-weekday variants or
# operational notices instead of actual side dishes, e.g. "[화] 치즈돈가스(6.5)",
# "화, 목요일은 기존 메뉴 대신 ...", "(방학 기간 팝업델리는 ...)". These aren't
# real 반찬 - drop them so only genuine side-dish names remain.
def is_noise_side_item(text):
    t = text.strip()
    if t.startswith("[") or t.startswith("/"):
        return True
    if "코너에서" in t or "트렌드미식회" in t or "요일은" in t:
        return True
    if re.search(r"\(\d+\.\d+\)", t):
        return True
    return False


def clean_side_items(side_items):
    return [s for s in side_items if not is_noise_side_item(s)]

WEEKS_BACK = 104  # ~2 years
TOP_N = 32

TARGETS = [
    ("자연과학캠퍼스", "행단골식당 (자과캠 학생회관 1층)", "20201104", "3"),
    ("인문사회과학캠퍼스", "은행골식당 (인사캠 600주년기념관 지하1층)", "10201031", "2"),
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
        for e in entries:
            cleaned, _price = dedupe_combo_name(e["main_item"])
            if cleaned != e["main_item"]:
                e["main_item"] = cleaned
                e["price"] = ""  # dropped price info is ambiguous once split, leave blank
            e["side_items"] = clean_side_items(e["side_items"])
            e["all_items"] = [e["main_item"]] + e["side_items"]
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
