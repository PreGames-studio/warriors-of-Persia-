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
# Software-GL emulators sometimes need well over a minute to build the village,
# and the WebView probe only answers once the main thread is free.
booted=""
for attempt in $(seq 1 10); do
  sleep 12
  adb logcat -d -s WoP:V >"$OUT/boot.txt" 2>&1 || true
  normalize "$OUT/boot.txt"
  if grep -q '"ui":true' "$OUT/boot.txt.norm"; then booted=1; break; fi
  log "waiting for the game to boot ($attempt/10)"
done

log "---- boot log ----"
tail -40 "$OUT/boot.txt.norm"

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

# Inventory: sword/shield/armour cells must exist and cost zero bag cells.
grep -q 'bag[^,]*true' "$OUT/boot.txt.norm" || fail BAG-MISSING 17
grep -q 'bagUnchanged[^,}]*true' "$OUT/boot.txt.norm" || fail BAG-CELL-CONSUMED 18
grep -q 'weaponSet[^,}]*true' "$OUT/boot.txt.norm" || fail BAG-NO-WEAPON-SLOT 19
grep -q 'shieldSet[^,}]*true' "$OUT/boot.txt.norm" || fail BAG-NO-SHIELD-SLOT 20
grep -q 'wornCells[^,}]*6' "$OUT/boot.txt.norm" || fail BAG-WORN-CELLS 21
grep -q 'bagCells[^,}]*16' "$OUT/boot.txt.norm" || fail BAG-CELL-COUNT 22
grep -o 'bagTest[^]]*' "$OUT/boot.txt.norm" | tail -1 || true

# The gear on Mia's model must follow the equipment cells.
grep -q 'heroGear[^}]*weapon' "$OUT/boot.txt.norm" || fail GEAR-MODEL-MISSING 28
grep -q 'hammer[^,}]*true' "$OUT/boot.txt.norm" || fail GEAR-NO-HAMMER 29
grep -q 'shieldOn[^,}]*true' "$OUT/boot.txt.norm" || fail GEAR-NO-SHIELD 30
grep -q 'shieldBare[^,}]*true' "$OUT/boot.txt.norm" || fail GEAR-SHIELD-STUCK 31
grep -q 'bowHidesShield[^,}]*true' "$OUT/boot.txt.norm" || fail GEAR-BOW-SHIELD 32
grep -q 'kinds[^,}]*6' "$OUT/boot.txt.norm" || fail GEAR-FAMILIES 33
grep -q 'weaponFamilies[^]]*spear' "$OUT/boot.txt.norm" || fail GEAR-SPEAR 34

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
# The first cold start on a busy emulator can be slow and the log buffer is
# small, so keep looking for the probe instead of trusting a single sample.
active=""
for attempt in $(seq 1 6); do
  sleep 20
  adb logcat -d -s WoP:V >"$OUT/installed.txt" 2>&1 || true
  normalize "$OUT/installed.txt"
  if grep -q 'installed[^,]*true' "$OUT/installed.txt.norm"; then active=1; break; fi
  log "waiting for the pack probe ($attempt/6)"
done
tail -20 "$OUT/installed.txt.norm"
# The status JSON is nested inside the probe string, so quotes arrive escaped at
# more than one level: match the key/value pair without insisting on quoting.
if [ -z "$active" ]; then
  log "---- renderer diagnostics ----"
  adb logcat -d 2>/dev/null | grep -iE "chromium|renderer|died|lowmemory|FATAL" | tail -25 || true
  adb shell dumpsys meminfo "$PACKAGE" 2>/dev/null | head -12 || true
  fail PACK-NOT-ACTIVE 12
fi
grep -q 'tier[^,]*hd' "$OUT/installed.txt.norm" || log "warning: tier not reported as hd"
adb shell screencap -p /sdcard/pack.png && adb pull /sdcard/pack.png "$OUT/pack.png" >/dev/null 2>&1 || true

log "---- screenshotting the equipment / bag screen ----"
adb shell am force-stop "$PACKAGE"
sleep 3
adb logcat -c
adb shell am start -n "$PACKAGE/.MainActivity" --es wop_open_bag keep >/dev/null || fail LAUNCH-FAILED 23
opened=""
for attempt in $(seq 1 12); do
  sleep 8
  adb logcat -d -s WoP:V >"$OUT/bag.txt" 2>&1 || true
  normalize "$OUT/bag.txt"
  if grep -q 'bag-opened[^,]*true' "$OUT/bag.txt.norm"; then opened=1; break; fi
  log "waiting for the bag screen ($attempt/12)"
done
tail -12 "$OUT/bag.txt.norm" 2>/dev/null || true
[ -n "$opened" ] || fail BAG-NOT-OPEN 26
# Give the delayed measurement time to land in the log before judging the size.
visible=""
for attempt in $(seq 1 5); do
  sleep 3
  adb logcat -d -s WoP:V >"$OUT/bag.txt" 2>&1 || true
  normalize "$OUT/bag.txt"
  if grep -Eq '"panel":\{[^}]*"w":[1-9][0-9][0-9]' "$OUT/bag.txt.norm"; then visible=1; break; fi
  log "waiting for the panel measurement ($attempt/5)"
done
grep -o 'bag-rects[^\n]*' "$OUT/bag.txt.norm" | tail -1 || true
# The panel must actually occupy the screen, not collapse to 0x0.
[ -n "$visible" ] || fail BAG-NOT-VISIBLE 27
sleep 3
adb shell screencap -p /sdcard/inventory.png && adb pull /sdcard/inventory.png "$OUT/inventory.png" >/dev/null 2>&1 || fail SCREENSHOT-FAILED 24
[ -s "$OUT/inventory.png" ] || fail SCREENSHOT-EMPTY 25
# A second frame a few seconds later, plus the raw probe log, so a stale or
# re-rendered screen can be told apart from a real one.
sleep 4
adb shell screencap -p /sdcard/inventory2.png && adb pull /sdcard/inventory2.png "$OUT/inventory2.png" >/dev/null 2>&1 || true
cp "$OUT/bag.txt.norm" "$OUT/bag-probe.txt" 2>/dev/null || true

log "---- screenshotting the worn gear on the model ----"
adb shell am force-stop "$PACKAGE"
sleep 3
adb logcat -c
adb shell am start -n "$PACKAGE/.MainActivity" --es wop_gear radiant >/dev/null || fail LAUNCH-FAILED 35
gear=""
for attempt in $(seq 1 12); do
  sleep 8
  adb logcat -d -s WoP:V >"$OUT/gear.txt" 2>&1 || true
  normalize "$OUT/gear.txt"
  if grep -q 'gear-shown[^,]*true' "$OUT/gear.txt.norm"; then gear=1; break; fi
  log "waiting for the gear showcase ($attempt/12)"
done
tail -8 "$OUT/gear.txt.norm" 2>/dev/null || true
[ -n "$gear" ] || fail GEAR-NOT-SHOWN 36

grep -o 'gear-show[^\n]*' "$OUT/gear.txt.norm" | tail -1 || true
grep -q 'closeup[^,}]*true' "$OUT/gear.txt.norm" || fail GEAR-NO-CLOSEUP 39
grep -q 'cameraDistance[^,}]*[0-5]\.[0-9]' "$OUT/gear.txt.norm" || fail GEAR-CAMERA-FAR 40
cp "$OUT/gear.txt.norm" "$OUT/gear-probe.txt" 2>/dev/null || true
sleep 8
adb shell screencap -p /sdcard/gear.png && adb pull /sdcard/gear.png "$OUT/gear.png" >/dev/null 2>&1 || fail SCREENSHOT-FAILED 37
[ -s "$OUT/gear.png" ] || fail SCREENSHOT-EMPTY 38

log "---- walking, the sword in the fist and the shop pictures ----"
adb shell am force-stop "$PACKAGE"
sleep 3
adb logcat -c
# 26 s of real time: ten of them walking, the rest on the automatic run, so the
# screenshots land inside both halves of the test.
adb logcat -G 16M >/dev/null 2>&1 || true
adb shell am start -n "$PACKAGE/.MainActivity" --es wop_walk 26 --es wop_shopart 1 >/dev/null || fail LAUNCH-FAILED 42

# One loop for the whole stage: the first sighting of the walk gives the walking
# screenshot, the first sighting of the automatic run gives the running one, and
# the probe's own JSON ends the loop. The page logs every step, so nothing here
# depends on hitting a narrow window.
walk=""
walkShot=""
runShot=""
for attempt in $(seq 1 40); do
  adb logcat -d -s WoP:V >"$OUT/walk.txt" 2>&1 || true
  normalize "$OUT/walk.txt"
  if [ -z "$walkShot" ] && grep -q 'walk-start' "$OUT/walk.txt.norm"; then
    walkShot=1
    adb shell screencap -p /sdcard/walk.png && adb pull /sdcard/walk.png "$OUT/walk.png" >/dev/null 2>&1 || fail SCREENSHOT-FAILED 43
    [ -s "$OUT/walk.png" ] || fail SCREENSHOT-EMPTY 44
    log "walk screenshot taken ($attempt)"
  fi
  if [ -z "$runShot" ] && grep -q 'auto-run-start' "$OUT/walk.txt.norm"; then
    runShot=1
    adb shell screencap -p /sdcard/walk-run.png && adb pull /sdcard/walk-run.png "$OUT/walk-run.png" >/dev/null 2>&1 || true
    log "auto-run screenshot taken ($attempt)"
  fi
  if grep -q 'walk-probe' "$OUT/walk.txt.norm"; then walk=1; break; fi
  sleep 5
  log "waiting for the walk probe ($attempt/40)"
done
[ -n "$walkShot" ] || fail WALK-NOT-SHOWN 45
if [ -z "$walk" ]; then
  grep -o 'gait [a-z]*[^\n]*' "$OUT/walk.txt.norm" | tail -10 || true
  grep -o 'walk-start[^\n]*' "$OUT/walk.txt.norm" | tail -3 || true
  grep -o 'webview-wait[^\n]*' "$OUT/walk.txt.norm" | tail -3 || true
  fail WALK-NO-PROBE 45
fi
cp "$OUT/walk.txt.norm" "$OUT/walk-probe.txt" 2>/dev/null || true
tail -10 "$OUT/walk.txt.norm" 2>/dev/null || true
[ -n "$walk" ] || fail WALK-NOT-SHOWN 45
grep -o 'walk-probe[^\n]*' "$OUT/walk.txt.norm" | tail -1 || true
grep -q 'clips":\[[^]]*\(Walk_Loop\|Jog_Fwd_Loop\)' "$OUT/walk.txt.norm" || fail WALK-NO-CYCLE 46
walkSpeed="$(grep -o 'speed":[0-9.]*' "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
log "walk: live speed=$walkSpeed"
[ -n "$walkSpeed" ] || fail WALK-NO-PROBE 45
awk -v v="$walkSpeed" 'BEGIN { exit !(v + 0 > 1.0) }' || fail WALK-NO-MOVEMENT 49

# The clip/pose audit is stepped at a fixed 60 Hz inside the page, so these
# numbers do not depend on how slow the software renderer is.
grep -q '"walkClip":"Walk_Loop"' "$OUT/walk.txt.norm" || fail WALK-NO-WALK-CYCLE 52
grep -q '"jogClip":"Jog_Fwd_Loop"' "$OUT/walk.txt.norm" || fail WALK-NO-JOG-CYCLE 53
grep -q '"sprintClip":"Sprint_Loop"' "$OUT/walk.txt.norm" || fail WALK-NO-SPRINT-CYCLE 54

# One pace everywhere plus the automatic run: she has to switch to running on
# her own after ten seconds of walking, with no extra button pressed.
grep -q '"runAfterSeconds":10' "$OUT/walk.txt.norm" || fail WALK-NO-PROBE 45
grep -q 'run' <<<"$(grep -o '"gaitModes":\[[^]]*\]' "$OUT/walk.txt.norm" | tail -1)" || fail AUTORUN-NOT-STARTED 55
autoAfter="$(grep -o '"autoRunAfter":[0-9.]*' "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
runPeak="$(grep -o '"runPeak":[0-9.]*' "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
log "auto-run: started after ${autoAfter}s, peak speed $runPeak"
if [ -z "$autoAfter" ]; then
  grep -o 'gait [a-z]*[^\n]*' "$OUT/walk.txt.norm" | tail -10 || true
  grep -o 'walk-start[^\n]*' "$OUT/walk.txt.norm" | tail -3 || true
  fail AUTORUN-NOT-STARTED 55
fi
# It must be the ten-second rule and nothing else: not instant, not never.
awk -v v="$autoAfter" 'BEGIN { exit !(v + 0 >= 9 && v + 0 <= 13.5) }' || fail AUTORUN-TIMING 56
awk -v v="$runPeak" 'BEGIN { exit !(v + 0 > 4.0) }' || fail AUTORUN-SLOW 57
for gait in walk jog sprint; do
  spread="$(grep -o "\"${gait}Spread\":[0-9.]*" "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
  peak="$(grep -o "\"${gait}Peak\":[0-9.]*" "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
  pop="$(grep -o "\"${gait}Pop\":[0-9.]*" "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
  log "$gait: sword drift=$spread hand peak=$peak blend pop=$pop"
  [ -n "$spread" ] && [ -n "$peak" ] && [ -n "$pop" ] || fail WALK-NO-PROBE 45
  # The sword must stay locked in the fist (the prop is a child of the wrist
  # bone, so any drift means the prop was torn off the hand).
  awk -v v="$spread" 'BEGIN { exit !(v + 0 < 2) }' || fail WALK-SWORD-SPINS 47
  # Settled gait: locally 1.7 deg/frame walking, 8.1 jogging, 7.3 sprinting.
  awk -v v="$peak" 'BEGIN { exit !(v + 0 < 30) }' || fail WALK-HAND-SPINS 48
  # Crossfade between cycles bends the whole arm at once (~38 deg worst case);
  # anything near a full turn means the pose is unrolling.
  awk -v v="$pop" 'BEGIN { exit !(v + 0 < 70) }' || fail WALK-HAND-SPINS 48
done

art=""
for attempt in $(seq 1 8); do
  if grep -q 'shop-art ' "$OUT/walk.txt.norm"; then art=1; break; fi
  sleep 5
  adb logcat -d -s WoP:V >"$OUT/walk.txt" 2>&1 || true
  normalize "$OUT/walk.txt"
  log "waiting for the shop art probe ($attempt/8)"
done
grep -o 'shop-art[^\n]*' "$OUT/walk.txt.norm" | tail -1 || true
[ -n "$art" ] || fail SHOP-ART-PROBE 50
failedArt="$(grep -o 'failed":[0-9]*' "$OUT/walk.txt.norm" | tail -1 | cut -d: -f2)"
log "shop art failures: $failedArt"
[ "$failedArt" = "0" ] || fail SHOP-ART-MISSING 51

echo "SMOKE OK"
