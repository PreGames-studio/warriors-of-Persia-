class_name InventoryUI
extends PanelContainer
## پنجره کیف آیتم‌ها و کریستال‌های همراه (Inventory)
## نمایش ۱۶ اسلات آیتم (قابل مصرف یا تجهیز با کلیک) و فهرست کریستال‌های جمع‌آوری‌شده تیم.

@onready var crystals_summary_label: Label = $Margin/VBox/CrystalsSummaryLabel
@onready var slots_grid: GridContainer = $Margin/VBox/SlotsGrid
@onready var close_btn: Button = $Margin/VBox/TopRow/CloseBtn


func _ready() -> void:
	visible = false
	close_btn.pressed.connect(func() -> void: visible = false)
	if EventBus != null:
		EventBus.inventory_changed.connect(_on_inventory_changed)
		EventBus.crystals_changed.connect(_on_crystals_changed)
		EventBus.inventory_requested.connect(_on_inventory_requested)
	refresh_ui()


func _on_inventory_requested(open_state: bool) -> void:
	visible = open_state
	if visible:
		refresh_ui()


func _on_inventory_changed(_items: Array) -> void:
	if visible:
		refresh_ui()


func _on_crystals_changed(_crystals: Array) -> void:
	if visible:
		refresh_ui()


func refresh_ui() -> void:
	if GameManager == null or GameManager.loot_system == null:
		return

	var loot: LootSystem = GameManager.loot_system
	var total_val: int = 0
	for c: Dictionary in loot.collected_crystals:
		total_val += int(c.get("coin_value", 0))

	crystals_summary_label.text = "کریستال‌های همراه تیم: %d عدد (ارزش فروش در روستا: %d سکه)" % [
		loot.collected_crystals.size(),
		total_val
	]

	for child: Node in slots_grid.get_children():
		child.queue_free()

	for i: int in range(loot.max_inventory_slots):
		var slot_btn: Button = Button.new()
		slot_btn.custom_minimum_size = Vector2(96.0, 56.0)
		slot_btn.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		slot_btn.add_theme_font_size_override("font_size", 11)

		if i < loot.inventory_items.size():
			var item: Item = loot.inventory_items[i]
			slot_btn.text = item.title
			slot_btn.tooltip_text = "%s\n(کلیک برای استفاده)" % item.description
			slot_btn.modulate = item.tint_color.lightened(0.25)
			var idx: int = i
			slot_btn.pressed.connect(func() -> void:
				loot.use_or_equip_item(idx)
				refresh_ui()
			)
		else:
			slot_btn.text = "خانه خالی %d" % (i + 1)
			slot_btn.disabled = true
			slot_btn.modulate = Color(0.65, 0.70, 0.80, 0.75)

		slots_grid.add_child(slot_btn)
