"""Build the final 32 for 행단골식당 from the top-50 frequency-ranked
candidates, dropping near-duplicate variants of the same dish (judged by
hand) and backfilling with the next most-frequent distinct candidates."""
import json

DROP_NAMES = {
    "나주식곰탕&당면사리",   # dup of 나주곰탕&당면사리
    "나주곰탕",              # dup of 나주곰탕&당면사리
    "닭개장",                # dup of 얼큰닭개장
    "모둠햄부대찌개&라면사리",  # dup of 모둠햄부대찌개
    "순살시래기감자탕",       # dup of 시래기순살감자탕 (word order only)
    "김치날치알밥",          # dup of 김치날치알비빔밥
}

candidates = json.load(open("scraper/haengdangol_top50.json", encoding="utf-8"))

final32 = []
seen = set()
for c in candidates:
    name = c["main_item"]
    if name in DROP_NAMES or name in seen:
        continue
    seen.add(name)

    # fallback cleanup: some corners join side items with "/" on one line
    # instead of separate lines
    cleaned_sides = []
    for s in c["side_items"]:
        if "/" in s and len(s) > 8:
            cleaned_sides.extend(p.strip(' "') for p in s.split("/") if p.strip(' "'))
        else:
            cleaned_sides.append(s.strip(' "'))
    c["side_items"] = cleaned_sides
    c["all_items"] = [name] + cleaned_sides
    c.pop("appearance_count", None)

    final32.append(c)
    if len(final32) == 32:
        break

print(f"final32 count: {len(final32)}")
for r in final32:
    print(f"  {r['main_item']}")

CAFETERIA = "행단골식당 (자과캠 학생회관 1층)"
for path in ("data/menus.json", "docs/data/menus.json"):
    d = json.load(open(path, encoding="utf-8"))
    d = [e for e in d if e["cafeteria"] != CAFETERIA]
    d.extend(final32)
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"wrote {path}: {len(d)} total entries")
