class_name Hero
extends UnitBase
## کلاس قهرمان قابل بازی و هم‌تیمی‌ها (Hero)
## حرکت فقط با جوی‌استیک لمسی موبایل، ۴ اسکیل فعال + ۱ پسیو،
## رشد سقف مانا با لول‌آپ، و هوش مصنوعی کمکی فقط برای تست محلی بازیکنان آنلاین ۲ تا ۵.

enum Role {
	WARRIOR,   # جنگجو
	MAGE,      # جادوگر
	ARCHER,    # کماندار
	TANK,      # تانک
	SUPPORT    # پشتیبان
}

# --- تنظیمات نقش، اسلات تیم و رشد مانا ---
@export var player_slot: int = 0
@export var is_local_leader: bool = true
@export var hero_role: Role = Role.WARRIOR
@export var mana_growth_per_level: float = 25.0   # مقدار رشد مانا در هر لول‌آپ (قابل بالانس در آینده)
@export var base_attack_cooldown: float = 0.65

# ورودی جوی‌استیک مجازی که از HUD تزریق می‌شود
var joystick_vector: Vector2 = Vector2.ZERO
var last_aim_direction: Vector2 = Vector2.RIGHT

# ۴ اسکیل فعال (هر چه اسکیل قوی‌تر -> ضریب آسیب بیشتر + کول‌داون بیشتر)
var skills: Array[Dictionary] = []
var skill_cooldown_timers: Array[float] = [0.0, 0.0, 0.0, 0.0]

# ۱ مهارت پسیو (Placeholder ساختاری آماده گسترش)
var passive_skill: Dictionary = {
	"id": "mana_resonance",
	"name": "پسیو: طنین مانا",
	"description": "بازیابی تدریجی مانا در میدان نبرد بر اساس سطح قهرمان",
	"mana_regen_base": 4.0
}

var _basic_attack_timer: float = 0.0
var _ally_ai_think_timer: float = 0.0


func _ready() -> void:
	team = Team.HERO
	add_to_group("heroes")
	_init_skills_placeholder()
	apply_role_style()
	super._ready()
	stats_changed.connect(_on_self_stats_changed)
	if is_local_leader and EventBus != null:
		EventBus.local_hero_registered.emit(self)
		EventBus.hero_stats_updated.emit(self)


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	_update_cooldowns_and_passive(delta)

	var move_dir: Vector2 = Vector2.ZERO
	if is_local_leader:
		move_dir = joystick_vector
	else:
		# در فاز اسکلت (قبل از اتصال سرور آنلاین)، هم‌تیمی‌های متصل شماره ۲ تا ۵
		# توسط AI کمکی هدایت می‌شوند تا تست تیم ۱ تا ۵ نفره روی یک دستگاه ممکن باشد.
		move_dir = _compute_connected_teammate_ai(delta)

	if move_dir.length_squared() > 0.001:
		move_dir = move_dir.normalized()
		last_aim_direction = move_dir
		velocity = move_dir * move_speed
		update_facing(move_dir.x)
		play_anim_state("walk")
	else:
		velocity = velocity.move_toward(Vector2.ZERO, move_speed * 10.0 * delta)
		play_anim_state("idle")

	move_and_slide()


## تعریف ساختار ۴ اسکیل با قانون: قدرت بیشتر -> کول‌داون طولانی‌تر
func _init_skills_placeholder() -> void:
	skills = [
		{
			"id": "skill_1",
			"name": "ضربه درخشان",
			"mana_cost": 15.0,
			"cooldown": 3.0,
			"damage_multiplier": 1.45,
			"mode": "melee_burst",
			"color": Color(0.30, 0.88, 1.0)
		},
		{
			"id": "skill_2",
			"name": "گوی انرژی",
			"mana_cost": 25.0,
			"cooldown": 6.0,
			"damage_multiplier": 1.95,
			"mode": "projectile",
			"color": Color(0.45, 0.65, 1.0)
		},
		{
			"id": "skill_3",
			"name": "موج ستاره‌ای",
			"mana_cost": 40.0,
			"cooldown": 10.0,
			"damage_multiplier": 2.65,
			"mode": "aoe_nova",
			"color": Color(0.85, 0.45, 1.0)
		},
		{
			"id": "skill_4",
			"name": "طوفان افسانه",
			"mana_cost": 60.0,
			"cooldown": 18.0,
			"damage_multiplier": 3.80,
			"mode": "ultimate",
			"color": Color(1.0, 0.80, 0.25)
		}
	]


## اعمال رنگ و ویژگی‌های پایه بر اساس نقش انتخاب‌شده (ترکیب نقش‌ها کاملاً آزاد است)
func apply_role_style() -> void:
	var role_color: Color = Color(1.0, 1.0, 1.0)
	match hero_role:
		Role.WARRIOR:
			role_color = Color(1.0, 0.95, 0.95)
		Role.MAGE:
			role_color = Color(0.75, 0.85, 1.15)
		Role.ARCHER:
			role_color = Color(0.80, 1.12, 0.85)
		Role.TANK:
			role_color = Color(1.12, 0.95, 0.72)
		Role.SUPPORT:
			role_color = Color(1.08, 0.82, 1.08)

	if visual_root != null:
		visual_root.modulate = role_color
	if glow_effect != null:
		var aura: Color = Color(0.25, 0.88, 1.0, 0.42) if is_local_leader else Color(0.35, 1.0, 0.65, 0.30)
		glow_effect.modulate = aura


static func get_role_title_fa(role_val: int) -> String:
	match role_val:
		Role.WARRIOR:
			return "جنگجو"
		Role.MAGE:
			return "جادوگر"
		Role.ARCHER:
			return "کماندار"
		Role.TANK:
			return "تانک"
		Role.SUPPORT:
			return "پشتیبان"
	return "قهرمان"


func _update_cooldowns_and_passive(delta: float) -> void:
	if _basic_attack_timer > 0.0:
		_basic_attack_timer = maxf(0.0, _basic_attack_timer - delta)

	for i: int in range(skill_cooldown_timers.size()):
		if skill_cooldown_timers[i] > 0.0:
			skill_cooldown_timers[i] = maxf(0.0, skill_cooldown_timers[i] - delta)

	# اجرای اثر پسیو بازیابی مانا (و بازیابی سریع‌تر در منطقه امن روستا)
	var regen_rate: float = float(passive_skill["mana_regen_base"]) + (float(level - 1) * 0.8)
	if GameManager != null and GameManager.is_in_safe_zone():
		regen_rate *= 3.0
		if hp_current < hp_max:
			heal(22.0 * delta)
	if mana_current < mana_max:
		restore_mana(regen_rate * delta)


## حمله پایه به نزدیک‌ترین دشمن در برد یا در جهت حرکت
func perform_basic_attack() -> void:
	if is_dead or _basic_attack_timer > 0.0:
		return
	if GameManager != null and GameManager.is_in_safe_zone():
		return

	_basic_attack_timer = base_attack_cooldown
	var target: UnitBase = _find_nearest_enemy(attack_range + 35.0)
	if target != null:
		last_aim_direction = (target.global_position - global_position).normalized()
		update_facing(last_aim_direction.x)

	play_anim_state("attack", true)
	if GameManager != null and GameManager.combat_system != null:
		GameManager.combat_system.perform_melee_strike(
			self,
			global_position + last_aim_direction * 42.0,
			attack_range,
			attack_damage,
			Color(0.55, 0.95, 1.0)
		)


## استفاده از یکی از ۴ اسکیل قهرمان (بررسی کول‌داون، منطقه امن و مصرف مانا)
func use_skill(skill_index: int) -> bool:
	if is_dead or skill_index < 0 or skill_index >= skills.size():
		return false

	if skill_cooldown_timers[skill_index] > 0.0:
		return false

	var skill: Dictionary = skills[skill_index]
	var mana_cost: float = float(skill["mana_cost"])
	if not use_mana(mana_cost):
		if is_local_leader and EventBus != null:
			EventBus.notification_requested.emit("مانا کافی نیست! (نوار آبی MANA)", Color(0.35, 0.75, 1.0))
		return false

	var cooldown_sec: float = float(skill["cooldown"])
	skill_cooldown_timers[skill_index] = cooldown_sec

	var target: UnitBase = _find_nearest_enemy(280.0)
	if target != null:
		last_aim_direction = (target.global_position - global_position).normalized()
		update_facing(last_aim_direction.x)

	var total_dmg: float = attack_damage * float(skill["damage_multiplier"])
	var vfx_color: Color = skill["color"]
	var mode: String = String(skill["mode"])

	play_anim_state("cast", true)

	if GameManager != null and GameManager.combat_system != null:
		match mode:
			"melee_burst":
				GameManager.combat_system.perform_melee_strike(
					self,
					global_position + last_aim_direction * 52.0,
					attack_range + 45.0,
					total_dmg,
					vfx_color
				)
			"projectile":
				GameManager.combat_system.spawn_projectile(
					self,
					global_position,
					last_aim_direction,
					total_dmg,
					vfx_color
				)
			"aoe_nova":
				GameManager.combat_system.perform_aoe_burst(
					self,
					global_position,
					165.0,
					total_dmg,
					vfx_color
				)
			"ultimate":
				heal(hp_max * 0.20)
				GameManager.combat_system.perform_aoe_burst(
					self,
					global_position,
					230.0,
					total_dmg,
					vfx_color
				)

	if is_local_leader and EventBus != null:
		EventBus.hero_skill_used.emit(skill_index, cooldown_sec)
	return true


## بازنویسی level_up برای رشد سقف مانا (MANA) در هر ارتقای سطح قهرمان
func level_up() -> void:
	mana_max += mana_growth_per_level
	super.level_up()
	if is_local_leader and EventBus != null:
		EventBus.notification_requested.emit(
			"ارتقای سطح! اکنون سطح %d هستید (+مانا و قدرت)" % level,
			Color(1.0, 0.86, 0.25)
		)


## اعمال جریمه مرگ (-۱ لول) و زمان‌بندی باززایی توسط MatchManager
func die() -> void:
	if is_dead:
		return
	super.die()
	if GameManager != null:
		if GameManager.progression_system != null:
			GameManager.progression_system.apply_death_penalty(self)
		if GameManager.match_manager != null:
			GameManager.match_manager.schedule_hero_respawn(self)


## بازگرداندن قهرمان به حیات پس از اتمام شمارش باززایی
func revive_at(spawn_pos: Vector2) -> void:
	global_position = spawn_pos
	is_dead = false
	_action_anim_locked = false
	hp_current = hp_max
	mana_current = mana_max
	if visual_root != null:
		visual_root.rotation = 0.0
		visual_root.scale = Vector2.ONE
		apply_role_style()
	play_anim_state("idle", true)
	update_overhead_bars()
	stats_changed.emit()


## هوش مصنوعی ساده فقط برای شبیه‌سازی هم‌تیمی‌های متصل لوکال (اسلات ۲ تا ۵) قبل از پیاده‌سازی سرور
func _compute_connected_teammate_ai(delta: float) -> Vector2:
	_ally_ai_think_timer -= delta
	var leader: Hero = GameManager.match_manager.get_local_hero() if (GameManager != null and GameManager.match_manager != null) else null
	if leader == null or leader == self:
		return Vector2.ZERO

	var follow_offset: Vector2 = Vector2(
		cos(float(player_slot) * 1.45) * 78.0,
		sin(float(player_slot) * 1.45) * 62.0
	)
	var desired_spot: Vector2 = leader.global_position + follow_offset

	# اگر خیلی از لیدر دور شد، سریع برگردد
	if global_position.distance_to(leader.global_position) > 300.0:
		return (desired_spot - global_position).normalized()

	if GameManager == null or not GameManager.is_in_safe_zone():
		var enemy_target: UnitBase = _find_nearest_enemy(210.0)
		if enemy_target != null:
			var dist_enemy: float = global_position.distance_to(enemy_target.global_position)
			if dist_enemy <= attack_range:
				perform_basic_attack()
				if _ally_ai_think_timer <= 0.0:
					_ally_ai_think_timer = 1.5
					use_skill(0)
				return Vector2.ZERO
			return (enemy_target.global_position - global_position).normalized()

	if global_position.distance_to(desired_spot) > 22.0:
		return (desired_spot - global_position).normalized()
	return Vector2.ZERO


func _find_nearest_enemy(search_radius: float) -> UnitBase:
	var enemies: Array[Node] = get_tree().get_nodes_in_group("enemies")
	var nearest: UnitBase = null
	var min_d: float = search_radius
	for node: Node in enemies:
		if node is UnitBase and not node.is_dead:
			var d: float = global_position.distance_to(node.global_position)
			if d <= min_d:
				min_d = d
				nearest = node
	return nearest


func _on_self_stats_changed() -> void:
	if is_local_leader and EventBus != null:
		EventBus.hero_stats_updated.emit(self)
	if EventBus != null and GameManager != null and GameManager.party_manager != null:
		EventBus.party_updated.emit(GameManager.party_manager.players)
