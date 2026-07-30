from PIL import Image
import os

SRC = os.path.join(os.path.dirname(__file__), "..", "public", "readme")
TOP = ["torvalds", "rauchg", "sindresorhus"]
BOT = ["knadh", "soumith"]
CARD_W, GAP_X, GAP_Y = 560, 40, 32
OUT = os.path.join(SRC, "showcase.png")

def load(name):
    im = Image.open(os.path.join(SRC, f"{name}.png")).convert("RGBA")
    im = im.crop(im.getbbox())
    h = round(im.height * CARD_W / im.width)
    return im.resize((CARD_W, h), Image.LANCZOS)

top = [load(n) for n in TOP]
bot = [load(n) for n in BOT]
CARD_H = max(c.height for c in top + bot)
row2_w = 2*CARD_W + GAP_X
W = 3*CARD_W + 2*GAP_X
H = 2*CARD_H + GAP_Y
canvas = Image.new("RGBA", (W, H), (0,0,0,0))
x = 0
for im in top:
    canvas.alpha_composite(im, (x, 0)); x += CARD_W + GAP_X
x = (W - row2_w)//2
for im in bot:
    canvas.alpha_composite(im, (x, CARD_H + GAP_Y)); x += CARD_W + GAP_X
canvas.save(OUT)
print(f"wrote {OUT} {W}x{H}")
