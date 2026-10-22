# اسکلت پایه بازی اکشن-ماجرایی کوآپ (Godot 4.3+)

پروژه اسکلت معماری بازی **اکشن-ماجرایی کوآپ Top-Down (۱ تا ۵ نفره)** با سبک بصری **چیبی/کارتونی درخشان (الهام‌گرفته از Mobile Legends: Bang Bang)** ساخته‌شده با **Godot 4.3+ (GDScript)** و رندر **Compatibility** مناسب موبایل و دسکتاپ.

---

## اجرای سریع پروژه در Godot 4.3+

1. نرم‌افزار **Godot Engine 4.3** (یا جدیدتر) را باز کنید.
2. روی **Import** کلیک کرده و فایل `project.godot` را انتخاب کنید.
3. کلید **F5** را بزنید تا صحنه اصلی (`res://scenes/main/Main.tscn`) اجرا شود.

---

## کلیدهای کنترلی (تست دسکتاپ و موبایل)

| عملکرد | دسکتاپ (کیبورد / ماوس) | موبایل / لمسی |
|---|---|---|
| حرکت قهرمان | `W / A / S / D` یا کلیدهای جهت‌نما | جوی‌استیک مجازی پایین-چپ |
| حمله پایه | `Space` | دکمه بزرگ **حمله پایه** پایین-راست |
| مهارت‌های ۱ تا ۴ | کلیدهای `1` تا `4` | ۴ دکمه مهارت درخشان پایین-راست |
| باز/بستن کیف آیتم‌ها | `B` یا `Tab` | دکمه **کیف آیتم (B)** بالای صفحه |
| باز/بستن فروشگاه روستا | `V` (یا نزدیک شدن به غرفه در روستا) | دکمه **فروشگاه (V)** بالای صفحه |
| جابجایی بین نقشه‌ها | عبور از پورتال‌های نورانی داخل نقشه | نوار دکمه‌های سریع بالای صفحه |
| تست تیم ۱ تا ۵ نفره و قطع اتصال | پنل **تیم کوآپ (PartyHUD)** سمت چپ | دکمه‌های `+ افزودن هم‌تیمی`، `نقش` و `قطع/وصل` |

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
