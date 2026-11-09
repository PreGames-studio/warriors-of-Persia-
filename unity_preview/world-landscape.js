/** Shared deterministic landscape grammar for every combat map.
 * Existing PBR architecture/materials are reused; no remote assets.
 */
export function combatBounds(zone) {
  return zone === 'dungeon' ? { x: 68, z: 53 } : { x: 128, z: 88 };
}

export function combatHeight(zone, tier, x, z) {
  if (zone === 'open_world') {
    // Both banks meet the bridge at zero without a step at either end.
    const bank = Math.min(1, Math.max(0, (Math.abs(x) - 11) / 20));
    return bank * (.065 * x - .075 * z + 2.8 * Math.sin(x / 28) * Math.sin(z / 23));
  }
  const fire = tier >= 3;
  // Boss and exit courts are locally level, with continuously sloping approaches.
  const court = Math.min(1, Math.max(0, (Math.hypot(x, z + 24) - 20) / 15));
  const exit = Math.min(1, Math.max(0, (Math.hypot(x, z - 42) - 8) / 12));
  return court * exit * ((fire ? .14 : .075) * x - .13 * z + 1.5 * Math.sin(x / 18) * Math.sin(z / 19));
}

function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

export function createCombatPlan(zone, tier = 1) {
  const bounds = combatBounds(zone), fire = zone === 'dungeon' && tier >= 3;
  let seed = zone === 'open_world' ? 6201 : fire ? 937 : 493;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const routes = zone === 'open_world' ? [
    [[-124, 0], [-88, 0], [-58, 3], [-26, -2], [-11, 0], [11, 0], [32, 3], [58, 0], [91, 8], [124, 4]],
    [[32, 3], [43, -12], [54, -28]],
    [[58, 0], [69, 14], [78, 30]],
    [[-58, 3], [-66, 25], [-95, 49]],
  ] : [
    [[0, 48], [0, 28], [6, 16], [-4, 4], [0, -8], [0, -24]],
    [[6, 16], [29, 22], [43, 5], [34, -16], [22, -27]],
    [[-4, 4], [-30, 13], [-46, -4], [-36, -26], [-22, -29]],
  ];
  const portals = zone === 'open_world' ? [[-88, 0], [54, -28], [78, 30]] : [[0, 42]];
  const clear = (x, z, margin) => routes.every(route => route.slice(1).every((b, i) => distanceToSegment(x, z, route[i], b) > margin)) && portals.every(p => Math.hypot(x - p[0], z - p[1]) > margin + 7) && (zone !== 'open_world' || Math.abs(x) > 15 + margin) && (zone !== 'dungeon' || Math.hypot(x, z + 24) > 32 + margin);
  const plots = [], rocks = [], trees = [];
  // Half the former building count; independent clustered samples, never rows.
  const target = zone === 'open_world' ? 0 : fire ? 6 : 4;
  const clusters = Array.from({length: 5}, () => ({x:(random()*2-1)*(bounds.x-15),z:(random()*2-1)*(bounds.z-15)}));
  for (let attempt=0; plots.length<target && attempt<20000; attempt++) {
    const cluster=clusters[Math.floor(random()*clusters.length)];
    const x=attempt%3 ? cluster.x+(random()*2-1)*26 : (random()*2-1)*(bounds.x-12);
    const z=attempt%3 ? cluster.z+(random()*2-1)*22 : (random()*2-1)*(bounds.z-12);
    if(Math.abs(x)>bounds.x-10 || Math.abs(z)>bounds.z-10 || !clear(x,z,12)) continue;
    if(plots.some(p=>Math.abs(x-p.x)<16 && Math.abs(z-p.z)<16)) continue;
    plots.push({x,z,y:combatHeight(zone,tier,x,z),rotY:random()*Math.PI*2,scale:.8,floors:1,kind:'house'});
  }
  if(plots.length!==target) throw new Error('Organic combat plot count invariant failed');
  for (let i = 0; i < (zone === 'open_world' ? 650 : 430); i++) {
    const x = (random() * 2 - 1) * (bounds.x - 3), z = (random() * 2 - 1) * (bounds.z - 3);
    if (!clear(x, z, 5) || plots.some(p => Math.hypot(x-p.x, z-p.z) < 10)) continue;
    const item = { x, z, y: combatHeight(zone, tier, x, z), scale: .7 + random() * 1.9, yaw: random() * Math.PI };
    (random() < (fire ? .12 : .64) ? trees : rocks).push(item);
  }
  return { bounds, routes, portals, plots, rocks, trees, fire, landmarks: zone === 'open_world' ? [
    { x: -95, z: 49, title: 'چشم‌انداز دامنه', symbol: '△' },
    { x: 0, z: 0, title: 'پل رودخانه', symbol: '≋' },
  ] : [{ x: 0, z: -24, title: fire ? 'میدان دیو آتش' : 'میدان نگهبان باستانی', symbol: '☠' }] };
}

export function buildCombatLandscape(THREE, kit, materials, zone, tier, plan) {
  const root = new THREE.Group();
  const height = (x, z) => combatHeight(zone, tier, x, z);
  function surface(w, d, x, z, material, lift = 0) {
    const geometry = new THREE.PlaneGeometry(w, d, Math.ceil(w / 3), Math.ceil(d / 3));
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const px = x + vertices.getX(i), pz = z + vertices.getZ(i);
      const riverBed = zone === 'open_world' && Math.abs(px) < 7;
      vertices.setY(i, (riverBed ? -2.3 : height(px, pz)) + lift);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, 0, z); mesh.receiveShadow = true; root.add(mesh);
  }
  const ground = zone === 'open_world' ? kit.materials.ground : plan.fire ? materials.volcanicRock : materials.highlandGrass;
  surface(plan.bounds.x * 2 + 4, plan.bounds.z * 2 + 4, 0, 0, ground);
  // Sloping ribbons share exactly the terrain height; no floating box roads.
  plan.routes.forEach(route => route.slice(1).forEach((b, i) => {
    const a = route[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.ceil(length / 2);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const vertices = [], indices = [];
    for (let j = 0; j <= steps; j++) for (const side of [-1, 1]) {
      const x = a[0] + (b[0]-a[0])*j/steps - dz*side*2.5, z = a[1] + (b[1]-a[1])*j/steps + dx*side*2.5;
      vertices.push(x, height(x, z) + .07, z);
    }
    for (let j = 0; j < steps; j++) { const k = j * 2; indices.push(k, k+1, k+2, k+1, k+3, k+2); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, kit.materials.road); road.receiveShadow = true; root.add(road);
  }));
  if (plan.plots.length) root.add(kit.buildDistrict(plan.plots));
  const matrix = new THREE.Object3D();
  function batch(geometry, material, items, yOffset, scaleY = 1) {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((p, i) => {
      matrix.position.set(p.x, p.y + yOffset * p.scale, p.z); matrix.rotation.set(0, p.yaw, 0); matrix.scale.set(p.scale, p.scale * scaleY, p.scale); matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }
  batch(new THREE.DodecahedronGeometry(1.6, 0), plan.fire ? materials.volcanicRock : materials.mountainRock, plan.rocks, .7, .85);
  batch(new THREE.CylinderGeometry(.18, .3, 3, 6), materials.darkWood, plan.trees, 1.5);
  batch(new THREE.ConeGeometry(1.7, 6, 7), materials.cypressFoliage, plan.trees, 4.4);
  if (plan.fire) {
    // Ember seams are outside traversal routes; warm emissive material is reused.
    batch(new THREE.OctahedronGeometry(.5), materials.portalFire, plan.rocks.filter((_, i) => i % 4 === 0), .7);
  }
  return root;
}
