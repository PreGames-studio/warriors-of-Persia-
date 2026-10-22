class_name ShopZone
extends Area2D
## محدوده تعاملی فروشگاه در روستای امن (ShopZone)
## با نزدیک شدن قهرمان به غرفه فروشگاه، پنجره Shop به صورت خودکار باز می‌شود.

@onready var hint_label: Label = get_node_or_null("HintLabel")


func _ready() -> void:
	add_to_group("shops")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _on_body_entered(body: Node2D) -> void:
	if body is Hero and (body as Hero).is_local_leader:
		if hint_label != null:
			hint_label.text = "فروشگاه روستا فعال است!"
		if EventBus != null:
			EventBus.shop_requested.emit(true)


func _on_body_exited(body: Node2D) -> void:
	if body is Hero and (body as Hero).is_local_leader:
		if hint_label != null:
			hint_label.text = "فروشگاه روستا (نزدیک شوید)"
		if EventBus != null:
			EventBus.shop_requested.emit(false)
