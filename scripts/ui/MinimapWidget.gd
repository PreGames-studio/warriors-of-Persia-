class_name MinimapWidget
extends Control
## مینی‌مپ راداری زنده (Minimap Placeholder)
## نمایش موقعیت لحظه‌ای قهرمان (سبز)، هم‌تیمی‌ها (فیروزه‌ای)، دشمنان (قرمز)، باس (بنفش)، کریستال و پورتال‌ها.

@export var world_bounds: Rect2 = Rect2(Vector2(0.0, 0.0), Vector2(2000.0, 1300.0))


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	var bg_col: Color = Color(0.11, 0.18, 0.16, 0.88)
	if GameManager != null and GameManager.world_manager != null:
		var zid: String = GameManager.world_manager.current_zone_id
		if zid == "village":
			bg_col = Color(0.16, 0.22, 0.16, 0.90)
			world_bounds = Rect2(Vector2(0, 0), Vector2(1400, 900))
		elif zid == "open_world":
			bg_col = Color(0.12, 0.23, 0.15, 0.90)
			world_bounds = Rect2(Vector2(0, 0), Vector2(2200, 1400))
		elif zid == "dungeon":
			bg_col = Color(0.14, 0.10, 0.22, 0.92)
			world_bounds = Rect2(Vector2(0, 0), Vector2(1500, 1050))

	draw_rect(Rect2(Vector2.ZERO, size), bg_col, true)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.88, 0.76, 0.36, 0.85), false, 2.0)

	# رسم نمادین رودخانه در جهان باز
	if GameManager != null and GameManager.world_manager != null and GameManager.world_manager.current_zone_id == "open_world":
		var rx: float = (1080.0 / world_bounds.size.x) * size.x
		draw_line(Vector2(rx, 2.0), Vector2(rx, size.y - 2.0), Color(0.24, 0.65, 0.98, 0.65), 6.0)

	# پورتال‌ها
	for p: Node in get_tree().get_nodes_in_group("portals"):
		if p is Node2D:
			draw_circle(_map_pos((p as Node2D).global_position), 4.2, Color(0.65, 0.95, 1.0))

	# کریستال‌های روی زمین
	for c: Node in get_tree().get_nodes_in_group("crystals"):
		if c is Node2D:
			draw_circle(_map_pos((c as Node2D).global_position), 2.8, Color(0.30, 0.92, 1.0))

	# دشمنان و باس
	for e: Node in get_tree().get_nodes_in_group("enemies"):
		if e is UnitBase and not (e as UnitBase).is_dead:
			var is_boss_unit: bool = e is Boss
			var r: float = 5.5 if is_boss_unit else 3.2
			var col: Color = Color(1.0, 0.35, 0.92) if is_boss_unit else Color(1.0, 0.32, 0.36)
			draw_circle(_map_pos((e as Node2D).global_position), r, col)

	# قهرمان اصلی و هم‌تیمی‌های آنلاین
	for h: Node in get_tree().get_nodes_in_group("heroes"):
		if h is Hero and not (h as Hero).is_dead:
			var hero_unit: Hero = h as Hero
			var h_col: Color = Color(0.25, 1.0, 0.45) if hero_unit.is_local_leader else Color(0.35, 0.88, 1.0)
			draw_circle(_map_pos(hero_unit.global_position), 4.3 if hero_unit.is_local_leader else 3.4, h_col)


func _map_pos(world_pos: Vector2) -> Vector2:
	var nx: float = clampf((world_pos.x - world_bounds.position.x) / maxf(1.0, world_bounds.size.x), 0.04, 0.96)
	var ny: float = clampf((world_pos.y - world_bounds.position.y) / maxf(1.0, world_bounds.size.y), 0.06, 0.94)
	return Vector2(nx * size.x, ny * size.y)
