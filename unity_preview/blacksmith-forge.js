import { BLACKSMITH_PBR, BLACKSMITH_FX } from './blacksmith-textures.js';

/** Real-mesh medieval forge for the offline Three.js/Android village. */
export function createBlacksmithForgeBuilder(THREE) {
  let seed = 61803;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const range = (a, b) => a + random() * (b - a);
  const textureCache = new Map();
  const geometryCache = new Map();
  const forges = [];
  let materials = null;
  const temp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function texture(uri, srgb, repeat = [1, 1], clamp = false) {
    let entry = textureCache.get(uri);
    if (!entry) {
      entry = { image: null, waiting: [] };
      const image = new Image();
      image.onload = () => {
        entry.image = image;
        entry.waiting.forEach(result => {
          result.image = image;
          result.needsUpdate = true;
        });
        entry.waiting.length = 0;
      };
      image.src = uri;
      textureCache.set(uri, entry);
    }
    // A fresh Texture avoids clone() marking an image-less texture for upload.
    const result = new THREE.Texture(entry.image);
    result.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    result.anisotropy = 4;
    result.wrapS = result.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    result.repeat.set(repeat[0], repeat[1]);
    if (entry.image) result.needsUpdate = true;
    else entry.waiting.push(result);
    return result;
  }

  function pbr(stem, repeat, color = 0xffffff) {
    const maps = BLACKSMITH_PBR[stem];
    const orm = texture(maps.orm, false, repeat);
    const material = new THREE.MeshStandardMaterial({
      map: texture(maps.albedo, true, repeat),
      normalMap: texture(maps.normal, false, repeat),
      roughnessMap: orm,
      metalnessMap: orm,
      color,
      roughness: 1,
      metalness: 1
    });
    material.normalScale.set(.78, .78);
    return material;
  }

  function ensureMaterials() {
    if (materials) return;
    materials = {
      stone: pbr('stone', [2.2, 1.15], 0xf4f6f7),
      stoneBlock: pbr('stone', [.19, .17], 0xf0f2f3),
      stoneDark: pbr('stone', [1.4, 1.4], 0x707980),
      wood: pbr('wood', [1, 1.8], 0xe1c9ae),
      woodDark: pbr('wood', [1, 2.2], 0x89766a),
      roof: pbr('roof', [1.7, 2.1], 0xe1e9f2),
      roofTile: pbr('roof', [.21, .14], 0xe6edf4),
      iron: pbr('metal', [1, 1], 0xaeb6bb),
      cobble: pbr('cobble', [3.5, 3.5], 0xd4d9d4),
      cobbleBlock: pbr('cobble', [.17, .14], 0xc3cbc6),
      steel: new THREE.MeshStandardMaterial({ color: 0x87959e, roughness: .3, metalness: .88 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc18a32, roughness: .34, metalness: .82 }),
      coal: new THREE.MeshStandardMaterial({ color: 0x101418, roughness: .9 }),
      moss: new THREE.MeshStandardMaterial({ color: 0x263e20, roughness: 1 }),
      ember: new THREE.MeshStandardMaterial({ color: 0xff5311, emissive: 0xff2704, emissiveIntensity: 2.8, roughness: .65 }),
      window: new THREE.MeshStandardMaterial({ color: 0xffa632, emissive: 0xff5a12, emissiveIntensity: 2.1, roughness: .5 }),
      water: new THREE.MeshStandardMaterial({ color: 0x172f3b, roughness: .12, metalness: .08, transparent: true, opacity: .68, depthWrite: false })
    };
  }

  function boxGeometry(w, h, d) {
    const key = `b${w},${h},${d}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geometryCache.get(key);
  }

  function cylinderGeometry(rt, rb, h, segments = 12) {
    const key = `c${rt},${rb},${h},${segments}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.CylinderGeometry(rt, rb, h, segments));
    return geometryCache.get(key);
  }

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadows = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = shadows;
    object.receiveShadow = shadows;
    parent.add(object);
    return object;
  }

  function box(parent, w, h, d, material, x = 0, y = 0, z = 0, shadows = true) {
    return mesh(parent, boxGeometry(w, h, d), material, x, y, z, shadows);
  }

  function cylinder(parent, rt, rb, h, material, x = 0, y = 0, z = 0, segments = 12, shadows = true) {
    return mesh(parent, cylinderGeometry(rt, rb, h, segments), material, x, y, z, shadows);
  }

  function beam(parent, start, end, thickness, material) {
    const delta = end.clone().sub(start);
    const object = box(parent, thickness, delta.length(), thickness, material, 0, 0, 0);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up, delta.normalize());
    return object;
  }

  /** Merge only a static root by material; doors, fire, lights and particles stay independent. */
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map();
    group.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material)) return;
      const key = object.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: object.material, items: [] });
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      buckets.get(key).items.push({ mesh: object, geometry });
    });
    buckets.forEach(({ material, items }) => {
      if (items.length < 2) {
        items.forEach(item => item.geometry.dispose());
        return;
      }
      const count = items.reduce((sum, item) => sum + item.geometry.attributes.position.count, 0);
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      const uvs = new Float32Array(count * 2);
      let offset = 0;
      items.forEach(({ geometry }) => {
        positions.set(geometry.attributes.position.array, offset * 3);
        normals.set(geometry.attributes.normal.array, offset * 3);
        if (geometry.attributes.uv) uvs.set(geometry.attributes.uv.array, offset * 2);
        offset += geometry.attributes.position.count;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const merged = new THREE.Mesh(geometry, material);
      merged.castShadow = items.some(item => item.mesh.castShadow);
      merged.receiveShadow = items.some(item => item.mesh.receiveShadow);
      items.forEach(item => {
        item.mesh.parent.remove(item.mesh);
        item.geometry.dispose();
      });
      group.add(merged);
    });
  }

  function makeWindow(parent, x, y, z, yaw = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    box(group, 1.08, 1.36, .09, materials.window, 0, 0, 0, false);
    [-1, 1].forEach(side => {
      box(group, .15, 1.62, .16, materials.woodDark, side * .61, 0, .09);
      const shutter = box(group, .58, 1.5, .11, materials.wood, side * .99, 0, -.02);
      shutter.rotation.y = side * .33;
      box(group, 1.38, .15, .16, materials.woodDark, 0, side * .75, .09);
    });
    box(group, .065, 1.4, .07, materials.iron, 0, 0, .14);
    box(group, 1.12, .065, .07, materials.iron, 0, 0, .14);
    parent.add(group);
  }

  function makeSword(parent, x, y, z, scale = 1, angle = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.rotation.z = angle;
    cylinder(group, .055, .055, .4, materials.woodDark, 0, .2, 0, 8);
    mesh(group, new THREE.SphereGeometry(.08, 8, 6), materials.gold, 0, -.03, 0);
    box(group, .58, .09, .13, materials.gold, 0, .46, 0);
    const blade = box(group, .17, 1.05, .055, materials.steel, 0, 1.0, 0);
    blade.scale.x = .82;
    mesh(group, new THREE.ConeGeometry(.12, .38, 4), materials.steel, 0, 1.7, 0);
    parent.add(group);
    return group;
  }

  function makeShield(parent, x, y, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    const shape = new THREE.Shape();
    shape.moveTo(-.5, .55); shape.lineTo(.5, .55); shape.lineTo(.46, -.12);
    shape.lineTo(0, -.65); shape.lineTo(-.46, -.12); shape.closePath();
    mesh(group, new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1 }), materials.steel, 0, 0, -.05);
    box(group, .075, .72, .035, materials.gold, 0, .02, .13);
    box(group, .55, .07, .035, materials.gold, 0, .2, .13);
    mesh(group, new THREE.SphereGeometry(.13, 10, 7), materials.iron, 0, .06, .17);
    parent.add(group);
  }

  function makeAnvil(parent, x, y, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z); group.scale.setScalar(scale);
    box(group, 1.18, .2, .7, materials.iron, 0, .1, 0);
    box(group, .7, .22, .5, materials.iron, 0, .3, 0);
    box(group, .44, .34, .42, materials.iron, 0, .54, 0);
    box(group, 1.35, .23, .64, materials.steel, 0, .79, 0);
    box(group, .43, .22, .56, materials.iron, -.82, .78, 0);
    const horn = mesh(group, new THREE.ConeGeometry(.2, .78, 12), materials.steel, .91, .8, 0);
    horn.rotation.z = -Math.PI / 2;
    parent.add(group);
  }

  function makeBarrel(parent, x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale);
    cylinder(group, .48, .52, 1.28, materials.woodDark, 0, .64, 0, 14);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      const stave = box(group, .18, 1.24, .09, materials.wood, Math.sin(a) * .49, .65, Math.cos(a) * .49);
      stave.rotation.y = a;
    }
    [.18, .64, 1.1].forEach(y => {
      const hoop = mesh(group, new THREE.TorusGeometry(.52, .035, 6, 18), materials.iron, 0, y, 0);
      hoop.rotation.x = Math.PI / 2;
    });
    parent.add(group);
  }

  function makeCrate(parent, x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale);
    box(group, 1.15, 1.05, 1.15, materials.wood, 0, .53, 0);
    [-.48, .48].forEach(v => {
      box(group, .09, 1.09, 1.19, materials.iron, v, .54, 0);
      box(group, 1.19, 1.09, .09, materials.iron, 0, .54, v);
    });
    parent.add(group);
  }

  function makeLantern(parent, x, y, z, withLight, lanterns) {
    const group = new THREE.Group(); group.position.set(x, y, z);
    box(group, .1, .8, .1, materials.iron, 0, .45, -.2);
    beam(group, new THREE.Vector3(0, .78, -.2), new THREE.Vector3(0, .78, .34), .07, materials.iron);
    const glow = box(group, .34, .57, .34, materials.window, 0, .1, .35, false);
    box(group, .48, .1, .48, materials.iron, 0, -.22, .35);
    mesh(group, new THREE.ConeGeometry(.39, .28, 4), materials.iron, 0, .54, .35).rotation.y = Math.PI / 4;
    [-1, 1].forEach(a => [-1, 1].forEach(b => box(group, .045, .68, .045, materials.iron, a * .19, .1, .35 + b * .19)));
    let light = null;
    if (withLight) {
      light = new THREE.PointLight(0xff9b45, 24, 11, 2);
      light.position.set(0, .12, .62); group.add(light);
    }
    lanterns.push({ glow, light, phase: random() * 6, intensity: 24 });
    parent.add(group);
  }

  function makeSign(parent) {
    box(parent, 4.1, .24, .28, materials.woodDark, 0, 6.35, 4.48);
    [-1, 1].forEach(side => {
      for (let i = 0; i < 4; i++) {
        const link = mesh(parent, new THREE.TorusGeometry(.085, .018, 5, 10), materials.iron, side * 1.02, 6.22 - i * .18, 4.61);
        link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      }
    });
    box(parent, 2.95, 1.58, .22, materials.woodDark, 0, 5.12, 4.63);
    box(parent, 3.02, .1, .08, materials.gold, 0, 5.89, 4.78);
    box(parent, 3.02, .1, .08, materials.gold, 0, 4.35, 4.78);
    [-1, 1].forEach(side => {
      box(parent, .09, 1.52, .08, materials.gold, side * 1.45, 5.12, 4.78);
      const handle = box(parent, .1, 1.22, .08, materials.wood, 0, 5.27, 4.81);
      handle.rotation.z = side * .75;
      const head = box(parent, .56, .22, .13, materials.steel, -side * .4, 5.74, 4.85);
      head.rotation.z = side * .75;
    });
    box(parent, 1.12, .18, .12, materials.steel, 0, 5.06, 4.96);
    box(parent, .34, .31, .12, materials.steel, 0, 4.86, 4.96);
    box(parent, .78, .13, .12, materials.steel, 0, 4.67, 4.96);

    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 160);
    ctx.font = '700 74px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.fillStyle = '#e9bd62';
    ctx.fillText("KAVEH'S FORGE", 512, 82);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
    mesh(parent, new THREE.PlaneGeometry(2.65, .42), material, 0, 4.45, 4.9, false);
  }

  function makeBrazier(parent, x, y, z, scale = 1) {
    const group = new THREE.Group();
    group.name = 'Exterior forged brazier';
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    cylinder(group, .58, .4, .3, materials.iron, 0, 1.02, 0, 16);
    const rim = mesh(group, new THREE.TorusGeometry(.53, .055, 8, 20), materials.iron, 0, 1.18, 0);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      beam(group, new THREE.Vector3(Math.cos(a) * .34, .98, Math.sin(a) * .34),
        new THREE.Vector3(Math.cos(a) * .48, .12, Math.sin(a) * .48), .085, materials.iron);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      const coal = mesh(group, new THREE.DodecahedronGeometry(.13 + (i % 2) * .035, 0),
        i % 3 === 0 ? materials.ember : materials.coal,
        Math.cos(a) * .32, 1.2 + (i % 2) * .035, Math.sin(a) * .32, false);
      coal.rotation.set(random(), random(), random());
    }
    parent.add(group);
  }

  function makeExteriorDetails(parent) {
    // Dressed voussoirs make the entrance read as a built stone arch, while
    // the actual door and its independent hinge remain untouched.
    for (let i = 0; i < 7; i++) {
      const stone = box(parent, .62, .42, .32, materials.stoneBlock,
        -1.86 + i * .62, 4.22 + Math.abs(i - 3) * .035, 4.35);
      stone.rotation.z = (i - 3) * .075;
    }

    // A small forged medallion and spokes give the closed gable a readable
    // silhouette at the normal village camera distance.
    mesh(parent, new THREE.TorusGeometry(.36, .045, 8, 20), materials.gold, 0, 6.35, 4.34);
    for (let i = 0; i < 4; i++) {
      const spoke = box(parent, .055, .62, .055, materials.gold, 0, 6.35, 4.38);
      spoke.rotation.z = i * Math.PI / 4;
    }

    // Ridge finials finish both ends of the now permanently closed roof.
    [-1, 1].forEach(side => {
      cylinder(parent, .075, .075, .38, materials.iron, 0, 7.91, side * 4.45, 10);
      mesh(parent, new THREE.ConeGeometry(.16, .48, 6), materials.gold, 0, 8.29, side * 4.45);
    });

    // Extra hand-forged fasteners on the front posts; all use the existing
    // metal PBR material and are merged with the static architecture later.
    [-1, 1].forEach(side => {
      for (let i = 0; i < 4; i++) {
        const rivet = cylinder(parent, .05, .05, .075, materials.iron,
          side * 4.56, 1.15 + i * .9, 4.19, 8);
        rivet.rotation.x = Math.PI / 2;
      }
    });

    // The purchase screen replaces the interior, so the working fire belongs
    // outside where it is visible from the street and the approach camera.
    makeBrazier(parent, 2.2, 0, 4.95, 1);
  }

  function makeParticleCloud(parent, kind, count, origin) {
    const positions = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const maxAge = kind === 'smoke' ? 5.2 : 1.35;
    for (let i = 0; i < count; i++) {
      ages[i] = random() * maxAge;
      positions[i * 3] = origin.x + range(-.18, .18) + (kind === 'smoke' ? ages[i] * .12 : 0);
      positions[i * 3 + 1] = origin.y + ages[i] * (kind === 'smoke' ? .72 : 1.25);
      positions[i * 3 + 2] = origin.z + range(-.16, .16);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: texture(BLACKSMITH_FX[kind === 'smoke' ? 'smoke' : 'spark'], true, [1, 1], true),
      color: kind === 'smoke' ? 0x8e9aa8 : 0xff7a22,
      size: kind === 'smoke' ? 2.1 : .18,
      transparent: true,
      opacity: kind === 'smoke' ? .27 : .9,
      depthWrite: false,
      blending: kind === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; parent.add(points);
    return { kind, points, positions, ages, origin: origin.clone(), maxAge };
  }

  function build(shopDef) {
    ensureMaterials();
    const group = new THREE.Group();
    group.name = 'Kaveh medieval blacksmith — real PBR meshes';
    group.position.set(shopDef.pos.x, 0, shopDef.pos.z);
    group.rotation.y = shopDef.rotY || 0;
    const architecture = new THREE.Group(); architecture.name = 'Forge static architecture and props';
    const roof = new THREE.Group(); roof.name = 'Forge closed exterior roof — never culled for interior view';
    const dynamic = new THREE.Group(); dynamic.name = 'Forge animated door lights and FX';
    group.add(architecture, roof, dynamic);

    // Closed exterior shell: the purchase UI replaces interior traversal.
    box(architecture, 9.55, .16, 7.65, materials.stone, 0, .015, 0);
    box(architecture, .46, 3.86, 7.7, materials.stone, -4.75, 2.66, 0);
    box(architecture, .46, 3.86, 7.7, materials.stone, 4.75, 2.66, 0);
    box(architecture, 9.55, 3.86, .46, materials.stone, 0, 2.66, -3.85);
    box(architecture, 3.2, 3.86, .46, materials.stone, -3.18, 2.66, 3.85);
    box(architecture, 3.2, 3.86, .46, materials.stone, 3.18, 2.66, 3.85);
    box(architecture, 3.2, .82, .46, materials.stone, 0, 4.18, 3.85);
    box(architecture, 2.85, .18, .75, materials.stoneBlock, 0, .09, 4.06);

    for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
      const x = -4.5 + i;
      [-1, 1].forEach(side => {
        if (side > 0 && Math.abs(x) < 1.65) return;
        const stone = box(architecture, .94, .43, .54, materials.stoneBlock, x, .29 + row * .47, side * 3.94);
        stone.rotation.set(range(-.015, .015), range(-.025, .025), range(-.015, .015));
      });
    }

    // Individually laid, slightly chipped ashlar veneer. These are real
    // meshes, not a flat wall texture; the doorway remains completely open.
    [-1, 1].forEach(side => {
      for (let row = 0; row < 7; row++) for (let col = 0; col < 8; col++) {
        const stone = box(architecture, .22 + range(0, .06), .42 + range(0, .08), .82 + range(0, .16), materials.stoneBlock,
          side * 4.99, .98 + row * .51, -3.45 + col * .98 + (row % 2) * .08);
        stone.rotation.set(range(-.018, .018), range(-.025, .025), range(-.018, .018));
      }
    });
    for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) {
      const stone = box(architecture, .91 + range(0, .16), .42 + range(0, .08), .22 + range(0, .06), materials.stoneBlock,
        -4.25 + col * 1.06 + (row % 2) * .09, .98 + row * .51, -4.02);
      stone.rotation.set(range(-.018, .018), range(-.025, .025), range(-.018, .018));
    }
    [-1, 1].forEach(side => {
      for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) {
        const stone = box(architecture, .68 + range(0, .14), .39 + range(0, .08), .18 + range(0, .09), materials.stoneBlock,
          side * (2.02 + col * .82 + (row % 2) * .08), .98 + row * .51, 4.04);
        stone.rotation.set(range(-.018, .018), range(-.025, .025), range(-.018, .018));
      }
      for (let row = 0; row < 7; row++) {
        box(architecture, .55, .44, row % 2 ? .3 : .42, materials.stoneBlock, side * 4.86, 1.02 + row * .51, 4.12);
      }
    });
    for (let col = 0; col < 5; col++) {
      const stone = box(architecture, .78, .48, .28, materials.stoneBlock, -1.7 + col * .85, 4.2, 4.08);
      stone.rotation.y = range(-.02, .02);
    }

    [-1, 1].forEach(x => [-1, 1].forEach(z => {
      box(architecture, .32, 4.65, .34, materials.woodDark, x * 4.56, 2.55, z * 3.98);
      for (let i = 0; i < 3; i++) box(architecture, .37, .13, .39, materials.iron, x * 4.56, 1.05 + i * 1.45, z * 3.98);
    }));
    [-1, 1].forEach(side => {
      box(architecture, .31, 3.85, .38, materials.woodDark, side * 1.52, 1.92, 4.09);
      box(architecture, .24, 4.35, .28, materials.wood, side * 3.12, 2.57, 4.08);
      beam(architecture, new THREE.Vector3(side * 4.38, 1.03, 4.11), new THREE.Vector3(side * 2.02, 3.63, 4.11), .22, materials.woodDark);
      beam(architecture, new THREE.Vector3(side * 4.55, 4.5, 4.1), new THREE.Vector3(0, 7.33, 4.1), .27, materials.woodDark);
      box(architecture, .34, .28, 8.35, materials.woodDark, side * 4.56, 4.48, 0);
    });
    box(architecture, 3.45, .34, .43, materials.woodDark, 0, 3.86, 4.1);
    box(architecture, 9.65, .31, .35, materials.woodDark, 0, 4.52, 4.09);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-4.78, 0); gableShape.lineTo(4.78, 0); gableShape.lineTo(0, 2.82); gableShape.closePath();
    const gableGeometry = new THREE.ExtrudeGeometry(gableShape, { depth: .42, bevelEnabled: false });
    mesh(architecture, gableGeometry, materials.stone, 0, 4.52, 3.65);
    const rearGable = mesh(architecture, gableGeometry, materials.stone, 0, 4.52, -3.65);
    rearGable.rotation.y = Math.PI;

    // Individually placed overlapping slate tiles, merged by material for mobile.
    [-1, 1].forEach(side => {
      const substrate = box(roof, 6.35, .24, 9.25, materials.roof, side * 2.73, 6.03, 0);
      substrate.rotation.z = -side * 29 * Math.PI / 180;
      box(roof, .28, .3, 9.45, materials.woodDark, side * 5.22, 4.51, 0);
      for (let row = 0; row < 8; row++) {
        const t = (row + .45) / 8;
        for (let col = 0; col < 9; col++) {
          const tile = box(roof, .87, .105, 1.02, materials.roofTile,
            side * (.15 + t * 5.25), 7.63 - t * 3.02 + row * .006,
            -4.35 + col * 1.085 + (row % 2) * .07);
          tile.rotation.set(range(-.01, .01), range(-.014, .014), -side * 29 * Math.PI / 180 + range(-.012, .012));
        }
      }
      for (let i = 0; i < 7; i++) beam(roof, new THREE.Vector3(side * .12, 7.35, -4.2 + i * 1.4), new THREE.Vector3(side * 5.32, 4.39, -4.2 + i * 1.4), .18, materials.woodDark);
      const gutter = cylinder(roof, .11, .11, 9.45, materials.iron, side * 5.22, 4.38, 0, 12);
      gutter.rotation.x = Math.PI / 2;
      const downspout = cylinder(roof, .075, .075, 4.25, materials.iron, side * 5.22, 2.25, -4.12, 10);
      for (let i = 0; i < 4; i++) box(roof, .28, .09, .12, materials.iron, side * 5.22, .65 + i * 1.05, -4.12);
    });
    for (let i = 0; i < 10; i++) {
      const cap = cylinder(roof, .215, .215, 1.06, materials.roofTile, 0, 7.72, -4.45 + i * .99, 12);
      cap.rotation.x = Math.PI / 2;
    }

    // One complete oak door on an independent left hinge.
    const door = new THREE.Group(); door.name = 'Proximity animated oak door'; door.position.set(-1.4, 0, 4.13); dynamic.add(door);
    for (let i = 0; i < 6; i++) box(door, .45, 3.48 - (i % 2) * .045, .19, i % 2 ? materials.woodDark : materials.wood, (i + .5) * (2.8 / 6), 1.75, 0);
    for (let i = 0; i < 3; i++) {
      const y = .55 + i * 1.14;
      box(door, 2.69, .15, .075, materials.iron, 1.4, y, .125);
      for (let j = 0; j < 3; j++) {
        const rivet = cylinder(door, .05, .05, .07, materials.iron, .18 + j * 1.21, y, .19, 8);
        rivet.rotation.x = Math.PI / 2;
      }
      cylinder(door, .095, .095, .48, materials.iron, .02, y, .03, 10);
    }
    box(door, .25, .4, .09, materials.iron, 2.31, 1.64, .15);
    mesh(door, new THREE.TorusGeometry(.17, .032, 7, 16), materials.steel, 2.31, 1.58, .27);

    makeSign(architecture);
    makeWindow(architecture, -3.15, 2.38, 4.19);
    makeWindow(architecture, 3.15, 2.38, 4.19);
    makeWindow(architecture, -5.14, 2.5, -.9, -Math.PI / 2);
    makeWindow(architecture, 5.14, 2.5, -.9, Math.PI / 2);
    makeExteriorDetails(architecture);

    // Stone chimney with soot-dark outlet.
    box(architecture, 1.22, 4.9, 1.22, materials.stoneDark, -3, 7.15, -1.8);
    for (let course = 0; course < 11; course++) for (let side = -1; side <= 1; side += 2) {
      box(architecture, 1.18, .39, .24, materials.stoneBlock, -3 + (course % 2 ? -.08 : .08), 4.95 + course * .43, -1.8 + side * .62);
      box(architecture, .24, .39, 1.18, materials.stoneBlock, -3 + side * .62, 4.95 + course * .43, -1.8 - (course % 2 ? -.08 : .08));
    }
    box(architecture, .86, .12, .86, materials.coal, -3, 9.81, -1.8);

    // Exterior weapon rack, armor stand, anvil and lived-in supplies.
    [-4.7, -2.4].forEach(x => box(architecture, .17, 2.35, .2, materials.woodDark, x, 1.3, 4.75));
    for (let i = 0; i < 3; i++) box(architecture, 2.5, .14, .18, materials.wood, -3.55, .57 + i * .78, 4.75);
    makeSword(architecture, -4.37, .57, 4.94, .9, -.1);
    makeSword(architecture, -3.83, .55, 4.95, 1.02, .07);
    makeSword(architecture, -3.3, .58, 4.95, .84, -.05);
    makeShield(architecture, -2.69, 1.2, 5.02, .9);
    makeCrate(architecture, -5.25, 5.15, .85);
    makeBarrel(architecture, -5.85, 3.85, .9);
    makeBarrel(architecture, 6.65, 3.6, .85);
    makeCrate(architecture, 7.9, 5.4, 1);
    makeCrate(architecture, 8.65, 6.35, .72);
    cylinder(architecture, .52, .58, .9, materials.woodDark, 5.6, .45, 4.45, 14);
    makeAnvil(architecture, 5.6, .88, 4.45, 1.05);

    // Side lean-to and a readable armor silhouette.
    [-1, 1].forEach(side => {
      box(architecture, .22, 3.44, .22, materials.woodDark, 6.85, 1.72, .6 + side * 2.25);
      beam(architecture, new THREE.Vector3(6.85, 2.5, .6 + side * 2.25), new THREE.Vector3(5.6, 3.55, .6 + side * 2.25), .16, materials.wood);
    });
    const awning = box(architecture, 3.05, .18, 5.35, materials.roof, 5.82, 3.65, .6); awning.rotation.z = -.21;
    box(architecture, 3.15, .22, .22, materials.woodDark, 5.82, 3.43, 3.25);
    box(architecture, .13, 2.3, .13, materials.woodDark, 5.95, 1.25, .75);
    box(architecture, 1.3, .12, .12, materials.wood, 5.95, 1.82, .75);
    const cuirass = mesh(architecture, new THREE.SphereGeometry(.5, 14, 10), materials.steel, 5.95, 1.53, .75); cuirass.scale.set(.82, 1.02, .53);
    [-1, 1].forEach(side => {
      const shoulder = mesh(architecture, new THREE.SphereGeometry(.25, 10, 7), materials.steel, 5.95 + side * .47, 1.82, .75); shoulder.scale.set(1.2, .7, 1);
      cylinder(architecture, .1, .12, .72, materials.steel, 5.95 + side * .5, 1.32, .75, 10);
    });
    const helm = mesh(architecture, new THREE.SphereGeometry(.28, 12, 8), materials.steel, 5.95, 2.3, .75); helm.scale.set(.95, 1, .9);
    box(architecture, .36, .07, .035, materials.coal, 5.95, 2.28, 1.01, false);
    makeShield(architecture, 6.67, .95, .87, .82);
    for (let i = 0; i < 14; i++) {
      const coal = mesh(architecture, new THREE.DodecahedronGeometry(range(.12, .24), 0), materials.coal, 6.9 + range(-.75, .75), .12 + (i % 3) * .08, 2.95 + range(-.55, .55));
      coal.rotation.set(random(), random(), random());
    }
    for (let i = 0; i < 7; i++) box(architecture, .38, .14, 1.05, materials.iron, 7.7 + (i % 2) * .42, .12 + Math.floor(i / 2) * .16, 1.9);

    // Exterior-only presentation: no walkable workshop interior is built.

    // Cobbled foreground, moss, puddles and ingots leave the entrance clear.
    box(architecture, 16, .12, 8.5, materials.cobble, 1.2, .015, 6.4, false);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) {
      if (Math.abs(col - 5.5) < 1.3 && row < 2) continue;
      const stone = box(architecture, .78, .1, .64, materials.cobbleBlock, -4.8 + col * .92 + (row % 2) * .35, .09, 4.7 + row * 1.15);
      stone.rotation.y = range(-.07, .07);
    }
    for (let i = 0; i < 12; i++) {
      const moss = mesh(architecture, new THREE.SphereGeometry(.18, 7, 5), materials.moss, range(-6.5, 7), .07, range(4.2, 9.5), false);
      moss.scale.set(range(.7, 1.7), .12, range(.7, 1.5));
    }
    for (let i = 0; i < 3; i++) {
      const puddle = cylinder(architecture, .68 + i * .11, .68 + i * .11, .018, materials.water, -3.5 + i * 4.2, .1, 7.2 + (i % 2) * 1.3, 24, false);
      puddle.scale.z = .65;
    }

    const lanterns = [];
    makeLantern(dynamic, -1.98, 3.15, 4.55, true, lanterns);
    makeLantern(dynamic, 1.98, 3.15, 4.55, true, lanterns);
    const flames = [];
    for (let i = 0; i < 6; i++) {
      const flame = mesh(dynamic, new THREE.ConeGeometry(.13, .55 + (i % 3) * .12, 8), materials.ember,
        2.02 + (i % 3) * .18, 1.28 + (i % 2) * .08, 4.82 + Math.floor(i / 3) * .16, false);
      flames.push({ mesh: flame, base: flame.scale.clone(), phase: random() * 6 });
    }
    const fireLight = new THREE.PointLight(0xff6a28, 32, 16, 2); fireLight.position.set(2.2, 1.65, 4.95); dynamic.add(fireLight);
    const smoke = makeParticleCloud(dynamic, 'smoke', 18, new THREE.Vector3(-3, 10.02, -1.8));
    const sparks = makeParticleCloud(dynamic, 'spark', 14, new THREE.Vector3(2.2, 1.25, 4.95));

    mergeStatic(architecture);
    mergeStatic(roof);
    forges.push({ group, roof, door, lanterns, flames, fireLight, smoke, sparks, open: 0 });
    return group;
  }

  function updateParticles(particle, dt) {
    const { positions, ages, origin, kind, maxAge } = particle;
    for (let i = 0; i < ages.length; i++) {
      ages[i] += dt;
      if (ages[i] >= maxAge) {
        ages[i] = 0;
        positions[i * 3] = origin.x + range(-.16, .16);
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z + range(-.14, .14);
      } else {
        positions[i * 3] += dt * (kind === 'smoke' ? .13 : Math.sin(ages[i] * 8 + i) * .08);
        positions[i * 3 + 1] += dt * (kind === 'smoke' ? .72 : 1.25);
        if (kind === 'smoke') positions[i * 3 + 2] += dt * .04;
      }
    }
    particle.points.geometry.attributes.position.needsUpdate = true;
  }

  function update(elapsed, dt, heroPosition) {
    forges.forEach(forge => {
      let near = false;
      if (heroPosition) {
        temp.copy(heroPosition);
        forge.group.worldToLocal(temp);
        const dx = temp.x;
        const dz = temp.z - 3.2;
        near = dx * dx + dz * dz < 72;
      }
      const target = near ? 1 : 0;
      forge.open += (target - forge.open) * (1 - Math.exp(-dt * 4.6));
      forge.door.rotation.y = forge.open * 108 * Math.PI / 180;
      forge.roof.visible = true; // Exterior-only: never cut away the closed roof.
      forge.lanterns.forEach(item => {
        const flicker = 1 + Math.sin(elapsed * 8.2 + item.phase) * .055 + Math.sin(elapsed * 17.1 + item.phase) * .025;
        item.glow.scale.setScalar(flicker);
        if (item.light) item.light.intensity = item.intensity * flicker;
      });
      const fireFlicker = 1 + Math.sin(elapsed * 9.7) * .08 + Math.sin(elapsed * 23.3) * .035;
      forge.fireLight.intensity = 32 * fireFlicker;
      forge.flames.forEach((item, i) => {
        const pulse = .86 + Math.sin(elapsed * 8.5 + item.phase + i) * .14;
        item.mesh.scale.set(item.base.x * (1.04 - pulse * .06), item.base.y * pulse, item.base.z * (1.04 - pulse * .06));
      });
      updateParticles(forge.smoke, dt);
      updateParticles(forge.sparks, dt);
    });
  }

  function reset() {
    forges.length = 0;
  }

  return { build, update, reset };
}
