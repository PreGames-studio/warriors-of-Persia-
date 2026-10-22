class_name Crystal
extends Area2D
## اسکریپت کریستال قابل جمع‌آوری (Crystal)
## با مرگ هر دشمن بر اساس رتبه (معمولی، الیت، باس) و لول آن تولید شده و توسط اعضای تیم جمع می‌شود.

signal collected(crystal_data: Dictionary, collector: Node)

@export var crystal_type: String = "small"      # نوع کریستال: small / medium / boss
@export var crystal_title: String = "خرده کریستال"
@export var enemy_source_level: int = 1         # لول دشمنی که کریستال از آن افتاده است
@export var coin_value: int = 12                # ارزش فروش در فروشگاه روستا به سکه
@export var magnet_radius: float = 135.0        # شعاع جذب خودکار به سمت قهرمان نزدیک
@export var magnet_speed: float = 340.0         # سرعت حرکت مغناطیسی به سمت قهرمان

var _base_scale: Vector2 = Vector2.ONE
var _time_alive: float = 0.0
var _collected_flag: bool = false

@onready var sprite: Sprite2D = $Sprite2D
@onready var glow_sprite: Sprite2D = $GlowSprite
@onready var value_label: Label = $ValueLabel


func _ready() -> void:
	add_to_group("crystals")
	body_entered.connect(_on_body_entered)
	_apply_visual_style()


func _physics_process(delta: float) -> void:
	if _collected_flag:
		return

	_time_alive += delta
	# حرکت شناور نرم به سبک بازی‌های کارتونی/چیبی
	if sprite != null:
		sprite.position.y = sin(_time_alive * 4.2) * 4.0
	if glow_sprite != null:
		var pulse: float = 0.88 + 0.14 * sin(_time_alive * 5.0)
		glow_sprite.scale = Vector2(pulse, pulse) * 0.65

	# جذب مغناطیسی نرم به سمت نزدیک‌ترین قهرمان آنلاین تیم
	var nearest_hero: Node2D = _find_nearest_hero()
	if nearest_hero != null:
		var dist: float = global_position.distance_to(nearest_hero.global_position)
		if dist <= magnet_radius:
			global_position = global_position.move_toward(
				nearest_hero.global_position,
				magnet_speed * delta
			)
			if dist <= 26.0:
				_collect(nearest_hero)


## پیکربندی ابعاد، رنگ و ارزش سکه کریستال بر اساس نوع و لول دشمن
func setup_from_enemy(p_enemy_level: int, p_enemy_rank: String) -> void:
	enemy_source_level = max(1, p_enemy_level)
	var rank_lower: String = p_enemy_rank.to_lower()

	if rank_lower == "boss":
		crystal_type = "boss"
		crystal_title = "کریستال باستانی باس"
		coin_value = 45 + (enemy_source_level * 20)
		_base_scale = Vector2(1.5, 1.5)
	elif rank_lower == "elite" or enemy_source_level >= 3:
		crystal_type = "medium"
		crystal_title = "کریستال تابناک"
		coin_value = 18 + (enemy_source_level * 10)
		_base_scale = Vector2(1.15, 1.15)
	else:
		crystal_type = "small"
		crystal_title = "خرده کریستال آبی"
		coin_value = 10 + (enemy_source_level * 5)
		_base_scale = Vector2(0.88, 0.88)

	if is_inside_tree():
		_apply_visual_style()


func _apply_visual_style() -> void:
	scale = _base_scale
	var gem_color: Color = Color(0.28, 0.88, 1.0, 1.0)
	if crystal_type == "medium":
		gem_color = Color(0.32, 0.98, 0.68, 1.0)
	elif crystal_type == "boss":
		gem_color = Color(1.0, 0.80, 0.24, 1.0)

	if sprite != null:
		sprite.modulate = gem_color
	if glow_sprite != null:
		glow_sprite.modulate = Color(gem_color.r, gem_color.g, gem_color.b, 0.42)
	if value_label != null:
		value_label.text = "%s (%d سکه)" % [crystal_title, coin_value]


func _on_body_entered(body: Node2D) -> void:
	if _collected_flag:
		return
	if body is UnitBase and body.team == UnitBase.Team.HERO and not body.is_dead:
		_collect(body)


func _collect(collector: Node) -> void:
	if _collected_flag:
		return
	_collected_flag = true

	var data: Dictionary = {
		"type": crystal_type,
		"title": "%s (Lv.%d)" % [crystal_title, enemy_source_level],
		"level": enemy_source_level,
		"coin_value": coin_value
	}
	collected.emit(data, collector)
	if GameManager != null and GameManager.loot_system != null:
		GameManager.loot_system.collect_crystal(data, global_position)

	queue_free()


func _find_nearest_hero() -> Node2D:
	var heroes: Array[Node] = get_tree().get_nodes_in_group("heroes")
	var best: Node2D = null
	var best_dist: float = INF
	for node: Node in heroes:
		if node is UnitBase and not node.is_dead and node.visible:
			var d: float = global_position.distance_to(node.global_position)
			if d < best_dist:
				best_dist = d
				best = node
	return best
