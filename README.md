# بازی سه‌بعدی جنگجویان پارس (Warriors of Persia 3D — Unity & Android APK)

> ⭐ **راهنمای سبک طراحی و علایق کارفرما:** جزئیات کامل نحوه طراحی مورد پسند (فروشگاه آهنگری سینمایی قرون‌وسطایی، رندرهای 8K/PBR آیتم‌ها، کوچه‌گردی سه‌بعدی در روستا و سیستم سیو دائمی) در فایل [**`DESIGN_PREFERENCES.md`**](./DESIGN_PREFERENCES.md) ذخیره شده است.

## 📥 دانلود مستقیم و نصب نسخه ۱.۰.۱ (رفع خطای «بسته نامعتبر»)

| مشخصه | مقدار |
|---|---|
| فایل | `WarriorsOfPersia_3D.apk` |
| حجم | ۲۰,۳۳۴,۸۱۵ بایت (≈ ۱۹.۴ مگابایت) |
| SHA-256 | `627ff32de1e5edb0197ee311a57b902f80bbd52deea983de85a889e268653163` |
| package | `com.pregames.warriorsofpersia` |
| versionName / versionCode | `1.0.1` / `2` |
| minSdk / targetSdk | `21` / `28` |
| امضا | JAR v1 + APK Signature Scheme v2 (RSA 2048 / SHA-256) |
| بیلد محتوا | `mia-9495b9487f` (همان بیلد Mia-only روز روشن) |

**لینک دانلود مستقیم (فایل باینری APK):**

- نسخهٔ همین انتشار:
  `https://github.com/PreGames-studio/warriors-of-Persia-/releases/download/v1.0.1-install-fix/WarriorsOfPersia_3D.apk`
- همیشه آخرین نسخهٔ منتشرشده:
  `https://github.com/PreGames-studio/warriors-of-Persia-/releases/latest/download/WarriorsOfPersia_3D.apk`

نکته: از لینک‌های بالا استفاده کنید، نه از صفحهٔ نمایش فایل در GitHub؛ باز کردن فایل از صفحهٔ
`blob` یک صفحهٔ HTML دانلود می‌کند و همان فایل هنگام نصب «بستهٔ نامعتبر» می‌دهد.

### چه چیزی در نسخهٔ ۱.۰.۱ درست شد؟

1. **بسته‌بندی از نو (ZIP استاندارد اندروید):** `resources.arsc` و آیکون به‌صورت *store* و
   هم‌تراز با مرز ۴ بایت ذخیره می‌شوند (آفست قبلی `759` بود که با `%4 = 3` هم‌تراز نبود) و
   فیلد اضافی نامعتبر `0xFFFF` از هدر حذف شد.
2. **امضای بازتولیدپذیر و ممیزی‌شده:** v1 و v2 با اسکریپت‌های `Tools/apk_signing.py` ساخته
   می‌شوند؛ خروجی با `keytool` (جاوا) و ابزار مستقل `Tools/verify_apk.py` تأیید شده است.
3. **کلید امضای ثابت:** کلید در `Tools/keys/wop-release.p12` نگه‌داری می‌شود، بنابراین
   نسخه‌های بعدی مثل یک آپدیت روی نسخهٔ فعلی نصب می‌شوند (قبلاً کلید در هر انتشار عوض می‌شد).
4. **حجم ۱۹ مگابایت به‌جای ۲۰۸ مگابایت:** دانلود ناقص/قطع‌شدهٔ فایل بزرگ، شایع‌ترین دلیل
   خطای «There was a problem parsing the package» روی گوشی است؛ نسخهٔ جدید کاملاً آفلاین و
   کوچک است و همهٔ بافت‌ها داخل خود APK قرار دارند.
5. **گزارش ممیزی نصب:** [`artifacts/quality/apk-install-audit-v1.0.1.json`](./artifacts/quality/apk-install-audit-v1.0.1.json)
   شامل بررسی CRC، هم‌ترازی، امضای v1/v2، دیجست SHA-256 محتوا و مانیفست باینری است
   (نتیجه: `verdict: pass`).

### نصب

1. اگر نسخهٔ قدیمی بازی روی گوشی نصب است، **یک بار حذفش کنید** (نسخه‌های قبلی با کلید دیگری
   امضا شده‌اند و اندروید اجازهٔ آپدیت با کلید متفاوت نمی‌دهد).
2. فایل `WarriorsOfPersia_3D.apk` را نصب کنید؛ اگر پیام «نصب برنامه‌های ناشناس» آمد، اجازه بدهید.
3. برای اطمینان از سالم‌بودن دانلود، SHA-256 فایل را با مقدار جدول بالا مقایسه کنید.

ساخت مجدد خروجی (بازتولیدپذیر):

```bash
python3 Tools/build_installable_apk.py --source-apk WarriorsOfPersia_3D.apk \
  --keystore Tools/keys/wop-release.p12 --storepass wop-release-2026 \
  --version-code 2 --version-name 1.0.1 --output WarriorsOfPersia_3D.apk
python3 Tools/verify_apk.py WarriorsOfPersia_3D.apk --json artifacts/quality/apk-install-audit-v1.0.1.json
```

---

پروژه بازی **اکشن-ماجرایی کوآپ Top-Down (۱ تا ۵ نفره)** شامل اسکریپت‌های سه‌بعدی **Unity (C#)** در پوشه `unity_3d/`، نسخه وب و موبایل سه‌بعدی در `unity_preview/` و فایل نصبی اندروید **`WarriorsOfPersia_3D.apk`** است.

---

## نصب و اجرا روی موبایل

1. فایل `project.godot` را در **Godot Engine 4.3** یا جدیدتر باز کنید.
2. ابزارهای خروجی موبایل و **Export Templates** متناسب با نسخه Godot را نصب کنید.
3. از بخش **Project > Export** خروجی Android یا iOS بسازید و آن را روی دستگاه نصب کنید.
4. صحنه اصلی بازی `res://scenes/main/Main.tscn` است و همه کنترل‌ها روی صفحه نمایش داده می‌شوند.

---

## کنترل‌های لمسی

| عملکرد | کنترل موبایل |
|---|---|
| حرکت قهرمان | جوی‌استیک مجازی پایین-چپ |
| حمله پایه | دکمه بزرگ **حمله پایه** پایین-راست |
| مهارت‌های ۱ تا ۴ | ۴ دکمه مهارت درخشان پایین-راست |
| باز/بستن کیف آیتم‌ها | دکمه **کیف آیتم** بالای صفحه |
| باز/بستن فروشگاه روستا | دکمه **فروشگاه** بالای صفحه یا نزدیک شدن به غرفه در روستا |
| جابجایی بین نقشه‌ها | نوار دکمه‌های سریع بالای صفحه یا پورتال‌های نورانی |
| مدیریت تیم ۱ تا ۵ نفره | دکمه‌های `+ افزودن هم‌تیمی`، `نقش` و `قطع/وصل` در پنل تیم |

---

## ساختار پوشه‌ها

```text
res://
├── project.godot
├── autoload/
│   ├── EventBus.gd               # باس رویداد سراسری بین سیستم‌ها و UI
│   └── GameManager.gd            # سینگلتون Autoload اصلی بازی
├── scenes/
│   ├── main/Main.tscn            # صحنه ریشه بازی
│   ├── world/
│   │   ├── Village.tscn          # روستای امن + فروشگاه + چشمه شفا
│   │   ├── OpenWorld.tscn        # دشت، رودخانه، پل چوبی، کوهستان و ورودی دانجن‌ها
│   │   └── Dungeon.tscn          # سیاه‌چال هیولاها + باس اصلی
│   ├── units/
│   │   ├── Hero.tscn             # صحنه قهرمان با انیمیشن ۵ حالته
│   │   ├── Enemy.tscn            # صحنه دشمن معمولی/الیت
│   │   └── Boss.tscn             # صحنه باس دانجن
│   ├── items/
│   │   ├── Crystal.tscn          # کریستال قابل جمع‌آوری
│   │   └── Projectile.tscn       # پرتابه انرژی
│   └── ui/
│       ├── HUD.tscn              # نوار سبز MP، آبی MANA، زرد XP، مینی‌مپ، جوی‌استیک و اسکیل‌ها
│       ├── PartyHUD.tscn         # وضعیت ۱ تا ۵ عضو تیم
│       ├── Inventory.tscn        # کیف آیتم‌ها و کریستال‌ها
│       └── Shop.tscn             # فروشگاه روستا (فروش کریستال -> سکه + بازیابی لول)
├── scripts/
│   ├── managers/ (GameManager.gd, PartyManager.gd, MatchManager.gd, WorldManager.gd, MainController.gd)
│   ├── units/    (UnitBase.gd, Hero.gd, Enemy.gd, Boss.gd)
│   ├── systems/  (CombatSystem.gd, LootSystem.gd, ProgressionSystem.gd, SpawnSystem.gd)
│   ├── items/    (Crystal.gd, Item.gd, Projectile.gd)
│   ├── world/    (PortalZone.gd, ShopZone.gd)
│   └── ui/       (HUD.gd, PartyHUD.gd, InventoryUI.gd, ShopUI.gd, VirtualJoystick.gd, MinimapWidget.gd)
└── assets/
    ├── sprites/                  # اسپرایت‌های Placeholder چیبی/کارتونی با Outline
    ├── animations/               # کتابخانه انیمیشن مشترک (idle, walk, attack, cast, die)
    ├── audio/                    # افکت‌های صوتی سبک Placeholder
    └── fonts/                    # فونت فارسی Vazirmatn
```
