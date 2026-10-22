class_name LootSystem
extends Node
## سیستم غنائم، کریستال‌ها و کیف آیتم‌ها (LootSystem)
## وظیفه اسپاون کریستال هنگام مرگ دشمنان، نگهداری کریستال‌های تیم و مدیریت اسلات‌های Inventory را دارد.

const CRYSTAL_SCENE: PackedScene = preload("res://scenes/items/Crystal.tscn")
const SFX_CRYSTAL: AudioStream = preload("res://assets/audio/sfx_crystal.wav")

@export var max_inventory_slots: int = 16

var collected_crystals: Array[Dictionary] = []
var inventory_items: Array[Item] = []

var _sfx_player: AudioStreamPlayer = null


func _ready() -> void:
	_sfx_player = AudioStreamPlayer.new()
	_sfx_player.volume_db = -7.0
	add_child(_sfx_player)

	# یک معجون اولیه برای تست سریع کیف آیتم‌ها
	var starter_catalog: Array[Item] = Item.get_default_shop_catalog()
	if starter_catalog.size() > 0:
		add_item(starter_catalog[0])


## اسپاون کریستال در مختصات مرگ دشمن بر اساس لول و رتبه دشمن
func spawn_crystal_from_enemy(enemy: Enemy) -> void:
	if enemy == null or not is_instance_valid(enemy):
		return
	if GameManager == null or GameManager.world_manager == null:
		return
	var world_node: Node = GameManager.world_manager.current_world_instance
	if world_node == null:
		return

	var crystal: Crystal = CRYSTAL_SCENE.instantiate() as Crystal
	crystal.global_position = enemy.global_position
	crystal.setup_from_enemy(enemy.level, enemy.enemy_rank)
	world_node.add_child(crystal)


## ثبت کریستال جمع‌آوری‌شده در کیف کریستال‌های تیم
func collect_crystal(crystal_data: Dictionary, _pickup_pos: Vector2) -> void:
	collected_crystals.append(crystal_data)
	if _sfx_player != null:
		_sfx_player.stream = SFX_CRYSTAL
		_sfx_player.play()

	if EventBus != null:
		EventBus.crystal_collected.emit(crystal_data, collected_crystals.size())
		EventBus.crystals_changed.emit(collected_crystals)
		EventBus.notification_requested.emit(
			"جمع‌آوری شد: %s" % String(crystal_data.get("title", "کریستال")),
			Color(0.35, 0.95, 1.0)
		)


## افزودن آیتم خریداری‌شده به کیف آیتم‌ها (Inventory)
func add_item(item: Item) -> bool:
	if item == null or inventory_items.size() >= max_inventory_slots:
		return false
	inventory_items.append(item)
	if EventBus != null:
		EventBus.inventory_changed.emit(inventory_items)
	return true


## استفاده یا تجهیز آیتم موجود در خانه مشخصی از کیف روی قهرمان اصلی
func use_or_equip_item(slot_index: int) -> bool:
	if slot_index < 0 or slot_index >= inventory_items.size():
		return false
	var hero: Hero = GameManager.match_manager.get_local_hero() if (GameManager != null and GameManager.match_manager != null) else null
	if hero == null or hero.is_dead:
		return false

	var item: Item = inventory_items[slot_index]
	match item.item_type:
		Item.ItemType.CONSUMABLE_HP:
			hero.heal(item.power_value)
		Item.ItemType.CONSUMABLE_MANA:
			hero.restore_mana(item.power_value)
		Item.ItemType.WEAPON:
			hero.attack_damage += item.power_value
			hero.stats_changed.emit()
		Item.ItemType.ACCESSORY:
			hero.mana_max += item.power_value
			hero.mana_current = minf(hero.mana_max, hero.mana_current + item.power_value)
			hero.update_overhead_bars()
			hero.stats_changed.emit()

	inventory_items.remove_at(slot_index)
	if EventBus != null:
		EventBus.inventory_changed.emit(inventory_items)
		EventBus.notification_requested.emit(
			"استفاده شد: %s" % item.title,
			Color(0.45, 1.0, 0.65)
		)
	return true
