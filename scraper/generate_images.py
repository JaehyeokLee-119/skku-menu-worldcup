"""Generate realistic photographic images for 해오름식당 menu items using
OpenAI's gpt-image-1, styled after example cafeteria tray photos.

API key is read from the OPENAI_API_KEY environment variable only —
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

OUT_DIR = "docs/images/haeorm"
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

DISH_DESCRIPTIONS = {
    "뚝배기사골떡만두국": "Korean beef bone broth soup with rice cakes and dumplings, served bubbling hot in a stone pot (ttukbaegi)",
    "제육볶음덮밥": "spicy stir-fried pork (jeyuk-bokkeum) served over a bowl of white rice",
    "고구마치즈돈까스": "a breaded and deep-fried pork cutlet (donkatsu) stuffed with sweet potato and cheese, sliced and plated with sauce drizzled on top",
    "와사비크림치킨": "crispy fried chicken pieces tossed in a pale wasabi cream sauce",
    "뚝배기부대찌개+라면사리": "Korean army stew (budae-jjigae) with sausage, spam, kimchi and instant ramen noodles, bubbling in a stone pot",
    "상하이식오돈불고기덮밥": "Shanghai-style spicy stir-fried pork bulgogi served over a bowl of rice",
    "치즈돈까스": "a breaded deep-fried pork cutlet (donkatsu) stuffed with melted cheese, sliced open showing cheese pull",
    "명란군만두": "pan-fried dumplings filled with pollock roe (myeongnan), golden and crispy on the bottom",
    "샤브설렁탕": "a milky white Korean ox bone soup (seolleongtang) with thin slices of shabu-shabu beef and green onion",
    "훈제오리김치볶음밥+떡갈비": "smoked duck kimchi fried rice plated next to grilled Korean short rib patties (tteokgalbi)",
    "쉬림프에그함박": "a Japanese-style hamburg steak (hambagu) topped with a fried egg and shrimp, in brown sauce",
    "고기+김치만두": "an assorted plate of steamed and pan-fried Korean dumplings (mandu), some meat-filled and some kimchi-filled",
    "뚝배기우삼겹고추장찌개": "a spicy gochujang stew with beef short rib belly slices, bubbling in a stone pot",
    "돈치마요덮밥": "a crispy pork cutlet cut into pieces over rice, drizzled generously with mayo sauce",
    "왕교자튀김만두": "large golden deep-fried gyoza dumplings, crispy on the outside",
    "뚝배기육개장칼국수": "spicy beef and vegetable soup (yukgaejang) with hand-cut wheat noodles (kalguksu), served hot in a stone pot",
    "데리야끼돈육숙주덮밥": "teriyaki-glazed pork slices with bean sprouts over a bowl of rice",
    "뚝배기삼겹감자짜글이": "a spicy stew of pork belly and potato chunks in red sauce, bubbling in a stone pot",
    "쇠고기양송이덮밥": "sliced beef and mushrooms in a savory cream sauce over a bowl of rice",
    "가라아게돈까스": "Japanese-style fried chicken karaage pieces plated alongside a pork cutlet",
    "파채닭강정": "sweet and spicy glazed Korean fried chicken bites (dakgangjeong) topped with shredded green onion",
    "나주곰탕": "a clear Korean beef bone soup (gomtang) with thin slices of beef and chopped green onion",
    "주꾸미파채불고기덮밥": "spicy stir-fried baby octopus with shredded green onion, bulgogi style, served over rice",
    "모둠까스(치킨&생선까스&새우튀김)": "an assorted fried cutlet platter with chicken cutlet, fish cutlet, and fried shrimp",
    "소떡소떡": "grilled sausage and rice cake skewers (sotteok-sotteok) glazed with sweet-spicy sauce",
    "갈비찐만두": "steamed dumplings filled with short rib meat (galbi-jjin-mandu)",
    "뚝배기만두닭곰탕": "a clear chicken soup (dakgomtang) with dumplings, served hot in a stone pot",
    "고로케김치마파두부덮밥": "a croquette plated with spicy kimchi mapo tofu over a bowl of rice",
    "로제치즈돈까스": "a pork cutlet topped with creamy rose (tomato-cream) sauce and melted cheese",
    "모둠튀김강정": "an assorted platter of sweet and spicy glazed fried snacks and chicken bites",
    "뚝배기쇠고기유부전골": "a hot pot (jeongol) of beef and fried tofu pouches in savory broth, bubbling in a stone pot",
    "청양풍닭안심덮밥": "spicy cheongyang-pepper glazed chicken tenderloin pieces served over a bowl of rice",
}


def slugify(name):
    keep = "".join(c for c in name if c.isalnum())
    return keep[:40] or "menu"


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


def main():
    menus = json.load(open("scraper/haeorm_menus.json", encoding="utf-8"))
    manifest = {}

    for i, m in enumerate(menus, 1):
        name = m["main_item"]
        desc = DISH_DESCRIPTIONS.get(name)
        if not desc:
            print(f"[{i}/{len(menus)}] SKIP (no description): {name}")
            continue

        slug = slugify(name)
        out_path = os.path.join(OUT_DIR, f"{slug}.jpg")
        rel_path = f"images/haeorm/{slug}.jpg"

        if os.path.exists(out_path):
            print(f"[{i}/{len(menus)}] exists, skipping: {name}")
            manifest[name] = rel_path
            continue

        prompt = STYLE_PREFIX + desc + "."
        print(f"[{i}/{len(menus)}] generating: {name}")
        try:
            generate(prompt, out_path)
            manifest[name] = rel_path
        except urllib.error.HTTPError as e:
            print(f"  ! failed: {e.code} {e.read().decode('utf-8', 'ignore')[:300]}")
        except Exception as e:
            print(f"  ! failed: {e}")
        time.sleep(1)

    with open("scraper/haeorm_image_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\nDone. {len(manifest)}/{len(menus)} images generated.")


if __name__ == "__main__":
    main()
