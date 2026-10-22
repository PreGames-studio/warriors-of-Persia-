class_name SpawnSystem
extends Node
## سیستم تولید دشمنان و باس‌ها در نقاط اسپاون جهان (SpawnSystem)
## در جهان باز، دشمنان کشته‌شده پس از زمان مشخص دوباره اسپاون می‌شوند؛ در دانجن، باس و نگهبانان حضور دارند.

const ENEMY_SCENE: PackedScene = preload("res://scenes/units/Enemy.tscn")
const BOSS_SCENE: PackedScene = preload("res://scenes/units/Boss.tscn")

@export var open_world_respawn_interval: float = 9.0

var _respawn_timer: float = 0.0
var _active_zone_root: Node = null
var _active_zone_tier: int = 1
var _allow_respawn: bool = false


func _process(delta: float) -> void:
	if not _allow_respawn or _active_zone_root == null or not is_instance_valid(_active_zone_root):
		return

	_respawn_timer += delta
	if _respawn_timer >= open_world_respawn_interval:
		_respawn_timer = 0.0
		_top_up_open_world_enemies()


## اسپاون اولیه تمام هیولاها و باس یک نقشه هنگام ورود به آن
func populate_zone(world_node: Node, zone_id: String, dungeon_tier: int = 1) -> void:
	_active_zone_root = world_node
	_active_zone_tier = max(1, dungeon_tier)
	_allow_respawn = (zone_id == "open_world")
	_respawn_timer = 0.0

	if world_node == null or zone_id == "village":
		return

	var enemies_container: Node = world_node.get_node_or_null("UnitsContainer")
	if enemies_container == null:
		enemies_container = world_node

	# اسپاون دشمنان معمولی و الیت روی نقاط Marker2D داخل گره EnemySpawnPoints
	var spawn_holder: Node = world_node.get_node_or_null("EnemySpawnPoints")
	if spawn_holder != null:
		var idx: int = 0
		for marker: Node in spawn_holder.get_children():
			if marker is Marker2D:
				var m: Marker2D = marker as Marker2D
				var mob_level: int = _active_zone_tier + (idx % 2)
				var rank: String = "elite" if (idx % 3 == 2) else "normal"
				_spawn_single_enemy(enemies_container, m.global_position, mob_level, rank)
				idx += 1

	# اسپاون باس در دانجن در صورت وجود BossSpawnPoint
	var boss_marker: Marker2D = world_node.get_node_or_null("BossSpawnPoint") as Marker2D
	if boss_marker != null:
		_spawn_boss(enemies_container, boss_marker.global_position, _active_zone_tier + 1)


func _top_up_open_world_enemies() -> void:
	if _active_zone_root == null:
		return
	var current_enemies: Array[Node] = get_tree().get_nodes_in_group("enemies")
	var spawn_holder: Node = _active_zone_root.get_node_or_null("EnemySpawnPoints")
	var container: Node = _active_zone_root.get_node_or_null("UnitsContainer")
	if spawn_holder == null or container == null:
		return

	var markers: Array[Node] = spawn_holder.get_children()
	if current_enemies.size() >= markers.size():
		return

	for marker: Node in markers:
		if marker is Marker2D:
			var m: Marker2D = marker as Marker2D
			var occupied: bool = false
			for e: Node in current_enemies:
				if e is Node2D and (e as Node2D).global_position.distance_to(m.global_position) < 160.0:
					occupied = true
					break
			if not occupied:
				_spawn_single_enemy(container, m.global_position, 1 + (randi() % 2), "normal")
				break


func _spawn_single_enemy(parent_node: Node, pos: Vector2, mob_level: int, rank: String) -> Enemy:
	var enemy: Enemy = ENEMY_SCENE.instantiate() as Enemy
	enemy.level = mob_level
	enemy.enemy_rank = rank
	enemy.unit_name = "هیولای نخبه" if rank == "elite" else "اسلایم شاخدار"
	enemy.global_position = pos
	if rank == "elite":
		enemy.scale = Vector2(1.18, 1.18)
	parent_node.add_child(enemy)
	return enemy


func _spawn_boss(parent_node: Node, pos: Vector2, boss_level: int) -> Boss:
	var boss: Boss = BOSS_SCENE.instantiate() as Boss
	boss.level = boss_level
	boss.unit_name = "پادشاه سیاه‌چال"
	boss.global_position = pos
	parent_node.add_child(boss)
	return boss
