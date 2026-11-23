# -*- coding: utf-8 -*-
"""يولّد شعار سِراج (SVG) وأيقونات التطبيق (PNG) من تصميم أصلي: قنديل إسلامي ذهبي + نجمة خاتم هندسية.
الاستخدام: python3 tools/make_assets.py   (يتطلب rsvg-convert)"""
import os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IMG = os.path.join(ROOT, "assets", "images")
os.makedirs(IMG, exist_ok=True)

DEFS = """<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EAD59A"/><stop offset=".5" stop-color="#D6B15E"/><stop offset="1" stop-color="#A9822F"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".55" stop-color="#EAD59A" stop-opacity=".5"/><stop offset="1" stop-color="#D6B15E" stop-opacity="0"/></radialGradient>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14503F"/><stop offset="1" stop-color="#082820"/></linearGradient>
</defs>"""

# القنديل في صندوق 200×250
LANTERN = """<g>
<circle cx="100" cy="19" r="9" fill="none" stroke="url(#g)" stroke-width="4"/>
<rect x="96" y="27" width="8" height="12" rx="2" fill="url(#g)"/>
<path d="M56 86 C56 62 78 46 100 38 C122 46 144 62 144 86 Z" fill="url(#g)"/>
<rect x="50" y="86" width="100" height="12" rx="4" fill="url(#g)"/>
<path d="M60 98 H140 L152 150 L140 202 H60 L48 150 Z" fill="#082820" stroke="url(#g)" stroke-width="5" stroke-linejoin="round"/>
<circle cx="100" cy="150" r="44" fill="url(#glow)"/>
<path d="M82 98 L75 202 M118 98 L125 202" stroke="url(#g)" stroke-width="3" opacity=".65" fill="none"/>
<g transform="translate(100 150)" fill="none" stroke="url(#g)" stroke-width="4" stroke-linejoin="round"><rect x="-22" y="-22" width="44" height="44"/><rect x="-22" y="-22" width="44" height="44" transform="rotate(45)"/></g>
<path d="M100 130 C109 141 113 151 100 166 C87 151 91 141 100 130 Z" fill="#FFF3C4"/>
<path d="M58 202 H142 L132 220 H68 Z" fill="url(#g)"/>
<rect x="96" y="220" width="8" height="11" fill="url(#g)"/>
<circle cx="100" cy="239" r="7" fill="url(#g)"/>
</g>"""

def write(name, s):
    with open(os.path.join(IMG, name), "w", encoding="utf-8") as f:
        f.write(s)

# رمز القنديل وحده (للاستخدام داخل التطبيق)
write("logo-mark.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" role="img" aria-label="شعار سِراج">%s%s</svg>' % (DEFS, LANTERN))

# أيقونة مربعة 512
def square(maskable=False):
    s = 1.28 if not maskable else 1.02   # منطقة آمنة أوسع للـ maskable
    h = 250 * s; w = 200 * s
    tx = (512 - w) / 2; ty = (512 - h) / 2 + 4
    corner = "" if maskable else ' rx="112"'
    ring = '' if maskable else '<rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="#D6B15E" stroke-opacity=".35" stroke-width="3"/>'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">%s<rect width="512" height="512"%s fill="url(#bg)"/>%s'
            '<g transform="translate(%.1f %.1f) scale(%.3f)">%s</g></svg>') % (DEFS, corner, ring, tx, ty, s, LANTERN)
write("icon.svg", square(False))
write("icon-maskable.svg", square(True))

# شعار أفقي: القنديل على اليمين ثم الاسم (RTL)
FONT = "Amiri, 'Noto Naskh Arabic', 'Noto Sans Arabic', 'DejaVu Sans', serif"
def horizontal(dark=True):
    bg = '<rect width="1200" height="360" rx="40" fill="url(#bg)"/>' if dark else ""
    name = "#EAD59A"; sub = "#D6B15E"
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360">%s%s'
            '<g transform="translate(950 42) scale(1.12)">%s</g>'
            '<text x="905" y="200" text-anchor="end" font-family="%s" font-size="140" font-weight="700" fill="%s">سِراج</text>'
            '<text x="905" y="262" text-anchor="end" font-family="Georgia, \'DejaVu Serif\', serif" font-size="44" letter-spacing="14" fill="%s">SIRAJ</text>'
            '<text x="905" y="318" text-anchor="end" font-family="%s" font-size="36" fill="#F6F1E5" fill-opacity=".85">نور العلم وهداية الطريق</text></svg>') % (DEFS, bg, LANTERN, FONT, name, sub, FONT)
write("logo-horizontal.svg", horizontal(True))

def png(src, out, w, h=None):
    cmd = ["rsvg-convert", "-w", str(w)] + (["-h", str(h)] if h else []) + [os.path.join(IMG, src), "-o", os.path.join(IMG, out)]
    subprocess.run(cmd, check=True)

png("icon.svg", "icon-512.png", 512)
png("icon.svg", "icon-192.png", 192)
png("icon.svg", "apple-touch-icon.png", 180)
png("icon-maskable.svg", "icon-maskable-512.png", 512)
png("icon.svg", "favicon-32.png", 32)
png("logo-horizontal.svg", "logo.png", 1200, 360)
png("logo-mark.svg", "logo-mark.png", 400)
print("assets OK")
