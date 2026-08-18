"""Downsize + recompress the generated menu/cafeteria photos for web delivery.
gpt-image-1 outputs ~1.7MB 1024x1024 JPEGs; cards only ever display them at a
few hundred px, so resize + re-encode at moderate JPEG quality."""
import os
from PIL import Image

TARGET_DIRS = [
    "docs/dev/images/menus",
    "docs/dev/images/cafeterias",
]
MAX_DIM = 640
QUALITY = 72


def compress(path):
    im = Image.open(path).convert("RGB")
    if max(im.size) > MAX_DIM:
        ratio = MAX_DIM / max(im.size)
        new_size = (round(im.size[0] * ratio), round(im.size[1] * ratio))
        im = im.resize(new_size, Image.LANCZOS)
    im.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)


def main():
    before_total = 0
    after_total = 0
    count = 0
    for d in TARGET_DIRS:
        for name in os.listdir(d):
            if not name.lower().endswith((".jpg", ".jpeg")):
                continue
            path = os.path.join(d, name)
            before = os.path.getsize(path)
            compress(path)
            after = os.path.getsize(path)
            before_total += before
            after_total += after
            count += 1

    print(f"Compressed {count} images")
    print(f"Before: {before_total/1024/1024:.1f} MB")
    print(f"After:  {after_total/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
