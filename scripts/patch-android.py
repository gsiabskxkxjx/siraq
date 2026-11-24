#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يُشغَّل بعد `npx cap add android`:
  1) صلاحيات: الموقع (القبلة/الأوقات) والاهتزاز، والإشعارات والمنبّهات الدقيقة (الأذان والتذكيرات).
  2) أيقونات التطبيق (عادية/دائرية/تكيّفية) من أيقونة سِراج بدل أيقونة Capacitor.
  3) شاشة البداية بلون سِراج وشعارها.
أي خطوة تفشل تُسجَّل كتحذير ولا توقف البناء (الـAPK يبقى صالحاً بالأيقونات الافتراضية).
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# يخدم التطبيقين: سِراج (الافتراضي) و«سِراج — التحكم» عبر متغيرات بيئة:
#   SIRAJ_ANDROID_DIR  مجلد مشروع أندرويد (الافتراضي android)
#   SIRAJ_IMAGES_DIR   مجلد الأيقونات والشعار (الافتراضي assets/images)
#   SIRAJ_ICON_BG      لون الأيقونة التكيّفية    SIRAJ_SPLASH_BG  لون شاشة البداية (#RRGGBB)
#   SIRAJ_PERMS        صلاحيات مفصولة بفاصلة؛ فارغ = لا شيء (الافتراضي: الموقع والاهتزاز)
AND = os.path.abspath(os.path.join(ROOT, os.environ.get("SIRAJ_ANDROID_DIR", "android")))
IMAGES = os.path.abspath(os.path.join(ROOT, os.environ.get("SIRAJ_IMAGES_DIR", os.path.join("assets", "images"))))
RES = os.path.join(AND, "app", "src", "main", "res")
MANIFEST = os.path.join(AND, "app", "src", "main", "AndroidManifest.xml")
BG = os.environ.get("SIRAJ_ICON_BG", "#103B2F")  # خلفية الأيقونة التكيّفية
_sb = os.environ.get("SIRAJ_SPLASH_BG", "#082820").lstrip("#")
SPLASH_BG = tuple(int(_sb[i:i + 2], 16) for i in (0, 2, 4))  # الافتراضي #082820
_DEF_PERMS = ("android.permission.ACCESS_COARSE_LOCATION,android.permission.ACCESS_FINE_LOCATION,android.permission.VIBRATE,"
              "android.permission.POST_NOTIFICATIONS,android.permission.SCHEDULE_EXACT_ALARM,android.permission.USE_EXACT_ALARM,"
              "android.permission.RECEIVE_BOOT_COMPLETED,android.permission.WAKE_LOCK")
PERMS = [p for p in os.environ.get("SIRAJ_PERMS", _DEF_PERMS).split(",") if p.strip()]


def warn(msg):
    print("::warning title=تهيئة أندرويد::" + msg)


def patch_manifest():
    if not os.path.exists(MANIFEST):
        warn("AndroidManifest.xml غير موجود")
        return
    s = open(MANIFEST, encoding="utf-8").read()
    want = PERMS
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
    # أندرويد 11+ يخفي عن التطبيق محركات النطق ما لم يُصرَّح بذلك (حتى تعمل «القراءة الآلية»). يُفعَّل عبر SIRAJ_TTS=1
    if os.environ.get("SIRAJ_TTS") == "1" and "TTS_SERVICE" not in s:
        s = s.replace("</manifest>", '    <queries>\n        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>\n</manifest>')
        open(MANIFEST, "w", encoding="utf-8").write(s)
        print("manifest: أُضيف <queries> لمحركات النطق")
    print("manifest: الصلاحيات =", re.findall(r'uses-permission android:name="([^"]+)"', s))


def icons():
    try:
        from PIL import Image, ImageDraw
    except Exception as e:  # noqa: BLE001
        warn("Pillow غير متوفر، تُركت الأيقونات الافتراضية: %s" % e)
        return
    src_m = os.path.join(IMAGES, "icon-maskable-512.png")
    src_a = os.path.join(IMAGES, "icon-512.png")
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


def status_icon():
    """أيقونة شريط الإشعارات: أندرويد يرسمها بلون واحد من قناة الشفافية فقط، لذا نصنع قناعاً أبيض من شعار سِراج."""
    if "android.permission.POST_NOTIFICATIONS" not in PERMS:  # تطبيق التحكم لا يرسل إشعارات
        return
    try:
        from PIL import Image
    except Exception as e:  # noqa: BLE001
        warn("Pillow غير متوفر، تُركت أيقونة الإشعارات الافتراضية: %s" % e)
        return
    src = os.path.join(IMAGES, "logo-mark.png")
    if not os.path.exists(src):
        warn("شعار سِراج غير موجود لأيقونة الإشعارات")
        return
    im = Image.open(src).convert("RGBA")
    a = im.split()[3]
    # إن كان الشعار معتماً بالكامل (لا شفافية) نستخرج القناع من سطوع الألوان الفاتحة
    if a.getextrema()[0] > 200:
        a = im.convert("L").point(lambda v: 255 if v > 90 else 0)
    box = a.getbbox() or (0, 0, im.width, im.height)
    a = a.crop(box)
    side = max(a.size)
    sq = Image.new("L", (side, side), 0)
    sq.paste(a, ((side - a.width) // 2, (side - a.height) // 2))
    for d, px in {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}.items():
        folder = os.path.join(RES, "drawable-" + d)
        os.makedirs(folder, exist_ok=True)
        inner = int(px * 0.86)
        m = sq.resize((inner, inner), Image.LANCZOS)
        out = Image.new("RGBA", (px, px), (255, 255, 255, 0))
        white = Image.new("RGBA", (inner, inner), (255, 255, 255, 255))
        out.paste(white, ((px - inner) // 2, (px - inner) // 2), m)
        out.save(os.path.join(folder, "ic_stat_siraj.png"))
    print("أيقونة الإشعارات: تم")


def adhan_sound():
    """صوت الأذان داخل إشعار النظام: يُنسخ من android-resources/adhan.(mp3|ogg|wav) إن وضعتَه أنت (ملف مرخّص)؛ لا يحوي المشروع تسجيلاً."""
    if "android.permission.POST_NOTIFICATIONS" not in PERMS:
        return
    src_dir = os.path.join(ROOT, "android-resources")
    for ext in ("mp3", "ogg", "wav"):
        p = os.path.join(src_dir, "adhan." + ext)
        if os.path.exists(p):
            raw = os.path.join(RES, "raw")
            os.makedirs(raw, exist_ok=True)
            import shutil
            shutil.copyfile(p, os.path.join(raw, "adhan." + ext))
            print("صوت الأذان: نُسخ", os.path.basename(p), "→ res/raw")
            return
    print("صوت الأذان: لا ملف في android-resources — يُستعمل صوت إشعارات الهاتف")


def splash():
    try:
        from PIL import Image
    except Exception as e:  # noqa: BLE001
        warn("Pillow غير متوفر، تُركت شاشة البداية الافتراضية: %s" % e)
        return
    logo_p = os.path.join(IMAGES, "logo-mark.png")
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
    for fn in (patch_manifest, icons, status_icon, adhan_sound, splash):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            warn("%s: %s" % (fn.__name__, e))
