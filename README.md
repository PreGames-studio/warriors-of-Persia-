# بازی سه‌بعدی جنگجویان پارس (Warriors of Persia 3D — Unity & Android APK)

> ⭐ **راهنمای سبک طراحی و علایق کارفرما:** جزئیات کامل نحوه طراحی مورد پسند (فروشگاه آهنگری سینمایی قرون‌وسطایی، رندرهای 8K/PBR آیتم‌ها، کوچه‌گردی سه‌بعدی در روستا و سیستم سیو دائمی) در فایل [**`DESIGN_PREFERENCES.md`**](./DESIGN_PREFERENCES.md) ذخیره شده است.

## ✅ نسخهٔ ۱.۰.۳ — علتِ واقعیِ «بستهٔ نامعتبر» پیدا و برطرف شد

تا نسخهٔ ۱.۰.۲ همهٔ بررسی‌ها (CRC، هم‌ترازی، امضای v1/v2، `keytool`، androguard) سبز بود،
ولی نصب باز هم شکست می‌خورد؛ چون ایراد در **امضا** نبود، در خودِ `resources.arsc` بود.
جدول منابعِ ۵۷۶ بایتی که دستی ساخته شده بود از نظر ساختاری خراب بود و پارسر منابعِ خودِ
اندروید آن را رد می‌کند:

```
aapt2: Entry at index 0 is too small (0)
error: corrupt ResTable_package: chunk is past the end of the document.
```

همین خطا باعث می‌شد PackageManager کل بسته را «نامعتبر» اعلام کند. در نسخهٔ ۱.۰.۳:

1. `Tools/apk_resources.py` یک `ResTable` **معتبر با صفر پکیج** تولید می‌کند
   (هدر `0x0002` + استخر رشتهٔ UTF-8 خالی) — همان چیزی که یک APK بدون منابعِ برنامه دارد.
2. `Tools/build_installable_apk.py` دیگر جدول منابعِ خراب و پوشهٔ `res/` را کپی نمی‌کند.
3. `Tools/verify_apk.py` حالا با **aapt2** (همان پارسرِ اندروید) دروازه‌گذاری می‌کند:
   `dump badging` / `dump resources` / `dump xmltree`. اگر APK خراب باشد، `verdict: fail`.
   قبلاً این دروازه نبود و همین باعث شد سه بیلد معیوب پشت‌سرهم تحویل داده شود.
4. محتوای بازی دست‌نخورده است: `assets/index.html` و `classes.dex` بایت‌به‌بایت با بیلد قبلی
   یکسان‌اند (SHA-256 جداگانه چک شده)؛ فقط پوستهٔ بسته اصلاح شده.

| فایل | شناسهٔ بسته | حجم | SHA-256 |
|---|---|---|---|
| `WarriorsOfPersia_3D.apk` | `com.pregames.warriorsofpersia` | ۲۰,۳۲۲,۴۸۹ بایت | `cd8e34730db6d13c4c5b74683375b35d526dc0489df9186a19021403f92d0fd4` |
| `WarriorsOfPersia_3D_hd.apk` | `com.pregames.warriorsofpersia.hd` | ۲۰,۳۲۲,۴۹۸ بایت | `b411255da984686e570ea7d92a8eb57ffb0510b16f92f5b160c82ffeccd6809a` |

هر دو: `versionName 1.0.3` / `versionCode 3`، `minSdk 21`، `targetSdk 28`، JAR v1 + APK v2.

**لینک دانلود مستقیم (باینری APK، برچسب ثابت `v1.0.3`):**

- `https://github.com/PreGames-studio/warriors-of-Persia-/raw/v1.0.3/WarriorsOfPersia_3D.apk`
- `https://github.com/PreGames-studio/warriors-of-Persia-/raw/v1.0.3/artifacts/apk/WarriorsOfPersia_3D_hd.apk`

نکته: از همین لینک‌های `raw` استفاده کنید، نه صفحهٔ `blob` گیت‌هاب؛ باز کردن فایل از صفحهٔ
نمایش، یک صفحهٔ HTML ذخیره می‌کند و همان «بستهٔ نامعتبر» را می‌دهد.

### بازتولید و ممیزی (بازتولیدپذیر)

```bash
# ابزار دروازه‌گذاری: aapt2 بستهٔ npm (یک‌بار)
npm i aaptjs3            # باینری در node_modules/aaptjs3/bin/x64/linux/aapt2

python3 Tools/build_installable_apk.py --source-apk WarriorsOfPersia_3D.apk \
  --keystore Tools/keys/wop-release.p12 --storepass wop-release-2026 \
  --version-code 3 --version-name 1.0.3 --output WarriorsOfPersia_3D.apk
python3 Tools/verify_apk.py WarriorsOfPersia_3D.apk \
  --json artifacts/quality/apk-install-audit-v1.0.3.json
```

گزارش‌های ممیزی: [`apk-install-audit-v1.0.3.json`](./artifacts/quality/apk-install-audit-v1.0.3.json)
و [`apk-install-audit-v1.0.3-hd.json`](./artifacts/quality/apk-install-audit-v1.0.3-hd.json)
(شامل خروجی خام `aapt2 dump badging/resources/xmltree`).

### نصب

1. اگر نسخهٔ قدیمی نصب است، اول حذفش کنید (بیلدهای قبلی با کلیدی دیگر امضا شده‌اند).
2. `WarriorsOfPersia_3D.apk` را نصب کنید. اگر خطای «بستهٔ نامعتبر» دید، ابتدا SHA-256 را
   با جدول بالا مقایسه کنید؛ نباید هیچ‌کدام از بیلدهای قبلی (۱.۰.۱/۱.۰.۲) این هش را داشته باشد.
3. اگر می‌خواهید نسخهٔ قبلی هم بماند، `WarriorsOfPersia_3D_hd.apk` را نصب کنید
   (شناسهٔ مستقل `...hd`).

اگر دانلود از گیت‌هاب در شبکهٔ شما ناقص/HTML می‌شود، صفحهٔ دانلود محلی:
`python3 Tools/serve_apk_downloads.py --port 8000 --dir artifacts/apk`

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
