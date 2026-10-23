class_name Hero3D
extends CharacterBody3D
## جنگجوی شمشیرزن سه‌بعدی. حرکت WASD، دویدن Shift و حمله‌ی شمشیری با کلیک چپ/Space.

signal sword_attack_started(combo_step: int)
signal sword_hit(target: Node, damage: float)
signal movement_state_changed(is_moving: bool, is_running: bool)

const KEY_ACTIONS: Dictionary = {
	"hero_move_left": KEY_A,
	"hero_move_right": KEY_D,
	"hero_move_forward": KEY_W,
	"hero_move_back": KEY_S,
	"hero_run": KEY_SHIFT,
	"hero_attack": KEY_SPACE,
	"hero_release_mouse": KEY_ESCAPE
}

@export_group("Movement")
@export var walk_speed: float = 4.4
@export var run_speed: float = 7.6
@export var acceleration: float = 19.0
@export var turn_speed: float = 13.0
@export var gravity_strength: float = 22.0

@export_group("Sword")
@export var sword_damage: float = 34.0
@export var attack_cooldown: float = 0.42
@export var attack_duration: float = 0.46
@export var attack_reach: float = 1.25
@export_flags_3d_physics var attack_collision_mask: int = 1

@export_group("Camera")
@export var mouse_sensitivity: float = 0.0025
@export var camera_distance: float = 4.8
@export var camera_height: float = 1.65

var _camera_yaw: float = 0.0
var _camera_pitch: float = -0.16
var _attack_timer: float = 0.0
var _attack_cooldown_timer: float = 0.0
var _attack_hit_applied: bool = false
var _combo_step: int = 0
var _combo_window: float = 0.0
var _animation_clock: float = 0.0
var _is_running: bool = false
var _was_moving: bool = false
var _sword_pivot: Node3D
var _left_leg: Node3D
var _right_leg: Node3D
var _left_arm: Node3D
var _right_arm: Node3D
var _cape: Node3D
var _model_materials: Dictionary = {}

@onready var _visual: Node3D = $HeroVisual
@onready var _camera_rig: Node3D = $CameraRig
@onready var _camera: Camera3D = $CameraRig/Camera3D


func _ready() -> void:
	add_to_group("heroes_3d")
	_ensure_input_actions()
	_build_swordsman_model()
	_camera_rig.top_level = true
	_camera.current = true
	_camera.position = Vector3(0.0, 0.0, camera_distance)
	_update_camera(1.0)
	if not _is_touch_device():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("hero_release_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif (
		event is InputEventMouseButton
		and event.pressed
		and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE
	):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_camera_drag(event.relative)
	elif event is InputEventScreenDrag:
		_apply_camera_drag(event.relative)


func _apply_camera_drag(relative_motion: Vector2) -> void:
	_camera_yaw -= relative_motion.x * mouse_sensitivity
	_camera_pitch = clampf(_camera_pitch - relative_motion.y * mouse_sensitivity, -0.72, 0.24)


func _is_touch_device() -> bool:
	return OS.has_feature("mobile") or DisplayServer.is_touchscreen_available()


func _physics_process(delta: float) -> void:
	if Input.is_action_just_pressed("hero_attack"):
		_start_sword_attack()
	_attack_cooldown_timer = maxf(0.0, _attack_cooldown_timer - delta)
	_combo_window = maxf(0.0, _combo_window - delta)
	if _attack_timer > 0.0:
		_update_attack_animation(delta)

	var input_vector := Input.get_vector(
		"hero_move_left", "hero_move_right", "hero_move_forward", "hero_move_back"
	)
	var local_input := Vector3(input_vector.x, 0.0, input_vector.y)
	var move_direction := Basis(Vector3.UP, _camera_yaw) * local_input
	move_direction.y = 0.0
	if move_direction.length_squared() > 1.0:
		move_direction = move_direction.normalized()

	_is_running = Input.is_action_pressed("hero_run") and move_direction.length_squared() > 0.01
	var target_speed := run_speed if _is_running else walk_speed
	var target_velocity := move_direction * target_speed
	velocity.x = move_toward(velocity.x, target_velocity.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target_velocity.z, acceleration * delta)

	if not is_on_floor():
		velocity.y -= gravity_strength * delta
	else:
		velocity.y = -0.5

	move_and_slide()
	if move_direction.length_squared() > 0.01:
		_face_direction(move_direction, delta)

	var moving := Vector2(velocity.x, velocity.z).length() > 0.15
	if moving != _was_moving:
		_was_moving = moving
		movement_state_changed.emit(moving, _is_running)
	_animate_body(delta, moving)
	_update_camera(delta)


func _start_sword_attack() -> void:
	if _attack_cooldown_timer > 0.0:
		return
	if _combo_window <= 0.0:
		_combo_step = 0
	else:
		_combo_step = (_combo_step + 1) % 3
	_combo_window = 0.8
	_attack_timer = attack_duration
	_attack_cooldown_timer = attack_cooldown
	_attack_hit_applied = false
	if Vector2(velocity.x, velocity.z).length_squared() < 0.04:
		rotation.y = _camera_yaw
	sword_attack_started.emit(_combo_step + 1)


func _update_attack_animation(delta: float) -> void:
	_attack_timer = maxf(0.0, _attack_timer - delta)
	var progress := 1.0 - _attack_timer / maxf(attack_duration, 0.01)
	var swing_progress := clampf(progress / 0.72, 0.0, 1.0)
	var combo_offset := float(_combo_step) * 0.16
	_sword_pivot.rotation.y = lerpf(-1.15 + combo_offset, 1.25 + combo_offset, swing_progress)
	_right_arm.rotation.x = -0.75 + sin(swing_progress * PI) * 1.05
	_right_arm.rotation.z = -0.4 - sin(swing_progress * PI) * 0.35

	if not _attack_hit_applied and progress >= 0.28:
		_attack_hit_applied = true
		_perform_sword_hit()
	if _attack_timer <= 0.0:
		_sword_pivot.rotation.y = -0.35
		_right_arm.rotation = Vector3(0.0, 0.0, -0.12)


func _perform_sword_hit() -> void:
	var sphere := SphereShape3D.new()
	sphere.radius = attack_reach
	var forward := -global_transform.basis.z
	var hit_position := global_position + Vector3.UP * 1.05 + forward * 0.95
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = sphere
	query.transform = Transform3D(Basis.IDENTITY, hit_position)
	query.collision_mask = attack_collision_mask
	query.exclude = [get_rid()]
	var results := get_world_3d().direct_space_state.intersect_shape(query, 24)
	var damaged_bodies: Array[Object] = []
	for result in results:
		var target: Object = result.get("collider")
		if target == null or target == self or damaged_bodies.has(target):
			continue
		if target is Node and (target as Node).is_in_group("enemies_3d"):
			var combo_multiplier := 1.0 + float(_combo_step) * 0.16
			var damage := sword_damage * combo_multiplier
			if target.has_method("take_damage"):
				target.call("take_damage", damage, self)
				damaged_bodies.append(target)
				sword_hit.emit(target as Node, damage)


func _face_direction(direction: Vector3, delta: float) -> void:
	var target_yaw := atan2(-direction.x, -direction.z)
	rotation.y = lerp_angle(rotation.y, target_yaw, minf(1.0, turn_speed * delta))


func _animate_body(delta: float, moving: bool) -> void:
	var speed_ratio := Vector2(velocity.x, velocity.z).length() / maxf(run_speed, 0.01)
	if moving:
		_animation_clock += delta * lerpf(8.5, 13.5, speed_ratio)
		var stride := sin(_animation_clock) * (0.48 if _is_running else 0.32)
		_left_leg.rotation.x = stride
		_right_leg.rotation.x = -stride
		if _attack_timer <= 0.0:
			_left_arm.rotation.x = -stride * 0.65
			_right_arm.rotation.x = -stride * 0.65
		_visual.position.y = absf(sin(_animation_clock * 2.0)) * (0.075 if _is_running else 0.035)
	else:
		_animation_clock = 0.0
		_left_leg.rotation.x = lerpf(_left_leg.rotation.x, 0.0, delta * 10.0)
		_right_leg.rotation.x = lerpf(_right_leg.rotation.x, 0.0, delta * 10.0)
		_left_arm.rotation.x = lerpf(_left_arm.rotation.x, 0.0, delta * 7.0)
		if _attack_timer <= 0.0:
			_right_arm.rotation.x = lerpf(_right_arm.rotation.x, 0.0, delta * 8.0)
		_visual.position.y = lerpf(_visual.position.y, 0.0, delta * 8.0)
	_cape.rotation.x = lerpf(_cape.rotation.x, -0.06 - speed_ratio * 0.12, delta * 5.0)


func _update_camera(delta: float) -> void:
	if not is_instance_valid(_camera_rig):
		return
	var target_position := global_position + Vector3.UP * camera_height
	_camera_rig.global_position = _camera_rig.global_position.lerp(
		target_position, minf(1.0, 12.0 * delta)
	)
	_camera_rig.global_rotation = Vector3(_camera_pitch, _camera_yaw, 0.0)


func _build_swordsman_model() -> void:
	var skin := _make_material("skin", "#e0a77c", 0.75)
	var tunic := _make_material("tunic", "#226a72", 0.8)
	var tunic_light := _make_material("tunic_trim", "#3f9a91", 0.65)
	var leather := _make_material("leather", "#603c2a", 0.9)
	var bronze := _make_material("bronze", "#bd8741", 0.48, "#39250e")
	var gold := _make_material("gold", "#f1ca72", 0.38, "#674814")
	var cape_material := _make_material("cape", "#8e3340", 0.8)
	var boot_material := _make_material("boots", "#392b29", 0.85)
	var steel := _make_material("sword_steel", "#cbd9dc", 0.28, "#253337")
	var steel_edge := _make_material("sword_edge", "#f1f6e8", 0.22)
	var eye_material := _make_material("eyes", "#291e1b", 0.5)

	_add_sphere(_visual, "Torso", Vector3(0.0, 1.2, 0.0), Vector3(0.34, 0.49, 0.25), tunic)
	_add_box(_visual, "TunicTrim", Vector3(0.0, 0.91, 0.0), Vector3(0.48, 0.08, 0.32), tunic_light)
	_add_box(_visual, "LeatherBelt", Vector3(0.0, 1.0, -0.01), Vector3(0.48, 0.09, 0.32), leather)
	_add_box(_visual, "BeltBuckle", Vector3(0.0, 1.0, -0.18), Vector3(0.11, 0.11, 0.035), gold)
	_cape = _add_box(
		_visual, "ShortCape", Vector3(0.0, 1.25, 0.19), Vector3(0.5, 0.72, 0.09), cape_material
	)

	_add_sphere(_visual, "Head", Vector3(0.0, 1.89, -0.015), Vector3(0.255, 0.29, 0.245), skin)
	_add_sphere(
		_visual, "BronzeHelmet", Vector3(0.0, 2.11, 0.005), Vector3(0.29, 0.17, 0.27), bronze
	)
	_add_box(_visual, "HelmetBand", Vector3(0.0, 2.02, -0.01), Vector3(0.52, 0.065, 0.38), gold)
	_add_box(
		_visual, "HelmetCrest", Vector3(0.0, 2.29, 0.035), Vector3(0.1, 0.22, 0.09), cape_material
	)
	_add_sphere(
		_visual, "EyeLeft", Vector3(-0.085, 1.91, -0.235), Vector3(0.028, 0.04, 0.018), eye_material
	)
	_add_sphere(
		_visual, "EyeRight", Vector3(0.085, 1.91, -0.235), Vector3(0.028, 0.04, 0.018), eye_material
	)

	_left_leg = _add_limb_pivot(Vector3(-0.17, 0.7, 0.0), "LeftLeg", tunic, boot_material)
	_right_leg = _add_limb_pivot(Vector3(0.17, 0.7, 0.0), "RightLeg", tunic, boot_material)
	_left_arm = _add_limb_pivot(Vector3(-0.39, 1.48, 0.0), "LeftArm", skin, bronze)
	_right_arm = _add_limb_pivot(Vector3(0.39, 1.48, 0.0), "RightArm", skin, bronze)
	_left_arm.rotation.z = 0.12
	_right_arm.rotation.z = -0.12

	_sword_pivot = Node3D.new()
	_sword_pivot.name = "SwordPivot"
	_sword_pivot.position = Vector3(0.02, -0.14, -0.08)
	_right_arm.add_child(_sword_pivot)
	_add_box(
		_sword_pivot, "SwordGrip", Vector3(0.0, -0.17, 0.04), Vector3(0.09, 0.32, 0.09), leather
	)
	_add_box(_sword_pivot, "SwordPommel", Vector3(0.0, -0.35, 0.04), Vector3(0.14, 0.1, 0.13), gold)
	_add_box(
		_sword_pivot, "SwordGuard", Vector3(0.0, -0.015, 0.04), Vector3(0.38, 0.08, 0.12), bronze
	)
	_add_box(_sword_pivot, "SwordBlade", Vector3(0.0, 0.0, -0.49), Vector3(0.12, 0.08, 0.92), steel)
	_add_box(
		_sword_pivot,
		"SwordBrightEdge",
		Vector3(-0.055, 0.047, -0.49),
		Vector3(0.022, 0.012, 0.76),
		steel_edge
	)


func _add_limb_pivot(
	position: Vector3,
	limb_name: String,
	limb_material: StandardMaterial3D,
	boot_material: StandardMaterial3D
) -> Node3D:
	var pivot := Node3D.new()
	pivot.name = limb_name
	pivot.position = position
	_visual.add_child(pivot)
	_add_capsule(pivot, limb_name + "Mesh", Vector3(0.0, -0.24, 0.0), 0.125, 0.54, limb_material)
	if limb_name.ends_with("Leg"):
		_add_box(
			pivot,
			limb_name + "Boot",
			Vector3(0.0, -0.54, -0.045),
			Vector3(0.25, 0.18, 0.36),
			boot_material
		)
	else:
		_add_sphere(
			pivot,
			limb_name + "ShoulderGuard",
			Vector3(0.0, -0.025, 0.015),
			Vector3(0.2, 0.16, 0.2),
			boot_material
		)
	return pivot


func _add_box(
	parent: Node3D,
	node_name: String,
	position: Vector3,
	size: Vector3,
	material: StandardMaterial3D
) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = position
	instance.material_override = material
	parent.add_child(instance)
	return instance


func _add_sphere(
	parent: Node3D,
	node_name: String,
	position: Vector3,
	dimensions: Vector3,
	material: StandardMaterial3D
) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 16
	mesh.rings = 8
	instance.mesh = mesh
	instance.position = position
	instance.scale = dimensions
	instance.material_override = material
	parent.add_child(instance)
	return instance


func _add_capsule(
	parent: Node3D,
	node_name: String,
	position: Vector3,
	radius: float,
	height: float,
	material: StandardMaterial3D
) -> void:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	mesh.rings = 6
	instance.mesh = mesh
	instance.position = position
	instance.material_override = material
	parent.add_child(instance)


func _make_material(
	key: String, color: String, roughness: float, emission_color: String = ""
) -> StandardMaterial3D:
	if _model_materials.has(key):
		return _model_materials[key] as StandardMaterial3D
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color)
	material.roughness = roughness
	if not emission_color.is_empty():
		material.emission_enabled = true
		material.emission = Color(emission_color)
		material.emission_energy_multiplier = 0.28
	_model_materials[key] = material
	return material


func _ensure_input_actions() -> void:
	for action_name in KEY_ACTIONS:
		if not InputMap.has_action(action_name):
			InputMap.add_action(action_name)
		var key_event := InputEventKey.new()
		key_event.physical_keycode = int(KEY_ACTIONS[action_name])
		var binding_exists := false
		for existing_event in InputMap.action_get_events(action_name):
			if (
				existing_event is InputEventKey
				and (existing_event as InputEventKey).physical_keycode == key_event.physical_keycode
			):
				binding_exists = true
				break
		if not binding_exists:
			InputMap.action_add_event(action_name, key_event)

	var has_mouse_attack := false
	for existing_event in InputMap.action_get_events("hero_attack"):
		if (
			existing_event is InputEventMouseButton
			and (existing_event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
		):
			has_mouse_attack = true
			break
	if not has_mouse_attack:
		var mouse_event := InputEventMouseButton.new()
		mouse_event.button_index = MOUSE_BUTTON_LEFT
		InputMap.action_add_event("hero_attack", mouse_event)
