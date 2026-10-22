class_name CombatSystem
extends Node
## سیستم مبارزات و جلوه‌های بصری مهارت‌ها (CombatSystem)
## محاسبه برخوردها، پرتابه‌ها، امواج دایره‌ای اسکیل‌ها، نمایش اعداد آسیب و افکت‌های درخشان کارتونی.

const PROJECTILE_SCENE: PackedScene = preload("res://scenes/items/Projectile.tscn")
const GLOW_RING_TEX: Texture2D = preload("res://assets/sprites/glow_ring.png")
const SFX_ATTACK: AudioStream = preload("res://assets/audio/sfx_attack.wav")
const SFX_SKILL: AudioStream = preload("res://assets/audio/sfx_skill.wav")

var _audio_player: AudioStreamPlayer = null


func _ready() -> void:
	_audio_player = AudioStreamPlayer.new()
	_audio_player.volume_db = -8.0
	add_child(_audio_player)


## اجرای ضربه نزدیک (Melee) با افکت حلقه نورانی درخشان
func perform_melee_strike(
	attacker: UnitBase,
	strike_center: Vector2,
	radius: float,
	base_damage: float,
	vfx_color: Color
) -> void:
	if attacker == null:
		return
	_play_sfx(SFX_ATTACK)
	_spawn_glow_ring_vfx(strike_center, radius * 0.75, vfx_color, 0.22)
	_damage_hostiles_in_radius(attacker, strike_center, radius, base_damage)


## اجرای موج انفجاری دایره‌ای (AoE Skill / Boss Shockwave)
func perform_aoe_burst(
	caster: UnitBase,
	center: Vector2,
	radius: float,
	skill_damage: float,
	vfx_color: Color
) -> void:
	if caster == null:
		return
	_play_sfx(SFX_SKILL)
	_spawn_glow_ring_vfx(center, radius, vfx_color, 0.36)
	_damage_hostiles_in_radius(caster, center, radius, skill_damage)


## شلیک پرتابه انرژی درخشان (Projectile)
func spawn_projectile(
	caster: UnitBase,
	origin: Vector2,
	dir: Vector2,
	proj_damage: float,
	vfx_color: Color
) -> void:
	if caster == null:
		return
	var world_root: Node = _get_active_world_root()
	if world_root == null:
		return

	_play_sfx(SFX_SKILL)
	var proj: Projectile = PROJECTILE_SCENE.instantiate() as Projectile
	world_root.add_child(proj)
	proj.setup(origin, dir, proj_damage, caster.team, caster, vfx_color)


## اعمال مستقیم آسیب مهارت به یک هدف مشخص همراه با عدد آسیب شناور
func apply_skill_damage(attacker: Node, target: UnitBase, raw_damage: float) -> void:
	if target == null or target.is_dead:
		return
	var final_damage: float = maxf(1.0, roundf(raw_damage))
	target.take_damage(final_damage, attacker)
	var popup_color: Color = Color(1.0, 0.92, 0.30) if target.team == UnitBase.Team.ENEMY else Color(1.0, 0.42, 0.48)
	_spawn_floating_text("-%d" % int(final_damage), target.global_position + Vector2(0, -42), popup_color)


func _damage_hostiles_in_radius(
	source: UnitBase,
	center: Vector2,
	radius: float,
	dmg: float
) -> void:
	var target_group: String = "enemies" if source.team == UnitBase.Team.HERO else "heroes"
	var candidates: Array[Node] = get_tree().get_nodes_in_group(target_group)
	for node: Node in candidates:
		if node is UnitBase and not node.is_dead and node.visible:
			if node.global_position.distance_to(center) <= radius:
				apply_skill_damage(source, node, dmg)


func _spawn_glow_ring_vfx(pos: Vector2, target_radius: float, color: Color, duration: float) -> void:
	var world_root: Node = _get_active_world_root()
	if world_root == null:
		return

	var vfx: Sprite2D = Sprite2D.new()
	vfx.texture = GLOW_RING_TEX
	vfx.global_position = pos
	vfx.z_index = 8
	vfx.modulate = Color(color.r, color.g, color.b, 0.90)
	var end_scale: float = maxf(0.4, (target_radius * 2.0) / 128.0)
	vfx.scale = Vector2.ONE * (end_scale * 0.25)
	world_root.add_child(vfx)

	var tw: Tween = vfx.create_tween()
	tw.set_parallel(true)
	tw.tween_property(vfx, "scale", Vector2.ONE * end_scale, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(vfx, "modulate:a", 0.0, duration)
	tw.chain().tween_callback(vfx.queue_free)


func _spawn_floating_text(text_val: String, world_pos: Vector2, color: Color) -> void:
	var world_root: Node = _get_active_world_root()
	if world_root == null:
		return

	var lbl: Label = Label.new()
	lbl.text = text_val
	lbl.z_index = 20
	lbl.global_position = world_pos + Vector2(-24.0, 0.0)
	lbl.add_theme_color_override("font_color", color)
	lbl.add_theme_color_override("font_outline_color", Color(0.08, 0.06, 0.14, 1.0))
	lbl.add_theme_constant_override("outline_size", 5)
	lbl.add_theme_font_size_override("font_size", 16)
	world_root.add_child(lbl)

	var tw: Tween = lbl.create_tween()
	tw.set_parallel(true)
	tw.tween_property(lbl, "global_position:y", world_pos.y - 34.0, 0.55)
	tw.tween_property(lbl, "modulate:a", 0.0, 0.55)
	tw.chain().tween_callback(lbl.queue_free)


func _play_sfx(stream: AudioStream) -> void:
	if _audio_player != null and stream != null:
		_audio_player.stream = stream
		_audio_player.play()


func _get_active_world_root() -> Node:
	if GameManager != null and GameManager.world_manager != null:
		return GameManager.world_manager.current_world_instance
	return null
