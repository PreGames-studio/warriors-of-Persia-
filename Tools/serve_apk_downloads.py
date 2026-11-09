#!/usr/bin/env python3
"""Serve the built APKs over HTTP so they can be downloaded directly.

GitHub's raw file host is blocked or mangled on some networks, which makes the
browser save an HTML error page under a `.apk` name -- Android then reports
"package appears to be invalid".  Serving the bytes ourselves, with the correct
MIME type and an exact Content-Length, removes that failure mode.

Usage:
    python3 Tools/serve_apk_downloads.py --port 8000 --dir artifacts/apk
"""
from __future__ import annotations

import argparse
import hashlib
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

APK_MIME = "application/vnd.android.package-archive"

PAGE = """<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>دانلود جنگجویان پارس ۳بعدی</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; padding:24px 18px 60px; font-family: Vazirmatn, Tahoma, system-ui, sans-serif;
         background:#0b1220; color:#e8eefc; line-height:1.9; }}
  .wrap {{ max-width: 780px; margin: 0 auto; }}
  h1 {{ font-size: 1.45rem; margin: 0 0 4px; }}
  .muted {{ color:#93a4c4; font-size:.92rem; }}
  .card {{ background:#131c30; border:1px solid #23304d; border-radius:16px; padding:18px; margin:18px 0; }}
  .card h2 {{ margin:0 0 6px; font-size:1.05rem; }}
  a.btn {{ display:block; text-align:center; text-decoration:none; font-weight:700;
           background:#2f7dff; color:#fff; padding:14px 18px; border-radius:12px; margin-top:14px; }}
  a.btn.alt {{ background:#1f2a44; color:#cfe0ff; border:1px solid #33507f; }}
  code {{ background:#0a1526; padding:2px 6px; border-radius:6px; font-size:.82rem;
          direction:ltr; display:inline-block; word-break:break-all; }}
  ol {{ padding-inline-start: 20px; margin: 8px 0 0; }}
  table {{ width:100%; border-collapse: collapse; font-size:.9rem; margin-top:8px; }}
  td {{ padding:6px 4px; border-bottom:1px solid #1e2b45; }}
  td:first-child {{ color:#93a4c4; white-space:nowrap; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>جنگجویان پارس ۳بعدی — نسخهٔ نصب‌شدنی</h1>
  <p class="muted">فایل‌ها با نوع <code>{mime}</code> و طول دقیق سرو می‌شوند؛ به‌جای APK صفحهٔ HTML یا فایل ناقص نمی‌آید.</p>
  {cards}
  <div class="card">
    <h2>راهنمای نصب</h2>
    <ol>
      <li>اگر نسخهٔ قدیمی بازی نصب است، اول حذفش کنید.</li>
      <li>فایل را دانلود و نصب کنید و اجازهٔ «نصب از منبع ناشناس» را بدهید.</li>
      <li>اگر باز هم خطای «بستهٔ نامعتبر» آمد، <b>نسخهٔ جایگزین</b> را نصب کنید: با شناسهٔ مستقل
          ساخته شده و کنار هر نسخهٔ قبلی نصب می‌شود.</li>
      <li>برای اطمینان از سالم‌بودن دانلود، SHA-256 فایل را با مقدار نوشته‌شده مقایسه کنید.</li>
    </ol>
  </div>
</div>
</body>
</html>
"""

CARD = """  <div class="card">
    <h2>{title}</h2>
    <p class="muted">{desc}</p>
    <table>
      <tr><td>فایل</td><td><code>{name}</code></td></tr>
      <tr><td>حجم</td><td>{size:,} بایت</td></tr>
      <tr><td>SHA-256</td><td><code>{sha}</code></td></tr>
      <tr><td>شناسهٔ بسته</td><td><code>{package}</code></td></tr>
      <tr><td>نسخه</td><td><code>{version}</code></td></tr>
    </table>
    <a class="btn{class}" href="/{name}">دانلود {name}</a>
  </div>"""


class Handler(BaseHTTPRequestHandler):
    directory: Path = Path(".")
    apks: list[dict] = []

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def _send(self, status: int, body: bytes, content_type: str, extra=None, head=False):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_HEAD(self):
        self.handle_request(head=True)

    def do_GET(self):
        self.handle_request(head=False)

    def handle_request(self, head: bool):
        route = unquote(urlparse(self.path).path)
        if route in ("/", "/index.html"):
            cards = []
            for i, apk in enumerate(self.apks):
                cards.append(
                    CARD.format(
                        title="نسخهٔ اصلی (آپدیت روی نسخهٔ قبلی)" if i == 0
                        else "نسخهٔ جایگزین (نصب کاملاً تازه)",
                        desc="همان بستهٔ همیشگی بازی؛ اگر نسخهٔ قبلی نصب نیست، همین را نصب کنید."
                        if i == 0 else
                        "با شناسهٔ بستهٔ مستقل؛ حتی اگر نسخهٔ قدیمی نصب باشد نصب می‌شود.",
                        name=apk["name"], size=apk["size"], sha=apk["sha256"],
                        package=apk.get("package", "-"), version=apk.get("version", "-"),
                        **{"class": "" if i == 0 else " alt"},
                    )
                )
            page = PAGE.format(mime=APK_MIME, cards="\n".join(cards))
            self._send(200, page.encode("utf-8"), "text/html; charset=utf-8", head=head)
            return

        name = route.lstrip("/")
        if "/" in name or name.startswith("."):
            self._send(404, b"not found", "text/plain; charset=utf-8", head=head)
            return
        target = self.directory / name
        if not target.is_file():
            self._send(404, b"not found", "text/plain; charset=utf-8", head=head)
            return
        body = target.read_bytes()
        self._send(
            200,
            body,
            APK_MIME,
            {"Content-Disposition": f'attachment; filename="{target.name}"'},
            head=head,
        )


def describe(directory: Path, name: str, meta: dict) -> dict:
    data = (directory / name).read_bytes()
    info = meta.get(name, {})
    return {
        "name": name,
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "package": info.get("package", "-"),
        "version": info.get("version", "-"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--dir", type=Path, default=Path("artifacts/apk"))
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    meta_file = args.dir / "meta.json"
    meta = json.loads(meta_file.read_text()) if meta_file.is_file() else {}
    names = [n for n in ("WarriorsOfPersia_3D.apk", "WarriorsOfPersia_3D_hd.apk")
             if (args.dir / n).is_file()]
    if not names:
        raise SystemExit(f"no APKs in {args.dir}")

    Handler.directory = args.dir
    Handler.apks = [describe(args.dir, n, meta) for n in names]
    print(json.dumps(Handler.apks, ensure_ascii=False, indent=2), flush=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"serving {len(names)} APK(s) on http://{args.host}:{args.port}/", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
