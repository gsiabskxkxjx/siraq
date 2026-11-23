# معمارية سِراج (النسخة 0.1.0-demo)

## 1) الفكرة
تطبيق ويب تقدّمي (PWA) بلا خادم: **HTML5 + CSS3 + JavaScript (ES6)** كلاسيكي دون أطر ولا أدوات بناء، يعمل بفتح `index.html` عبر خادم ساكن. كل شيء محفوظ على جهاز المستخدم (IndexedDB + LocalStorage). لا مفاتيح API ولا واجهة خلفية.

```
index.html
├─ assets/data/*.js|json   بيانات مضمّنة (أقسام، فهارس، فهرس الأدعية بلا نصوص، معاملات القرآن) ← تُولَّد بـ tools/build_data.py
├─ assets/js/ui.js         نواة: قوالب آمنة S.h/S.esc، أيقونات، نوافذ، نماذج، توست، إعدادات
├─ assets/js/storage.js    IndexedDB + kv + مفضلة/تقدم/إحصاءات/إشعارات/سجل عمليات/ملفات
├─ assets/js/navigation.js موجّه hash: S.router.add(pattern, handler)
├─ library, reader, quran, quran-audio, duas, prayer, calendar, tasbeeh, home, settings
├─ admin, ailibrary, encyclopedia, assistant, worship, daily
├─ assets/js/app.js        الإقلاع، البذر، تسجيل Service Worker
├─ manifest.json, service-worker.js, offline.html
└─ tools/*.py              توليد بيانات/أيقونات/قائمة التخزين المسبق (لا تدخل وقت التشغيل)
```

## 2) قواعد البرمجة
- ملفات `<script>` عادية (IIFE) تتشارك الكائن `window.SIRAJ` (يُختصر `S`). لا وحدات ES (لتعمل أبسط الخوادم).
- **الموجّه**: `#/path?query`. أول مسار مُسجَّل مطابق يفوز، فتُسجَّل المسارات الخاصة قبل `/x/:param`. المعالج يعيد `{title, html, nav, back, actions, mount(), unmount()}`.
- **القوالب**: `S.h` يهرّب كل قيمة تلقائياً؛ `S.raw` لما هو موثوق فقط. لا `innerHTML` بنصوص المستخدم.
- **الأحداث**: تفويض مركزي عبر `data-act` (نقر) و`data-chg` (تغيير) و`data-inp` (إدخال) ← `S.act/S.onChange/S.onInput`. لا أزرار بلا معالج: يفحص `tests/routes.py` الأخطاء، وتفحص الاختبارات التفاعلية السلوك.
- **الأمان**: لا `eval`، لا نصوص خارجية مُنفَّذة؛ الروابط الخارجية `rel="noopener noreferrer"`؛ رفع الملفات يتحقق من النوع والحجم والتوقيع (`%PDF-`).

## 3) التخزين (IndexedDB: `siraj`)
| المخزن | المحتوى |
|---|---|
| books, authors, publishers, sources | المكتبة والبيانات المرجعية |
| files | ملفات PDF والأغلفة والتسجيلات (Blob) |
| quran, audio | نص القرآن/الترجمات والتلاوات المنزَّلة |
| duas, audiolib | الأدعية (نص+مصدر) والمكتبة الصوتية |
| entries | محرّك الموسوعات (13 مجموعة) |
| favorites, bookmarks, progress, notes, highlights | بيانات القراءة |
| tasbeeh, prayerlog, qada, stats | العبادات والإحصاءات اليومية (`read:YYYY-MM-DD`، `wird:…`، `must:…`) |
| users, notifications, audit | الإدارة المحلية |
| kv | إعدادات وقوائم صغيرة (ورد، تنبيهات، استفتاءات، سجل المساعد…) |

الإعدادات في LocalStorage (`siraj.settings.v1`) كي يُطبَّق المظهر قبل الرسم الأول.

## 4) قواعد النشر والمحتوى (تُفرَض في الشيفرة)
1. **لا كتاب يُنشر آلياً.** كل المقترحات (يدوية، JSON، AI LIBRARY) تدخل `pending`. القرار النهائي للمالك افتراضياً (`settings.owner.requireOwnerApproval`).
2. المراجع **يوصي فقط** (`reviewerRec`). المحرر الذي لا يملك صلاحية النشر تتحول تعديلاته إلى `pending`.
3. **لا ملف PDF يُنشر** إلا بحالة حقوق موثقة (ملك عام، Creative Commons، إذن ناشر/مؤلف، عمل المالك). التنزيل يتبع الحالة نفسها.
4. **لا نص ديني بلا مصدر**: الدعاء يلزمه الكتاب + الصفحة/الجزء/الرابط، والمدخل الموسوعي مصدر واحد على الأقل، وحكم العالم يُنسب لقائله ومصدره.
5. **القرآن لا يُولَّد**: يُجلب من Tanzil عبر AlQuran.cloud ويُتحقق من عدد الآيات قبل الحفظ (6236).
6. **المساعد لا يفتي**: استرجاع محلي من المدخلات الموثقة مع إحالات؛ سؤال الفتوى يُحال لمرجع التقليد؛ عند قلة المعلومات يعترف بذلك. مزوّد خارجي اختياري، معطّل افتراضياً، وإجابته موسومة «غير موثقة».
7. **SIRAJ AI LIBRARY** تكتشف وتحلّل وتقترح فقط: لا تنزّل ملفات، ولا تستنتج ترخيصاً من وجود PDF.

## 5) PWA
- `manifest.json`: RTL، عربي، standalone، أيقونات any/maskable، 4 اختصارات.
- `service-worker.js`: تخزين مسبق للقشرة (قائمة تُولَّد بـ `python3 tools/build_sw.py` مع بصمة نسخة)، cache-first لملفات الموقع، stale-while-revalidate للخطوط، لا يعترض طلبات Range ولا مزوّدي البيانات الخارجيين. صفحة `offline.html` احتياطية.
- **لا يعمل SW على `file://`** (قيد المتصفح). يعمل على `https://` أو `http://localhost`.
- التنبيهات (مواقيت، أذان، ورد) **تعمل والتطبيق مفتوح**؛ الدفع من خادم (Web Push) غير مربوط.

## 6) نحو Supabase (انظر `docs/schema.sql`)
| محلي | Supabase |
|---|---|
| `books/authors/sources/files` | جداول `books/authors/sources/book_files` + Storage خاص |
| `kv settings.owner.requireOwnerApproval` | `app_settings` + زناد `enforce_publish_rules` |
| `users` + PIN محلي | `auth.users` + `profiles(role, grants)` + `has_cap()` |
| `entries` (+مصادر) | `entries` + `entry_sources` + `scholar_rulings` (زناد يمنع المدخل بلا مصدر) |
| `audit` | `audit_log` (غير قابل للتعديل) |
| `favorites/progress/notes/stats/qada…` | جداول بسياسات «صاحبها فقط» ← تتيح مزامنة التقدم |
خطوات الانتقال المقترحة: (1) استبدال `S.db` بطبقة واجهة موحّدة تدعم المصدرين، (2) رفع البيانات من `S.backup` إلى الجداول، (3) نقل استدعاء المزوّد الذكي إلى Edge Function، (4) إضافة Web Push.

## 7) التحويل إلى Flutter (لاحقاً — لم يبدأ)
- نموذج البيانات (JSON أعلاه) يتحول مباشرة إلى كائنات Dart؛ `drift/sqflite` بدل IndexedDB.
- القارئ: `pdfx`/`syncfusion_flutter_pdfviewer`؛ المواقيت: نقل `prayer.js` (خوارزمية فلكية بحتة) كما هي إلى Dart.
- الموجّه: `go_router` بنفس هيكل المسارات الحالية (أسماء `/library/book/:id` … محفوظة).
- الاختبارات التفاعلية في `tests/` تصلح مرجعاً لسلوك كل شاشة.
