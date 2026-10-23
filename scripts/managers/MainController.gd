extends Node2D
## کنترلر ریشه صحنه اصلی بازی (Main.tscn)
## با اجرای بازی، ظرف جهان (WorldContainer) را به GameManager متصل کرده و جهان اولیه را بارگذاری می‌کند.

@onready var world_container: Node2D = $WorldContainer


func _ready() -> void:
	if GameManager != null:
		GameManager.start_game_with_container(world_container, "village")
