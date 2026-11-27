#!/usr/bin/env bash
# يعيد توقيع APK الخاص بالتصحيح بمفتاح ثابت (android-signing/siraj-personal.keystore)
# حتى تتطابق التواقيع بين البناءات ويقبل أندرويد التحديث فوق النسخة المثبّتة.
set -euo pipefail
IN="${1:?usage: sign-apk.sh in.apk out.apk}"
OUT="${2:?usage: sign-apk.sh in.apk out.apk}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || { echo "ANDROID_HOME غير معرّف"; exit 1; }
BT="$(ls -1 "$SDK/build-tools" | sort -V | tail -1)"
echo "build-tools: $BT"
TMP="$(mktemp -d)"
"$SDK/build-tools/$BT/zipalign" -f -p 4 "$IN" "$TMP/aligned.apk"
# مفتاح الإصدار: إن وُجد السران SIRAJ_KS_B64 (الملف بترميز base64) وSIRAJ_KS_PASS في GitHub Secrets يُستعمل،
# وإلا يبقى المفتاح الشخصي القديم حتى تتطابق التواقيع مع النسخ المثبّتة.
if [ -n "${SIRAJ_KS_B64:-}" ] && [ -n "${SIRAJ_KS_PASS:-}" ]; then
  echo "$SIRAJ_KS_B64" | base64 -d > "$TMP/release.keystore"
  KS="$TMP/release.keystore"; ALIAS="siraj-release"; PASS="$SIRAJ_KS_PASS"; echo "التوقيع بمفتاح الإصدار (Secrets)"
else
  KS="$ROOT/android-signing/siraj-personal.keystore"; ALIAS="siraj"; PASS="siraj-personal-test"; echo "التوقيع بالمفتاح الشخصي القديم"
fi
"$SDK/build-tools/$BT/apksigner" sign \
  --ks "$KS" --ks-type PKCS12 \
  --ks-key-alias "$ALIAS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT" "$TMP/aligned.apk"
"$SDK/build-tools/$BT/apksigner" verify --verbose --print-certs "$OUT"
ls -l "$OUT"
