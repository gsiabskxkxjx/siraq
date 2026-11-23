#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يُشغَّل بعد `npx cap add android`:
  1) صلاحيات: الموقع (القبلة/الأوقات) والاهتزاز.
  2) أيقونات التطبيق (عادية/دائرية/تكيّفية) من أيقونة سِراج بدل أيقونة Capacitor.
  3) شاشة البداية بلون سِراج وشعارها.
أي خطوة تفشل تُسجَّل كتحذير ولا توقف البناء (الـAPK يبقى صالحاً بالأيقونات الافتراضية).
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, "android")
RES = os.path.join(AND, "app", "src", "main", "res")
MANIFEST = os.path.join(AND, "app", "src", "main", "AndroidManifest.xml")
BG = "#103B2F"          # خلفية الأيقونة التكيّفية
SPLASH_BG = (8, 40, 32)  # #082820


def warn(msg):
    print("::warning title=تهيئة أندرويد::" + msg)


def patch_manifest():
    if not os.path.exists(MANIFEST):
        warn("AndroidManifest.xml غير موجود")
        return
    s = open(MANIFEST, encoding="utf-8").read()
    want = [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.VIBRATE",
    ]
    add = ""
    for p in want:
        if p not in s:
            add += '    <uses-permission android:name="%s" />\n' % p
    if add:
        if "</manifest>" not in s:
            warn("بنية المانيفست غير متوقعة")
            return
        s = s.replace("</manifest>", add + "</manifest>")
        open(MANIFEST, "w", encoding="utf-8").write(s)
    print("manifest: الصلاحيات =", re.findall(r'uses-permission android:name="([^"]+)"', s))


def icons():
    try:
        from PIL import Image, ImageDraw
    except Exception as e:  # noqa: BLE001
        warn("Pillow غير متوفر، تُركت الأيقونات الافتراضية: %s" % e)
        return
    src_m = os.path.join(ROOT, "assets", "images", "icon-maskable-512.png")
    src_a = os.path.join(ROOT, "assets", "images", "icon-512.png")
    if not (os.path.exists(src_m) and os.path.exists(src_a)):
        warn("أيقونات المصدر غير موجودة")
        return
    maskable = Image.open(src_m).convert("RGBA")
    anyicon = Image.open(src_a).convert("RGBA")
    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for d, k in dens.items():
        folder = os.path.join(RES, "mipmap-" + d)
        os.makedirs(folder, exist_ok=True)
        s = int(round(48 * k))
        f = int(round(108 * k))
        # الأيقونة القديمة (مربعة بزوايا مستديرة) والدائرية
        sq = anyicon.resize((s, s), Image.LANCZOS)
        sq.save(os.path.join(folder, "ic_launcher.png"))
        big = maskable.resize((s * 4, s * 4), Image.LANCZOS)
        mask = Image.new("L", (s * 4, s * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
        rnd = Image.new("RGBA", (s * 4, s * 4), (0, 0, 0, 0))
        rnd.paste(big, (0, 0), mask)
        rnd.resize((s, s), Image.LANCZOS).save(os.path.join(folder, "ic_launcher_round.png"))
        # مقدمة الأيقونة التكيّفية: المقنّعة تحتفظ بهامش آمن أصلاً
        # نجعل الخلفية شفافة حيث لونها يطابق خلفية التكيّفية ليبقى الشعار فقط
        fg = maskable.resize((f, f), Image.LANCZOS)
        fg.save(os.path.join(folder, "ic_launcher_foreground.png"))
    os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '</adaptive-icon>\n')
    for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
        open(os.path.join(RES, "mipmap-anydpi-v26", n), "w", encoding="utf-8").write(xml)
    os.makedirs(os.path.join(RES, "values"), exist_ok=True)
    open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">%s</color>\n</resources>\n' % BG)
    # قالب Capacitor قد يحوي رسوماً متجهة قديمة بالاسم نفسه تتعارض مع المقدمة الجديدة
    for old in glob.glob(os.path.join(RES, "drawable*", "ic_launcher_foreground.xml")) + \
            glob.glob(os.path.join(RES, "drawable*", "ic_launcher_background.xml")):
        os.remove(old)
        print("حُذف قديم:", os.path.relpath(old, RES))
    print("أيقونات: تم")


def splash():
    try:
        from PIL import Image
    except Exception as e:  # noqa: BLE001
        warn("Pillow غير متوفر، تُركت شاشة البداية الافتراضية: %s" % e)
        return
    logo_p = os.path.join(ROOT, "assets", "images", "logo-mark.png")
    if not os.path.exists(logo_p):
        warn("شعار سِراج غير موجود لشاشة البداية")
        return
    logo = Image.open(logo_p).convert("RGBA")
    files = glob.glob(os.path.join(RES, "drawable*", "splash.png"))
    for p in files:
        try:
            w, h = Image.open(p).size
            canvas = Image.new("RGBA", (w, h), SPLASH_BG + (255,))
            side = int(min(w, h) * 0.34)
            lg = logo.copy()
            lg.thumbnail((side, side), Image.LANCZOS)
            canvas.paste(lg, ((w - lg.width) // 2, (h - lg.height) // 2), lg)
            canvas.convert("RGB").save(p)
        except Exception as e:  # noqa: BLE001
            warn("تعذّر تعديل %s: %s" % (p, e))
    print("شاشة البداية: عُدّل %d ملف" % len(files))


if __name__ == "__main__":
    if not os.path.isdir(AND):
        print("لا يوجد مجلد android — شغّل npx cap add android أولاً")
        sys.exit(1)
    for fn in (patch_manifest, icons, splash):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            warn("%s: %s" % (fn.__name__, e))
