#!/usr/bin/env bash
# End-to-end check on an Android emulator: install the built APK, boot the game in
# the new WebView shell, download the HD graphics pack through the game itself and
# confirm the pack is active after a relaunch.
#
#   bash Tools/emulator_smoke.sh apk/WarriorsOfPersia_1.0.14.apk
#
# Exits non-zero with a tagged marker (MISSING-UI, NO-WEBGL, PACK-ERROR, …) so CI
# can report what failed even when the raw log is not readable.
set -uo pipefail

APK="${1:?usage: emulator_smoke.sh <apk>}"
# Accept a directory too: the CI artifact download layout has moved before and
# an empty APK path used to fail with a bare "usage" line instead of a reason.
if [ -d "$APK" ]; then
  APK="$(find "$APK" -name 'WarriorsOfPersia_*.apk' -print -quit)"
  [ -n "$APK" ] || { echo "APK-MISSING: no APK under $1"; exit 2; }
fi
[ -f "$APK" ] || { echo "APK-MISSING: $APK is not a file"; exit 2; }
echo "[smoke] using $APK"
PACKAGE="com.pregames.warriorsofpersia"
OUT="${RUNNER_TEMP:-/tmp}"
mkdir -p "$OUT"

log() { echo "[smoke] $*"; }
# logcat shows the JSON strings returned by evaluateJavascript with escaped quotes.
normalize() { sed 's/\\"/"/g' "$1" > "$1.norm" 2>/dev/null || cp "$1" "$1.norm"; }
fail() { echo "$1"; exit "${2:-1}"; }

adb wait-for-device

log "installing $APK"
adb install -r "$APK" >"$OUT/install.txt" 2>&1 || { cat "$OUT/install.txt"; fail INSTALL-FAILED 2; }
grep -q "Success" "$OUT/install.txt" || { cat "$OUT/install.txt"; fail INSTALL-FAILED 2; }

adb shell pm list packages | grep -q "$PACKAGE" || fail PACKAGE-MISSING 3
adb shell dumpsys package "$PACKAGE" | grep -E "versionCode|versionName" | head -3

adb logcat -c
log "launching the game"
adb shell am start -n "$PACKAGE/.MainActivity" >/dev/null || fail LAUNCH-FAILED 4
sleep 60

adb logcat -d -s WoP:V >"$OUT/boot.txt" 2>&1 || true
normalize "$OUT/boot.txt"
log "---- boot log ----"
cat "$OUT/boot.txt.norm"

adb shell run-as "$PACKAGE" ls -la files >"$OUT/files.txt" 2>&1 || true
cat "$OUT/files.txt"
adb shell dumpsys activity activities | grep -i "$PACKAGE" | head -3 || true

grep -q '"ui":true' "$OUT/boot.txt.norm" || fail MISSING-UI 5
grep -q '"gl":true' "$OUT/boot.txt.norm" || fail NO-WEBGL 6
grep -q 'Uncaught' "$OUT/boot.txt.norm" && fail JS-ERROR 7
grep -q 'installed[^,]*false' "$OUT/boot.txt.norm" || log "warning: pack already reported installed"

# The four skill buttons and the cast self-test: the probe reports how many
# icons actually decoded and whether casting moved the hero's cast pivot.
grep -q 'spells[^,]*true' "$OUT/boot.txt.norm" || fail SPELLS-MISSING 13
icons="$(grep -o 'spellIcons[^,]*' "$OUT/boot.txt.norm" | tail -1)"
log "spell icons: $icons"
grep -q 'spellIcons[^,]*4' "$OUT/boot.txt.norm" || fail SPELL-ICONS 14
grep -q 'moved[^,}]*true' "$OUT/boot.txt.norm" || fail SPELL-NO-MOTION 15
grep -q 'settled[^,}]*true' "$OUT/boot.txt.norm" || fail SPELL-POSE-STUCK 16
adb shell screencap -p /sdcard/spells.png && adb pull /sdcard/spells.png "$OUT/spells.png" >/dev/null 2>&1 || true

log "---- downloading the HD pack through the shell ----"
# The autostart extra is read in onCreate, so the running activity must be
# stopped first: am start on a live task delivers onNewIntent instead.
adb shell am force-stop "$PACKAGE"
sleep 3
adb logcat -c
adb shell am start -n "$PACKAGE/.MainActivity" --es wop_pack_autostart hd >/dev/null || fail LAUNCH-FAILED 8
done_state=""
for i in $(seq 1 90); do
  sleep 10
  adb logcat -d -s WoP:V >"$OUT/pack.txt" 2>&1 || true
  if grep -q '"state":"done"' "$OUT/pack.txt"; then done_state=1; break; fi
  if grep -q '"state":"error"' "$OUT/pack.txt"; then
    tail -30 "$OUT/pack.txt"
    fail PACK-ERROR 9
  fi
  log "waiting for the pack ($i/90)"
done
tail -20 "$OUT/pack.txt"
[ -n "$done_state" ] || fail PACK-TIMEOUT 10
adb shell run-as "$PACKAGE" ls -la files >"$OUT/files-after.txt" 2>&1 || true
adb shell run-as "$PACKAGE" ls -la files/pack >"$OUT/pack-files.txt" 2>&1 || true
head -25 "$OUT/files-after.txt" "$OUT/pack-files.txt"

log "---- relaunching with the pack installed ----"
adb shell am force-stop "$PACKAGE"
adb logcat -c
adb shell am start -n "$PACKAGE/.MainActivity" >/dev/null || fail LAUNCH-FAILED 11
sleep 60
adb logcat -d -s WoP:V >"$OUT/installed.txt" 2>&1 || true
normalize "$OUT/installed.txt"
tail -20 "$OUT/installed.txt.norm"
# The status JSON is nested inside the probe string, so quotes arrive escaped at
# more than one level: match the key/value pair without insisting on quoting.
grep -q 'installed[^,]*true' "$OUT/installed.txt.norm" || fail PACK-NOT-ACTIVE 12
grep -q 'tier[^,]*hd' "$OUT/installed.txt.norm" || log "warning: tier not reported as hd"
adb shell screencap -p /sdcard/pack.png && adb pull /sdcard/pack.png "$OUT/pack.png" >/dev/null 2>&1 || true

echo "SMOKE OK"
