class_name MatchManager
extends Node
## مدیر جلسه نبرد، اسپاون قهرمانان و دوربین (MatchManager)
## توجه طراحی: ضریب سختی دنیا برای گروه ۵ نفره بالانس شده و با کم شدن نفرات تیم کاهش نمی‌یابد.

const HERO_SCENE: PackedScene = preload("res://scenes/units/Hero.tscn")
const BALANCED_PARTY_SIZE: int = 5

@export var respawn_delay_seconds: float = 2.5

var active_camera: Camera2D = null


func _process(delta: float) -> void:
	var leader: Hero = get_local_hero()
	if leader != null and active_camera != null and is_instance_valid(active_camera):
		active_camera.global_position = active_camera.global_position.lerp(
			leader.global_position,
			minf(1.0, 7.5 * delta)
		)


## اسپاون یا همگام‌سازی تمام اعضای آنلاین تیم در نقشه فعلی
func sync_party_units_in_world() -> void:
	if GameManager == null or GameManager.world_manager == null or GameManager.party_manager == null:
		return

	var world_node: Node = GameManager.world_manager.current_world_instance
	if world_node == null:
		return

	var units_holder: Node = world_node.get_node_or_null("UnitsContainer")
	if units_holder == null:
		units_holder = world_node

	var base_spawn: Vector2 = _get_world_spawn_position(world_node)
	var leader: Hero = get_local_hero()
	if leader != null:
		base_spawn = leader.global_position

	for entry: Dictionary in GameManager.party_manager.players:
		var slot_idx: int = int(entry["slot"])
		var is_online: bool = bool(entry["is_online"])
		var current_ref: Hero = entry.get("hero_ref") as Hero

		if not is_online:
			if current_ref != null and is_instance_valid(current_ref):
				current_ref.queue_free()
			entry["hero_ref"] = null
			continue

		if current_ref != null and is_instance_valid(current_ref):
			continue

		var hero_inst: Hero = HERO_SCENE.instantiate() as Hero
		hero_inst.player_slot = slot_idx
		hero_inst.is_local_leader = bool(entry["is_local"])
		hero_inst.unit_name = String(entry["name"])
		hero_inst.hero_role = int(entry["role"]) as Hero.Role
		hero_inst.level = int(entry["level"])
		hero_inst.xp = int(entry["xp"])
		hero_inst.hp_max = float(entry["hp_max"])
		hero_inst.mana_max = float(entry["mana_max"])
		hero_inst.attack_damage = float(entry["attack_damage"])

		var offset: Vector2 = Vector2.ZERO if slot_idx == 0 else Vector2(
			cos(float(slot_idx) * 1.35) * 64.0,
			sin(float(slot_idx) * 1.35) * 52.0
		)
		hero_inst.global_position = base_spawn + offset
		units_holder.add_child(hero_inst)
		entry["hero_ref"] = hero_inst

	_ensure_world_camera(world_node)
	if EventBus != null:
		EventBus.party_updated.emit(GameManager.party_manager.players)


## زمان‌بندی زنده‌شدن مجدد قهرمان در نقطه امن/ورودی نقشه
func schedule_hero_respawn(hero: Hero) -> void:
	if hero == null or not is_instance_valid(hero):
		return

	var timer: SceneTreeTimer = get_tree().create_timer(respawn_delay_seconds)
	timer.timeout.connect(func() -> void:
		if hero != null and is_instance_valid(hero):
			var world_node: Node = GameManager.world_manager.current_world_instance
			var spawn_pos: Vector2 = _get_world_spawn_position(world_node)
			hero.revive_at(spawn_pos)
	)


func get_local_hero() -> Hero:
	if GameManager == null or GameManager.party_manager == null:
		return null
	if GameManager.party_manager.players.is_empty():
		return null
	var ref: Hero = GameManager.party_manager.players[0].get("hero_ref") as Hero
	if ref != null and is_instance_valid(ref):
		return ref
	return null


func _get_world_spawn_position(world_node: Node) -> Vector2:
	if world_node != null:
		var marker: Marker2D = world_node.get_node_or_null("HeroSpawnPoint") as Marker2D
		if marker != null:
			return marker.global_position
	return Vector2(360.0, 360.0)


func _ensure_world_camera(world_node: Node) -> void:
	if world_node == null:
		return
	var existing: Camera2D = world_node.get_node_or_null("WorldCamera") as Camera2D
	if existing == null:
		existing = Camera2D.new()
		existing.name = "WorldCamera"
		var leader: Hero = get_local_hero()
		existing.global_position = leader.global_position if leader != null else _get_world_spawn_position(world_node)
		world_node.add_child(existing)
	existing.enabled = true
	active_camera = existing
