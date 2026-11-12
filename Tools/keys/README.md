# کلید امضای نسخه اندروید (APK signing key)

فایل `wop-release.p12` کلید امضای ثابت نسخهٔ اندروید این بازی است.

| فیلد | مقدار |
|---|---|
| فایل | `Tools/keys/wop-release.p12` |
| نوع | PKCS#12 |
| Alias | `wop-release` |
| رمز keystore و key | `wop-release-2026` |
| الگوریتم | RSA 2048-bit، SHA256withRSA |
| Subject | `CN=Warriors of Persia, O=PreGames Studio, C=US` |
| اعتبار | تا ۲۰۵۹ |

## چرا این فایل در ریپو است؟

اندروید اجازهٔ نصب نسخهٔ جدید روی نسخهٔ نصب‌شده را **فقط** وقتی می‌دهد که هر دو با یک کلید
امضا شده باشند. در نسخه‌های قبلی کلید در هر انتشار عوض می‌شد و همین موضوع باعث می‌شد نصب
نسخهٔ بعدی با خطای «برنامه نصب نشد» یا «بستهٔ نامعتبر» متوقف شود. با نگه‌داشتن همین کلید،
نسخه‌های بعدی به‌صورت آپدیت روی نسخهٔ فعلی نصب می‌شوند.

این کلید برای یک پروژهٔ خصوصی/دمو است و کلید منتشرشده در Google Play محسوب نمی‌شود.
اگر روزی بازی در Google Play منتشر شود، باید کلید تولید (production key) جداگانه با
Play App Signing ساخته و از همان استفاده شود.

## ساخت مجدد APK

```bash
python3 Tools/build_installable_apk.py \
  --source-apk WarriorsOfPersia_3D.apk \
  --keystore Tools/keys/wop-release.p12 --storepass wop-release-2026 \
  --version-code 2 --version-name 1.0.1 \
  --output WarriorsOfPersia_3D.apk

python3 Tools/verify_apk.py WarriorsOfPersia_3D.apk \
  --json artifacts/quality/apk-install-audit-v1.0.1.json
```

اسکریپت‌ها به `cryptography` و `asn1crypto` نیاز دارند (`pip install cryptography asn1crypto`).
خروجی ساخت **بازتولیدپذیر** است: با همان کلید و همان ورودی، بایت‌به‌بایت همان فایل ساخته می‌شود.
