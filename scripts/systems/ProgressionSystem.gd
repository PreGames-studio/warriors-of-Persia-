class_name ProgressionSystem
extends Node
## سیستم پیشرفت تیمی و اقتصاد بازی (ProgressionSystem)
## ۱) اعطای XP مشترک به تمام بازیکنان آنلاین تیم هنگام کشته شدن دشمن
## ۲) تبدیل کریستال‌ها به سکه در فروشگاه روستا
## ۳) اعمال جریمه مرگ (-۱ لول) و امکان بازیابی لول ازدست‌رفته با پرداخت سکه

const SFX_LEVELUP: AudioStream = preload("res://assets/audio/sfx_levelup.wav")

@export var coins: int = 30
@export var level_recovery_cost_per_level: int = 45

var lost_levels_recoverable: int = 0
var _sfx_player: AudioStreamPlayer = null


func _ready() -> void:
	_sfx_player = AudioStreamPlayer.new()
	_sfx_player.volume_db = -6.0
	add_child(_sfx_player)


## تقسیم/اعطای XP مشترک به همه قهرمانان آنلاین فعال در تیم
func grant_shared_team_xp(xp_amount: int) -> void:
	if xp_amount <= 0:
		return
	if GameManager == null or GameManager.party_manager == null:
		return

	var prev_leader_level: int = 1
	var leader: Hero = GameManager.match_manager.get_local_hero() if GameManager.match_manager != null else null
	if leader != null:
		prev_leader_level = leader.level

	var online_heroes: Array[Hero] = GameManager.party_manager.get_online_hero_nodes()
	for hero: Hero in online_heroes:
		if hero != null and not hero.is_dead:
			hero.gain_xp(xp_amount)

	if leader != null and leader.level > prev_leader_level and _sfx_player != null:
		_sfx_player.stream = SFX_LEVELUP
		_sfx_player.play()

	if EventBus != null:
		EventBus.shared_xp_granted.emit(xp_amount)


## فروش تک‌تک یا تمام کریستال‌ها در فروشگاه روستا و دریافت سکه
func sell_crystal_at(index: int, loot_system: LootSystem) -> int:
	if loot_system == null or index < 0 or index >= loot_system.collected_crystals.size():
		return 0

	var crystal_entry: Dictionary = loot_system.collected_crystals[index]
	var gained_coins: int = int(crystal_entry.get("coin_value", 10))
	loot_system.collected_crystals.remove_at(index)
	add_coins(gained_coins)

	if EventBus != null:
		EventBus.crystals_changed.emit(loot_system.collected_crystals)
	return gained_coins


func sell_all_crystals(loot_system: LootSystem) -> int:
	if loot_system == null or loot_system.collected_crystals.is_empty():
		return 0

	var total_gained: int = 0
	for entry: Dictionary in loot_system.collected_crystals:
		total_gained += int(entry.get("coin_value", 10))

	loot_system.collected_crystals.clear()
	add_coins(total_gained)

	if EventBus != null:
		EventBus.crystals_changed.emit(loot_system.collected_crystals)
		EventBus.notification_requested.emit(
			"فروش کریستال‌ها انجام شد! +%d سکه طلا" % total_gained,
			Color(1.0, 0.85, 0.25)
		)
	return total_gained


func add_coins(amount: int) -> void:
	if amount <= 0:
		return
	coins += amount
	if EventBus != null:
		EventBus.coins_changed.emit(coins)


func spend_coins(cost: int) -> bool:
	if cost < 0 or coins < cost:
		return false
	coins -= cost
	if EventBus != null:
		EventBus.coins_changed.emit(coins)
	return true


## جریمه مرگ قهرمان: کاهش ۱ سطح (حداقل سطح ۱) با امکان جبران توسط سکه در فروشگاه روستا
func apply_death_penalty(hero: Hero) -> void:
	if hero == null:
		return

	if hero.level > 1:
		hero.level -= 1
		hero.hp_max = maxf(100.0, hero.hp_max - 25.0)
		hero.mana_max = maxf(80.0, hero.mana_max - hero.mana_growth_per_level)
		hero.attack_damage = maxf(15.0, hero.attack_damage - 4.0)
		hero.xp = 0
		hero.xp_to_next_level = hero.calculate_xp_required(hero.level)
		if hero.is_local_leader:
			lost_levels_recoverable += 1
			if EventBus != null:
				EventBus.notification_requested.emit(
					"جریمه مرگ: -۱ سطح! (قابل بازیابی با سکه در فروشگاه روستا)",
					Color(1.0, 0.45, 0.45)
				)
	else:
		hero.xp = 0
		if hero.is_local_leader and EventBus != null:
			EventBus.notification_requested.emit(
				"قهرمان شکست خورد! باززایی تا لحظاتی دیگر...",
				Color(1.0, 0.55, 0.45)
			)

	hero.update_overhead_bars()
	hero.stats_changed.emit()


## هزینه سکه برای جبران ۱ سطح ازدست‌رفته ناشی از مرگ
func get_recovery_cost(hero: Hero) -> int:
	var lv: int = hero.level if hero != null else 1
	return level_recovery_cost_per_level * max(1, lv)


## جبران ۱ سطح ازدست‌رفته قهرمان با پرداخت سکه در روستا
func recover_lost_level_with_coins(hero: Hero) -> bool:
	if hero == null or lost_levels_recoverable <= 0:
		return false
	var cost: int = get_recovery_cost(hero)
	if not spend_coins(cost):
		return false

	lost_levels_recoverable -= 1
	hero.level_up()
	if EventBus != null:
		EventBus.notification_requested.emit(
			"سطح ازدست‌رفته با موفقیت بازیابی شد! (سطح فعلی: %d)" % hero.level,
			Color(0.35, 1.0, 0.60)
		)
	return true
