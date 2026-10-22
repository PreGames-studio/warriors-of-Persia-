class_name Boss
extends Enemy
## کلاس باس دانجن (Boss)
## نسخه قدرتمندتر دشمن با مهارت موج انفجاری (Cast Shockwave) و دراپ کریستال باستانی ارزشمند.

@export var shockwave_cooldown: float = 5.5
@export var shockwave_radius: float = 195.0
@export var shockwave_multiplier: float = 1.65

var _shockwave_timer: float = 3.0


func _ready() -> void:
	enemy_rank = "boss"
	super._ready()


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	if target_hero != null:
		_shockwave_timer -= delta
		if _shockwave_timer <= 0.0:
			_cast_boss_shockwave()
			_shockwave_timer = shockwave_cooldown

	super._physics_process(delta)


## مهارت ویژه باس با انیمیشن cast و افکت موج انرژی بنفش درخشان
func _cast_boss_shockwave() -> void:
	play_anim_state("cast", true)
	if GameManager != null and GameManager.combat_system != null:
		GameManager.combat_system.perform_aoe_burst(
			self,
			global_position,
			shockwave_radius,
			attack_damage * shockwave_multiplier,
			Color(0.95, 0.32, 0.85)
		)
