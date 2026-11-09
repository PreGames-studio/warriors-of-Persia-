# Selected application artwork

The user compared two generated designs and selected option 1: a cartoon adult
female elf against a green background. The full-resolution selected original is
`artifacts/app-icon/elf-icon-selected.png`. Identical PNG bytes are used in
`icon.png` (project icon) and `unity_preview/icon.png` (web manifest/favicon).
The web manifest declares the actual image dimensions. No resizing or quality
reduction was performed. Service-worker cache was refreshed for the new icon.

The explicitly requested 1.0.9 APK now includes this selected image as its native
Android application icon. Real launcher resources and manifest are compiled with
`aapt2 compile --no-crunch` and `aapt2 link`, using an Android 28 framework jar.
The packaged launcher PNG and web PNG are byte-identical to the selected original.
Earlier APKs are unchanged. The framework jar is a local build dependency under
`.cache/android/android.jar` (or pass `--android-jar`), not committed to Git.
