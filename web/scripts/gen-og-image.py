from PIL import Image, ImageFilter, ImageDraw
import os
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "..", "public", "readme")
LEFT, CENTER, RIGHT = "torvalds", "sindresorhus", "knadh"
CANVAS_W, CANVAS_H = 1200, 630
CENTER_H, OUTER_H, ANGLE, OUTER_DX, OUTER_DY = 500, 438, 13, 300, 18
OUT = os.path.join(HERE, "..", "app", "opengraph-image.png")

def load(name, h):
    im = Image.open(os.path.join(SRC, f"{name}.png")).convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)

def drop_shadow(im, blur, opacity):
    a = im.split()[3].point(lambda p: int(p * opacity / 255))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(a)
    return sh.filter(ImageFilter.GaussianBlur(blur))

def paste_c(canvas, im, cx, cy):
    canvas.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))

def gradient_bg():
    top, bottom = (22, 22, 26), (8, 8, 10)
    bg = Image.new("RGB", (CANVAS_W, CANVAS_H)); px = bg.load()
    for y in range(CANVAS_H):
        t = y / (CANVAS_H - 1)
        c = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(CANVAS_W):
            px[x, y] = c
    glow = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    ImageDraw.Draw(glow).ellipse([CANVAS_W * 0.2, -CANVAS_H * 0.3, CANVAS_W * 0.8, CANVAS_H * 0.9], fill=42)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.composite(Image.new("RGB", (CANVAS_W, CANVAS_H), (40, 40, 48)), bg, glow).convert("RGBA")

canvas = gradient_bg()
cxm, cym = CANVAS_W / 2, CANVAS_H / 2
left = load(LEFT, OUTER_H).rotate(ANGLE, expand=True, resample=Image.BICUBIC)
right = load(RIGHT, OUTER_H).rotate(-ANGLE, expand=True, resample=Image.BICUBIC)
center = load(CENTER, CENTER_H)
for im, cx, cy in [(left, cxm - OUTER_DX, cym + OUTER_DY), (right, cxm + OUTER_DX, cym + OUTER_DY)]:
    paste_c(canvas, drop_shadow(im, 22, 130), cx, cy + 14)
    paste_c(canvas, im, cx, cy)
paste_c(canvas, drop_shadow(center, 28, 175), cxm, cym + 18)
paste_c(canvas, center, cxm, cym)
canvas.convert("RGB").save(OUT)
print(f"wrote {OUT} {CANVAS_W}x{CANVAS_H}")
