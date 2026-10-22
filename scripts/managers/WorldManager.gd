class_name WorldManager
extends Node
## مدیر جهان و جابجایی بین نقشه‌ها (WorldManager)
## مدیریت انتقال روان تیم بین:
## - Village (روستا: امن + فروشگاه خرید/فروش کریستال)
## - OpenWorld (جهان باز: دشت، رودخانه، کوهستان + ورودی دانجن‌های متعدد)
## - Dungeon (دانجن: هیولاهای نگهبان + باس اصلی)

const ZONE_SCENES: Dictionary = {
	"village": "res://scenes/world/Village.tscn",
	"open_world": "res://scenes/world/OpenWorld.tscn",
	"dungeon": "res://scenes/world/Dungeon.tscn"
}

const ZONE_TITLES_FA: Dictionary = {
	"village": "روستای امن (فروشگاه و استراحت)",
	"open_world": "جهان باز (دشت، رودخانه و کوهستان)",
	"dungeon": "سیاه‌چال باستانی (باس و غنائم)"
}

var world_container: Node = null
var current_zone_id: String = ""
var current_dungeon_tier: int = 1
var current_world_instance: Node = null
var _is_transitioning: bool = false


func is_safe_zone() -> bool:
	return current_zone_id == "village"


## تغییر نقشه فعال و انتقال تمام اعضای آنلاین تیم به نقشه جدید
func load_zone(zone_id: String, dungeon_tier: int = 1) -> void:
	if _is_transitioning or not ZONE_SCENES.has(zone_id):
		return
	if world_container == null or not is_instance_valid(world_container):
		return

	_is_transitioning = true
	call_deferred("_perform_zone_switch", zone_id, max(1, dungeon_tier))


func _perform_zone_switch(zone_id: String, dungeon_tier: int) -> void:
	# ۱. ذخیره وضعیت و آمار فعلی اعضای تیم پیش از حذف صحنه قبلی
	if GameManager != null and GameManager.party_manager != null:
		GameManager.party_manager.save_all_heroes_snapshot()
		for entry: Dictionary in GameManager.party_manager.players:
			entry["hero_ref"] = null

	# ۲. پاکسازی کامل نقشه قبلی
	if current_world_instance != null and is_instance_valid(current_world_instance):
		world_container.remove_child(current_world_instance)
		current_world_instance.free()
		current_world_instance = null

	# ۳. بارگذاری و افزودن صحنه نقشه جدید
	var scene_path: String = String(ZONE_SCENES[zone_id])
	var packed: PackedScene = ResourceLoader.load(scene_path) as PackedScene
	if packed == null:
		_is_transitioning = false
		return

	current_zone_id = zone_id
	current_dungeon_tier = dungeon_tier
	current_world_instance = packed.instantiate()
	world_container.add_child(current_world_instance)

	# ۴. اسپاون قهرمانان آنلاین و دشمنان نقشه جدید
	if GameManager != null:
		if GameManager.match_manager != null:
			GameManager.match_manager.sync_party_units_in_world()
		if GameManager.spawn_system != null:
			GameManager.spawn_system.populate_zone(current_world_instance, zone_id, dungeon_tier)

	var title_text: String = String(ZONE_TITLES_FA.get(zone_id, zone_id))
	if zone_id == "dungeon":
		title_text = "دانجن سطح %d (باس و هیولاها)" % dungeon_tier

	if EventBus != null:
		EventBus.zone_changed.emit(zone_id, title_text, is_safe_zone())
		EventBus.notification_requested.emit("ورود به: %s" % title_text, Color(0.55, 0.92, 1.0))

	_is_transitioning = false
