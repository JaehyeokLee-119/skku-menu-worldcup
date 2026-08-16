import json

for path in ("data/menus.json", "web/data/menus.json"):
    d = json.load(open(path, encoding="utf-8"))
    cleaned = []
    for e in d:
        items = [x for x in e["all_items"] if "미운영" not in x]
        if not items:
            continue  # whole entry was just a closure placeholder
        e["all_items"] = items
        e["main_item"] = items[0]
        e["side_items"] = items[1:]
        cleaned.append(e)
    json.dump(cleaned, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(path, len(d), "->", len(cleaned))
