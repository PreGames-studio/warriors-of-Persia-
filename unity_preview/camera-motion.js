/** Frame-rate-independent shortest-arc rotation with a hard angular speed limit. */
export function smoothAngle(current, target, dt, maxSpeed = 1.05, damping = 4) {
  const delta = Math.atan2(Math.sin(target-current), Math.cos(target-current));
  const stepTime = Math.max(0, Math.min(dt, .05));
  const step = Math.max(-maxSpeed*stepTime, Math.min(maxSpeed*stepTime, delta*(1-Math.exp(-damping*stepTime))));
  return current+step;
}

export function dragLookTarget(yaw, tilt, dx, dy) {
  // Ignore coordinate spikes caused by delayed/coalesced pointer events.
  const clamp = (value, min, max) => Math.max(min,Math.min(max,value));
  return { yaw: yaw-clamp(dx,-40,40)*.0025, tilt:clamp(tilt+clamp(dy,-40,40)*.0018,-.15,.8) };
}
