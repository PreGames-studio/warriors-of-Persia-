# Warriors of Persia — Unity mobile prototype

پروژه از این مرحله به بعد با **Unity 2022.3 LTS** توسعه داده می‌شود و طراحی آن فقط موبایل‌محور است. پوشه‌ی `MD/قانون ۱.md` قانون رسمی طراحی موبایل را نگه می‌دارد. فایل‌ها و صحنه‌های Godot فعلاً به‌عنوان نسخه‌ی قدیمی برای مرجع حفظ شده‌اند؛ پروژه‌ی فعال Unity در همین ریشه‌ی مخزن قرار دارد.

## صحنه‌ی فعلی

با Unity Hub همین پوشه‌ی پروژه را باز کنید. صحنه‌ی شروع `Assets/Scenes/OpenField.unity` است و محیط در زمان اجرا ساخته می‌شود:

- دشت سه‌بعدی سرسبز کنار دروازه‌ی روستا، مسیرهای قابل‌گسترش برای مناطق آینده، چمن‌های کم‌هزینه و بوته‌های برخوردپذیر.
- قهرمان شمشیرزن سه‌بعدی پارسی با مدل اولیه، حرکت، دویدن، دوربین سوم‌شخص و کمبو شمشیر.
- دو هدف تمرینی برای آزمایش آسیب شمشیر.
- کنترل‌های لمسی: جوی‌استیک مجازی سمت چپ، دکمه‌ی دویدن و حمله سمت راست، و کشیدن انگشت برای چرخاندن دوربین.
- جهت افقی و محدوده‌ی امن صفحه برای موبایل تنظیم شده‌اند. مدل‌سازی چمن و بوته‌ها با GPU instancing برای کارایی بهتر انجام می‌شود.

## اجرا و خروجی Android

1. Unity **2022.3.62f1** را با ماژول **Android Build Support**، Android SDK & NDK و OpenJDK نصب کنید.
2. پروژه را در Unity Hub از همین پوشه باز کنید و صحنه‌ی `Assets/Scenes/OpenField.unity` را اجرا کنید.
3. برای APK، از **File → Build Settings → Android → Switch Platform** استفاده کنید؛ صحنه‌ی OpenField باید در فهرست Build Scenes فعال باشد.
4. در **Player Settings** شناسه‌ی برنامه و تنظیمات امضا را بررسی کنید؛ جهت صفحه روی Landscape و معماری هدف روی ARM64 تنظیم شده است.
5. **Build** یا برای ساخت و نصب مستقیم **Build And Run** را انتخاب کنید.

## ساختار Unity

```text
Assets/
├── Editor/MobileProjectSettings.cs     # پیش‌فرض‌های موبایل و Landscape
├── Scenes/OpenField.unity              # صحنه‌ی شروع Unity
├── Scripts/
│   ├── UnityOpenFieldGame.cs           # ساخت دشت، دروازه، چمن، بوته‌ها و HUD لمسی
│   ├── SwordsmanController.cs          # حرکت، دویدن، دوربین و مبارزه‌ی شمشیر
│   ├── TrainingDummy.cs                # هدف تمرینی
│   ├── FoliageBatch.cs                 # رندر دسته‌ای پوشش گیاهی برای موبایل
│   └── Mobile*.cs                      # جوی‌استیک، دکمه‌ها، چرخش دوربین و Safe Area
└── Resources/Fonts/Vazirmatn-Regular.ttf

ProjectSettings/                       # نسخه‌ی Unity و صحنه‌ی شروع
Packages/manifest.json                  # وابستگی UGUI
MD/قانون ۱.md                           # قانون طراحی فقط برای موبایل
```

فایل‌های قدیمی Godot مانند `project.godot` و `scenes/` بیرون از پوشه‌ی `Assets/` باقی مانده‌اند و وارد بیلد Unity نمی‌شوند.
