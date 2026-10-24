extends Node2D
## پیش‌نمایش ۳بعدی از نقشه‌ی روستا در یک SubViewport؛ حرکت و برخورد بازی دوبعدی می‌ماند.
## این راهکار ظاهر سه‌بعدی را اضافه می‌کند و سازگاری قهرمانان و سیستم‌های فعلی را حفظ می‌کند.

const SHOP_SCRIPT: Script = preload("res://scripts/world/ShopZone.gd")
const MAP_SIZE := Vector2(2400.0, 1600.0)
const HUB := Vector2(1200.0, 800.0)
const HUB_HALF_SIZE := Vector2(360.0, 265.0)
const LANE_NAMES: Array[String] = [
	"کوچه سپیدار",
	"کوچه زرگرها",
	"کوچه انارستان",
	"کوچه آب‌انبار",
	"کوچه نخلستان",
	"کوچه نانواها",
	"کوچه گل‌فروش‌ها",
	"کوچه کاهگلی"
]
const SHOP_NAMES: Array[String] = [
	"عطاری و ادویه",
	"زرگری",
	"نانوایی",
	"پارچه‌فروشی",
	"داروخانه گیاهی",
	"آهنگری",
	"گل‌فروشی",
	"مهمان‌خانه"
]
const AWNING_COLORS: Array[Color] = [
	Color("#a94d3e"), Color("#c88c42"), Color("#477c68"), Color("#755b91")
]

var _viewport: SubViewport
var _art_root: Node3D
var _materials: Dictionary = {}


func _ready() -> void:
	_build_3d_viewport()
	_build_3d_village()
	_build_2d_interactions()
	_build_boundary_walls()


func _build_3d_viewport() -> void:
	_viewport = SubViewport.new()
	_viewport.name = "Village3DViewport"
	_viewport.size = Vector2i(1200, 800)
	_viewport.transparent_bg = false
	_viewport.msaa_3d = Viewport.MSAA_2X
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(_viewport)

	var map_texture := Sprite2D.new()
	map_texture.name = "ThreeDimensionalVillage"
	map_texture.texture = _viewport.get_texture()
	map_texture.position = HUB
	map_texture.scale = Vector2(2.0, 2.0)
	map_texture.z_index = -10
	add_child(map_texture)

	_art_root = Node3D.new()
	_art_root.name = "Village3D"
	_viewport.add_child(_art_root)

	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#5c9a58")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#fff0d6")
	environment.ambient_light_energy = 0.72
	world_environment.environment = environment
	_art_root.add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "WarmSun"
	sun.rotation_degrees = Vector3(-52.0, -28.0, 0.0)
	sun.light_color = Color("#ffe2aa")
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	_art_root.add_child(sun)

	var camera := Camera3D.new()
	camera.name = "VillageTopDownCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 1600.0
	camera.position = Vector3(HUB.x, 1800.0, HUB.y - 300.0)
	camera.look_at(Vector3(HUB.x, 0.0, HUB.y), Vector3(0.0, 0.0, -1.0))
	camera.current = true
	_art_root.add_child(camera)


func _build_3d_village() -> void:
	var grass := _material("grass", "#5c9a58", 1.0)
	var garden_material := _material("garden", "#75a85b", 1.0)
	var lane_border := _material("lane_border", "#8b704f", 1.0)
	var lane_stone := _material("lane_stone", "#c9ad7c", 1.0)
	var plaza_border := _material("plaza_border", "#ad8e63", 1.0)
	var plaza_stone := _material("plaza_stone", "#d9c69d", 1.0)
	var tile_a := _material("tile_a", "#c8b58e", 1.0)
	var tile_b := _material("tile_b", "#d2c09a", 1.0)

	_add_box("Meadow", Vector3(1200, -18, 800), Vector3(2400, 36, 1600), grass)
	for garden in [
		Rect2(90, 100, 360, 220),
		Rect2(1940, 110, 350, 230),
		Rect2(100, 1280, 360, 220),
		Rect2(1940, 1270, 350, 220),
		Rect2(510, 90, 300, 125),
		Rect2(1590, 1370, 310, 130)
	]:
		_add_box(
			"Garden",
			Vector3(
				garden.position.x + garden.size.x / 2.0, 1, garden.position.y + garden.size.y / 2.0
			),
			Vector3(garden.size.x, 2, garden.size.y),
			garden_material
		)
		_add_garden_rows(garden)

	_add_eight_alleys(lane_border, lane_stone)
	_add_plaza(plaza_border, plaza_stone, tile_a, tile_b)
	_add_houses_and_trees()
	_add_fountain()
	_add_eight_stalls()
	_add_3d_exit_portal()


func _add_eight_alleys(
	border_material: StandardMaterial3D, stone_material: StandardMaterial3D
) -> void:
	for lane_index in range(8):
		var angle := -PI / 2.0 + float(lane_index) * TAU / 8.0
		var direction := Vector2.RIGHT.rotated(angle)
		var start_distance := _ray_distance_to_rect(direction, HUB_HALF_SIZE) - 18.0
		var end_distance := _ray_distance_to_rect(direction, Vector2(1120.0, 720.0))
		var start := HUB + direction * start_distance
		var finish := HUB + direction * end_distance
		_add_road_segment("AlleyBorder%d" % lane_index, start, finish, 170.0, 7.0, border_material)
		_add_road_segment("AlleyStone%d" % lane_index, start, finish, 138.0, 8.0, stone_material)
		for marker_index in range(4):
			var marker_pos := HUB + direction * (120.0 + marker_index * 95.0)
			_add_box(
				"PavingMarker",
				Vector3(marker_pos.x, 8.5, marker_pos.y),
				Vector3(9, 1.5, 9),
				_material("paving_marker", "#eddaae", 0.95)
			)


func _add_plaza(
	border_material: StandardMaterial3D,
	floor_material: StandardMaterial3D,
	tile_a: StandardMaterial3D,
	tile_b: StandardMaterial3D
) -> void:
	_add_box("PlazaFoundation", Vector3(HUB.x, 8, HUB.y), Vector3(760, 12, 560), border_material)
	_add_box("CentralSquare", Vector3(HUB.x, 15, HUB.y), Vector3(730, 4, 530), floor_material)
	for row in range(5):
		for column in range(7):
			var x := HUB.x - 215.0 + column * 70.0
			var z := HUB.y - 135.0 + row * 58.0
			_add_box(
				"PlazaPaving",
				Vector3(x, 18, z),
				Vector3(64, 2, 52),
				tile_a if (row + column) % 2 == 0 else tile_b
			)


func _add_houses_and_trees() -> void:
	var homes: Array[Vector2] = [
		Vector2(440, 255),
		Vector2(720, 205),
		Vector2(1000, 175),
		Vector2(1400, 180),
		Vector2(1695, 220),
		Vector2(1980, 280),
		Vector2(2150, 480),
		Vector2(2175, 1120),
		Vector2(1970, 1320),
		Vector2(1690, 1380),
		Vector2(1400, 1410),
		Vector2(1000, 1410),
		Vector2(710, 1370),
		Vector2(410, 1300),
		Vector2(220, 1110),
		Vector2(215, 490)
	]
	for index in range(homes.size()):
		_add_house(homes[index], index)

	var trees: Array[Vector2] = [
		Vector2(125, 390),
		Vector2(330, 360),
		Vector2(640, 370),
		Vector2(910, 340),
		Vector2(1485, 350),
		Vector2(1780, 370),
		Vector2(2070, 390),
		Vector2(2280, 650),
		Vector2(2265, 950),
		Vector2(2050, 1200),
		Vector2(1770, 1220),
		Vector2(1480, 1245),
		Vector2(900, 1230),
		Vector2(620, 1200),
		Vector2(340, 1190),
		Vector2(120, 950),
		Vector2(130, 650),
		Vector2(440, 980),
		Vector2(1950, 690),
		Vector2(520, 600)
	]
	for tree_position in trees:
		_add_tree(tree_position)


func _add_house(center: Vector2, index: int) -> void:
	var x := center.x
	var z := center.y
	var walls := _material("house_walls_%d" % index, "#b9875f", 0.92)
	var roof_material := _material("clay_roof_%d" % index, "#874f3c", 0.95)
	var wood := _material("door_wood", "#654330", 0.95)
	var glass := _material("blue_glass", "#9bd5d1", 0.25, 0.2)
	_add_box("ClayHouseWalls", Vector3(x, 44, z), Vector3(132, 72, 86), walls)
	_add_box("ClayHouseRoof", Vector3(x, 83, z), Vector3(154, 14, 106), roof_material)
	_add_box("HouseDoor", Vector3(x, 28, z - 44), Vector3(28, 52, 5), wood)
	_add_box("HouseWindowLeft", Vector3(x - 45, 53, z - 45), Vector3(20, 17, 5), glass)
	_add_box("HouseWindowRight", Vector3(x + 45, 53, z - 45), Vector3(20, 17, 5), glass)
	# Sloped roof planes add a clear raised, dimensional roof silhouette from the top-down camera.
	_add_sloped_roof_panel(x, z, -1.0, roof_material)
	_add_sloped_roof_panel(x, z, 1.0, roof_material)


func _add_sloped_roof_panel(x: float, z: float, side: float, material: StandardMaterial3D) -> void:
	var roof := MeshInstance3D.new()
	roof.name = "PitchedRoof"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(150, 8, 58)
	roof.mesh = mesh
	roof.position = Vector3(x, 91, z + side * 27)
	roof.rotation.x = side * 0.34
	roof.material_override = material
	_art_root.add_child(roof)


func _add_tree(position_2d: Vector2) -> void:
	_add_2d_circle_blocker(position_2d, 18.0, "TreeBlocker")
	var trunk_mat := _material("tree_trunk", "#70472e", 1.0)
	var canopy_mat := _material("tree_canopy", "#37744a", 1.0)
	var highlight_mat := _material("tree_highlight", "#579352", 1.0)
	_add_cylinder("TreeTrunk", Vector3(position_2d.x, 22, position_2d.y), 10, 44, trunk_mat)
	_add_sphere(
		"TreeCanopy", Vector3(position_2d.x, 72, position_2d.y), Vector3(30, 36, 30), canopy_mat
	)
	_add_sphere(
		"TreeCanopyHighlight",
		Vector3(position_2d.x - 9, 91, position_2d.y - 7),
		Vector3(13, 12, 13),
		highlight_mat
	)


func _add_fountain() -> void:
	_add_cylinder(
		"FountainStoneBase",
		Vector3(HUB.x, 25, HUB.y),
		86,
		28,
		_material("fountain_base", "#816749", 0.9)
	)
	_add_cylinder(
		"FountainRim", Vector3(HUB.x, 42, HUB.y), 76, 9, _material("fountain_rim", "#e8d9b7", 0.35)
	)
	_add_cylinder(
		"HealingWater", Vector3(HUB.x, 48, HUB.y), 57, 5, _material("water", "#55bccc", 0.18, 0.35)
	)
	_add_cylinder(
		"FountainJet",
		Vector3(HUB.x, 60, HUB.y),
		18,
		22,
		_material("water_glint", "#b4eff0", 0.12, 0.5)
	)
	_add_2d_label(
		"چشمه‌ی شفا • میدان هشت‌کوچه",
		HUB + Vector2(0, 112),
		Vector2(300, 28),
		16,
		Color("#fff4d5"),
		2
	)


func _add_eight_stalls() -> void:
	for index in range(8):
		var angle := -PI / 2.0 + float(index) * TAU / 8.0
		var direction := Vector2.RIGHT.rotated(angle)
		var side := direction.orthogonal() * (150.0 if index % 2 == 0 else -150.0)
		var position_2d := HUB + direction * 590.0 + side
		_add_stall(position_2d, index)
		_add_shop_zone(position_2d, SHOP_NAMES[index], index)


func _add_stall(position_2d: Vector2, index: int) -> void:
	var x := position_2d.x
	var z := position_2d.y
	var awning := _material("awning_%d" % index, AWNING_COLORS[index % AWNING_COLORS.size()], 0.75)
	var counter_mat := _material("stall_wood", "#8c613d", 0.88)
	var post_mat := _material("stall_posts", "#68452f", 0.9)
	_add_box("ShopCounter", Vector3(x, 29, z), Vector3(112, 28, 48), counter_mat)
	_add_box("ColorfulShopAwning", Vector3(x, 69, z), Vector3(132, 13, 94), awning)
	for post_x in [-57.0, 57.0]:
		for post_z in [-38.0, 38.0]:
			_add_box(
				"AwningSupport", Vector3(x + post_x, 43, z + post_z), Vector3(7, 51, 7), post_mat
			)
	_add_box(
		"ShopSignBoard",
		Vector3(x, 88, z - 53),
		Vector3(124, 22, 4),
		_material("signboard", "#493c2d", 0.9)
	)


func _add_shop_zone(position_2d: Vector2, shop_name: String, index: int) -> void:
	var shop := Area2D.new()
	shop.name = "Shop_%02d" % (index + 1)
	shop.position = position_2d
	shop.set_script(SHOP_SCRIPT)

	var sign := Label.new()
	sign.name = "HintLabel"
	sign.position = Vector2(-93, -89)
	sign.size = Vector2(186, 24)
	sign.text = shop_name + " • فروشگاه"
	sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sign.add_theme_color_override("font_color", Color("#fff0bd"))
	sign.add_theme_color_override("font_outline_color", Color("#39291f"))
	sign.add_theme_constant_override("outline_size", 4)
	sign.add_theme_font_size_override("font_size", 13)
	shop.add_child(sign)

	var shape := CollisionShape2D.new()
	shape.name = "CollisionShape2D"
	var circle := CircleShape2D.new()
	circle.radius = 78.0
	shape.shape = circle
	shop.add_child(shape)
	add_child(shop)


func _add_3d_exit_portal() -> void:
	var portal_mat := _material("portal_glow", "#58d7ec", 0.16, 0.5)
	_add_cylinder(
		"WorldGateStone", Vector3(1200, 8, 1480), 78, 13, _material("portal_base", "#244c5a", 0.35)
	)
	_add_torus("WorldGateRing", Vector3(1200, 29, 1480), 58, 10, portal_mat)


func _build_2d_interactions() -> void:
	for lane_index in range(8):
		var angle := -PI / 2.0 + float(lane_index) * TAU / 8.0
		var direction := Vector2.RIGHT.rotated(angle)
		_add_2d_label(
			LANE_NAMES[lane_index],
			HUB + direction * 455.0,
			Vector2(176, 28),
			15,
			Color("#fff1c8"),
			2
		)

	var house_positions: Array[Vector2] = [
		Vector2(440, 255),
		Vector2(720, 205),
		Vector2(1000, 175),
		Vector2(1400, 180),
		Vector2(1695, 220),
		Vector2(1980, 280),
		Vector2(2150, 480),
		Vector2(2175, 1120),
		Vector2(1970, 1320),
		Vector2(1690, 1380),
		Vector2(1400, 1410),
		Vector2(1000, 1410),
		Vector2(710, 1370),
		Vector2(410, 1300),
		Vector2(220, 1110),
		Vector2(215, 490)
	]
	for house_position in house_positions:
		_add_2d_blocker(house_position, Vector2(112, 64), "HouseBlocker")


func _add_2d_label(
	text: String, center: Vector2, dimensions: Vector2, font_size: int, color: Color, z: int
) -> void:
	var label := Label.new()
	label.position = center - dimensions * 0.5
	label.size = dimensions
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.z_index = z
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", Color("#3d3325"))
	label.add_theme_constant_override("outline_size", 4)
	label.add_theme_font_size_override("font_size", font_size)
	add_child(label)


func _add_2d_blocker(center: Vector2, size: Vector2, node_name: String) -> void:
	var body := StaticBody2D.new()
	body.name = node_name
	body.position = center
	var shape_node := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)


func _add_2d_circle_blocker(center: Vector2, radius: float, node_name: String) -> void:
	var body := StaticBody2D.new()
	body.name = node_name
	body.position = center
	var shape_node := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = radius
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)


func _build_boundary_walls() -> void:
	var wall_root := StaticBody2D.new()
	wall_root.name = "BoundaryWalls"
	add_child(wall_root)
	_add_wall(wall_root, Vector2(1200, 18), Vector2(2400, 36), "NorthWall")
	_add_wall(wall_root, Vector2(1200, 1582), Vector2(2400, 36), "SouthWall")
	_add_wall(wall_root, Vector2(18, 800), Vector2(36, 1600), "WestWall")
	_add_wall(wall_root, Vector2(2382, 800), Vector2(36, 1600), "EastWall")


func _add_wall(parent: Node2D, center: Vector2, wall_size: Vector2, node_name: String) -> void:
	var collider := CollisionShape2D.new()
	collider.name = node_name
	collider.position = center
	var shape := RectangleShape2D.new()
	shape.size = wall_size
	collider.shape = shape
	parent.add_child(collider)


func _add_road_segment(
	node_name: String,
	start: Vector2,
	finish: Vector2,
	width: float,
	height: float,
	material: StandardMaterial3D
) -> void:
	var segment := MeshInstance3D.new()
	segment.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = Vector3(start.distance_to(finish), height, width)
	segment.mesh = mesh
	var midpoint := (start + finish) * 0.5
	segment.position = Vector3(midpoint.x, height * 0.5, midpoint.y)
	segment.rotation.y = -atan2(finish.y - start.y, finish.x - start.x)
	segment.material_override = material
	_art_root.add_child(segment)


func _add_garden_rows(rect: Rect2) -> void:
	var row_material := _material("garden_rows", "#699a51", 1.0)
	for index in range(5):
		var x := rect.position.x + 35 + index * 62
		if x < rect.end.x - 12:
			_add_box(
				"GardenRow",
				Vector3(x, 2.5, rect.position.y + rect.size.y * 0.5),
				Vector3(5, 1.5, rect.size.y - 36),
				row_material
			)


func _add_box(
	node_name: String, position_3d: Vector3, size: Vector3, material: StandardMaterial3D
) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = position_3d
	instance.material_override = material
	_art_root.add_child(instance)
	return instance


func _add_cylinder(
	node_name: String,
	position_3d: Vector3,
	radius: float,
	height: float,
	material: StandardMaterial3D
) -> void:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 24
	instance.mesh = mesh
	instance.position = position_3d
	instance.material_override = material
	_art_root.add_child(instance)


func _add_sphere(
	node_name: String, position_3d: Vector3, dimensions: Vector3, material: StandardMaterial3D
) -> void:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 16
	mesh.rings = 8
	instance.mesh = mesh
	instance.position = position_3d
	instance.scale = dimensions
	instance.material_override = material
	_art_root.add_child(instance)


func _add_torus(
	node_name: String,
	position_3d: Vector3,
	outer_radius: float,
	thickness: float,
	material: StandardMaterial3D
) -> void:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := TorusMesh.new()
	mesh.outer_radius = outer_radius
	mesh.inner_radius = outer_radius - thickness
	mesh.rings = 32
	mesh.ring_segments = 12
	instance.mesh = mesh
	instance.position = position_3d
	instance.material_override = material
	_art_root.add_child(instance)


func _material(
	key: String, color: Color, roughness: float, emission: float = 0.0
) -> StandardMaterial3D:
	if _materials.has(key):
		return _materials[key] as StandardMaterial3D
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	if emission > 0.0:
		material.emission_enabled = true
		material.emission = material.albedo_color
		material.emission_energy_multiplier = emission
	_materials[key] = material
	return material


func _ray_distance_to_rect(direction: Vector2, half_size: Vector2) -> float:
	var x_distance := half_size.x / absf(direction.x) if not is_zero_approx(direction.x) else INF
	var y_distance := half_size.y / absf(direction.y) if not is_zero_approx(direction.y) else INF
	return minf(x_distance, y_distance)
