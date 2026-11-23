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
"$SDK/build-tools/$BT/apksigner" sign \
  --ks "$ROOT/android-signing/siraj-personal.keystore" --ks-type PKCS12 \
  --ks-key-alias siraj --ks-pass pass:siraj-personal-test --key-pass pass:siraj-personal-test \
  --out "$OUT" "$TMP/aligned.apk"
"$SDK/build-tools/$BT/apksigner" verify --verbose --print-certs "$OUT"
ls -l "$OUT"
