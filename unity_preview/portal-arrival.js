/** Resolve returns against the freshly built entrance, never a second hardcoded map coordinate. */
export function dungeonReturnArrival(portals, dungeonTier) {
  const entrance = portals.find(p => p.targetZone === 'dungeon' && p.targetTier === dungeonTier);
  if (!entrance) return null;
  const yaw = entrance.group.rotation.y || 0;
  return { x: entrance.pos.x + Math.sin(yaw) * 9, z: entrance.pos.z + Math.cos(yaw) * 9, yaw };
}

export function arrivalPartyPosition(arrival, index) {
  // All companions remain in front of the gate, outside its 6-unit trigger.
  const side = index === 0 ? 0 : (index % 2 ? -1 : 1) * 2.2;
  const forward = index === 0 ? 0 : Math.ceil(index / 2) * 2.5;
  return { x: arrival.x + Math.cos(arrival.yaw) * side + Math.sin(arrival.yaw) * forward,
    z: arrival.z - Math.sin(arrival.yaw) * side + Math.cos(arrival.yaw) * forward };
}
