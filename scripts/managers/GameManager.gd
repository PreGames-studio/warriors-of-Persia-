extends Node
## مدیر مرکزی بازی (GameManager Core Script)
## تمام زیرسیستم‌های اصلی (Party, Match, World, Combat, Loot, Progression, Spawn) را ایجاد و هماهنگ می‌کند.

var party_manager: PartyManager = null
var match_manager: MatchManager = null
var world_manager: WorldManager = null
var combat_system: CombatSystem = null
var loot_system: LootSystem = null
var progression_system: ProgressionSystem = null
var spawn_system: SpawnSystem = null


func _ready() -> void:
	_setup_subsystems()
	if EventBus != null:
		EventBus.zone_change_requested.connect(_on_zone_change_requested)


func _setup_subsystems() -> void:
	combat_system = CombatSystem.new()
	combat_system.name = "CombatSystem"
	add_child(combat_system)

	loot_system = LootSystem.new()
	loot_system.name = "LootSystem"
	add_child(loot_system)

	progression_system = ProgressionSystem.new()
	progression_system.name = "ProgressionSystem"
	add_child(progression_system)

	spawn_system = SpawnSystem.new()
	spawn_system.name = "SpawnSystem"
	add_child(spawn_system)

	party_manager = PartyManager.new()
	party_manager.name = "PartyManager"
	add_child(party_manager)

	match_manager = MatchManager.new()
	match_manager.name = "MatchManager"
	add_child(match_manager)

	world_manager = WorldManager.new()
	world_manager.name = "WorldManager"
	add_child(world_manager)


## شروع بازی از صحنه Main.tscn و بارگذاری اولیه نقشه جهان باز
func start_game_with_container(container_node: Node, initial_zone: String = "open_world") -> void:
	if world_manager == null:
		return
	world_manager.world_container = container_node
	world_manager.load_zone(initial_zone, 1)


func is_in_safe_zone() -> bool:
	return world_manager != null and world_manager.is_safe_zone()


func _on_zone_change_requested(zone_id: String, dungeon_tier: int) -> void:
	if world_manager != null:
		world_manager.load_zone(zone_id, dungeon_tier)
