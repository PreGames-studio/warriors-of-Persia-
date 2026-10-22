class_name Item
extends Resource
## کلاس داده آیتم (Item Resource)
## ساختار پایه آیتم‌های قابل خرید از فروشگاه روستا و قابل نگهداری در Inventory قهرمان.

enum ItemType {
	CONSUMABLE_HP,     # معجون بازیابی خون (نوار سبز MP)
	CONSUMABLE_MANA,   # معجون بازیابی مانا (نوار آبی MANA)
	WEAPON,            # سلاح افزایش قدرت حمله
	ACCESSORY          # لوازم جانبی افزایش مانا و سرعت
}

@export var id: String = "potion_hp"
@export var title: String = "معجون خون"
@export var description: String = "بازیابی فوری بخشی از سلامتی قهرمان"
@export var item_type: ItemType = ItemType.CONSUMABLE_HP
@export var price_coins: int = 25
@export var power_value: float = 45.0
@export var tint_color: Color = Color(0.2, 0.9, 0.45, 1.0)


## سازنده کمکی برای ساخت سریع آیتم با مقادیر مشخص در کد
static func create(
	p_id: String,
	p_title: String,
	p_desc: String,
	p_type: ItemType,
	p_price: int,
	p_power: float,
	p_color: Color
) -> Item:
	var item: Item = Item.new()
	item.id = p_id
	item.title = p_title
	item.description = p_desc
	item.item_type = p_type
	item.price_coins = p_price
	item.power_value = p_power
	item.tint_color = p_color
	return item


## کاتالوگ پیش‌فرض آیتم‌های فروشگاه روستا (در مرحله اسکلت)
static func get_default_shop_catalog() -> Array[Item]:
	var catalog: Array[Item] = []
	catalog.append(Item.create(
		"potion_hp",
		"معجون سبز حیات",
		"+۶۰ واحد بازیابی نوار سبز (MP/خون)",
		ItemType.CONSUMABLE_HP,
		20,
		60.0,
		Color(0.18, 0.85, 0.44)
	))
	catalog.append(Item.create(
		"potion_mana",
		"معجون آبی مانا",
		"+۵۰ واحد بازیابی نوار آبی (MANA)",
		ItemType.CONSUMABLE_MANA,
		20,
		50.0,
		Color(0.20, 0.62, 0.96)
	))
	catalog.append(Item.create(
		"sword_radiant",
		"شمشیر درخشان شوالیه",
		"+۸ قدرت حمله دائمی برای قهرمان",
		ItemType.WEAPON,
		55,
		8.0,
		Color(0.98, 0.78, 0.22)
	))
	catalog.append(Item.create(
		"amulet_star",
		"طلسم ستاره‌ای مانا",
		"+۳۰ سقف مانا (MANA) دائمی",
		ItemType.ACCESSORY,
		65,
		30.0,
		Color(0.68, 0.42, 0.98)
	))
	return catalog
