#!/usr/bin/env python3
"""Bundle current preview sources (not a stale standalone) into a signed offline APK.
Requires npm install --no-save esbuild and Python cryptography/asn1crypto.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from apk_signing import Entry, sign_apk
from build_installable_apk import collect_entries, load_key

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version-code', type=int, required=True)
    parser.add_argument('--version-name', required=True)
    parser.add_argument('--storepass', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    preview = ROOT / 'unity_preview'
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
    entries = [e for e in collect_entries(ROOT / 'WarriorsOfPersia_3D.apk', args.version_code, args.version_name) if not e.name.startswith('assets/')]
    entries.append(Entry('assets/index.html', html.encode()))
    paths = list((preview / 'assets').rglob('*')) + list((preview / 'fonts').rglob('*'))
    paths += [preview / name for name in ('potion-shop.css', 'village-theme.css', 'merchant-shop.css', 'manifest.json', 'icon.png')]
    for path in sorted(paths):
        if path.is_file():
            entries.append(Entry('assets/' + path.relative_to(preview).as_posix(), path.read_bytes()))
    key, cert, extra = load_key(ROOT / 'Tools/keys/wop-release.p12', args.storepass)
    apk, report = sign_apk(entries, key, cert, extra_certificates=extra)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(apk)
    report.update(version=args.version_name, bytes=len(apk), sha256=hashlib.sha256(apk).hexdigest(), sourceHashes={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [preview / 'index.html', *preview.glob('*.js'), *preview.glob('*.css')]})
    args.output.with_suffix('.build.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('version', 'bytes', 'sha256')}, indent=2))


if __name__ == '__main__':
    main()
