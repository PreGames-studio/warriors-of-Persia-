#!/usr/bin/env python3
"""Compile the Java WebView shell into classes.dex and a launcher APK.

The game itself is a web app, but the pack download needs a real launcher: an
internet permission, a private https origin that can serve both APK assets and
downloaded files, and a small Java download manager. This tool builds exactly
that with the Android SDK's own tools (javac + d8 + aapt2); nothing is written
by hand, and the launcher icon bytes are taken from the shipping APK so the
launcher icon never changes.

    python Tools/build_android_launcher.py \
        --sdk $ANDROID_HOME --platform android-34 --build-tools 34.0.0 \
        --icon artifacts/releases/icon.png --version-code 14 --version-name 1.0.14 \
        --out-dir build/launcher
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "android/launcher/src"

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  package="com.pregames.warriorsofpersia"
  android:versionCode="{version_code}"
  android:versionName="{version_name}"
  android:installLocation="auto">
  <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="28"/>
  <!-- Only used for the optional 4K/8K graphics pack download. -->
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <application android:label="Warriors of Persia 3D"
    android:hardwareAccelerated="true"
    android:largeHeap="true"
    android:usesCleartextTraffic="false"
    android:icon="@drawable/app_icon">
    <activity android:name="com.pregames.warriorsofpersia.MainActivity"
      android:label="Warriors of Persia 3D"
      android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
      android:screenOrientation="landscape"
      android:configChanges="keyboardHidden|orientation|screenSize|screenLayout|uiMode"
      android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
"""


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess:
    result = subprocess.run(command, capture_output=True, text=True, **kwargs)
    if result.returncode != 0:
        raise SystemExit(f"command failed: {' '.join(command)}\n{result.stdout}\n{result.stderr}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, required=True)
    parser.add_argument("--platform", default="android-34")
    parser.add_argument("--build-tools", default="34.0.0")
    parser.add_argument("--icon", type=Path, required=True)
    parser.add_argument("--version-code", type=int, required=True)
    parser.add_argument("--version-name", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    android_jar = args.sdk / "platforms" / args.platform / "android.jar"
    tools = args.sdk / "build-tools" / args.build_tools
    d8, aapt2 = tools / "d8", tools / "aapt2"
    for required in (android_jar, d8, aapt2):
        if not required.exists():
            raise SystemExit(f"missing Android SDK component: {required}")

    out = args.out_dir
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    sources = sorted(str(path) for path in SOURCE.rglob("*.java"))
    if not sources:
        raise SystemExit(f"no Java sources under {SOURCE}")

    classes = out / "classes"
    classes.mkdir()
    run(["javac", "-source", "8", "-target", "8", "-bootclasspath", str(android_jar),
         "-classpath", str(android_jar), "-encoding", "UTF-8", "-d", str(classes), *sources])

    dex_dir = out / "dex"
    dex_dir.mkdir()
    class_files = sorted(str(path) for path in classes.rglob("*.class"))
    run([str(d8), "--release", "--min-api", "21", "--lib", str(android_jar),
         "--output", str(dex_dir), *class_files])
    dex = dex_dir / "classes.dex"
    if not dex.is_file():
        raise SystemExit("d8 produced no classes.dex")

    # aapt2 links the manifest with the framework resources and the launcher icon.
    with tempfile.TemporaryDirectory(prefix="wop-launcher-") as tmp:
        root = Path(tmp)
        res = root / "res/drawable-nodpi"
        res.mkdir(parents=True)
        (res / "app_icon.png").write_bytes(args.icon.read_bytes())
        manifest = root / "AndroidManifest.xml"
        manifest.write_text(MANIFEST.format(version_code=args.version_code,
                                            version_name=args.version_name), encoding="utf-8")
        compiled = root / "resources.zip"
        run([str(aapt2), "compile", "--no-crunch", "--dir", str(root / "res"), "-o", str(compiled)])
        launcher = out / "launcher.apk"
        run([str(aapt2), "link", "-I", str(android_jar), "--manifest", str(manifest),
             "-o", str(launcher), str(compiled)])
        with zipfile.ZipFile(launcher) as archive:
            names = archive.namelist()
            for required in ("AndroidManifest.xml", "resources.arsc"):
                if required not in names:
                    raise SystemExit(f"launcher apk missing {required}")
            packed_icon = archive.read("res/drawable-nodpi-v4/app_icon.png")
            if packed_icon != args.icon.read_bytes():
                raise SystemExit("aapt2 altered the launcher icon bytes")

    shutil.copyfile(dex, out / "classes.dex")
    report = {
        "dex": str(out / "classes.dex"),
        "dexBytes": (out / "classes.dex").stat().st_size,
        "dexSha256": hashlib.sha256((out / "classes.dex").read_bytes()).hexdigest(),
        "launcher": str(out / "launcher.apk"),
        "launcherBytes": (out / "launcher.apk").stat().st_size,
        "versionCode": args.version_code,
        "versionName": args.version_name,
        "sources": len(sources),
        "permissions": ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE"],
    }
    (out / "launcher.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
