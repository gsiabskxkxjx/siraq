-- =====================================================================
-- سِراج SIRAJ — مخطط PostgreSQL / Supabase المستقبلي
-- الحالة: تصميم مرجعي غير موصول بالتطبيق (النسخة الحالية تعمل محلياً بـ IndexedDB).
-- التحقق الذي جرى: تحميل نظيف على PostgreSQL 16 محلي مع بدائل بسيطة لـ auth.users/auth.uid()،
--   واختبار 12 قاعدة (منع النشر لغير المالك، منع التنزيل بلا حقوق، منع نص دعاء/مدخل بلا مصدر، سجل غير قابل للتعديل،
--   عزل بيانات المستخدمين، منع رفع الدور ذاتياً، كشف التكرار العربي). لم يُجرَّب على مشروع Supabase حقيقي.
-- يطابق نموذج البيانات المستعمل في التطبيق (انظر docs/ARCHITECTURE.md للمقابلات).
-- يتطلب Supabase (جدول auth.users ودوال auth.uid()). شغّله على مشروع جديد ثم راجع قسم «ملاحظات أمنية» أسفله.
-- =====================================================================

create extension if not exists pg_trgm;       -- للبحث المتقارب وكشف التكرار
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- 1) الأنواع المعدودة
-- ---------------------------------------------------------------------
create type book_status      as enum ('draft','pending','needs_review','rejected','published','archived');
create type copyright_status as enum ('unknown','public_domain','creative_commons','publisher_permission','author_permission','owner_work','restricted');
create type app_role         as enum ('owner','manager','editor','reviewer','user');
create type entry_status     as enum ('documented','reviewed');
create type dua_kind         as enum ('dua','ziyara','collection','dhikr','munajat');
create type audio_kind       as enum ('recitation','dua','lecture','adhan');

-- ---------------------------------------------------------------------
-- 2) المستخدمون والصلاحيات
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role        app_role not null default 'user',
  marja       text default '',                      -- المرجع الذي يقلّده المستخدم (للنسبة في الأحكام فقط)
  grants      text[] not null default '{}',         -- صلاحيات إضافية فوق الدور
  disabled    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table role_caps (                             -- مطابق لـ sample-data.json: roles
  role app_role not null,
  cap  text not null,
  primary key (role, cap)
);
insert into role_caps (role, cap) values
  ('owner','*'),
  ('manager','books.view'),('manager','books.add'),('manager','books.edit'),('manager','books.review'),('manager','content.edit'),
  ('manager','audio.manage'),('manager','notifications.manage'),('manager','stats.view'),('manager','audit.view'),
  ('editor','books.view'),('editor','books.add'),('editor','books.edit'),('editor','content.edit'),
  ('reviewer','books.view'),('reviewer','books.review'),('reviewer','stats.view');

-- هل يملك المستخدم الحالي الصلاحية؟ (يُستعمل في سياسات RLS)
create or replace function has_cap(cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and not p.disabled
      and ( cap = any(p.grants)
            or exists (select 1 from role_caps rc where rc.role = p.role and (rc.cap = cap or rc.cap = '*')) )
  );
$$;

-- دوال مساعدة تتجاوز RLS (security definer) لتفادي «infinite recursion» عند قراءة profiles داخل سياسة profiles
create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create or replace function my_grants() returns text[]
language sql stable security definer set search_path = public as $$ select grants from profiles where id = auth.uid() $$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner' and not p.disabled);
$$;

-- إعدادات المنصة (منها: اشتراط موافقة المالك)
create table app_settings (
  key   text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into app_settings values ('owner.requireOwnerApproval','true'::jsonb,null,now());

-- ---------------------------------------------------------------------
-- 3) المكتبة: أقسام، مؤلفون، ناشرون، مصادر، كتب
-- ---------------------------------------------------------------------
create table sections (
  id text primary key,                 -- fiqh, sharia, tafsir, ahkam, ayat, fadail
  title text not null,
  sort int not null default 0,
  target_count int not null default 300
);
create table subcategories (
  id bigint generated always as identity primary key,
  section_id text not null references sections(id) on delete cascade,
  title text not null,
  unique (section_id, title)
);

create table authors (
  id text primary key,
  name text not null,
  death_year int,                      -- هجري
  bio text default '',
  created_at timestamptz not null default now()
);
create table publishers (
  id bigint generated always as identity primary key,
  name text not null unique,
  url text default ''
);
create table sources (                 -- مواقع/مستودعات يُستمدّ منها (al-islam.org, lib.eshia.ir, noorlib.ir, shiaonlinelibrary.com, archive.org)
  id text primary key,
  name text not null,
  base_url text not null,
  license_note text default '',
  allowed boolean not null default true
);

create table books (
  id text primary key,
  title text not null,
  author_id text references authors(id),
  author_name text not null,
  section_id text not null references sections(id),
  subcat text default '',
  description text default '',
  tags text[] not null default '{}',
  publisher_id bigint references publishers(id),
  year int,
  edition text default '',
  pages int,
  lang text not null default 'العربية',
  source_id text references sources(id),
  source_url text default '' check (source_url = '' or source_url ~* '^https?://'),
  copyright copyright_status not null default 'unknown',
  digital_url text default '',
  status book_status not null default 'draft',
  proposed_section text references sections(id),   -- اقتراح SIRAJ AI LIBRARY (لا يُطبَّق دون موافقة)
  ai_note text default '',                          -- أدلة الاقتراح (مثل الكلمات المطابقة)
  toc jsonb not null default '[]',                  -- [{title,depth,page}]
  allow_download boolean not null default false,
  review_note text default '',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  is_demo boolean not null default false,           -- بيانات ببليوغرافية تجريبية لم تُراجَع
  added_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- لا ملف منشور ولا تنزيل دون حالة حقوق موثقة
  constraint dl_requires_rights check (not allow_download or copyright in ('public_domain','creative_commons','publisher_permission','author_permission','owner_work'))
);
create index books_section_idx on books(section_id, status);
create index books_title_trgm on books using gin (title gin_trgm_ops);
create index books_author_trgm on books using gin (author_name gin_trgm_ops);

create table book_files (               -- الملف نفسه في Supabase Storage (حاوية خاصة)
  id uuid primary key default gen_random_uuid(),
  book_id text not null references books(id) on delete cascade,
  kind text not null check (kind in ('pdf','cover')),
  storage_path text not null,           -- مثل: books/<book_id>/file.pdf
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (book_id, kind)
);

-- طابور المراجعة وسجل قراراتها
create table book_reviews (
  id bigint generated always as identity primary key,
  book_id text not null references books(id) on delete cascade,
  reviewer uuid references profiles(id),
  decision text not null check (decision in ('recommend_publish','recommend_reject','ask_more','approve','reject','edit_section','edit_data')),
  note text default '',
  created_at timestamptz not null default now()
);

-- تطبيع النص العربي للمقارنة: حذف التشكيل والتطويل، وتوحيد الألف والياء والتاء المربوطة
-- (يتطلب قاعدة بيانات بترميز UTF8 وترتيب ctype يدعم العربية؛ الافتراضي في Supabase en_US.UTF-8 مناسب)
create or replace function norm_ar(t text) returns text
language sql immutable parallel safe as $$
  select lower(trim(regexp_replace(
    translate(regexp_replace(coalesce(t,''), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
              'أإآٱىةؤئ', 'اااايهوي'),
    '[^[:alnum:]]+', ' ', 'g')))
$$;
create index books_title_norm_trgm on books using gin (norm_ar(title) gin_trgm_ops);

-- كشف التكرار: عنوان+مؤلف متقارب بعد التطبيع
create or replace function find_duplicate_books(p_title text, p_author text, p_threshold real default 0.7)
returns table (id text, title text, author_name text, score real)
language sql stable as $$
  select b.id, b.title, b.author_name,
         (similarity(norm_ar(b.title), norm_ar(p_title)) * (case when similarity(norm_ar(b.author_name), norm_ar(p_author)) > 0.4 then 1.0 else 0.6 end))::real as score
  from books b
  where similarity(norm_ar(b.title), norm_ar(p_title)) >= p_threshold
  order by score desc limit 10;
$$;

-- لا نشر إلا بموافقة المالك عندما يكون الإعداد مفعّلاً (سلوك التطبيق الافتراضي)
create or replace function enforce_publish_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare need_owner boolean;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select coalesce((value)::boolean, true) into need_owner from app_settings where key = 'owner.requireOwnerApproval';
    if need_owner and not is_owner() then
      raise exception 'النشر يتطلب موافقة المالك';
    end if;
    if exists (select 1 from book_files f where f.book_id = new.id and f.kind = 'pdf') and new.copyright in ('unknown','restricted') then
      raise exception 'لا يُنشر ملف دون حالة حقوق موثقة تسمح بالنشر';
    end if;
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger books_publish_guard before insert or update on books for each row execute function enforce_publish_rules();

-- ---------------------------------------------------------------------
-- 4) SIRAJ AI LIBRARY: تشغيلات الاكتشاف (لا تحميل ولا نشر تلقائي)
-- ---------------------------------------------------------------------
create table ailib_runs (
  id bigint generated always as identity primary key,
  query text not null,
  source_id text references sources(id),
  started_by uuid references profiles(id),
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create table ailib_proposals (
  id bigint generated always as identity primary key,
  run_id bigint references ailib_runs(id) on delete set null,
  book_id text references books(id) on delete set null,   -- يُنشأ سجل كتاب بحالة pending فقط
  external_id text,                                        -- مثل معرّف archive.org
  external_url text,
  license_hint text default '',                            -- مجرد تلميح: وجود PDF ≠ إذن إعادة النشر
  duplicates jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) القرآن (النص من مصدر موثوق ويُستورد؛ لا يولَّد)
-- ---------------------------------------------------------------------
create table quran_editions (
  id text primary key,                 -- مثل quran-uthmani, ar.asad
  kind text not null check (kind in ('text','translation','tafsir')),
  lang text not null,
  name text not null,
  provider text not null,              -- مثل Tanzil / AlQuran.cloud
  license text not null,               -- مثل CC-BY 3.0
  source_url text not null
);
create table surahs (
  n int primary key check (n between 1 and 114),
  name text not null, english_name text, revelation text, ayah_count int not null
);
create table ayahs (
  edition_id text not null references quran_editions(id),
  surah int not null references surahs(n),
  ayah int not null,
  text text not null,
  juz int, page int,
  primary key (edition_id, surah, ayah)
);
create table reciters (id text primary key, name text not null, base_url text not null, license_note text default '');

-- ---------------------------------------------------------------------
-- 6) الأدعية والزيارات (لا نص دون مصدر وطبعة)
-- ---------------------------------------------------------------------
create table duas (
  id text primary key,
  kind dua_kind not null default 'dua',
  category text not null,
  title text not null,
  common_source text default '',
  note text default '',
  text text default '',
  text_book text default '', text_author text default '', text_edition text default '',
  text_part text default '', text_page text default '', text_url text default '',
  text_status text generated always as (case when text <> '' and text_book <> '' and (text_page <> '' or text_part <> '' or text_url <> '') then 'documented' else 'missing' end) stored,
  is_demo boolean not null default false,
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  constraint dua_text_needs_source check (text = '' or (text_book <> '' and (text_page <> '' or text_part <> '' or text_url <> '')))
);
create table audio_library (
  id uuid primary key default gen_random_uuid(),
  title text not null, kind audio_kind not null, performer text default '',
  license text not null,                       -- لا يُقبل تسجيل بلا بيان ترخيص
  storage_path text not null, size_bytes bigint,
  dua_id text references duas(id),
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7) الموسوعات (محرّك مدخلات عام: روايات، رواة، تفسير، أسباب نزول، أحكام…)
-- ---------------------------------------------------------------------
create table entries (
  id uuid primary key default gen_random_uuid(),
  collection text not null check (collection in ('narrations','narrators','aqeedah_terms','fiqh_terms','tafsir','asbab','events','places','manuscripts','discussions','imam_quotes','imam_sirah','rulings')),
  title text not null,
  text text not null default '',
  verses text[] not null default '{}',          -- "2:255" أو "2:255-257"
  tags text[] not null default '{}',
  isnads jsonb not null default '[]',
  variants jsonb not null default '[]',          -- [{text,source}]
  positions jsonb not null default '[]',         -- [{holder,view,source}]
  extra jsonb not null default '{}',
  status entry_status not null default 'documented',
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  file_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table entry_sources (                    -- كل مدخل يلزمه مصدر واحد على الأقل (يُفرض بالزناد أدناه)
  id bigint generated always as identity primary key,
  entry_id uuid not null references entries(id) on delete cascade,
  book text not null, author text default '', edition text default '',
  volume text default '', page text default '', number text default '', url text default '',
  check (page <> '' or number <> '' or url <> '' or volume <> '')
);
create table scholar_rulings (                   -- حكم عالم ينسب لقائله ومصدره
  id bigint generated always as identity primary key,
  entry_id uuid not null references entries(id) on delete cascade,
  scholar text not null, ruling text not null, source text not null
);
create index entries_col_idx on entries(collection);
create index entries_verses_gin on entries using gin (verses);
create index entries_title_trgm on entries using gin (title gin_trgm_ops);

create or replace function entries_need_source() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from entry_sources s where s.entry_id = new.id) then
    raise exception 'لا يُحفظ مدخل بلا مصدر';
  end if;
  return null;
end $$;
create constraint trigger entries_source_required after insert on entries
  deferrable initially deferred for each row execute function entries_need_source();

-- ---------------------------------------------------------------------
-- 8) بيانات المستخدم (خاصة بصاحبها فقط)
-- ---------------------------------------------------------------------
create table favorites     (user_id uuid references profiles(id) on delete cascade, type text, ref text, created_at timestamptz default now(), primary key (user_id,type,ref));
create table bookmarks     (user_id uuid references profiles(id) on delete cascade, type text, ref text, label text, created_at timestamptz default now(), primary key (user_id,type,ref));
create table reading_progress (user_id uuid references profiles(id) on delete cascade, type text, ref text, pos jsonb not null, updated_at timestamptz default now(), primary key (user_id,type,ref));
create table notes         (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, type text not null, ref text not null, text text not null, created_at timestamptz default now());
create table highlights    (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, type text not null, ref text not null, color text, created_at timestamptz default now());
create table tasbeeh_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, preset text, count int not null check (count >= 0), created_at timestamptz default now());
create table prayer_log    (user_id uuid references profiles(id) on delete cascade, day date, prayer text, done boolean not null, primary key (user_id,day,prayer));
create table qada          (user_id uuid primary key references profiles(id) on delete cascade, prayers jsonb not null, fast jsonb not null, log jsonb not null default '[]', updated_at timestamptz default now());
create table daily_stats   (user_id uuid references profiles(id) on delete cascade, key text, n int not null, updated_at timestamptz default now(), primary key (user_id,key));   -- read:YYYY-MM-DD, wird:YYYY-MM-DD:id, must:…
create table user_prefs    (user_id uuid primary key references profiles(id) on delete cascade, prefs jsonb not null default '{}', kv jsonb not null default '{}');                 -- يطابق localStorage وkv (ورد، تنبيهات…)
create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade, title text not null, body text default '', kind text default 'info', read boolean not null default false, created_at timestamptz default now());

-- ---------------------------------------------------------------------
-- 9) سجل العمليات (لا يُعدَّل ولا يُحذف)
-- ---------------------------------------------------------------------
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references profiles(id),
  actor_name text, actor_role app_role,
  action text not null, target text default '', details text default ''
);
create or replace function audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'سجل العمليات غير قابل للتعديل'; end $$;
create trigger audit_no_update before update or delete on audit_log for each row execute function audit_immutable();

-- =====================================================================
-- سياسات RLS
-- =====================================================================
alter table profiles          enable row level security;
alter table role_caps         enable row level security;
alter table app_settings      enable row level security;
alter table sections          enable row level security;
alter table subcategories     enable row level security;
alter table authors           enable row level security;
alter table publishers        enable row level security;
alter table sources           enable row level security;
alter table books             enable row level security;
alter table book_files        enable row level security;
alter table book_reviews      enable row level security;
alter table ailib_runs        enable row level security;
alter table ailib_proposals   enable row level security;
alter table quran_editions    enable row level security;
alter table surahs            enable row level security;
alter table ayahs             enable row level security;
alter table reciters          enable row level security;
alter table duas              enable row level security;
alter table audio_library     enable row level security;
alter table entries           enable row level security;
alter table entry_sources     enable row level security;
alter table scholar_rulings   enable row level security;
alter table favorites         enable row level security;
alter table bookmarks         enable row level security;
alter table reading_progress  enable row level security;
alter table notes             enable row level security;
alter table highlights        enable row level security;
alter table tasbeeh_sessions  enable row level security;
alter table prayer_log        enable row level security;
alter table qada              enable row level security;
alter table daily_stats       enable row level security;
alter table user_prefs        enable row level security;
alter table notifications     enable row level security;
alter table audit_log         enable row level security;

-- الملفات الشخصية: يقرأ المستخدم ملفه، ومن يملك users.manage يقرأ الجميع. لا يرفع أحد دوره بنفسه.
create policy profiles_self_read   on profiles for select using (id = auth.uid() or has_cap('users.manage'));
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role() and grants = my_grants() and disabled = false);
create policy profiles_admin_write on profiles for all using (is_owner()) with check (is_owner());
create policy role_caps_read       on role_caps for select using (true);
create policy settings_read        on app_settings for select using (true);
create policy settings_owner_write on app_settings for all using (is_owner()) with check (is_owner());

-- بيانات مرجعية: قراءة للجميع، كتابة لمن يملك content.edit
do $$ declare t text; begin
  foreach t in array array['sections','subcategories','authors','publishers','sources','quran_editions','surahs','ayahs','reciters'] loop
    execute format('create policy %I_read on %I for select using (true)', t, t);
    execute format('create policy %I_write on %I for all using (has_cap(%L)) with check (has_cap(%L))', t, t, 'content.edit', 'content.edit');
  end loop;
end $$;

-- الكتب: العامة ترى المنشور فقط؛ العاملون يرون كل شيء؛ الإضافة/التعديل لمن يملك الصلاحية (والزناد يحمي النشر)
create policy books_public_read  on books for select using (status = 'published' or has_cap('books.view'));
create policy books_insert       on books for insert with check (has_cap('books.add'));
create policy books_update       on books for update using (has_cap('books.edit') or has_cap('books.review')) with check (has_cap('books.edit') or has_cap('books.review'));
create policy books_delete       on books for delete using (is_owner());
create policy book_files_read    on book_files for select using (exists (select 1 from books b where b.id = book_id and (b.status = 'published' or has_cap('books.view'))));
create policy book_files_write   on book_files for all using (has_cap('books.edit')) with check (has_cap('books.edit'));
create policy book_reviews_read  on book_reviews for select using (has_cap('books.review') or has_cap('books.view'));
create policy book_reviews_write on book_reviews for insert with check (has_cap('books.review') and reviewer = auth.uid());
create policy ailib_runs_all     on ailib_runs      for all using (has_cap('books.add')) with check (has_cap('books.add'));
create policy ailib_props_all    on ailib_proposals for all using (has_cap('books.add')) with check (has_cap('books.add'));

-- الأدعية والموسوعات: العامة تقرأ ما له مصدر؛ المحررون يكتبون
create policy duas_read          on duas for select using (true);
create policy duas_write         on duas for all using (has_cap('content.edit')) with check (has_cap('content.edit'));
create policy audio_read         on audio_library for select using (true);
create policy audio_write        on audio_library for all using (has_cap('audio.manage')) with check (has_cap('audio.manage'));
create policy entries_read       on entries for select using (true);
create policy entries_write      on entries for all using (has_cap('content.edit')) with check (has_cap('content.edit'));
create policy entry_src_read     on entry_sources for select using (true);
create policy entry_src_write    on entry_sources for all using (has_cap('content.edit')) with check (has_cap('content.edit'));
create policy rulings_read       on scholar_rulings for select using (true);
create policy rulings_write      on scholar_rulings for all using (has_cap('content.edit')) with check (has_cap('content.edit'));

-- بيانات المستخدم: صاحبها فقط
do $$ declare t text; begin
  foreach t in array array['favorites','bookmarks','reading_progress','notes','highlights','tasbeeh_sessions','prayer_log','qada','daily_stats','user_prefs','notifications'] loop
    execute format('create policy %I_own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- سجل العمليات: يقرأ من يملك audit.view، والإدخال عبر دالة خادم فقط (لا إدخال مباشر من العميل)
create policy audit_read on audit_log for select using (has_cap('audit.view'));

-- =====================================================================
-- Storage (نفّذ من لوحة Supabase أو بالـ API)
--   حاوية 'books'  : خاصة (public=false). التنزيل بروابط موقّعة قصيرة العمر، ولا يُنشأ رابط إلا إذا books.status='published' وallow_download=true.
--   حاوية 'covers' : يمكن أن تكون عامة للأغلفة المنشورة فقط.
--   حاوية 'audio'  : خاصة، ببيان ترخيص في audio_library.
-- =====================================================================

-- =====================================================================
-- ملاحظات أمنية (مهمة)
-- 1) رموز PIN المحلية في النسخة الحالية (owner/1111 …) للتجربة فقط وليست أمناً حقيقياً: تُحذف عند الانتقال لهذا المخطط
--    ويُستبدل بها Supabase Auth (بريد/كلمة مرور أو هاتف) مع MFA للمالك.
-- 2) لا تضع مفتاح service_role في أي ملف يصل للمتصفح. العميل يستعمل anon key فقط وتحميه سياسات RLS أعلاه.
-- 3) مزوّد الذكاء الاصطناعي الخارجي يُستدعى من دالة Edge على الخادم (المفتاح سر للخادم)، لا من المتصفح مباشرة.
-- 4) كتابة audit_log تتم داخل دوال security definer أو Edge Functions لضمان أن الفاعل هو المصادَق عليه فعلاً.
-- 5) راجع تراخيص كل كتاب/تسجيل قبل أي نشر؛ القيود هنا تمنع النشر الآلي لكنها لا تُغني عن مراجعة بشرية.
-- 6) اختبر السياسات بسيناريوهات: مستخدم عادي، محرر، مراجع، مدير، مالك، ومحاولة رفع الدور ذاتياً.
-- =====================================================================
