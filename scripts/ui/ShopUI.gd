class_name ShopUI
extends PanelContainer
## پنجره فروشگاه روستا (Shop)
## امکانات:
## ۱) فروش کریستال‌های جمع‌آوری‌شده و تبدیل مستقیم به سکه طلا
## ۲) خرید آیتم و معجون برای قهرمان
## ۳) جبران سطح ازدست‌رفته ناشی از مرگ با پرداخت سکه

@onready var status_label: Label = $Margin/VBox/StatusLabel
@onready var coins_label: Label = $Margin/VBox/TopRow/CoinsLabel
@onready var sell_all_btn: Button = $Margin/VBox/CrystalBox/SellAllBtn
@onready var recover_level_btn: Button = $Margin/VBox/RecoverLevelBtn
@onready var travel_village_btn: Button = $Margin/VBox/TravelVillageBtn
@onready var items_list_vbox: VBoxContainer = $Margin/VBox/ItemsVBox
@onready var close_btn: Button = $Margin/VBox/TopRow/CloseBtn

var _catalog: Array[Item] = []


func _ready() -> void:
	visible = false
	_catalog = Item.get_default_shop_catalog()

	close_btn.pressed.connect(func() -> void: visible = false)
	sell_all_btn.pressed.connect(_on_sell_all_pressed)
	recover_level_btn.pressed.connect(_on_recover_level_pressed)
	travel_village_btn.pressed.connect(func() -> void:
		if EventBus != null:
			EventBus.zone_change_requested.emit("village", 1)
	)

	if EventBus != null:
		EventBus.shop_requested.connect(_on_shop_requested)
		EventBus.coins_changed.connect(_on_coins_or_zone_changed_int)
		EventBus.crystals_changed.connect(_on_crystals_changed_arr)
		EventBus.zone_changed.connect(_on_zone_changed_refresh)

	refresh_ui()


func _on_coins_or_zone_changed_int(_val: int) -> void:
	if visible:
		refresh_ui()


func _on_crystals_changed_arr(_arr: Array) -> void:
	if visible:
		refresh_ui()


func _on_zone_changed_refresh(_id: String, _title: String, _safe: bool) -> void:
	if visible:
		refresh_ui()


func _on_shop_requested(open_state: bool) -> void:
	visible = open_state
	if visible:
		refresh_ui()


func _on_sell_all_pressed() -> void:
	if GameManager == null or not GameManager.is_in_safe_zone():
		return
	GameManager.progression_system.sell_all_crystals(GameManager.loot_system)
	refresh_ui()


func _on_recover_level_pressed() -> void:
	if GameManager == null or not GameManager.is_in_safe_zone():
		return
	var hero: Hero = GameManager.match_manager.get_local_hero()
	if hero != null:
		GameManager.progression_system.recover_lost_level_with_coins(hero)
	refresh_ui()


func refresh_ui() -> void:
	if GameManager == null or GameManager.progression_system == null or GameManager.loot_system == null:
		return

	var prog: ProgressionSystem = GameManager.progression_system
	var loot: LootSystem = GameManager.loot_system
	var in_village: bool = GameManager.is_in_safe_zone()

	coins_label.text = "سکه: %d" % prog.coins
	travel_village_btn.visible = not in_village

	var crystal_count: int = loot.collected_crystals.size()
	var total_crystal_coins: int = 0
	for c: Dictionary in loot.collected_crystals:
		total_crystal_coins += int(c.get("coin_value", 0))

	if in_village:
		status_label.text = "خوش آمدید به فروشگاه روستای امن! کریستال‌های شکار را به سکه تبدیل کنید."
		status_label.modulate = Color(0.55, 1.0, 0.72)
	else:
		status_label.text = "توجه: معامله در فروشگاه فقط داخل «روستای امن» فعال است!"
		status_label.modulate = Color(1.0, 0.78, 0.35)

	sell_all_btn.text = "فروش همه کریستال‌ها (%d عدد -> +%d سکه)" % [crystal_count, total_crystal_coins]
	sell_all_btn.disabled = (not in_village) or (crystal_count == 0)

	var leader: Hero = GameManager.match_manager.get_local_hero() if GameManager.match_manager != null else null
	var rec_cost: int = prog.get_recovery_cost(leader)
	recover_level_btn.text = "جبران جریمه مرگ (%d سطح قابل بازیابی | هزینه: %d سکه)" % [
		prog.lost_levels_recoverable,
		rec_cost
	]
	recover_level_btn.disabled = (not in_village) or (prog.lost_levels_recoverable <= 0) or (prog.coins < rec_cost)

	for child: Node in items_list_vbox.get_children():
		child.queue_free()

	for item: Item in _catalog:
		var row: HBoxContainer = HBoxContainer.new()
		var info_lbl: Label = Label.new()
		info_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_lbl.add_theme_font_size_override("font_size", 12)
		info_lbl.text = "%s — %s" % [item.title, item.description]
		row.add_child(info_lbl)

		var buy_btn: Button = Button.new()
		buy_btn.text = "خرید (%d سکه)" % item.price_coins
		buy_btn.add_theme_font_size_override("font_size", 12)
		buy_btn.disabled = (not in_village) or (prog.coins < item.price_coins)
		var captured_item: Item = item
		buy_btn.pressed.connect(func() -> void:
			if prog.spend_coins(captured_item.price_coins):
				loot.add_item(captured_item)
				if EventBus != null:
					EventBus.notification_requested.emit(
						"خریداری شد و به کیف اضافه گردید: %s" % captured_item.title,
						Color(1.0, 0.88, 0.32)
					)
				refresh_ui()
		)
		row.add_child(buy_btn)
		items_list_vbox.add_child(row)
