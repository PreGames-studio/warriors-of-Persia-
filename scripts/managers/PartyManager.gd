class_name PartyManager
extends Node
## مدیر تیم ۱ تا ۵ نفره (PartyManager)
## قوانین کلیدی طراحی بازی:
## ۱) ظرفیت تیم: ۱ تا ۵ بازیکن (اجرای تکنفره مجاز است).
## ۲) ترکیب نقش‌ها کاملاً آزاد است (می‌توانند همه یک نقش یا ترکیبی از نقش‌ها باشند).
## ۳) در صورت آفلاین شدن هر بازیکن، ربات جایگزین آن نمی‌شود و تیم با نفرات کمتر ادامه می‌دهد.

const MAX_PARTY_SIZE: int = 5
const REPLACE_OFFLINE_WITH_BOT: bool = false

var players: Array[Dictionary] = []


func _ready() -> void:
	# شروع پیش‌فرض با ۱ بازیکن محلی (آماده افزودن هم‌تیمی‌های ۲ تا ۵ برای تست لوکال)
	reset_to_single_local_player()


## مقداردهی اولیه تیم با رهبر محلی (بازیکن شماره ۱)
func reset_to_single_local_player() -> void:
	players.clear()
	players.append(_create_member_dict(0, "قهرمان ۱ (شما)", Hero.Role.WARRIOR, true))
	_emit_party_changed()


func _create_member_dict(slot_idx: int, p_name: String, role_val: int, is_local: bool) -> Dictionary:
	return {
		"slot": slot_idx,
		"name": p_name,
		"role": role_val,
		"is_local": is_local,
		"is_online": true,
		"level": 1,
		"xp": 0,
		"hp_max": 160.0,
		"mana_max": 100.0,
		"attack_damage": 24.0,
		"hero_ref": null
	}


## افزودن یک بازیکن جدید به تیم برای تست لوکال (حداکثر ۵ نفر، هر نقشی مجاز)
func add_test_member(role_val: int = -1) -> bool:
	if players.size() >= MAX_PARTY_SIZE:
		return false

	var next_slot: int = players.size()
	var chosen_role: int = role_val
	if chosen_role < 0:
		chosen_role = next_slot % 5

	var member_name: String = "بازیکن %d" % (next_slot + 1)
	var entry: Dictionary = _create_member_dict(next_slot, member_name, chosen_role, false)
	players.append(entry)

	if GameManager != null and GameManager.match_manager != null:
		GameManager.match_manager.sync_party_units_in_world()

	_emit_party_changed()
	if EventBus != null:
		EventBus.notification_requested.emit(
			"%s (%s) به تیم پیوست! [%d/%d]" % [
				member_name,
				Hero.get_role_title_fa(chosen_role),
				get_online_count(),
				MAX_PARTY_SIZE
			],
			Color(0.40, 0.95, 0.65)
		)
	return true


## تغییر آزادانه نقش یک عضو تیم (حتی همه اعضا می‌توانند یک نقش یکسان داشته باشند)
func cycle_member_role(slot_index: int) -> void:
	if slot_index < 0 or slot_index >= players.size():
		return

	var current_role: int = int(players[slot_index]["role"])
	var next_role: int = (current_role + 1) % 5
	players[slot_index]["role"] = next_role

	var hero_node: Hero = players[slot_index]["hero_ref"] as Hero
	if hero_node != null and is_instance_valid(hero_node):
		hero_node.hero_role = next_role as Hero.Role
		hero_node.apply_role_style()

	_emit_party_changed()


## تغییر وضعیت اتصال یک هم‌تیمی (آنلاین <-> آفلاین)
## قانون مهم: وقتی بازیکن آفلاین شود، هیچ رباتی جایگزین او نمی‌شود و قهرمانش از میدان خارج می‌گردد.
func set_player_online(slot_index: int, online_state: bool) -> void:
	if slot_index <= 0 or slot_index >= players.size():
		# بازیکن ۰ (خود کاربر محلی) همیشه در جلسه لوکال آنلاین است
		return

	var entry: Dictionary = players[slot_index]
	if bool(entry["is_online"]) == online_state:
		return

	# ذخیره آخرین وضعیت قهرمان قبل از خروج از میدان
	if not online_state:
		_save_single_hero_snapshot(entry)
		var existing_hero: Hero = entry["hero_ref"] as Hero
		if existing_hero != null and is_instance_valid(existing_hero):
			existing_hero.queue_free()
		entry["hero_ref"] = null

	entry["is_online"] = online_state

	if online_state and not REPLACE_OFFLINE_WITH_BOT:
		if GameManager != null and GameManager.match_manager != null:
			GameManager.match_manager.sync_party_units_in_world()

	if EventBus != null:
		EventBus.player_connection_changed.emit(slot_index, online_state)
		var msg: String = (
			"%s دوباره آنلاین شد! اندازه تیم فعال: %d نفر" % [String(entry["name"]), get_online_count()]
			if online_state
			else "%s آفلاین شد! (ربات جایگزین نشد — ادامه با %d نفر)" % [String(entry["name"]), get_online_count()]
		)
		EventBus.notification_requested.emit(msg, Color(1.0, 0.78, 0.32))

	_emit_party_changed()


## ذخیره آمار فعلی تمام قهرمانان فعال پیش از جابجایی بین نقشه‌ها
func save_all_heroes_snapshot() -> void:
	for entry: Dictionary in players:
		_save_single_hero_snapshot(entry)


func _save_single_hero_snapshot(entry: Dictionary) -> void:
	var h: Hero = entry.get("hero_ref") as Hero
	if h != null and is_instance_valid(h):
		entry["level"] = h.level
		entry["xp"] = h.xp
		entry["hp_max"] = h.hp_max
		entry["mana_max"] = h.mana_max
		entry["attack_damage"] = h.attack_damage


## بازگرداندن لیست گره‌های Hero تمام بازیکنان آنلاین فعلی برای دریافت XP مشترک
func get_online_hero_nodes() -> Array[Hero]:
	var result: Array[Hero] = []
	for entry: Dictionary in players:
		if bool(entry.get("is_online", false)):
			var h: Hero = entry.get("hero_ref") as Hero
			if h != null and is_instance_valid(h):
				result.append(h)
	return result


func get_online_count() -> int:
	var count: int = 0
	for entry: Dictionary in players:
		if bool(entry.get("is_online", false)):
			count += 1
	return count


func _emit_party_changed() -> void:
	if EventBus != null:
		EventBus.party_updated.emit(players)
