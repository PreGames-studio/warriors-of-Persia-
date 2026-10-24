extends Node3D
## دشت باز سه‌بعدی کنار روستا، با چمن و بوته‌های کم‌تراکم و مسیرهای قابل‌گسترش.

const HERO_SCENE: PackedScene = preload("res://scenes/units/Hero3D.tscn")
const DUMMY_SCENE: PackedScene = preload("res://scenes/units/TrainingDummy3D.tscn")

@export_range(50, 250, 10) var field_size: float = 140.0
@export_range(200, 2500, 100) var grass_blade_count: int = 1100
@export_range(30, 180, 10) var shrub_count: int = 100

var _hero: Hero3D
var _status_label: Label
var _touch_buttons: Dictionary = {}
var _materials: Dictionary = {}
var _random := RandomNumberGenerator.new()


func _ready() -> void:
	_random.seed = 2319
	_build_sky_and_sun()
	_build_ground()
	_build_trails()
	_build_distant_greenery()
	_build_grass()
	_build_shrubs()
	_build_village_edge()
	_spawn_hero()
	_spawn_training_targets()
	_build_mobile_hud()


func _build_sky_and_sun() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#9bc6dc")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#e8f2d8")
	environment.ambient_light_energy = 0.72
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "OpenFieldSun"
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_color = Color("#fff0ca")
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)


func _build_ground() -> void:
	var grass_material := _material("#61934e", 1.0)
	var ground_body := StaticBody3D.new()
	ground_body.name = "FieldGround"
	ground_body.position = Vector3(0, -0.12, 0)
	var collision := CollisionShape3D.new()
	var ground_shape := BoxShape3D.new()
	ground_shape.size = Vector3(field_size + 6.0, 0.24, field_size + 6.0)
	collision.shape = ground_shape
	ground_body.add_child(collision)
	add_child(ground_body)
	_add_box(
		"Grassland",
		Vector3(0, -0.14, 0),
		Vector3(field_size + 6.0, 0.18, field_size + 6.0),
		grass_material
	)

	# حاشیه‌ی چمن‌های روشن و تیره برای شکستن سطح یکنواخت دشت.
	var patch_colors: Array[String] = ["#679a52", "#5a8d49", "#6d9c55", "#5d914e"]
	for index in range(32):
		var x := _random.randf_range(-field_size * 0.46, field_size * 0.46)
		var z := _random.randf_range(-field_size * 0.46, field_size * 0.46)
		if _is_near_trail(Vector2(x, z), 7.0):
			continue
		var dimensions := Vector2(_random.randf_range(3.0, 8.0), _random.randf_range(3.0, 7.0))
		_add_box(
			"GrassColorPatch",
			Vector3(x, -0.035, z),
			Vector3(dimensions.x, 0.025, dimensions.y),
			_material(patch_colors[index % patch_colors.size()], 1.0)
		)

	_add_boundary_walls()


func _build_trails() -> void:
	var earth := _material("#aa8a5d", 0.98)
	var trail_edge := _material("#90744f", 1.0)
	var stone := _material("#d0bd91", 0.93)
	var main_start := Vector2(0, 61)
	var main_end := Vector2(0, -65)
	_add_trail_segment("VillageTrailEdge", main_start, main_end, 5.2, 0.05, trail_edge)
	_add_trail_segment("VillageTrail", main_start, main_end, 4.4, 0.055, earth)

	for index in range(38):
		var z := 56.0 - index * 3.05
		var width := _random.randf_range(1.25, 3.1)
		var x := _random.randf_range(-1.25, 1.25)
		_add_box(
			"PathStone",
			Vector3(x, 0.02, z),
			Vector3(width, 0.045, _random.randf_range(0.6, 1.4)),
			stone
		)

	# شاخه‌های مسیر تا لبه‌ی دشت ادامه پیدا می‌کنند تا جا برای نواحی بعدی بماند.
	_add_trail_segment("NorthwestTrail", Vector2(0, -20), Vector2(-49, -66), 3.6, 0.045, earth)
	_add_trail_segment("NortheastTrail", Vector2(0, -20), Vector2(49, -66), 3.6, 0.045, earth)
	_add_trail_segment("WesternTrail", Vector2(-2, 13), Vector2(-66, 30), 3.4, 0.04, earth)

	for position in [Vector2(-48, -60), Vector2(48, -60), Vector2(-60, 28)]:
		_add_trail_marker(position)


func _build_distant_greenery() -> void:
	var hill_materials: Array[StandardMaterial3D] = [
		_material("#4f7d45", 1.0), _material("#58864a", 1.0), _material("#668f50", 1.0)
	]
	for index in range(22):
		var side := -1.0 if index % 2 == 0 else 1.0
		var z := -70.0 + float(index / 2) * 6.4
		var x := side * (66.0 + _random.randf_range(-3.0, 4.0))
		var hill := MeshInstance3D.new()
		hill.name = "SoftDistantHill"
		var mesh := SphereMesh.new()
		mesh.radius = 1.0
		mesh.height = 2.0
		mesh.radial_segments = 8
		mesh.rings = 4
		hill.mesh = mesh
		hill.position = Vector3(x, -0.25, z)
		hill.scale = Vector3(_random.randf_range(5.0, 9.0), 1.1, _random.randf_range(5.0, 11.0))
		hill.material_override = hill_materials[index % hill_materials.size()]
		add_child(hill)


func _build_grass() -> void:
	var blade_mesh := BoxMesh.new()
	blade_mesh.size = Vector3(0.045, 0.23, 0.035)
	var green_materials: Array[StandardMaterial3D] = [
		_material("#76a957", 0.95), _material("#83b35e", 0.95), _material("#4e8045", 0.95)
	]
	var instances_by_color: Array[Array] = [[], [], []]
	for index in range(grass_blade_count):
		var position := Vector2(
			_random.randf_range(-field_size * 0.47, field_size * 0.47),
			_random.randf_range(-field_size * 0.47, field_size * 0.47)
		)
		if _is_near_trail(position, 3.5):
			continue
		var scale_factor := _random.randf_range(0.55, 1.45)
		var rotation := _random.randf_range(0.0, TAU)
		var basis := Basis(Vector3.UP, rotation).scaled(Vector3.ONE * scale_factor)
		var transform := Transform3D(basis, Vector3(position.x, 0.11 * scale_factor, position.y))
		instances_by_color[index % instances_by_color.size()].append(transform)

	for material_index in range(instances_by_color.size()):
		_add_multimesh(
			"GrassBlades%d" % material_index,
			blade_mesh,
			instances_by_color[material_index],
			green_materials[material_index]
		)


func _build_shrubs() -> void:
	var bush_mesh := SphereMesh.new()
	bush_mesh.radius = 1.0
	bush_mesh.height = 2.0
	bush_mesh.radial_segments = 7
	bush_mesh.rings = 4
	var bush_materials: Array[StandardMaterial3D] = [
		_material("#397443", 0.95), _material("#4c8546", 0.95), _material("#5a9149", 0.95)
	]
	var shrubs_by_color: Array[Array] = [[], [], []]
	for index in range(shrub_count):
		var position := Vector2(
			_random.randf_range(-field_size * 0.45, field_size * 0.45),
			_random.randf_range(-field_size * 0.45, field_size * 0.45)
		)
		if _is_near_trail(position, 7.2) or position.distance_to(Vector2(0, 40)) < 9.0:
			continue
		var radius := _random.randf_range(0.45, 0.95)
		var height := radius * _random.randf_range(0.72, 1.0)
		var color_index := index % shrubs_by_color.size()
		var bush_basis := Basis.IDENTITY.scaled(Vector3(radius, height, radius))
		var bush_transform := Transform3D(bush_basis, Vector3(position.x, height * 0.9, position.y))
		shrubs_by_color[color_index].append(bush_transform)
		_add_bush_collision(position, radius)

	for material_index in range(shrubs_by_color.size()):
		_add_multimesh(
			"FieldShrubs%d" % material_index,
			bush_mesh,
			shrubs_by_color[material_index],
			bush_materials[material_index]
		)


func _build_village_edge() -> void:
	var plaster := _material("#c6a477", 0.92)
	var terracotta := _material("#8e4f3c", 0.88)
	var wood := _material("#68462f", 0.9)
	var bronze := _material("#d2ae67", 0.55)
	var gate_z := 66.0
	_add_box("VillageGateLeft", Vector3(-3.4, 2.0, gate_z), Vector3(0.65, 4.0, 0.7), plaster)
	_add_box("VillageGateRight", Vector3(3.4, 2.0, gate_z), Vector3(0.65, 4.0, 0.7), plaster)
	_add_box("VillageGateLintel", Vector3(0, 4.1, gate_z), Vector3(7.5, 0.65, 0.9), terracotta)
	_add_box("GateWoodDoorLeft", Vector3(-1.45, 1.8, gate_z - 0.1), Vector3(2.2, 3.5, 0.22), wood)
	_add_box("GateWoodDoorRight", Vector3(1.45, 1.8, gate_z - 0.1), Vector3(2.2, 3.5, 0.22), wood)
	_add_box("GateInsignia", Vector3(0, 4.2, gate_z - 0.52), Vector3(0.65, 0.65, 0.12), bronze)
	_add_box("VillageHouseLeft", Vector3(-9.0, 2.2, 72.0), Vector3(7.0, 4.4, 6.0), plaster)
	_add_box("VillageRoofLeft", Vector3(-9.0, 4.65, 72.0), Vector3(8.0, 0.6, 7.0), terracotta)
	_add_box("VillageHouseRight", Vector3(10.0, 1.9, 75.0), Vector3(6.0, 3.8, 6.0), plaster)
	_add_box("VillageRoofRight", Vector3(10.0, 4.0, 75.0), Vector3(7.0, 0.55, 7.0), terracotta)

	var village_label := Label3D.new()
	village_label.position = Vector3(0, 5.25, gate_z - 0.8)
	village_label.text = "روستا"
	village_label.font_size = 64
	village_label.outline_size = 9
	village_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	village_label.modulate = Color("#fff0c7")
	add_child(village_label)


func _spawn_hero() -> void:
	_hero = HERO_SCENE.instantiate() as Hero3D
	_hero.name = "PersianSwordHero"
	_hero.position = Vector3(0, 0.02, 43)
	_hero.sword_hit.connect(_on_sword_hit)
	add_child(_hero)


func _spawn_training_targets() -> void:
	for target_position in [Vector3(-5.8, 0, -8.0), Vector3(6.0, 0, -17.0)]:
		var dummy := DUMMY_SCENE.instantiate() as TrainingDummy3D
		dummy.position = target_position
		add_child(dummy)


func _build_mobile_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "MobileHUD"
	layer.layer = 10
	add_child(layer)

	var backdrop := ColorRect.new()
	backdrop.position = Vector2(28, 24)
	backdrop.size = Vector2(610, 112)
	backdrop.color = Color(0.05, 0.11, 0.1, 0.74)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(backdrop)

	var title := Label.new()
	title.position = Vector2(48, 29)
	title.size = Vector2(560, 36)
	title.text = "دشت سبز کنار روستا"
	title.add_theme_font_size_override("font_size", 25)
	title.add_theme_color_override("font_color", Color("#f5d995"))
	layer.add_child(title)

	var hint := Label.new()
	hint.position = Vector2(48, 68)
	hint.size = Vector2(560, 55)
	hint.text = "حرکت و دویدن: دکمه‌های چپ    شمشیر: دکمه‌ی راست\nچرخش دوربین: کشیدن انگشت روی صفحه"
	hint.add_theme_font_size_override("font_size", 16)
	hint.add_theme_color_override("font_color", Color("#e4eee5"))
	layer.add_child(hint)

	_status_label = Label.new()
	_status_label.anchor_left = 0.5
	_status_label.anchor_right = 0.5
	_status_label.anchor_top = 1.0
	_status_label.anchor_bottom = 1.0
	_status_label.offset_left = -290
	_status_label.offset_right = 290
	_status_label.offset_top = -54
	_status_label.offset_bottom = -24
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 20)
	_status_label.add_theme_color_override("font_color", Color("#fff0bf"))
	_status_label.text = "چمنزار باز است؛ مسیرها به جایگاه‌های آینده می‌رسند."
	layer.add_child(_status_label)

	_add_touch_button(layer, "◀", "hero_move_left", Vector2(74, 66))
	_add_touch_button(layer, "▶", "hero_move_right", Vector2(74, 66))
	_add_touch_button(layer, "▲", "hero_move_forward", Vector2(74, 66))
	_add_touch_button(layer, "▼", "hero_move_back", Vector2(74, 66))
	_add_touch_button(layer, "دویدن", "hero_run", Vector2(112, 64))
	_add_touch_button(layer, "شمشیر", "hero_attack", Vector2(130, 100))
	_layout_touch_buttons()
	get_viewport().size_changed.connect(_layout_touch_buttons)


func _add_touch_button(layer: CanvasLayer, text: String, action: String, size: Vector2) -> void:
	var button := Button.new()
	button.text = text
	button.size = size
	button.add_theme_font_size_override("font_size", 22 if text.length() <= 2 else 18)
	button.add_theme_color_override("font_color", Color("#fff0cf"))
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.08, 0.14, 0.16, 0.74)
	normal.border_color = Color("#d9b86d")
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(16)
	button.add_theme_stylebox_override("normal", normal)
	var pressed := StyleBoxFlat.new()
	pressed.bg_color = Color(0.25, 0.47, 0.42, 0.9)
	pressed.border_color = Color("#f3d793")
	pressed.set_border_width_all(3)
	pressed.set_corner_radius_all(16)
	button.add_theme_stylebox_override("pressed", pressed)
	button.button_down.connect(func() -> void: Input.action_press(action))
	button.button_up.connect(func() -> void: Input.action_release(action))
	_touch_buttons[action] = button
	layer.add_child(button)


func _layout_touch_buttons() -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var width := viewport_size.x
	var height := viewport_size.y
	_touch_buttons["hero_move_left"].position = Vector2(44, height - 172)
	_touch_buttons["hero_move_right"].position = Vector2(132, height - 172)
	_touch_buttons["hero_move_forward"].position = Vector2(88, height - 244)
	_touch_buttons["hero_move_back"].position = Vector2(88, height - 100)
	_touch_buttons["hero_run"].position = Vector2(224, height - 172)
	_touch_buttons["hero_attack"].position = Vector2(width - 184, height - 174)


func _add_trail_marker(position: Vector2) -> void:
	var stone := _material("#8d805f", 0.9)
	var marker := _add_box(
		"TrailMarker", Vector3(position.x, 0.65, position.y), Vector3(0.55, 1.3, 0.55), stone
	)
	marker.rotation.y = _random.randf_range(-0.2, 0.2)


func _add_trail_segment(
	node_name: String,
	start: Vector2,
	finish: Vector2,
	width: float,
	thickness: float,
	material: StandardMaterial3D
) -> void:
	var segment := MeshInstance3D.new()
	segment.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = Vector3(start.distance_to(finish), thickness, width)
	segment.mesh = mesh
	var midpoint := (start + finish) * 0.5
	segment.position = Vector3(midpoint.x, thickness * 0.5 + 0.005, midpoint.y)
	segment.rotation.y = -atan2(finish.y - start.y, finish.x - start.x)
	segment.material_override = material
	add_child(segment)


func _add_bush_collision(position: Vector2, radius: float) -> void:
	var bush_body := StaticBody3D.new()
	bush_body.name = "BushCollision"
	bush_body.position = Vector3(position.x, radius * 0.48, position.y)
	var collision := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = radius * 0.85
	collision.shape = shape
	bush_body.add_child(collision)
	add_child(bush_body)


func _add_boundary_walls() -> void:
	# محدوده‌ی نامرئی موقت است؛ در توسعه‌ی جهان می‌توان این لبه‌ها را گسترش داد.
	var extent := field_size * 0.5 + 3.0
	_add_wall(Vector3(0, 2.0, -extent), Vector3(field_size + 6.0, 4.0, 1.0))
	_add_wall(Vector3(0, 2.0, extent), Vector3(field_size + 6.0, 4.0, 1.0))
	_add_wall(Vector3(-extent, 2.0, 0), Vector3(1.0, 4.0, field_size + 6.0))
	_add_wall(Vector3(extent, 2.0, 0), Vector3(1.0, 4.0, field_size + 6.0))


func _add_wall(position: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = position
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	add_child(body)


func _add_box(
	node_name: String, position: Vector3, size: Vector3, material: StandardMaterial3D
) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = position
	mesh_instance.material_override = material
	add_child(mesh_instance)
	return mesh_instance


func _add_multimesh(
	node_name: String, mesh: Mesh, transforms: Array, material: StandardMaterial3D
) -> void:
	if transforms.is_empty():
		return
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = mesh
	multimesh.instance_count = transforms.size()
	for index in range(transforms.size()):
		multimesh.set_instance_transform(index, transforms[index])
	var instance := MultiMeshInstance3D.new()
	instance.name = node_name
	instance.multimesh = multimesh
	instance.material_override = material
	add_child(instance)


func _is_near_trail(point: Vector2, margin: float) -> bool:
	if absf(point.x) < margin and point.y > -66.0 and point.y < 62.0:
		return true
	var northwest_distance := _distance_to_segment(point, Vector2(0, -20), Vector2(-49, -66))
	var northeast_distance := _distance_to_segment(point, Vector2(0, -20), Vector2(49, -66))
	var west_distance := _distance_to_segment(point, Vector2(-2, 13), Vector2(-66, 30))
	return minf(northwest_distance, minf(northeast_distance, west_distance)) < margin


func _distance_to_segment(point: Vector2, start: Vector2, finish: Vector2) -> float:
	var segment := finish - start
	var weight := clampf(
		(point - start).dot(segment) / maxf(segment.length_squared(), 0.001), 0.0, 1.0
	)
	return point.distance_to(start + segment * weight)


func _material(color: String, roughness: float) -> StandardMaterial3D:
	if _materials.has(color):
		return _materials[color] as StandardMaterial3D
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color)
	material.roughness = roughness
	_materials[color] = material
	return material


func _on_sword_hit(_target: Node, damage: float) -> void:
	_status_label.text = "ضربه‌ی شمشیر! آسیب: %d" % roundi(damage)
