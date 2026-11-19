/**
 * Hero spell casting: body motion + effects for the four HUD skills.
 *
 * The damage/cooldown logic lives in index.html; this module adds what the cast
 * was missing — the hero actually *moves* when a spell fires:
 *
 *   windup  → weight shifts back, the torso tilts away from the target
 *   release → a forward lunge (or a spin / leap), the torso whips through
 *   settle  → the pose eases back to neutral
 *
 * The transform is applied to a dedicated pivot that wraps Mia's model, so it
 * never fights the movement code that owns `leader.mesh.position`. Each cast also
 * plays a matching animation clip and spawns a short-lived effect.
 */

const TAU = Math.PI * 2;

/** Icon, clip and motion profile for each HUD slot. */
export const HERO_SPELLS = [
  {
    id: 'strike',
    name: 'ضربهٔ درخشان',
    subtitle: 'Light Strike',
    icon: './assets/spells/strike.png',
    clip: 'Sword_Light_A',
    color: 0x7dd3fc,
    motion: { windup: 0.16, release: 0.24, settle: 0.34, lunge: 0.62, rise: 0.08, pitch: 0.20, spin: 0, spinSign: 1 },
  },
  {
    id: 'orb',
    name: 'گوی انرژی',
    subtitle: 'Arcane Orb',
    icon: './assets/spells/orb.png',
    clip: 'OverhandThrow',
    color: 0x93c5fd,
    motion: { windup: 0.30, release: 0.20, settle: 0.38, lunge: 0.22, rise: 0.14, pitch: 0.30, spin: 0, spinSign: 1 },
  },
  {
    id: 'wave',
    name: 'موج ستاره‌ای',
    subtitle: 'Star Wave',
    icon: './assets/spells/wave.png',
    clip: 'Sword_UpperCut',
    color: 0xc084fc,
    motion: { windup: 0.18, release: 0.30, settle: 0.40, lunge: 0.34, rise: 0.42, pitch: 0.16, spin: TAU, spinSign: -1 },
  },
  {
    id: 'storm',
    name: 'طوفان افسانه',
    subtitle: 'Legend Storm',
    icon: './assets/spells/storm.png',
    clip: 'Sword_Heavy_A',
    color: 0xfacc15,
    motion: { windup: 0.34, release: 0.34, settle: 0.52, lunge: 0.12, rise: 0.85, pitch: 0.22, spin: TAU, spinSign: 1 },
  },
];

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function createHeroSpells(options) {
  const {
    THREE,
    getRoot,
    getLeader,
    playTone = () => {},
    flash = () => {},
  } = options;

  /** @type {Array<{mesh: THREE.Object3D, life: number, max: number, update: (k: number) => void}>} */
  const effects = [];
  let active = null;

  function pivotFor(leader) {
    const mesh = leader && leader.mesh;
    if (!mesh) return null;
    if (mesh.userData && mesh.userData.castPivot) return mesh.userData.castPivot;
    return null;
  }

  function resetPivot(pivot) {
    if (!pivot) return;
    pivot.position.set(0, 0, 0);
    pivot.rotation.set(0, 0, 0);
    pivot.scale.setScalar(1);
  }

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------
  function addEffect(mesh, life, update) {
    const root = getRoot();
    if (!root) return null;
    root.add(mesh);
    const entry = { mesh, life: 0, max: life, update };
    effects.push(entry);
    return entry;
  }

  function ring(position, color, from, to, life, lift = 0.12, thickness = 0.09) {
    const geometry = new THREE.RingGeometry(from, to, 48);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += lift;
    addEffect(mesh, life, (k) => {
      mesh.scale.setScalar(1 + k * 2.6);
      material.opacity = 0.85 * (1 - k) * (1 - k);
    });
    return mesh;
  }

  function burst(position, color, count, life, spread = 5, size = 0.14) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const theta = Math.random() * TAU;
      const phi = Math.random() * Math.PI * 0.55;
      const speed = spread * (0.35 + Math.random() * 0.8);
      velocities.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.9 + spread * 0.25,
        Math.sin(phi) * Math.sin(theta) * speed,
      ));
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    addEffect(points, life, (k, dt) => {
      const attribute = geometry.getAttribute('position');
      const step = dt;
      for (let i = 0; i < count; i += 1) {
        attribute.array[i * 3] += velocities[i].x * step;
        attribute.array[i * 3 + 1] += velocities[i].y * step;
        attribute.array[i * 3 + 2] += velocities[i].z * step;
        velocities[i].y -= 9.5 * step;
      }
      attribute.needsUpdate = true;
      material.opacity = 0.95 * (1 - k);
    });
  }

  function glow(position, color, intensity, distance) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.copy(position);
    addEffect(light, 0.5, (k) => {
      light.intensity = intensity * (1 - k) * (1 - k);
    });
    return light;
  }

  function slashArc(position, yaw, color) {
    const geometry = new THREE.TorusGeometry(1.05, 0.06, 8, 40, Math.PI * 1.15);
    const material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y += 1.5;
    mesh.rotation.set(Math.PI / 2, 0, 0);
    mesh.rotation.y = yaw;
    addEffect(mesh, 0.34, (k) => {
      mesh.rotation.z = -0.9 + k * 1.9;
      mesh.scale.setScalar(1 + k * 0.9);
      material.opacity = 0.9 * (1 - k);
    });
  }

  function skyColumn(position, color, height) {
    const geometry = new THREE.ConeGeometry(1.1, height, 24, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y += height * 0.5;
    addEffect(mesh, 0.7, (k) => {
      mesh.scale.set(1 + k * 0.5, 1 - k * 0.35, 1 + k * 0.5);
      material.opacity = 0.55 * (1 - k);
    });
  }

  function forwardOf(leader) {
    const yaw = leader && leader.mesh ? leader.mesh.rotation.y : 0;
    return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  }

  function spawnEffects(index, leader) {
    const spell = HERO_SPELLS[index];
    const root = getRoot();
    if (!root || !leader || !leader.mesh) return;
    const ground = leader.mesh.position.clone();
    const chest = ground.clone().add(new THREE.Vector3(0, 1.55, 0));
    const forward = forwardOf(leader);
    const hand = chest.clone().add(forward.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0, 0.15, 0));

    if (spell.id === 'strike') {
      slashArc(hand, leader.mesh.rotation.y, spell.color);
      ring(ground, spell.color, 0.4, 0.75, 0.45);
      burst(hand, spell.color, 26, 0.4, 5.5, 0.12);
      glow(hand, spell.color, 3.2, 7);
      flash('rgba(125, 211, 252, .16)', 170);
    } else if (spell.id === 'orb') {
      burst(hand, spell.color, 40, 0.5, 4.2, 0.13);
      glow(hand, spell.color, 4.5, 9);
      ring(ground, spell.color, 0.3, 0.55, 0.4);
      flash('rgba(147, 197, 253, .18)', 200);
    } else if (spell.id === 'wave') {
      ring(ground, spell.color, 0.6, 1.0, 0.7);
      ring(ground, 0xffffff, 0.2, 0.45, 0.5, 0.2, 0.05);
      burst(chest, spell.color, 54, 0.7, 7.5, 0.16);
      glow(chest, spell.color, 5.5, 12);
      flash('rgba(168, 85, 247, .22)', 260);
    } else {
      ring(ground, spell.color, 0.8, 1.5, 0.9);
      ring(ground, 0xffffff, 0.4, 0.7, 0.6, 0.25, 0.06);
      burst(ground.clone().add(new THREE.Vector3(0, 0.4, 0)), spell.color, 90, 0.9, 9.5, 0.2);
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * TAU;
        skyColumn(ground.clone().add(new THREE.Vector3(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2)),
          spell.color, 9);
      }
      glow(chest, spell.color, 8, 18);
      flash('rgba(250, 204, 21, .26)', 320);
    }
  }

  // ------------------------------------------------------------------
  // Cast
  // ------------------------------------------------------------------
  function cast(index) {
    const spell = HERO_SPELLS[index];
    const leader = getLeader();
    if (!spell || !leader || !leader.mesh) return false;
    const pivot = pivotFor(leader);

    // A new cast interrupts the previous pose cleanly.
    if (active) resetPivot(active.pivot);
    // The effect is held back until the swing connects (see `update`), so the
    // visuals land on the release instead of during the wind-up.
    active = { index, time: 0, profile: spell.motion, pivot, spawned: false, leader };

    if (leader.mesh.userData && typeof leader.mesh.userData.playAction === 'function') {
      leader.mesh.userData.playAction(spell.clip);
    }

    const base = 300 + index * 90;
    playTone(base, 0.16, 'triangle');
    setTimeout(() => playTone(base * 1.5, 0.22, 'sine'), 140);
    return true;
  }

  function update(dt) {
    if (active) {
      const { pivot, profile } = active;
      active.time += dt;
      const wind = profile.windup;
      const release = profile.release;
      const settle = profile.settle;
      const total = wind + release + settle;
      const t = active.time;

      let z = 0;
      let y = 0;
      let pitch = 0;
      let spin = 0;
      let scale = 1;

      if (t < wind) {
        // Load the pose: weight back, chest away from the target.
        const e = easeOutCubic(t / wind);
        z = -profile.lunge * 0.28 * e;
        y = -0.045 * e;
        pitch = -profile.pitch * 0.75 * e;
        spin = profile.spinSign * 0.12 * e;
        scale = 1 - 0.02 * e;
      } else if (t < wind + release) {
        // Uncoil: the lunge/leap happens here, and the spin (if any) completes.
        const p = (t - wind) / release;
        const e = easeOutQuart(p);
        z = -profile.lunge * 0.28 + profile.lunge * 1.28 * e;
        y = profile.rise * Math.sin(Math.PI * Math.min(1, p * 1.05));
        pitch = -profile.pitch * 0.75 + profile.pitch * 2.4 * e;
        spin = profile.spinSign * (0.12 + (profile.spin - 0.12) * e);
        scale = 1 - 0.03 * Math.sin(Math.PI * p);
      } else {
        // Settle back onto the feet without a visible snap.
        const p = Math.min(1, (t - wind - release) / settle);
        const e = easeInOutCubic(p);
        z = profile.lunge * (1 - e);
        pitch = profile.pitch * 0.55 * (1 - e);
        spin = profile.spinSign * profile.spin * (1 - e);
      }

      if (!active.spawned && t >= wind) {
        active.spawned = true;
        spawnEffects(active.index, active.leader);
      }

      if (pivot) {
        pivot.position.set(0, y, z);
        pivot.rotation.set(pitch, spin, 0);
        pivot.scale.setScalar(scale);
      }
      if (t >= total) {
        resetPivot(pivot);
        active = null;
      }
    }

    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      effect.life += dt;
      const k = Math.min(1, effect.life / effect.max);
      effect.update(k, dt);
      if (k >= 1) {
        const root = getRoot();
        if (root && effect.mesh.parent === root) root.remove(effect.mesh);
        else if (effect.mesh.parent) effect.mesh.parent.remove(effect.mesh);
        if (effect.mesh.geometry) effect.mesh.geometry.dispose();
        if (effect.mesh.material && effect.mesh.material.dispose) effect.mesh.material.dispose();
        effects.splice(i, 1);
      }
    }
  }

  function cancel() {
    if (active) {
      resetPivot(active.pivot);
      active = null;
    }
  }

  return { cast, update, cancel, spells: HERO_SPELLS };
}
