/** Persistent wall-clock intervals, shared by every zone and enemy rank. */
export const MP_RECOVERY_MS = 10 * 60 * 1000;
export const ENEMY_RESPAWN_MS = 10 * 60 * 1000;

export function recoverMP(member, now = Date.now()) {
  if (!Number.isFinite(member.mpRecoveryAt) || member.mpRecoveryAt > now) member.mpRecoveryAt = now;
  if (member.mana >= member.manaMax) { member.mpRecoveryAt = now; return 0; }
  const ticks = Math.floor((now - member.mpRecoveryAt) / MP_RECOVERY_MS);
  if (ticks <= 0) return 0;
  const recovered = Math.min(ticks, member.manaMax-member.mana);
  member.mana += recovered;
  member.mpRecoveryAt = member.mana >= member.manaMax ? now : member.mpRecoveryAt + ticks * MP_RECOVERY_MS;
  return recovered;
}

export function enemySpawnKey(zone, tier, x, z, rank, level) {
  return `${zone}:${tier}:${x}:${z}:${rank}:${level}`;
}
export function enemyRespawnAt(records, key, now = Date.now()) {
  const value = records[key];
  if (Number.isFinite(value) && value > now) return value;
  delete records[key];
  return 0;
}
export function recordEnemyDeath(records, key, now = Date.now()) {
  records[key] = now + ENEMY_RESPAWN_MS;
  return records[key];
}
export function restoreEnemyRespawns(records, now = Date.now()) {
  return Object.fromEntries(Object.entries(records && typeof records === 'object' ? records : {})
    .filter(([key,value]) => typeof key === 'string' && Number.isFinite(value) && value > now));
}
export function mpDisplayName(value) {
  return typeof value === 'string' ? value.replace(/مانای|مانا|MANA|Mana/g,'MP') : value;
}
