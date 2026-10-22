class_name Projectile
extends Area2D
## پرتابه انرژی/جادویی درخشان (Projectile)
## برای اسکیل‌های دوربرد قهرمانان یا حملات ویژه دشمنان استفاده می‌شود.

@export var speed: float = 480.0
@export var max_lifetime: float = 1.8

var direction: Vector2 = Vector2.RIGHT
var damage: float = 25.0
var source_team: int = 1
var source_unit: Node = null
var _elapsed: float = 0.0

@onready var sprite: Sprite2D = $Sprite2D


func _ready() -> void:
	body_entered.connect(_on_body_entered)


## مقداردهی اولیه پرتابه هنگام شلیک
func setup(
	p_origin: Vector2,
	p_dir: Vector2,
	p_damage: float,
	p_team: int,
	p_source: Node,
	p_color: Color = Color(0.35, 0.9, 1.0, 1.0)
) -> void:
	global_position = p_origin
	direction = p_dir.normalized() if p_dir.length_squared() > 0.001 else Vector2.RIGHT
	rotation = direction.angle()
	damage = p_damage
	source_team = p_team
	source_unit = p_source
	modulate = p_color


func _physics_process(delta: float) -> void:
	_elapsed += delta
	if _elapsed >= max_lifetime:
		queue_free()
		return
	global_position += direction * speed * delta
	if sprite != null:
		sprite.rotation += 8.0 * delta


func _on_body_entered(body: Node2D) -> void:
	if body == source_unit:
		return
	if body is UnitBase:
		var target_unit: UnitBase = body as UnitBase
		if target_unit.team != source_team and not target_unit.is_dead:
			if GameManager != null and GameManager.combat_system != null:
				GameManager.combat_system.apply_skill_damage(source_unit, target_unit, damage)
			else:
				target_unit.take_damage(damage, source_unit)
			queue_free()
