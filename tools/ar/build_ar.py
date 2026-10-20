"""Build the AR Quick Look models (USDZ) and button images for /fuzzy/.

Run from the repo root with a local server on port 8766 (python -m http.server 8766), then:
    python tools/ar/build_ar.py
Needs: pip install playwright pillow && playwright install chromium
"""
import base64, io, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

OUT = "assets/fuzzy/ar"
STATES = [  # (file stem, road, traffic, gap, rule set, button caption)
    ("highway-2023-dense", 10, 10, 10, "v1", "2023 rules · dense traffic"),
    ("highway-rewrite", 7.5, 2.5, 9, "v2", "My 27-rule rewrite"),
]
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page()
    pg.goto("http://localhost:8766/tools/ar/build.html"); pg.wait_for_function("window.ready === true", timeout=60000)
    for stem, r, t, g, s, cap in STATES:
        res = pg.evaluate(f"buildAR({r}, {t}, {g}, '{s}')")
        open(f"{OUT}/{stem}.usdz", "wb").write(base64.b64decode(res["usdz"]))
        open(f"{OUT}/{stem}.glb", "wb").write(base64.b64decode(res["glb"]))
        im = Image.open(io.BytesIO(base64.b64decode(res["png"].split(",", 1)[1]))).convert("RGB")
        # Quick Look wants the link's only child to be an image, so the label is drawn into it
        d = ImageDraw.Draw(im, "RGBA"); W, H = im.size
        try: f1, f2 = ImageFont.truetype("arialbd.ttf", 34), ImageFont.truetype("arial.ttf", 24)
        except OSError: f1 = f2 = ImageFont.load_default()
        d.rounded_rectangle([24, H - 104, W - 24, H - 24], 22, fill=(8, 8, 18, 215))
        d.text((52, H - 96), "View in AR", font=f1, fill=(236, 235, 255)); d.text((52, H - 56), cap, font=f2, fill=(166, 163, 200))
        im.save(f"{OUT}/{stem}.jpg", "JPEG", quality=84, optimize=True)
        print(stem, "value", res["value"], "usdz KB", os.path.getsize(f"{OUT}/{stem}.usdz") // 1024)
    b.close()
