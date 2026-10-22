class_name Enemy
extends UnitBase
## کلاس دشمن با هوش مصنوعی پایه (Enemy AI)
## چرخه رفتار: شناسایی قهرمان (Detect) -> تعقیب (Chase) -> حمله (Attack)
## با مرگ دشمن: ۱) کریستال متناسب با نوع/لول به زمین می‌افتد، ۲) XP مشترک به کل تیم فعال داده می‌شود.

enum AIState {
	IDLE,
	CHASE,
	ATTACK
}

@export var enemy_rank: String = "normal"       # نوع دشمن: normal / elite / boss
@export var detection_range: float = 240.0      # شعاع شناسایی قهرمان
@export var leash_range: float = 420.0          # حداکثر فاصله تعقیب از نقطه اسپاون
@export var attack_interval: float = 1.15       # فاصله زمانی بین حملات
@export var xp_reward: int = 45                 # مقدار XP مشترک تیمی هنگام مرگ

var ai_state: AIState = AIState.IDLE
var target_hero: UnitBase = null
var spawn_origin: Vector2 = Vector2.ZERO
var _attack_cooldown_timer: float = 0.0


func _ready() -> void:
	team = Team.ENEMY
	add_to_group("enemies")
	spawn_origin = global_position
	_apply_level_scaling()
	super._ready()


## تنظیم آمار دشمن بر اساس لول و بالانس پایه ۵ نفره
func _apply_level_scaling() -> void:
	var lv: int = max(1, level)
	hp_max = hp_max + float(lv - 1) * 45.0
	attack_damage = attack_damage + float(lv - 1) * 5.0
	xp_reward = xp_reward + (lv - 1) * 20


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	if _attack_cooldown_timer > 0.0:
		_attack_cooldown_timer = maxf(0.0, _attack_cooldown_timer - delta)

	_validate_current_target()

	match ai_state:
		AIState.IDLE:
			_process_idle_state(delta)
		AIState.CHASE:
			_process_chase_state()
		AIState.ATTACK:
			_process_attack_state()

	move_and_slide()


## حالت ۱: آماده‌باش، بازگشت آرام به پست نگهبانی و جستجوی قهرمان (Detect)
func _process_idle_state(delta: float) -> void:
	var detected: UnitBase = _detect_nearest_hero()
	if detected != null:
		target_hero = detected
		ai_state = AIState.CHASE
		return

	if global_position.distance_to(spawn_origin) > 18.0:
		var back_dir: Vector2 = (spawn_origin - global_position).normalized()
		velocity = back_dir * (move_speed * 0.65)
		update_facing(back_dir.x)
		play_anim_state("walk")
	else:
		velocity = velocity.move_toward(Vector2.ZERO, move_speed * 8.0 * delta)
		play_anim_state("idle")


## حالت ۲: تعقیب قهرمان شناسایی‌شده (Chase)
func _process_chase_state() -> void:
	if target_hero == null:
		ai_state = AIState.IDLE
		return

	var dist_from_origin: float = global_position.distance_to(spawn_origin)
	if dist_from_origin > leash_range:
		target_hero = null
		ai_state = AIState.IDLE
		return

	var dist_to_target: float = global_position.distance_to(target_hero.global_position)
	if dist_to_target <= attack_range:
		ai_state = AIState.ATTACK
		return

	var dir: Vector2 = (target_hero.global_position - global_position).normalized()
	velocity = dir * move_speed
	update_facing(dir.x)
	play_anim_state("walk")


## حالت ۳: حمله به قهرمان در برد (Attack)
func _process_attack_state() -> void:
	if target_hero == null:
		ai_state = AIState.IDLE
		return

	var dist_to_target: float = global_position.distance_to(target_hero.global_position)
	if dist_to_target > attack_range * 1.15:
		ai_state = AIState.CHASE
		return

	velocity = Vector2.ZERO
	var dir: Vector2 = (target_hero.global_position - global_position).normalized()
	update_facing(dir.x)

	if _attack_cooldown_timer <= 0.0:
		_execute_enemy_attack()
	else:
		play_anim_state("idle")


func _execute_enemy_attack() -> void:
	_attack_cooldown_timer = attack_interval
	play_anim_state("attack", true)
	if target_hero != null and not target_hero.is_dead:
		if GameManager != null and GameManager.combat_system != null:
			GameManager.combat_system.apply_skill_damage(self, target_hero, attack_damage)
		else:
			target_hero.take_damage(attack_damage, self)


func _validate_current_target() -> void:
	if target_hero == null:
		return
	if not is_instance_valid(target_hero) or target_hero.is_dead or not target_hero.visible:
		target_hero = null
		ai_state = AIState.IDLE


func _detect_nearest_hero() -> UnitBase:
	var heroes: Array[Node] = get_tree().get_nodes_in_group("heroes")
	var best: UnitBase = null
	var min_dist: float = detection_range
	for node: Node in heroes:
		if node is UnitBase and not node.is_dead and node.visible:
			var d: float = global_position.distance_to(node.global_position)
			if d <= min_dist:
				min_dist = d
				best = node
	return best


## هنگام مرگ دشمن: اسپاون کریستال + اعطای XP مشترک به اعضای آنلاین تیم
func die() -> void:
	if is_dead:
		return
	super.die()

	# انداختن کریستال بر اساس نوع و لول دشمن و اعطای XP مشترک تیمی
	if GameManager != null:
		if GameManager.loot_system != null:
			GameManager.loot_system.call_deferred("spawn_crystal_from_enemy", self)
		if GameManager.progression_system != null:
			GameManager.progression_system.grant_shared_team_xp(xp_reward)

	# حذف واحد پس از اتمام انیمیشن مرگ
	var cleanup_tween: Tween = create_tween()
	cleanup_tween.tween_interval(0.5)
	cleanup_tween.tween_callback(queue_free)
