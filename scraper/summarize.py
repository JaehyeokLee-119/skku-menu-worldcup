import json
from collections import Counter

d = json.load(open("data/menus.json", encoding="utf-8"))
c = Counter((e["cafeteria"], e["meal_label"]) for e in d)
with open("scraper/summary.txt", "w", encoding="utf-8") as f:
    for k, v in sorted(c.items()):
        f.write(f"{k[0]} {k[1]} {v}\n")
    f.write(f"\ntotal {len(d)}\n")
