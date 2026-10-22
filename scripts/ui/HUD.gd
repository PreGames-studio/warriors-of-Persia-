class_name HUD
extends CanvasLayer
## رابط کاربری اصلی بازی (HUD)
## شامل:
## ۱) نوارهای سه‌رنگ قهرمان: نوار سبز MP (خون)، نوار آبی MANA، نوار زرد XP
## ۲) پنل ۵ عضو تیم (PartyHUD)
## ۳) مینی‌مپ زنده + دکمه‌های جابجایی سریع تست بین Village / OpenWorld / Dungeon
## ۴) جوی‌استیک مجازی موبایل + دکمه حمله پایه + ۴ دکمه اسکیل درخشان + نشانگر پسیو
## ۵) پنجره‌های Inventory و Shop

@onready var hero_title_label: Label = $RootControl/HeroStatusPanel/Margin/VBox/HeroTitleLabel
@onready var economy_label: Label = $RootControl/HeroStatusPanel/Margin/VBox/EconomyLabel
@onready var hp_bar: ProgressBar = $RootControl/HeroStatusPanel/Margin/VBox/HPBarRow/HPBar
@onready var hp_val_label: Label = $RootControl/HeroStatusPanel/Margin/VBox/HPBarRow/HPValLabel
@onready var mana_bar: ProgressBar = $RootControl/HeroStatusPanel/Margin/VBox/ManaBarRow/ManaBar
@onready var mana_val_label: Label = $RootControl/HeroStatusPanel/Margin/VBox/ManaBarRow/ManaValLabel
@onready var xp_bar: ProgressBar = $RootControl/HeroStatusPanel/Margin/VBox/XPBarRow/XPBar
@onready var xp_val_label: Label = $RootControl/HeroStatusPanel/Margin/VBox/XPBarRow/XPValLabel

@onready var zone_label: Label = $RootControl/TopCenterBar/VBox/ZoneTitleLabel
@onready var toast_label: Label = $RootControl/TopCenterBar/VBox/ToastLabel
@onready var btn_village: Button = $RootControl/TopCenterBar/VBox/QuickButtons/BtnVillage
@onready var btn_openworld: Button = $RootControl/TopCenterBar/VBox/QuickButtons/BtnOpenWorld
@onready var btn_dungeon: Button = $RootControl/TopCenterBar/VBox/QuickButtons/BtnDungeon
@onready var btn_inventory: Button = $RootControl/TopCenterBar/VBox/QuickButtons/BtnInventory
@onready var btn_shop: Button = $RootControl/TopCenterBar/VBox/QuickButtons/BtnShop

@onready var virtual_joystick: VirtualJoystick = $RootControl/VirtualJoystick
@onready var attack_btn: Button = $RootControl/ActionCluster/AttackBtn
@onready var skill_btn_1: Button = $RootControl/ActionCluster/SkillBtn1
@onready var skill_btn_2: Button = $RootControl/ActionCluster/SkillBtn2
@onready var skill_btn_3: Button = $RootControl/ActionCluster/SkillBtn3
@onready var skill_btn_4: Button = $RootControl/ActionCluster/SkillBtn4
@onready var passive_label: Label = $RootControl/ActionCluster/PassiveLabel

@onready var inventory_popup: InventoryUI = $RootControl/ModalContainer/Inventory
@onready var shop_popup: ShopUI = $RootControl/ModalContainer/Shop

var _skill_buttons: Array[Button] = []
var _toast_timer: float = 0.0


func _ready() -> void:
	_skill_buttons = [skill_btn_1, skill_btn_2, skill_btn_3, skill_btn_4]
	_style_three_colored_bars()
	_connect_ui_actions()

	if EventBus != null:
		EventBus.local_hero_registered.connect(_refresh_hero_hud)
		EventBus.hero_stats_updated.connect(_refresh_hero_hud)
		EventBus.coins_changed.connect(func(_c: int) -> void: _refresh_economy())
		EventBus.crystals_changed.connect(func(_arr: Array) -> void: _refresh_economy())
		EventBus.zone_changed.connect(_on_zone_changed)
		EventBus.notification_requested.connect(_show_toast)

	_refresh_economy()


func _process(delta: float) -> void:
	# ارسال پیوسته بردار جوی‌استیک و به‌روزرسانی لحظه‌ای نوارها و کول‌داون ۴ اسکیل
	var hero: Hero = GameManager.match_manager.get_local_hero() if (GameManager != null and GameManager.match_manager != null) else null
	if hero != null:
		hero.joystick_vector = virtual_joystick.output
		_refresh_hero_hud(hero)
		_refresh_skill_buttons(hero)

	if _toast_timer > 0.0:
		_toast_timer -= delta
		if _toast_timer <= 0.0 and toast_label != null:
			toast_label.text = ""


## رنگ‌آمیزی دقیق سه نوار اصلی قهرمان طبق مشخصات:
## نوار MP (خون) = سبز، نوار MANA = آبی، نوار XP = زرد
func _style_three_colored_bars() -> void:
	_apply_bar_fill_color(hp_bar, Color(0.16, 0.84, 0.42), Color(0.08, 0.24, 0.14))
	_apply_bar_fill_color(mana_bar, Color(0.18, 0.58, 0.98), Color(0.08, 0.16, 0.30))
	_apply_bar_fill_color(xp_bar, Color(0.96, 0.78, 0.14), Color(0.26, 0.22, 0.07))


func _apply_bar_fill_color(bar: ProgressBar, fill_col: Color, bg_col: Color) -> void:
	if bar == null:
		return
	var fill_style: StyleBoxFlat = StyleBoxFlat.new()
	fill_style.bg_color = fill_col
	fill_style.set_corner_radius_all(5)

	var bg_style: StyleBoxFlat = StyleBoxFlat.new()
	bg_style.bg_color = bg_col
	bg_style.border_color = Color(0.9, 0.94, 1.0, 0.28)
	bg_style.set_border_width_all(1)
	bg_style.set_corner_radius_all(5)

	bar.add_theme_stylebox_override("fill", fill_style)
	bar.add_theme_stylebox_override("background", bg_style)


func _connect_ui_actions() -> void:
	attack_btn.pressed.connect(func() -> void:
		var h: Hero = GameManager.match_manager.get_local_hero()
		if h != null:
			h.perform_basic_attack()
	)

	for idx: int in range(_skill_buttons.size()):
		var captured: int = idx
		_skill_buttons[idx].pressed.connect(func() -> void:
			var h: Hero = GameManager.match_manager.get_local_hero()
			if h != null:
				h.use_skill(captured)
		)

	btn_village.pressed.connect(func() -> void: EventBus.zone_change_requested.emit("village", 1))
	btn_openworld.pressed.connect(func() -> void: EventBus.zone_change_requested.emit("open_world", 1))
	btn_dungeon.pressed.connect(func() -> void: EventBus.zone_change_requested.emit("dungeon", 1))

	btn_inventory.pressed.connect(func() -> void:
		inventory_popup.visible = not inventory_popup.visible
		if inventory_popup.visible:
			shop_popup.visible = false
			inventory_popup.refresh_ui()
	)
	btn_shop.pressed.connect(func() -> void:
		shop_popup.visible = not shop_popup.visible
		if shop_popup.visible:
			inventory_popup.visible = false
			shop_popup.refresh_ui()
	)


func _refresh_hero_hud(node: Node) -> void:
	if not (node is Hero):
		return
	var hero: Hero = node as Hero

	hero_title_label.text = "%s (%s) — سطح %d" % [
		hero.unit_name,
		Hero.get_role_title_fa(hero.hero_role),
		hero.level
	]
	passive_label.text = String(hero.passive_skill.get("name", "پسیو فعال"))

	hp_bar.max_value = maxf(1.0, hero.hp_max)
	hp_bar.value = hero.hp_current
	hp_val_label.text = "%d/%d" % [int(roundf(hero.hp_current)), int(roundf(hero.hp_max))]

	mana_bar.max_value = maxf(1.0, hero.mana_max)
	mana_bar.value = hero.mana_current
	mana_val_label.text = "%d/%d" % [int(roundf(hero.mana_current)), int(roundf(hero.mana_max))]

	xp_bar.max_value = maxf(1.0, float(hero.xp_to_next_level))
	xp_bar.value = float(hero.xp)
	xp_val_label.text = "%d/%d" % [hero.xp, hero.xp_to_next_level]

	_refresh_economy()


func _refresh_economy() -> void:
	if GameManager == null or GameManager.progression_system == null or GameManager.loot_system == null:
		return
	economy_label.text = "سکه: %d   |   کریستال همراه: %d" % [
		GameManager.progression_system.coins,
		GameManager.loot_system.collected_crystals.size()
	]


func _refresh_skill_buttons(hero: Hero) -> void:
	for i: int in range(min(_skill_buttons.size(), hero.skills.size())):
		var btn: Button = _skill_buttons[i]
		var sk: Dictionary = hero.skills[i]
		var cd_left: float = hero.skill_cooldown_timers[i]
		var m_cost: int = int(roundf(float(sk["mana_cost"])))

		if cd_left > 0.05:
			btn.text = "%s\n%.1fs" % [String(sk["name"]), cd_left]
			btn.disabled = true
			btn.modulate = Color(0.55, 0.58, 0.68)
		else:
			btn.text = "%s\n(%d مانا)" % [String(sk["name"]), m_cost]
			btn.disabled = false
			btn.modulate = Color(1.0, 1.0, 1.0) if hero.mana_current >= float(m_cost) else Color(0.55, 0.72, 1.0)


func _on_zone_changed(_zone_id: String, zone_title: String, _is_safe: bool) -> void:
	if zone_label != null:
		zone_label.text = "مکان فعلی: %s" % zone_title


func _show_toast(message: String, color: Color) -> void:
	if toast_label != null:
		toast_label.text = message
		toast_label.modulate = color
		_toast_timer = 3.2
