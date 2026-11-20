/**
 * One pace for the whole game.
 *
 * The village, the guild, the dungeons and the open world used to move Mia at
 * different speeds (a slow stroll in the village, a flat run everywhere else).
 * They now share a single walking speed, and the same auto-run rule: after the
 * player has kept moving for ten seconds Mia breaks into a run on her own,
 * without any extra button. Standing still resets the clock.
 */

/** Ground speed shared by every zone, in world units per second. */
export const WALK_SPEED = 2.8;
/** Ground speed of the automatic run. */
export const RUN_SPEED = 5.4;
/** Seconds of continuous walking before the run takes over. */
export const RUN_AFTER_SECONDS = 10;
/**
 * A short stop (a corner, a swing, a shop door) does not throw the run away:
 * the walk clock only resets after this many seconds without moving.
 */
export const STOP_GRACE_SECONDS = 0.7;
/** Below this ground speed the hero is considered standing, not walking. */
export const MOVING_SPEED = 0.25;
/**
 * A single frame never advances the clock by more than this (resume, a long
 * hitch). It is deliberately above one second: a software-GL phone can render
 * a frame in ~0.6 s, and clamping that to half would make "ten seconds" take
 * twenty on exactly the devices that need the honest number.
 */
const MAX_STEP_SECONDS = 1;

/**
 * Track how long the hero has been walking and decide the pace.
 *
 * `update()` takes the distance actually covered, not the input: a hero pressed
 * into a wall or a closed door is not walking, so the clock pauses instead of
 * building up a run that would launch her as soon as the wall ends.
 */
export function createGait(options = {}) {
  const walkSpeed = Number.isFinite(options.walkSpeed) ? options.walkSpeed : WALK_SPEED;
  const runSpeed = Number.isFinite(options.runSpeed) ? options.runSpeed : RUN_SPEED;
  const runAfter = Number.isFinite(options.runAfter) ? options.runAfter : RUN_AFTER_SECONDS;
  const stopGrace = Number.isFinite(options.stopGrace) ? options.stopGrace : STOP_GRACE_SECONDS;

  let walkedFor = 0;
  let stillFor = 0;
  let mode = 'idle';

  const reset = () => {
    walkedFor = 0;
    stillFor = 0;
    mode = 'idle';
  };

  return {
    /** Advance the clock; returns the new mode ('idle' | 'walk' | 'run'). */
    update(dt, actualSpeed = 0) {
      const step = Math.min(Math.max(Number(dt) || 0, 0), MAX_STEP_SECONDS);
      const moving = Number(actualSpeed) > MOVING_SPEED;
      if (moving) {
        stillFor = 0;
        walkedFor = Math.min(runAfter, walkedFor + step);
        mode = walkedFor >= runAfter ? 'run' : 'walk';
      } else {
        stillFor += step;
        if (stillFor >= stopGrace) walkedFor = 0;
        mode = 'idle';
      }
      return mode;
    },
    /** Target ground speed for the current mode. */
    speed: () => (mode === 'run' ? runSpeed : walkSpeed),
    mode: () => mode,
    /** 0 → 1 of the ten seconds walked so far; 1 while running. */
    progress: () => (runAfter > 0 ? Math.min(1, walkedFor / runAfter) : 1),
    /** Seconds of walking left before the run starts. */
    secondsLeft: () => Math.max(0, runAfter - walkedFor),
    walkSpeed: () => walkSpeed,
    runSpeed: () => runSpeed,
    runAfter: () => runAfter,
    reset
  };
}
