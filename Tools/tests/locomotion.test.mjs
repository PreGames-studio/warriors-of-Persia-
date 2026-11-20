// The whole game walks at one pace and breaks into a run on its own after ten
// seconds of continuous walking. These checks run the real module, headless.
import { createGait, WALK_SPEED, RUN_SPEED, RUN_AFTER_SECONDS, STOP_GRACE_SECONDS } from '../../unity_preview/locomotion.js';

const checks = [];
const expect = (label, ok, detail) => checks.push({ label, ok: Boolean(ok), detail });
const STEP = 1 / 60;

/** Step the clock for `seconds` at a fixed ground speed; returns the seen modes. */
function walk(gait, seconds, speed = WALK_SPEED) {
  const modes = [];
  const frames = Math.round(seconds / STEP);
  for (let frame = 0; frame < frames; frame++) {
    const mode = gait.update(STEP, speed);
    if (modes[modes.length - 1] !== mode) modes.push(mode);
  }
  return modes;
}

const gait = createGait();

expect('a fresh hero walks', gait.mode() === 'idle', gait.mode());
expect('the walk pace is one number for every zone', gait.speed() === WALK_SPEED, `${gait.speed()}`);
expect('the run is faster than the walk', RUN_SPEED > WALK_SPEED, `${WALK_SPEED} -> ${RUN_SPEED}`);

// 1) Nine seconds of walking is still a walk.
walk(gait, RUN_AFTER_SECONDS - 1);
expect('nine seconds of walking still walks', gait.mode() === 'walk', gait.mode());
expect('the badge meter has almost filled', gait.progress() > 0.85, gait.progress().toFixed(2));

// 2) The tenth second switches to the run, with no input at all.
walk(gait, 1.2);
expect('ten seconds of walking starts the run by itself', gait.mode() === 'run', gait.mode());
expect('the run uses the run speed', Math.abs(gait.speed() - RUN_SPEED) < 1e-9, `${gait.speed()}`);
expect('the badge shows full', gait.progress() === 1, `${gait.progress()}`);

// 3) A quick stop does not throw the run away; a real stop does.
walk(gait, STOP_GRACE_SECONDS * 0.5, 0);
walk(gait, 0.5);
expect('a short pause keeps the run', gait.mode() === 'run', gait.mode());
walk(gait, STOP_GRACE_SECONDS + 0.2, 0);
expect('standing still stops the hero', gait.mode() === 'idle', gait.mode());
expect('standing resets the clock', gait.progress() === 0, `${gait.progress()}`);
walk(gait, 1);
expect('she walks again after a stop', gait.mode() === 'walk', gait.mode());

// 4) Pushing against a wall (input, no distance) never builds up a run.
const stuck = createGait();
for (let frame = 0; frame < 60 * 30; frame++) stuck.update(STEP, 0.02);
expect('a hero held by a wall never auto-runs', stuck.mode() === 'idle', stuck.mode());

// 5) Options are honoured (the tunables stay real).
const custom = createGait({ walkSpeed: 3.1, runSpeed: 6, runAfter: 2 });
walk(custom, 1);
expect('a custom walk speed is used', custom.speed() === 3.1, `${custom.speed()}`);
walk(custom, 1.2);
expect('a custom threshold starts the run', custom.mode() === 'run', custom.mode());
expect('a custom run speed is used', custom.speed() === 6, `${custom.speed()}`);
custom.reset();
expect('reset returns to the start', custom.mode() === 'idle' && custom.progress() === 0, custom.mode());

// 6) A huge frame (tab resume) cannot fast-forward the clock in one go.
const resumed = createGait();
resumed.update(30, WALK_SPEED);
expect('a long hitch does not skip the walk', resumed.mode() === 'walk', resumed.mode());

let failed = 0;
for (const check of checks) {
  if (!check.ok) failed += 1;
  console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
