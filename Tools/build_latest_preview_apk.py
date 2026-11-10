#!/usr/bin/env python3
"""Bundle current preview sources (not a stale standalone) into a signed offline APK.
Requires npm install --no-save esbuild and Python cryptography/asn1crypto/Pillow/numpy.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from apk_signing import Entry, sign_apk
from build_installable_apk import collect_entries, load_key
from android_launcher import launcher_entries

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version-code', type=int, required=True)
    parser.add_argument('--version-name', required=True)
    parser.add_argument('--storepass', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--android-jar', type=Path, default=ROOT / '.cache/android/android.jar')
    parser.add_argument('--original-merchant-images', action='store_true', help='Package original portrait/product PNG bytes instead of the approved dimension-preserving WebP policy')
    args = parser.parse_args()
    preview = ROOT / 'unity_preview'
    optimized = {}
    if not args.original_merchant_images:
        from optimize_merchant_images import optimize_assets
        optimized = optimize_assets(preview, ROOT / 'build/optimized-images')
    html = (preview / 'index.html').read_text()
    match = re.search(r'<script type="module">(.*?)</script>', html, re.S)
    if not match:
        raise RuntimeError('Preview module script missing')
    script = match.group(1).replace("if ('serviceWorker' in navigator)", "if (location.protocol !== 'file:' && 'serviceWorker' in navigator)")
    bundle = subprocess.run(
        [str(ROOT / 'node_modules/.bin/esbuild'), '--bundle', '--format=iife', '--target=chrome80', '--loader=js', '--minify'],
        input=script, text=True, cwd=preview, check=True, capture_output=True,
    ).stdout
    # No ES module fetches under file:// Android WebView; all code is inline.
    html = html[:match.start()] + '<script>' + bundle.replace('</script', '<\\/script') + '</script>' + html[match.end():]
    entries = [e for e in collect_entries(ROOT / 'WarriorsOfPersia_3D.apk', None, None) if not e.name.startswith('assets/')]
    entries = [e for e in entries if e.name not in ('AndroidManifest.xml', 'resources.arsc') and not e.name.startswith('res/')]
    entries.extend(launcher_entries(preview / 'icon.png', args.android_jar, ROOT / 'node_modules/aaptjs3/bin/x64/linux/aapt2', args.version_code, args.version_name))
    entries.append(Entry('assets/index.html', html.encode()))
    paths = list((preview / 'assets').rglob('*')) + list((preview / 'fonts').rglob('*'))
    paths += [preview / name for name in ('potion-shop.css', 'village-theme.css', 'merchant-shop.css', 'manifest.json', 'icon.png')]
    for path in sorted(paths):
        if path.is_file():
            relative = path.relative_to(preview).as_posix()
            payload = optimized[relative][0] if relative in optimized else path.read_bytes()
            entries.append(Entry('assets/' + relative, payload))
    key, cert, extra = load_key(ROOT / 'Tools/keys/wop-release.p12', args.storepass)
    apk, report = sign_apk(entries, key, cert, extra_certificates=extra)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(apk)
    report.update(launcherIconSha256=hashlib.sha256((preview/'icon.png').read_bytes()).hexdigest(), version=args.version_name, bytes=len(apk), sha256=hashlib.sha256(apk).hexdigest(), sourceHashes={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [preview / 'index.html', *preview.glob('*.js'), *preview.glob('*.css')]})
    report['merchantImageOptimization'] = {name: details for name, (_, details) in optimized.items()}
    args.output.with_suffix('.build.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('version', 'bytes', 'sha256')}, indent=2))


if __name__ == '__main__':
    main()
