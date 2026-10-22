class_name VirtualJoystick
extends Control
## جوی‌استیک مجازی کاملاً لمسی (VirtualJoystick)
## کنترل حرکت موبایل با پشتیبانی از چندلمسی؛ ورودی ماوس پذیرفته نمی‌شود.

signal direction_changed(output_vector: Vector2)

@export var max_radius: float = 56.0
@export var deadzone_ratio: float = 0.12

var output: Vector2 = Vector2.ZERO
var _touch_index: int = -1
var _knob_offset: Vector2 = Vector2.ZERO


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	queue_redraw()


func _gui_input(event: InputEvent) -> void:
	var center: Vector2 = size * 0.5

	if event is InputEventScreenTouch:
		var touch: InputEventScreenTouch = event as InputEventScreenTouch
		if touch.pressed and _touch_index == -1:
			_touch_index = touch.index
			_update_knob(touch.position - center)
			accept_event()
		elif not touch.pressed and touch.index == _touch_index:
			_reset_knob()
			accept_event()

	elif event is InputEventScreenDrag:
		var drag: InputEventScreenDrag = event as InputEventScreenDrag
		if drag.index == _touch_index:
			_update_knob(drag.position - center)
			accept_event()


func _update_knob(raw_delta: Vector2) -> void:
	if raw_delta.length() > max_radius:
		_knob_offset = raw_delta.normalized() * max_radius
	else:
		_knob_offset = raw_delta

	var normalized_strength: Vector2 = _knob_offset / maxf(1.0, max_radius)
	if normalized_strength.length() < deadzone_ratio:
		output = Vector2.ZERO
	else:
		output = normalized_strength

	direction_changed.emit(output)
	queue_redraw()


func _reset_knob() -> void:
	_touch_index = -1
	_knob_offset = Vector2.ZERO
	output = Vector2.ZERO
	direction_changed.emit(output)
	queue_redraw()


func _draw() -> void:
	var center: Vector2 = size * 0.5
	# پس‌زمینه دایره‌ای نیمه‌شفاف به سبک بازی‌های موبایلی (MLBB)
	draw_circle(center, max_radius, Color(0.08, 0.12, 0.22, 0.52))
	draw_arc(center, max_radius, 0.0, TAU, 48, Color(0.42, 0.82, 1.0, 0.72), 3.0, true)
	draw_arc(center, max_radius * 0.35, 0.0, TAU, 32, Color(1.0, 1.0, 1.0, 0.18), 1.5, true)

	# اهرم درخشان میانی
	var knob_pos: Vector2 = center + _knob_offset
	var active_alpha: float = 0.95 if _touch_index != -1 else 0.75
	draw_circle(knob_pos, 23.0, Color(0.22, 0.72, 1.0, active_alpha))
	draw_arc(knob_pos, 23.0, 0.0, TAU, 32, Color(0.88, 0.98, 1.0, active_alpha), 2.5, true)
