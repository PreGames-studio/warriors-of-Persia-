class_name TrainingDummy3D
extends StaticBody3D
## هدف تمرینی سه‌بعدی برای آزمایش ضربات شمشیر قهرمان.

signal health_changed(current_health: float, max_health: float)
signal destroyed

@export var max_health: float = 120.0
var current_health: float = 120.0
var _original_material: StandardMaterial3D
var _body_mesh: MeshInstance3D
var _flash_material: StandardMaterial3D
var _flash_timer: float = 0.0


func _ready() -> void:
	add_to_group("enemies_3d")
	current_health = max_health
	_body_mesh = get_node_or_null("Visual/Body") as MeshInstance3D
	if _body_mesh != null:
		_original_material = _body_mesh.material_override as StandardMaterial3D
	_flash_material = _make_flash_material()
	health_changed.emit(current_health, max_health)


func take_damage(amount: float, _attacker: Node = null) -> void:
	if amount <= 0.0:
		return
	current_health = maxf(0.0, current_health - amount)
	health_changed.emit(current_health, max_health)
	_flash_timer = 0.12
	if current_health <= 0.0:
		current_health = max_health
		health_changed.emit(current_health, max_health)
		destroyed.emit()


func _process(delta: float) -> void:
	if _flash_timer > 0.0:
		_flash_timer -= delta
		if _body_mesh != null and _flash_material != null:
			_body_mesh.material_override = _flash_material
	elif _body_mesh != null and _original_material != null:
		_body_mesh.material_override = _original_material


func _make_flash_material() -> StandardMaterial3D:
	var flash := StandardMaterial3D.new()
	flash.albedo_color = Color("#fff1d6")
	flash.roughness = 0.5
	flash.emission_enabled = true
	flash.emission = Color("#ff9c46")
	flash.emission_energy_multiplier = 0.55
	return flash
