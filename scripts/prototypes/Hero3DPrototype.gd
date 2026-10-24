extends Node3D
## میدان آزمایشی سه‌بعدی برای پیاده‌سازی تدریجی بازی و آزمایش شمشیرزن.

const HERO_SCENE: PackedScene = preload("res://scenes/units/Hero3D.tscn")
const DUMMY_SCENE: PackedScene = preload("res://scenes/units/TrainingDummy3D.tscn")

var _hero: Hero3D
var _status_label: Label
var _materials: Dictionary = {}
var _touch_buttons: Dictionary = {}


func _ready() -> void:
	_build_lighting()
	_build_practice_yard()
	_spawn_hero()
	_spawn_targets()
	_build_hud()


func _build_lighting() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#a5c5d4")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#f5e7d2")
	environment.ambient_light_energy = 0.7
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "WarmAfternoonSun"
	sun.rotation_degrees = Vector3(-52, -32, 0)
	sun.light_color = Color("#ffe4bc")
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	add_child(sun)

	var fill := OmniLight3D.new()
	fill.position = Vector3(0, 5, 0)
	fill.light_color = Color("#b8dcff")
	fill.light_energy = 0.45
	fill.omni_range = 22.0
	add_child(fill)


func _build_practice_yard() -> void:
	var grass := _material("#4c8551", 0.98)
	var edge_grass := _material("#376944", 0.95)
	var sand := _material("#b69a6e", 0.9)
	var sand_light := _material("#d0b98e", 0.85)
	var wood := _material("#775033", 0.92)
	var trim := _material("#d0a95d", 0.52)

	var floor_body := StaticBody3D.new()
	floor_body.name = "ArenaFloor"
	floor_body.position = Vector3(0, -0.12, 0)
	var floor_shape := CollisionShape3D.new()
	var floor_collision := BoxShape3D.new()
	floor_collision.size = Vector3(42, 0.24, 42)
	floor_shape.shape = floor_collision
	floor_body.add_child(floor_shape)
	add_child(floor_body)
	_add_mesh_box("ArenaGrass", Vector3(0, -0.12, 0), Vector3(42, 0.16, 42), grass)
	_add_mesh_box("PracticeSquare", Vector3(0, 0.005, -1), Vector3(13, 0.04, 13), sand)
	_add_mesh_box("Walkway", Vector3(0, 0.025, 8), Vector3(3.2, 0.035, 11), sand_light)

	# نشانه‌گذاری ساده‌ی میدان و چند ستون کاهگلی برای حس فضای روستایی.
	for side in [-1.0, 1.0]:
		for depth in [-1.0, 1.0]:
			var post_position := Vector3(side * 7.5, 0.8, depth * 7.5)
			_add_mesh_box("ClayPillar", post_position, Vector3(0.55, 1.6, 0.55), wood)
			_add_mesh_box(
				"PillarCap", post_position + Vector3.UP * 0.87, Vector3(0.76, 0.16, 0.76), trim
			)

	# دیواره‌های کوتاه دور میدان، با برخورد فیزیکی.
	_add_barrier(Vector3(0, 0.55, -11), Vector3(21, 1.1, 0.45), wood)
	_add_barrier(Vector3(0, 0.55, 11), Vector3(21, 1.1, 0.45), wood)
	_add_barrier(Vector3(-11, 0.55, 0), Vector3(0.45, 1.1, 21), wood)
	_add_barrier(Vector3(11, 0.55, 0), Vector3(0.45, 1.1, 21), wood)

	for index in range(11):
		var stone_position := Vector3(-4.0 + index * 0.8, 0.055, 4.8)
		_add_mesh_box("PathStone", stone_position, Vector3(0.62, 0.04, 0.62), trim)


func _spawn_hero() -> void:
	_hero = HERO_SCENE.instantiate() as Hero3D
	_hero.name = "PersianSwordHero"
	_hero.position = Vector3(0, 0.02, 6.3)
	_hero.sword_hit.connect(_on_sword_hit)
	add_child(_hero)


func _spawn_targets() -> void:
	for position_3d in [Vector3(0, 0, -3.8), Vector3(-3.8, 0, -5.0), Vector3(3.8, 0, -5.0)]:
		var dummy := DUMMY_SCENE.instantiate() as TrainingDummy3D
		dummy.position = position_3d
		add_child(dummy)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "PrototypeHUD"
	layer.layer = 10
	add_child(layer)

	var backdrop := ColorRect.new()
	backdrop.position = Vector2(22, 20)
	backdrop.size = Vector2(635, 130)
	backdrop.color = Color(0.06, 0.10, 0.12, 0.78)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(backdrop)

	var title := Label.new()
	title.position = Vector2(42, 27)
	title.size = Vector2(590, 38)
	title.text = "شمشیرزن پارسی • نمونه‌ی سه‌بعدی"
	title.add_theme_font_size_override("font_size", 25)
	title.add_theme_color_override("font_color", Color("#f5d995"))
	layer.add_child(title)

	var controls := Label.new()
	controls.position = Vector2(42, 68)
	controls.size = Vector2(590, 67)
	controls.text = (
		"حرکت و دویدن: دکمه‌های لمسی سمت چپ    شمشیر: دکمه‌ی سمت راست\n"
		+ "چرخش دوربین: کشیدن انگشت روی صفحه"
	)
	controls.add_theme_font_size_override("font_size", 17)
	controls.add_theme_color_override("font_color", Color("#e4eee5"))
	layer.add_child(controls)

	_status_label = Label.new()
	_status_label.anchor_left = 0.5
	_status_label.anchor_right = 0.5
	_status_label.anchor_top = 1.0
	_status_label.anchor_bottom = 1.0
	_status_label.offset_left = -300
	_status_label.offset_right = 300
	_status_label.offset_top = -82
	_status_label.offset_bottom = -42
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 23)
	_status_label.add_theme_color_override("font_color", Color("#fff0bf"))
	layer.add_child(_status_label)
	_status_label.text = "سه هدف تمرینی آماده‌اند؛ نزدیک شو و ضربه بزن!"

	var crosshair := Label.new()
	crosshair.anchor_left = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.offset_left = -10
	crosshair.offset_right = 10
	crosshair.offset_top = -16
	crosshair.offset_bottom = 16
	crosshair.text = "+"
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	crosshair.add_theme_font_size_override("font_size", 22)
	crosshair.add_theme_color_override("font_color", Color(1, 0.93, 0.72, 0.82))
	layer.add_child(crosshair)

	# کنترل‌های اصلی لمسی: خوشه‌ی حرکت و دویدن در چپ، ضربه در راست.
	_add_action_button(layer, "◀", "hero_move_left", Vector2.ZERO, Vector2(74, 66))
	_add_action_button(layer, "▶", "hero_move_right", Vector2.ZERO, Vector2(74, 66))
	_add_action_button(layer, "▲", "hero_move_forward", Vector2.ZERO, Vector2(74, 66))
	_add_action_button(layer, "▼", "hero_move_back", Vector2.ZERO, Vector2(74, 66))
	_add_action_button(layer, "دویدن", "hero_run", Vector2.ZERO, Vector2(112, 64))
	_add_action_button(layer, "شمشیر", "hero_attack", Vector2.ZERO, Vector2(130, 100))
	_layout_touch_controls()
	get_viewport().size_changed.connect(_layout_touch_controls)


func _layout_touch_controls() -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var height := viewport_size.y
	var width := viewport_size.x
	_touch_buttons["hero_move_left"].position = Vector2(44, height - 172)
	_touch_buttons["hero_move_right"].position = Vector2(132, height - 172)
	_touch_buttons["hero_move_forward"].position = Vector2(88, height - 244)
	_touch_buttons["hero_move_back"].position = Vector2(88, height - 100)
	_touch_buttons["hero_run"].position = Vector2(224, height - 172)
	_touch_buttons["hero_attack"].position = Vector2(width - 184, height - 174)


func _add_action_button(
	layer: CanvasLayer,
	button_text: String,
	action_name: String,
	position: Vector2,
	button_size: Vector2
) -> void:
	var button := Button.new()
	button.text = button_text
	button.position = position
	button.size = button_size
	_touch_buttons[action_name] = button
	button.add_theme_font_size_override("font_size", 22 if button_text.length() <= 2 else 18)
	button.add_theme_color_override("font_color", Color("#fff0cf"))
	var normal_style := StyleBoxFlat.new()
	normal_style.bg_color = Color(0.08, 0.14, 0.16, 0.74)
	normal_style.border_color = Color("#d9b86d")
	normal_style.set_border_width_all(2)
	normal_style.set_corner_radius_all(16)
	button.add_theme_stylebox_override("normal", normal_style)
	var pressed_style := StyleBoxFlat.new()
	pressed_style.bg_color = Color(0.25, 0.47, 0.42, 0.9)
	pressed_style.border_color = Color("#f3d793")
	pressed_style.set_border_width_all(3)
	pressed_style.set_corner_radius_all(16)
	button.add_theme_stylebox_override("pressed", pressed_style)
	button.button_down.connect(func() -> void: Input.action_press(action_name))
	button.button_up.connect(func() -> void: Input.action_release(action_name))
	layer.add_child(button)


func _on_sword_hit(_target: Node, damage: float) -> void:
	_status_label.text = "ضربه‌ی شمشیر! آسیب: %d" % roundi(damage)


func _add_barrier(position_3d: Vector3, size: Vector3, material: StandardMaterial3D) -> void:
	var body := StaticBody3D.new()
	body.position = position_3d
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	body.add_child(collider)
	add_child(body)
	_add_mesh_box("YardBarrier", position_3d, size, material)


func _add_mesh_box(
	node_name: String, position_3d: Vector3, size: Vector3, material: StandardMaterial3D
) -> void:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = position_3d
	mesh_instance.material_override = material
	add_child(mesh_instance)


func _material(color_hex: String, roughness: float) -> StandardMaterial3D:
	if _materials.has(color_hex):
		return _materials[color_hex] as StandardMaterial3D
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color_hex)
	material.roughness = roughness
	_materials[color_hex] = material
	return material
