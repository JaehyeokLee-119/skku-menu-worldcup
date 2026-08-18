"""Generate realistic photographic images for menu items using OpenAI's
gpt-image-1, styled after the example cafeteria tray photos in 예시사진/.

API key is read from the OPENAI_API_KEY environment variable only -
never hardcode it here or commit it anywhere.
"""
import base64
import json
import os
import time
import urllib.request
import urllib.error

API_KEY = os.environ["OPENAI_API_KEY"]
API_URL = "https://api.openai.com/v1/images/generations"

OUT_DIR = "docs/images/menus"
os.makedirs(OUT_DIR, exist_ok=True)

STYLE_PREFIX = (
    "A realistic photograph of a single dish served on a matte black ceramic "
    "plate or bowl, placed on a dark gray/black plastic university cafeteria "
    "tray. Shot from a slightly elevated angle looking down, like a phone "
    "photo taken by a student in a dining hall. Natural indoor fluorescent "
    "lighting, mild reflections on the tray surface, true-to-life colors and "
    "textures, photorealistic, candid food photography style, shallow depth "
    "of field. No cartoon or illustration style, no text, no watermark, no "
    "people, no hands, no logos. The dish: "
)


def slugify(cafeteria, name):
    prefix = "haengdangol" if cafeteria.startswith("행단골") else "eunhaenggol"
    keep = "".join(c for c in name if c.isalnum())
    return f"{prefix}_{keep[:40] or 'menu'}"


def generate(prompt, out_path):
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1024x1024",
        "quality": "medium",
        "n": 1,
    }).encode("utf-8")

    req = urllib.request.Request(API_URL, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {API_KEY}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.load(resp)

    b64 = data["data"][0]["b64_json"]
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(b64))


def run(descriptions, menus_path="data/menus.json"):
    """descriptions: {(cafeteria_prefix, main_item): english description}
    cafeteria_prefix is '은행골' or '행단골' (matched via startswith)."""
    menus = json.load(open(menus_path, encoding="utf-8"))
    manifest = {}

    targets = []
    for m in menus:
        for (caf_prefix, name), desc in descriptions.items():
            if m["cafeteria"].startswith(caf_prefix) and m["main_item"] == name:
                targets.append((m, desc))

    for i, (m, desc) in enumerate(targets, 1):
        name = m["main_item"]
        slug = slugify(m["cafeteria"], name)
        out_path = os.path.join(OUT_DIR, f"{slug}.jpg")
        rel_path = f"images/menus/{slug}.jpg"

        if os.path.exists(out_path):
            print(f"[{i}/{len(targets)}] exists, skipping: {m['cafeteria'][:6]} / {name}")
            manifest[f"{m['cafeteria']}::{name}"] = rel_path
            continue

        print(f"[{i}/{len(targets)}] generating: {m['cafeteria'][:6]} / {name}")
        prompt = STYLE_PREFIX + desc + "."
        try:
            generate(prompt, out_path)
            manifest[f"{m['cafeteria']}::{name}"] = rel_path
            print(f"  -> saved {out_path}")
        except urllib.error.HTTPError as e:
            print(f"  ! failed: {e.code} {e.read().decode('utf-8', 'ignore')[:300]}")
        except Exception as e:
            print(f"  ! failed: {e}")
        time.sleep(1)

    return manifest


if __name__ == "__main__":
    import sys
    desc_file = sys.argv[1] if len(sys.argv) > 1 else "scraper/menu_descriptions_test.json"
    raw = json.load(open(desc_file, encoding="utf-8"))
    descriptions = {(k.split("::")[0], k.split("::")[1]): v for k, v in raw.items()}
    manifest = run(descriptions)
    with open("scraper/image_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nDone. {len(manifest)} images generated.")
