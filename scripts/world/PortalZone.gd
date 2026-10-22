class_name PortalZone
extends Area2D
## پورتال جابجایی بین نقشه‌ها (Village <-> OpenWorld <-> Dungeon)
## به محض ورود قهرمان رهبر محلی به محدوده پورتال، انتقال نقشه از طریق EventBus انجام می‌شود.

@export var target_zone_id: String = "village"
@export var target_dungeon_tier: int = 1
@export var portal_label_text: String = "ورود به روستا"
@export var portal_color: Color = Color(0.28, 0.95, 0.65, 0.85)

var _active_delay: float = 0.85
var _timer: float = 0.0

@onready var ring_sprite: Sprite2D = get_node_or_null("RingSprite")
@onready var title_label: Label = get_node_or_null("PortalLabel")


func _ready() -> void:
	add_to_group("portals")
	body_entered.connect(_on_body_entered)
	if ring_sprite != null:
		ring_sprite.modulate = portal_color
	if title_label != null:
		title_label.text = portal_label_text


func _process(delta: float) -> void:
	if _timer < _active_delay:
		_timer += delta
	if ring_sprite != null:
		ring_sprite.rotation += 0.9 * delta


func _on_body_entered(body: Node2D) -> void:
	# تاخیر کوتاه پس از بارگذاری صحنه برای جلوگیری از جابجایی ناخواسته فوری
	if _timer < _active_delay:
		return
	if body is Hero and (body as Hero).is_local_leader:
		if EventBus != null:
			EventBus.zone_change_requested.emit(target_zone_id, target_dungeon_tier)
