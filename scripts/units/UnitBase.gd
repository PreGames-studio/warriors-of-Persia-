class_name UnitBase
extends CharacterBody2D
## کلاس پایه تمام واحدهای زنده بازی (قهرمانان، دشمنان و باس‌ها)
## شامل آمار پایه، نوار سبز سلامتی (MP/خون)، نوار آبی مانا (MANA)، نوار زرد تجربه (XP)،
## سیگنال‌های استاندارد و ماشین اجرای انیمیشن ۵ حالته (idle, walk, attack, cast, die).
##
## نکته مهم Godot 4: در GDScript امکان هم‌نام بودن همزمان یک signal و یک func در یک کلاس وجود ندارد؛
## بنابراین مطابق الگوی سایر سیگنال‌ها (died / damaged / healed)، نام سیگنال ارتقای سطح leveled_up
## و نام متد ارتقای سطح level_up() تعریف شده است.

enum Team {
	NEUTRAL = 0,
	HERO = 1,
	ENEMY = 2
}

# --- سیگنال‌های اصلی واحد ---
signal died(unit: UnitBase)
signal damaged(amount: float, hp_current_val: float, attacker: Node)
signal healed(amount: float, hp_current_val: float)
signal leveled_up(new_level: int)
signal stats_changed()

# --- مشخصات هویتی و تیمی ---
@export var unit_name: String = "واحد پایه"
@export var team: int = Team.HERO

# --- نوار سبز سلامتی (MP = خون در طراحی UI بازی) ---
@export var hp_max: float = 150.0
var hp_current: float = 150.0

# --- نوار آبی مانا (MANA) ---
@export var mana_max: float = 100.0
var mana_current: float = 100.0

# --- نوار زرد تجربه و سطح (XP & Level) ---
@export var level: int = 1
@export var xp: int = 0
@export var xp_to_next_level: int = 100

# --- آمار رزمی و حرکتی ---
@export var attack_damage: float = 22.0
@export var attack_range: float = 92.0
@export var move_speed: float = 225.0

var is_dead: bool = false
var current_anim_state: String = "idle"
var _action_anim_locked: bool = false

@onready var visual_root: Node2D = get_node_or_null("VisualRoot")
@onready var sprite: Sprite2D = get_node_or_null("VisualRoot/Sprite2D")
@onready var glow_effect: Sprite2D = get_node_or_null("GlowEffect")
@onready var anim_player: AnimationPlayer = get_node_or_null("AnimationPlayer")
@onready var overhead_hp_bar: ProgressBar = get_node_or_null("OverheadBars/HPBar")
@onready var overhead_mana_bar: ProgressBar = get_node_or_null("OverheadBars/ManaBar")
@onready var overhead_label: Label = get_node_or_null("OverheadBars/NameLevelLabel")


func _ready() -> void:
	hp_current = hp_max
	mana_current = mana_max
	xp_to_next_level = calculate_xp_required(level)
	if anim_player != null:
		anim_player.animation_finished.connect(_on_animation_finished)
	play_anim_state("idle")
	update_overhead_bars()


## محاسبه XP موردنیاز برای رسیدن به سطح بعدی
func calculate_xp_required(target_level: int) -> int:
	return 80 + (max(1, target_level) * 40)


## دریافت آسیب (کم شدن نوار سبز خون/MP)
func take_damage(amount: float, attacker: Node = null) -> void:
	if is_dead or amount <= 0.0:
		return

	hp_current = maxf(0.0, hp_current - amount)
	_flash_hit_effect()
	update_overhead_bars()
	damaged.emit(amount, hp_current, attacker)
	stats_changed.emit()

	if hp_current <= 0.0:
		die()


## بازیابی سلامتی (پر شدن نوار سبز خون/MP)
func heal(amount: float) -> void:
	if is_dead or amount <= 0.0:
		return

	var prev_hp: float = hp_current
	hp_current = minf(hp_max, hp_current + amount)
	var actual_healed: float = hp_current - prev_hp
	update_overhead_bars()
	if actual_healed > 0.0:
		healed.emit(actual_healed, hp_current)
	stats_changed.emit()


## مصرف مانا برای اجرای اسکیل‌ها؛ در صورت کافی بودن true برمی‌گرداند
func use_mana(amount: float) -> bool:
	if is_dead:
		return false
	if amount <= 0.0:
		return true
	if mana_current < amount:
		return false

	mana_current = maxf(0.0, mana_current - amount)
	update_overhead_bars()
	stats_changed.emit()
	return true


## بازیابی مانا در طول زمان یا با معجون
func restore_mana(amount: float) -> void:
	if is_dead or amount <= 0.0:
		return
	mana_current = minf(mana_max, mana_current + amount)
	update_overhead_bars()
	stats_changed.emit()


## دریافت تجربه (پر شدن نوار زرد XP) و بررسی لول‌آپ خودکار
func gain_xp(amount: int) -> void:
	if is_dead or amount <= 0:
		return

	xp += amount
	while xp >= xp_to_next_level:
		xp -= xp_to_next_level
		level_up()

	update_overhead_bars()
	stats_changed.emit()


## ارتقای سطح واحد
func level_up() -> void:
	level += 1
	xp_to_next_level = calculate_xp_required(level)
	hp_max += 25.0
	attack_damage += 4.0
	hp_current = hp_max
	mana_current = mana_max

	update_overhead_bars()
	leveled_up.emit(level)
	stats_changed.emit()
	if EventBus != null:
		EventBus.unit_leveled_up.emit(self, level)


## مرگ واحد و اجرای انیمیشن die
func die() -> void:
	if is_dead:
		return
	is_dead = true
	velocity = Vector2.ZERO
	_action_anim_locked = false
	play_anim_state("die", true)

	died.emit(self)
	if EventBus != null:
		EventBus.unit_died.emit(self)


## تغییر روان وضعیت انیمیشن بین ۵ حالت استاندارد: idle, walk, attack, cast, die
func play_anim_state(state_name: String, force_play: bool = false) -> void:
	if anim_player == null:
		return
	if is_dead and state_name != "die":
		return
	if _action_anim_locked and not force_play and state_name in ["idle", "walk"]:
		return

	if state_name in ["attack", "cast", "die"]:
		_action_anim_locked = true
		current_anim_state = state_name
		if anim_player.has_animation(state_name):
			anim_player.stop()
			anim_player.play(state_name)
		else:
			_action_anim_locked = false
		return

	if current_anim_state != state_name or force_play:
		current_anim_state = state_name
		if anim_player.has_animation(state_name):
			anim_player.play(state_name)


func _on_animation_finished(anim_name: StringName) -> void:
	if String(anim_name) in ["attack", "cast"]:
		_action_anim_locked = false
		if not is_dead:
			var next_state: String = "walk" if velocity.length() > 10.0 else "idle"
			play_anim_state(next_state, true)


## چرخش افقی اسپرایت چیبی بر اساس جهت حرکت
func update_facing(dir_x: float) -> void:
	if sprite != null and absf(dir_x) > 0.05:
		sprite.flip_h = dir_x < 0.0


## به‌روزرسانی نوارهای کوچک بالای سر کاراکتر
func update_overhead_bars() -> void:
	if overhead_hp_bar != null:
		overhead_hp_bar.max_value = maxf(1.0, hp_max)
		overhead_hp_bar.value = hp_current
	if overhead_mana_bar != null:
		overhead_mana_bar.max_value = maxf(1.0, mana_max)
		overhead_mana_bar.value = mana_current
	if overhead_label != null:
		overhead_label.text = "%s [Lv.%d]" % [unit_name, level]


func _flash_hit_effect() -> void:
	if sprite == null or not is_inside_tree():
		return
	sprite.self_modulate = Color(2.2, 0.55, 0.55, 1.0)
	var tween: Tween = create_tween()
	tween.tween_property(sprite, "self_modulate", Color(1.0, 1.0, 1.0, 1.0), 0.14)
