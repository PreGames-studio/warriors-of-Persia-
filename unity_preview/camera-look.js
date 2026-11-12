/** One-finger look gesture, separate from joystick/UI and OrbitControls. */
export function installDragLook(element, { enabled, rotate, finished, threshold = 6 }) {
  let pointer = null;
  const end = event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const previous = pointer; pointer = null;
    if (element.hasPointerCapture(previous.id)) element.releasePointerCapture(previous.id);
    if (previous.dragged) finished();
  };
  element.addEventListener('pointerdown', event => {
    if (!enabled() || pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!enabled()) { end(event); return; }
    if (!pointer.dragged && Math.hypot(event.clientX-pointer.startX, event.clientY-pointer.startY) < threshold) return;
    pointer.dragged = true;
    rotate(event.clientX-pointer.x, event.clientY-pointer.y);
    pointer.x=event.clientX; pointer.y=event.clientY;
    event.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, end);
  return { cancel() { if (pointer) end({ pointerId: pointer.id }); } };
}
