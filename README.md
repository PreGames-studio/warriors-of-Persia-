# بازی موبایل اکشن-ماجرایی کوآپ (Godot 4.3+)

پروژه بازی **اکشن-ماجرایی کوآپ Top-Down (۱ تا ۵ نفره)** با سبک بصری **چیبی/کارتونی درخشان**، ساخته‌شده با **Godot 4.3+ (GDScript)** و رندر **Compatibility** مخصوص موبایل است. این نسخه کاملاً لمسی و افقی است.

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
