#!/usr/bin/env bash
# يشغّل كل اختبارات سِراج وتطبيق التحكم ويطبع ملخصاً. الاستعمال: bash tests/run_all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in catalog_flow content_flow daily_flow encyclopedia_flow features_flow native_flow native_ux_flow pwa_flow quran_flow reader_flow templates_flow thaqalayn_flow control_flow control_entries_flow control_native_flow packs_flow; do
  out="$(timeout 600 python3 tests/$t.py --regen 2>&1)"; code=$?
  p=$(printf '%s\n' "$out" | grep -c '^PASS'); f=$(printf '%s\n' "$out" | grep -c '^FAIL')
  if [ $code -ne 0 ]; then fail=1; echo "✗ $t  (PASS=$p FAIL=$f exit=$code)"; printf '%s\n' "$out" | grep -v '^PASS' | tail -6; else echo "✓ $t  (PASS=$p)"; fi
done
out="$(python3 tests/routes.py 2>&1)"; echo "$out" | tail -1; echo "$out" | grep -q 'مشاكل: 0' || fail=1
exit $fail
