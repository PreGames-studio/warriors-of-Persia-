extends Node
## باس رویداد سراسری (Global EventBus)
## این سینگلتون تمام ارتباطات غیرمستقیم بین واحدها، سیستم‌ها، جهان و رابط کاربری را مدیریت می‌کند
## تا ماژول‌ها کاملاً مستقل (Decoupled) و آماده اتصال به شبکه در مراحل بعدی باشند.

# --- سیگنال‌های واحدها و قهرمان اصلی ---
signal local_hero_registered(hero: Node)
signal hero_stats_updated(hero: Node)
signal hero_skill_used(skill_index: int, cooldown: float)
signal unit_died(unit: Node)
signal unit_leveled_up(unit: Node, new_level: int)

# --- سیگنال‌های تیم (Party - ۱ تا ۵ بازیکن) ---
signal party_updated(players: Array)
signal player_connection_changed(slot_index: int, is_online: bool)

# --- سیگنال‌های پیشرفت، کریستال، سکه و کیف آیتم‌ها ---
signal shared_xp_granted(amount: int)
signal crystal_collected(crystal_data: Dictionary, total_count: int)
signal crystals_changed(crystals: Array)
signal coins_changed(new_coins: int)
signal inventory_changed(items: Array)
signal notification_requested(message: String, color: Color)

# --- سیگنال‌های جهان و رابط کاربری ---
signal zone_change_requested(zone_id: String, dungeon_tier: int)
signal zone_changed(zone_id: String, zone_title: String, is_safe_zone: bool)
signal shop_requested(open_state: bool)
signal inventory_requested(open_state: bool)
