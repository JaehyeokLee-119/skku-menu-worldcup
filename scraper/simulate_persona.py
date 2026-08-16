"""Simulate the 남/21세/성균관대 2학년 기숙사생 persona (from docs/about.html)
playing the worldcup ~30 times per cafeteria, to seed real-looking preference
data into Supabase for 은행골식당 / 행단골식당.

Persona: tight allowance, dorm student, eats at campus cafeterias often.
Leans toward hearty/fried/cheesy/meaty comfort food; less excited by plain
soups, health-food-ish or unusually light dishes.
"""
import json
import random
import time
import urllib.request

SUPABASE_URL = "https://nvzjplsawkwrtmegcpel.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_hdH2l6B5QatY5wnxnaTlLw_CZU-ahVV"

CAFETERIAS = ["은행골식당", "행단골식당"]
RUNS_PER_CAFETERIA = 30
BRACKET_SIZE = 16

POSITIVE_KEYWORDS = {
    "치즈": 3, "까스": 3, "가스": 3, "함박": 3, "스테이크": 3, "가라아게": 3,
    "폭탄": 3, "베이컨": 3, "삼겹": 3, "부대찌개": 3, "도리아": 3, "짜글이": 3,
    "마요": 3, "카츠": 3, "가츠": 3,
    "불고기": 2, "제육": 2, "닭갈비": 2, "볶음밥": 2, "짬뽕": 2, "카레": 2,
    "자장": 2, "떡볶이": 2, "강정": 2, "돈까스": 2, "튀김": 2, "치킨": 2,
    "곰탕": 1, "설렁탕": 1, "육개장": 1, "감자탕": 1, "비빔밥": 1, "만두": 1,
    "탕": 1, "찌개": 1,
}
NEGATIVE_KEYWORDS = {
    "청국장": 3, "비지": 2, "열무": 2, "냉모밀": 2, "초계국수": 2,
    "죽": 2, "순두부": 1, "나물": 1, "미역국": 1,
}


def score(main_item):
    s = 0.0
    for kw, w in POSITIVE_KEYWORDS.items():
        if kw in main_item:
            s += w
    for kw, w in NEGATIVE_KEYWORDS.items():
        if kw in main_item:
            s -= w
    return s


def menu_id(entry):
    return f"{entry['cafeteria']}::{entry['main_item']}::{'|'.join(entry['side_items'])}"


def pick_winner(a, b):
    sa, sb = score(a["main_item"]), score(b["main_item"])
    # persona bias + noise, so it's not perfectly deterministic
    sa += random.gauss(0, 1.4)
    sb += random.gauss(0, 1.4)
    return a if sa >= sb else b


def record_menu_match(winner, loser):
    body = json.dumps({
        "winner_id": menu_id(winner),
        "winner_cafeteria": winner["cafeteria"],
        "winner_main": winner["main_item"],
        "loser_id": menu_id(loser),
        "loser_cafeteria": loser["cafeteria"],
        "loser_main": loser["main_item"],
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/record_menu_match",
        data=body, method="POST",
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("apikey", SUPABASE_ANON_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_ANON_KEY}")
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def run_bracket(pool, size):
    bracket = random.sample(pool, min(size, len(pool)))
    match_count = 0
    while len(bracket) > 1:
        next_round = []
        for i in range(0, len(bracket) - 1, 2):
            a, b = bracket[i], bracket[i + 1]
            winner = pick_winner(a, b)
            loser = b if winner is a else a
            record_menu_match(winner, loser)
            match_count += 1
            next_round.append(winner)
        if len(bracket) % 2 == 1:
            next_round.append(bracket[-1])
        bracket = next_round
    return match_count


def main():
    menus = json.load(open("data/menus.json", encoding="utf-8"))
    total_matches = 0

    for cafeteria in CAFETERIAS:
        pool = [e for e in menus if e["cafeteria"] == cafeteria]
        print(f"{cafeteria}: {len(pool)} menus, running {RUNS_PER_CAFETERIA} brackets of {BRACKET_SIZE}강")
        for run in range(1, RUNS_PER_CAFETERIA + 1):
            n = run_bracket(pool, BRACKET_SIZE)
            total_matches += n
            if run % 5 == 0:
                print(f"  run {run}/{RUNS_PER_CAFETERIA} done ({total_matches} matches so far)")
            time.sleep(0.05)

    print(f"\nDone. {total_matches} total matches recorded.")


if __name__ == "__main__":
    main()
