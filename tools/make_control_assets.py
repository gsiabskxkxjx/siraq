#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يولّد أيقونات تطبيق «سِراج — التحكم» من شعار سِراج (الفانوس) على خلفية كحلية مع شارة مفتاح ذهبية،
حتى يتميّز عن تطبيق سِراج على الشاشة الرئيسية. المخرجات في control/assets/images/ (تُلتزم في المستودع)."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "logo-mark.png")
OUT = os.path.join(ROOT, "control", "assets", "images")
os.makedirs(OUT, exist_ok=True)
NAVY_TOP, NAVY_BOT = (22, 44, 72), (9, 20, 36)
GOLD, GOLD_D = (214, 176, 92), (160, 120, 48)


def gradient(size, top, bot):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    return img


def key_badge(d, cx, cy, r):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD, outline=GOLD_D, width=max(2, r // 14))
    # مفتاح مبسّط: حلقة + ساق + سنّان
    s = r / 100.0
    ring_c = (cx - 28 * s, cy - 6 * s)
    d.ellipse((ring_c[0] - 24 * s, ring_c[1] - 24 * s, ring_c[0] + 24 * s, ring_c[1] + 24 * s), outline=NAVY_BOT, width=int(11 * s))
    d.rectangle((ring_c[0] + 22 * s, ring_c[1] - 5 * s, cx + 52 * s, ring_c[1] + 6 * s), fill=NAVY_BOT)
    d.rectangle((cx + 28 * s, ring_c[1] + 4 * s, cx + 38 * s, ring_c[1] + 24 * s), fill=NAVY_BOT)
    d.rectangle((cx + 44 * s, ring_c[1] + 4 * s, cx + 54 * s, ring_c[1] + 18 * s), fill=NAVY_BOT)


def compose(size, rounded, logo_k, badge=True):
    bg = gradient(size, NAVY_TOP, NAVY_BOT).convert("RGBA")
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.23), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(bg, (0, 0), mask)
        bg = out
        d = ImageDraw.Draw(bg)
        d.rounded_rectangle((size * 0.03, size * 0.03, size * 0.97, size * 0.97), radius=int(size * 0.2), outline=(214, 176, 92, 70), width=max(1, size // 256))
    logo = Image.open(SRC).convert("RGBA")
    h = int(size * logo_k)
    w = int(logo.width * h / logo.height)
    logo = logo.resize((w, h), Image.LANCZOS)
    bg.alpha_composite(logo, ((size - w) // 2, (size - h) // 2 - int(size * 0.02)))
    if badge:
        d = ImageDraw.Draw(bg)
        r = int(size * 0.17)
        key_badge(d, int(size * (0.70 if rounded else 0.66)), int(size * (0.72 if rounded else 0.68)), r)
    return bg


if __name__ == "__main__":
    compose(512, True, 0.74).save(os.path.join(OUT, "icon-512.png"))
    compose(192, True, 0.74).save(os.path.join(OUT, "icon-192.png"))
    compose(512, False, 0.56).save(os.path.join(OUT, "icon-maskable-512.png"))
    compose(32, True, 0.74, badge=False).save(os.path.join(OUT, "favicon-32.png"))
    # شعار الشاشة الافتتاحية (خلفية شفافة): الفانوس مع شارة المفتاح
    logo = Image.open(SRC).convert("RGBA")
    c = Image.new("RGBA", (460, 520), (0, 0, 0, 0))
    c.alpha_composite(logo, (30, 10))
    key_badge(ImageDraw.Draw(c), 350, 400, 80)
    c.save(os.path.join(OUT, "logo-mark.png"))
    print("تم:", sorted(os.listdir(OUT)))
