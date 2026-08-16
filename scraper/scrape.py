"""Scrape SKKU cafeteria weekly menus and collect the latest N distinct
menu-sets per cafeteria, storing main dish vs side dishes separately.

Source: https://www.skku.edu/skku/campus/support/welfare_11.do (humanities/social campus)
         https://www.skku.edu/skku/campus/support/welfare_11_1.do (natural science campus)
"""
import json
import time
import datetime
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.skku.edu/skku/campus/support/welfare_11.do"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
CATEGORIES = ["B", "L", "D", "S"]  # 조식/중식/석식/간식
TARGET_DISTINCT = 32
MAX_WEEKS_BACK = 60  # safety cap (~14 months)

CAFETERIAS = [
    # campus, name, conspaceCd, srResId
    ("인문사회과학캠퍼스", "패컬티식당", "10201030", "1"),
    ("인문사회과학캠퍼스", "은행골식당", "10201031", "2"),
    ("인문사회과학캠퍼스", "법고을식당", "10201034", "4"),
    ("인문사회과학캠퍼스", "금잔디식당", "10201033", "6"),
    ("자연과학캠퍼스", "행단골식당", "20201104", "3"),
    ("자연과학캠퍼스", "구시재식당", "20201040", "11"),
    ("자연과학캠퍼스", "해오름식당", "20201251", "12"),
    ("자연과학캠퍼스", "THE S LOUNGE", "20201289", "17"),
]

MEAL_LABEL = {"B": "조식", "L": "중식", "D": "석식", "S": "간식"}


def fetch_week(conspace, res_id, category, dt):
    params = {
        "mode": "info",
        "conspaceCd": conspace,
        "srResId": res_id,
        "srShowTime": "W",
        "srCategory": category,
        "srDt": dt,
    }
    r = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.text


def parse_week(html, campus, cafeteria, category, conspace):
    soup = BeautifulSoup(html, "html.parser")
    entries = []

    prev_input = soup.find("input", id="prev")
    prev_date = prev_input["value"] if prev_input else None

    for wrap in soup.select("div.weeListWrap"):
        tit = wrap.select_one("div.weeListTit")
        if not tit:
            continue
        tit_text = " ".join(tit.stripped_strings)  # e.g. "화 (08.18)"
        parts = tit_text.split("(")
        weekday = parts[0].strip() if parts else ""
        mmdd = parts[1].rstrip(")").strip() if len(parts) > 1 else ""

        for cont in wrap.select("div.weeListCont"):
            h6 = cont.select_one("h6")
            corner = " ".join(h6.stripped_strings) if h6 else ""

            pre = cont.select_one("ul li pre")
            if not pre:
                continue
            items = [x.strip() for x in pre.get_text("\n").split("\n") if x.strip()]
            # drop closure/placeholder lines like "미운영" or "한상차림 미운영"
            items = [x for x in items if "미운영" not in x]
            if not items:
                continue

            lis = cont.select("ul > li")
            price = ""
            if len(lis) > 1:
                price = lis[1].get_text(strip=True)

            main_item = items[0]
            side_items = items[1:]

            entries.append({
                "campus": campus,
                "cafeteria": cafeteria,
                "conspace_cd": conspace,
                "corner": corner,
                "meal_type": category,
                "meal_label": MEAL_LABEL[category],
                "weekday": weekday,
                "mmdd": mmdd,
                "price": price,
                "main_item": main_item,
                "side_items": side_items,
                "all_items": items,
            })

    return entries, prev_date


def dedup_key(entry):
    return (entry["main_item"], tuple(entry["side_items"]))


def collect_for_cafeteria(campus, cafeteria, conspace, res_id, target=TARGET_DISTINCT):
    seen_keys = set()
    collected = []
    start_dt = datetime.date.today().isoformat()

    for category in CATEGORIES:
        dt = start_dt
        weeks_tried = 0
        while weeks_tried < MAX_WEEKS_BACK and len(
            {k for k in seen_keys}
        ) < target * len(CATEGORIES):
            html = fetch_week(conspace, res_id, category, dt)
            entries, prev_date = parse_week(html, campus, cafeteria, category, conspace)

            new_in_week = 0
            for e in entries:
                k = dedup_key(e)
                if k not in seen_keys:
                    seen_keys.add(k)
                    collected.append(e)
                    new_in_week += 1

            weeks_tried += 1
            if not prev_date or prev_date == dt:
                break
            dt = prev_date
            time.sleep(0.3)

            # stop early once this category has plainly run dry for a while
            if new_in_week == 0 and weeks_tried > 6:
                break

    return collected


def main():
    all_menus = []
    per_cafeteria_target = TARGET_DISTINCT

    for campus, cafeteria, conspace, res_id in CAFETERIAS:
        print(f"Scraping {campus} / {cafeteria} ...")
        collected = []
        seen = set()
        start_dt = datetime.date.today().isoformat()

        for category in CATEGORIES:
            dt = start_dt
            weeks_tried = 0
            stale_weeks = 0
            while weeks_tried < MAX_WEEKS_BACK:
                distinct_for_cafeteria = len({dedup_key(e) for e in collected})
                if distinct_for_cafeteria >= per_cafeteria_target:
                    break
                try:
                    html = fetch_week(conspace, res_id, category, dt)
                except requests.RequestException as ex:
                    print(f"  ! fetch error {category} {dt}: {ex}")
                    break
                entries, prev_date = parse_week(html, campus, cafeteria, category, conspace)

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

        print(f"  -> {len(collected)} distinct menu-sets collected")
        all_menus.extend(collected)

    with open("data/menus.json", "w", encoding="utf-8") as f:
        json.dump(all_menus, f, ensure_ascii=False, indent=2)

    print(f"\nTotal entries: {len(all_menus)}")
    from collections import Counter
    counts = Counter(e["cafeteria"] for e in all_menus)
    for name, c in counts.items():
        print(f"  {name}: {c}")


if __name__ == "__main__":
    main()
