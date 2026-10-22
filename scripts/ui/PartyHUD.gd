class_name PartyHUD
extends PanelContainer
## پنل وضعیت تیم ۱ تا ۵ نفره (PartyHUD)
## نمایش زنده خون (سبز)، مانا (آبی)، نقش و وضعیت اتصال هر عضو + ابزار تست لوکال هم‌تیمی و آفلاین شدن.

@onready var header_label: Label = $Margin/VBox/HeaderLabel
@onready var members_vbox: VBoxContainer = $Margin/VBox/MembersVBox
@onready var add_member_btn: Button = $Margin/VBox/ButtonsRow/AddMemberBtn


func _ready() -> void:
	add_member_btn.pressed.connect(_on_add_member_pressed)
	if EventBus != null:
		EventBus.party_updated.connect(_on_party_updated)
	_refresh_party_list()


func _on_add_member_pressed() -> void:
	if GameManager != null and GameManager.party_manager != null:
		GameManager.party_manager.add_test_member()


func _on_party_updated(_players: Array) -> void:
	_refresh_party_list()


func _refresh_party_list() -> void:
	if members_vbox == null or GameManager == null or GameManager.party_manager == null:
		return

	var pm: PartyManager = GameManager.party_manager
	add_member_btn.disabled = pm.players.size() >= PartyManager.MAX_PARTY_SIZE
	header_label.text = "تیم کوآپ: %d آنلاین از %d (بالانس ۵ نفره)" % [
		pm.get_online_count(),
		pm.players.size()
	]

	for child: Node in members_vbox.get_children():
		child.queue_free()

	for entry: Dictionary in pm.players:
		var slot_idx: int = int(entry["slot"])
		var is_online: bool = bool(entry["is_online"])
		var role_name: String = Hero.get_role_title_fa(int(entry["role"]))
		var hero_ref: Hero = entry.get("hero_ref") as Hero
		var lv: int = hero_ref.level if (hero_ref != null and is_instance_valid(hero_ref)) else int(entry["level"])

		var row_box: VBoxContainer = VBoxContainer.new()
		row_box.add_theme_constant_override("separation", 2)

		var top_line: HBoxContainer = HBoxContainer.new()
		var name_lbl: Label = Label.new()
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_lbl.add_theme_font_size_override("font_size", 12)
		var status_suffix: String = "" if is_online else " [آفلاین - بدون ربات]"
		name_lbl.text = "%s | %s Lv.%d%s" % [String(entry["name"]), role_name, lv, status_suffix]
		name_lbl.modulate = Color(1.0, 1.0, 1.0) if is_online else Color(0.62, 0.62, 0.68)
		top_line.add_child(name_lbl)

		# دکمه تغییر آزادانه نقش (همه یک نقش یا مخلوط)
		var role_btn: Button = Button.new()
		role_btn.text = "نقش"
		role_btn.tooltip_text = "تغییر آزادانه نقش این بازیکن"
		role_btn.add_theme_font_size_override("font_size", 11)
		var captured_slot: int = slot_idx
		role_btn.pressed.connect(func() -> void:
			pm.cycle_member_role(captured_slot)
		)
		top_line.add_child(role_btn)

		# دکمه شبیه‌سازی قطع/وصل اینترنت بازیکن برای هم‌تیمی‌های ۲ تا ۵
		if slot_idx > 0:
			var net_btn: Button = Button.new()
			net_btn.text = "قطع" if is_online else "وصل"
			net_btn.add_theme_font_size_override("font_size", 11)
			var next_online: bool = not is_online
			net_btn.pressed.connect(func() -> void:
				pm.set_player_online(captured_slot, next_online)
			)
			top_line.add_child(net_btn)

		row_box.add_child(top_line)

		# نوار کوچک سبز (MP/خون) و آبی (MANA) برای اعضای آنلاین
		if is_online and hero_ref != null and is_instance_valid(hero_ref):
			var hp_bar: ColorRect = ColorRect.new()
			hp_bar.custom_minimum_size = Vector2(180.0 * clampf(hero_ref.hp_current / maxf(1.0, hero_ref.hp_max), 0.0, 1.0), 4.0)
			hp_bar.color = Color(0.18, 0.86, 0.44)
			row_box.add_child(hp_bar)

			var mana_bar: ColorRect = ColorRect.new()
			mana_bar.custom_minimum_size = Vector2(180.0 * clampf(hero_ref.mana_current / maxf(1.0, hero_ref.mana_max), 0.0, 1.0), 3.0)
			mana_bar.color = Color(0.22, 0.64, 0.98)
			row_box.add_child(mana_bar)

		members_vbox.add_child(row_box)
