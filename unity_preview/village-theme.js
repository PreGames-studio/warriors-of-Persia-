import { createBlacksmithForgeBuilder } from './blacksmith-forge.js';

/**
 * Procedural Persian village art kit.
 * Real walkable 3D geometry, local canvas textures and mobile-friendly lights.
 */
export function createPersianVillageKit(THREE) {
  const medievalForge = createBlacksmithForgeBuilder(THREE);
  let seed = 937421;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const geometryCache = new Map();
  const animated = { lamps: [], waters: [], orbs: [], dust: null };

  function canvasTexture(size, painter) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    painter(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function noise(ctx, size, amount, light = 255, alpha = .08) {
    for (let i = 0; i < amount; i++) {
      const value = Math.floor(random() * light);
      ctx.fillStyle = `rgba(${value},${value},${value},${alpha * random()})`;
      const d = .5 + random() * 2.5;
      ctx.fillRect(random() * size, random() * size, d, d);
    }
  }

  const textures = {
    adobe: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#9c7954'; ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 2800, 210, .11);
      ctx.lineWidth = 1;
      for (let y = 0; y < s; y += 32) {
        ctx.strokeStyle = 'rgba(53,35,22,.24)';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
        const offset = (y / 32) % 2 ? 27 : 0;
        for (let x = offset; x < s; x += 55) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(235,203,155,.08)';
        ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(s, y + 1); ctx.stroke();
      }
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = 'rgba(48,30,18,.16)';
        ctx.beginPath();
        const x = random() * s, y = random() * s;
        ctx.moveTo(x, y); ctx.lineTo(x + random() * 14 - 7, y + random() * 16); ctx.stroke();
      }
    }),
    stone: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#31362f'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 42) {
        const offset = (y / 42) % 2 ? -30 : 0;
        for (let x = offset; x < s; x += 62) {
          const v = 79 + Math.floor(random() * 28);
          ctx.fillStyle = `rgb(${v + 12},${v + 8},${v})`;
          ctx.fillRect(x + 2, y + 2, 58, 38);
          ctx.strokeStyle = 'rgba(218,199,159,.13)'; ctx.strokeRect(x + 3, y + 3, 56, 35);
        }
      }
      noise(ctx, s, 1600, 190, .1);
    }),
    cobble: canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#252b27'; ctx.fillRect(0, 0, s, s);
      const rowH = 42;
      for (let row = 0; row < 13; row++) {
        const y = row * rowH;
        const offset = row % 2 ? -31 : 0;
        for (let col = -1; col < 9; col++) {
          const x = offset + col * 66;
          const v = 79 + Math.floor(random() * 31);
          ctx.fillStyle = `rgb(${v + 9},${v + 7},${v + 2})`;
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 5 + random() * 3);
          ctx.lineTo(x + 57, y + 3 + random() * 3);
          ctx.lineTo(x + 63, y + 32 + random() * 4);
          ctx.lineTo(x + 8, y + 38 - random() * 3);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(197,181,145,.16)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.strokeStyle = 'rgba(15,20,17,.28)';
          ctx.beginPath(); ctx.moveTo(x + 9, y + 34); ctx.lineTo(x + 57, y + 30); ctx.stroke();
        }
      }
      noise(ctx, s, 2600, 170, .12);
    }),
    ground: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#24352a'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1200; i++) {
        const green = 36 + Math.floor(random() * 30);
        ctx.fillStyle = `rgba(${25 + Math.floor(random() * 18)},${green},${29 + Math.floor(random() * 15)},.35)`;
        ctx.fillRect(random() * s, random() * s, 1 + random() * 3, 1 + random() * 4);
      }
      noise(ctx, s, 1400, 130, .09);
    }),
    wood: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#493321'; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 42) {
        ctx.fillStyle = x % 84 ? 'rgba(126,86,46,.13)' : 'rgba(26,14,8,.13)';
        ctx.fillRect(x, 0, 39, s);
        ctx.strokeStyle = 'rgba(15,9,5,.42)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          ctx.strokeStyle = 'rgba(197,143,79,.1)';
          ctx.beginPath();
          const sx = x + random() * 36;
          ctx.moveTo(sx, 0); ctx.bezierCurveTo(sx + 8, 70, sx - 7, 160, sx + 3, s); ctx.stroke();
        }
      }
      noise(ctx, s, 900, 150, .09);
    }),
    tile: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#176c6c'; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(129,211,193,.48)'; ctx.lineWidth = 2;
      for (let x = 0; x <= s; x += 64) for (let y = 0; y <= s; y += 64) {
        ctx.save(); ctx.translate(x + 32, y + 32); ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-20, -20, 40, 40); ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(8,44,45,.65)';
      for (let i = 0; i <= s; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke(); }
      noise(ctx, s, 500, 210, .07);
    }),
    rug: canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#572a28'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#b08a4e'; ctx.fillRect(12, 12, s - 24, s - 24);
      ctx.fillStyle = '#202f2b'; ctx.fillRect(21, 21, s - 42, s - 42);
      ctx.fillStyle = '#7d3830'; ctx.fillRect(42, 42, s - 84, s - 84);
      ctx.strokeStyle = '#d0ad68'; ctx.lineWidth = 5;
      for (let y = 80; y < s - 50; y += 118) for (let x = 82; x < s - 50; x += 116) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-28, -28, 56, 56); ctx.strokeRect(-13, -13, 26, 26); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(235,203,137,.55)'; ctx.lineWidth = 2; ctx.strokeRect(29, 29, s - 58, s - 58);
      noise(ctx, s, 3200, 190, .07);
    }),
    heroLeather: canvasTexture(1024, (ctx, s) => {
      let localSeed = 74119;
      const rnd = () => ((localSeed = (localSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
      ctx.fillStyle = '#39271c'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 14500; i++) {
        const v = 42 + Math.floor(rnd() * 48);
        ctx.fillStyle = `rgba(${v + 18},${v + 5},${v},${.05 + rnd() * .13})`;
        const d = .6 + rnd() * 2.4;
        ctx.fillRect(rnd() * s, rnd() * s, d, d);
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < 150; i++) {
        ctx.strokeStyle = `rgba(212,155,100,${.025 + rnd() * .05})`;
        const x = rnd() * s, y = rnd() * s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12 + rnd() * 55, y + rnd() * 5 - 2.5); ctx.stroke();
      }
    }),
    heroCape: canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#35181b'; ctx.fillRect(0, 0, s, s);
      const gradient = ctx.createLinearGradient(0, 0, s, 0);
      gradient.addColorStop(0, 'rgba(0,0,0,.35)'); gradient.addColorStop(.5, 'rgba(128,56,44,.2)'); gradient.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#a77b38'; ctx.lineWidth = 13; ctx.strokeRect(16, 16, s - 32, s - 32);
      ctx.strokeStyle = '#d0a657'; ctx.lineWidth = 3; ctx.strokeRect(29, 29, s - 58, s - 58);
      for (let y = 52; y < s - 40; y += 64) {
        ctx.save(); ctx.translate(32, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-10, -10, 20, 20); ctx.restore();
        ctx.save(); ctx.translate(s - 32, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-10, -10, 20, 20); ctx.restore();
      }
    }),
    awning: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#b7a986'; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 64) { ctx.fillStyle = '#4d5548'; ctx.fillRect(x, 0, 32, s); }
      noise(ctx, s, 1000, 180, .08);
    }),
    sky: canvasTexture(1024, (ctx, s) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, s);
      gradient.addColorStop(0, '#2f7fc4');
      gradient.addColorStop(.42, '#65b1e2');
      gradient.addColorStop(.72, '#9fd2ee');
      gradient.addColorStop(1, '#d3e5e7');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
      // Soft deterministic cloud banks; the texture keeps its original 1K size.
      let cloudSeed = 91427;
      const rnd = () => ((cloudSeed = (cloudSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 24; i++) {
        const x = rnd() * s, y = (.12 + rnd() * .48) * s;
        const radius = 24 + rnd() * 48;
        ctx.save(); ctx.translate(x, y); ctx.scale(2.2 + rnd() * 1.4, .7 + rnd() * .35);
        const cloud = ctx.createRadialGradient(0, 0, radius * .08, 0, 0, radius);
        cloud.addColorStop(0, `rgba(255,255,250,${.2 + rnd() * .2})`);
        cloud.addColorStop(.52, 'rgba(248,252,250,.13)');
        cloud.addColorStop(1, 'rgba(240,248,250,0)');
        ctx.fillStyle = cloud; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    })
  };

  function surface(texture, { repeat = [1, 1], color = 0xffffff, roughness = .86, metalness = 0, bump = .035, side } = {}) {
    const map = texture.clone();
    map.needsUpdate = true;
    map.repeat.set(repeat[0], repeat[1]);
    const material = new THREE.MeshStandardMaterial({ map, color, roughness, metalness, bumpMap: bump ? map : null, bumpScale: bump });
    if (side !== undefined) material.side = side;
    return material;
  }

  const materials = {
    ground: surface(textures.ground, { repeat: [18, 14], roughness: 1, bump: .06 }),
    road: surface(textures.cobble, { repeat: [9, 3], roughness: .96, bump: .11 }),
    plaza: surface(textures.stone, { repeat: [5, 5], color: 0xb9b09a, roughness: .9, bump: .07 }),
    adobe: surface(textures.adobe, { repeat: [2, 2], roughness: .96, bump: .055 }),
    adobeDark: surface(textures.adobe, { repeat: [2, 2], color: 0xb29a7c, roughness: .97, bump: .06 }),
    stone: surface(textures.stone, { repeat: [2, 2], roughness: .92, bump: .07 }),
    wood: surface(textures.wood, { repeat: [2, 2], roughness: .88, bump: .04 }),
    tile: surface(textures.tile, { repeat: [3, 1], color: 0x87c4b4, roughness: .38, metalness: .12, bump: .025 }),
    rug: surface(textures.rug, { roughness: .95, bump: .015, side: THREE.DoubleSide }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x9f7a3c, roughness: .38, metalness: .72 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x262b27, roughness: .48, metalness: .68 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x080d0b, roughness: 1 }),
    window: new THREE.MeshStandardMaterial({ color: 0xe8bd69, emissive: 0xc77b28, emissiveIntensity: .45, roughness: .55 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2a9b91, emissive: 0x0a4c47, emissiveIntensity: .65, roughness: .18, metalness: .2, transparent: true, opacity: .82 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x173d2b, roughness: .92 }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x28543a, roughness: .9 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x76503a, roughness: .94 }),
    parchment: new THREE.MeshStandardMaterial({ color: 0xb49b70, roughness: .92 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xa87554, roughness: .78 }),
    beard: new THREE.MeshStandardMaterial({ color: 0x77776b, roughness: .95 })
  };

  function cachedBox(w, h, d) {
    const key = `b${w},${h},${d}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geometryCache.get(key);
  }
  function cachedCylinder(rt, rb, h, segments = 12) {
    const key = `c${rt},${rb},${h},${segments}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.CylinderGeometry(rt, rb, h, segments));
    return geometryCache.get(key);
  }
  function addMesh(parent, geometry, material, x = 0, y = 0, z = 0, shadows = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = shadows;
    object.receiveShadow = shadows;
    parent.add(object);
    return object;
  }
  function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, shadows = true) {
    return addMesh(parent, cachedBox(w, h, d), material, x, y, z, shadows);
  }
  function addCylinder(parent, rt, rb, h, material, x = 0, y = 0, z = 0, segments = 12, shadows = true) {
    return addMesh(parent, cachedCylinder(rt, rb, h, segments), material, x, y, z, shadows);
  }

  /** Merge static meshes by material while preserving animated pieces and lights. */
  function mergeStaticGroup(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const dynamic = new Set([
      ...animated.lamps.map(item => item.glow),
      ...animated.orbs.map(item => item.mesh),
      ...animated.waters
    ]);
    const buckets = new Map();

    group.traverse(object => {
      if (!object.isMesh || dynamic.has(object) || Array.isArray(object.material)) return;
      const key = object.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: object.material, items: [] });
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      const relative = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
      geometry.applyMatrix4(relative);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      buckets.get(key).items.push({ mesh: object, geometry });
    });

    buckets.forEach(({ material, items }) => {
      if (items.length < 2) {
        items.forEach(item => item.geometry.dispose());
        return;
      }
      const vertexCount = items.reduce((sum, item) => sum + item.geometry.attributes.position.count, 0);
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      let vertexOffset = 0;

      items.forEach(({ geometry }) => {
        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        const uv = geometry.attributes.uv;
        positions.set(position.array, vertexOffset * 3);
        normals.set(normal.array, vertexOffset * 3);
        if (uv) uvs.set(uv.array, vertexOffset * 2);
        vertexOffset += position.count;
      });

      const mergedGeometry = new THREE.BufferGeometry();
      mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      mergedGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      mergedGeometry.computeBoundingBox();
      mergedGeometry.computeBoundingSphere();
      const merged = new THREE.Mesh(mergedGeometry, material);
      merged.castShadow = items.some(item => item.mesh.castShadow);
      merged.receiveShadow = items.some(item => item.mesh.receiveShadow);
      merged.renderOrder = items[0].mesh.renderOrder;
      items.forEach(item => {
        item.mesh.parent.remove(item.mesh);
        item.geometry.dispose();
      });
      group.add(merged);
    });
  }

  function archGeometry(width, height) {
    const key = `arch${width},${height}`;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const radius = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, height - radius);
    shape.absarc(0, height - radius, radius, 0, Math.PI, false);
    shape.lineTo(-radius, 0);
    const geometry = new THREE.ShapeGeometry(shape, 12);
    geometryCache.set(key, geometry);
    return geometry;
  }

  function addArchPanel(parent, width, height, material, x, y, z) {
    return addMesh(parent, archGeometry(width, height), material, x, y, z, false);
  }

  function makeWindow(parent, x, y, z, scale = 1) {
    addArchPanel(parent, 1.55 * scale, 2.15 * scale, materials.stone, x, y, z);
    addArchPanel(parent, 1.18 * scale, 1.82 * scale, materials.window, x, y + .08 * scale, z + .025);
    addBox(parent, .09 * scale, 1.45 * scale, .06, materials.darkMetal, x, y + .78 * scale, z + .055, false);
    addBox(parent, 1.05 * scale, .08 * scale, .06, materials.darkMetal, x, y + .73 * scale, z + .055, false);
  }

  function makePot(parent, x, y, z, scale = 1, planted = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z); group.scale.setScalar(scale);
    const key = 'pot-lathe';
    if (!geometryCache.has(key)) {
      const points = [[.22, 0], [.43, .08], [.5, .36], [.44, .72], [.27, .93], [.29, 1.04]].map(([a, b]) => new THREE.Vector2(a, b));
      geometryCache.set(key, new THREE.LatheGeometry(points, 12));
    }
    addMesh(group, geometryCache.get(key), materials.terracotta, 0, 0, 0);
    const rim = addMesh(group, new THREE.TorusGeometry(.3, .055, 6, 14), materials.bronze, 0, 1.02, 0);
    rim.rotation.x = Math.PI / 2;
    if (planted) {
      for (let i = 0; i < 5; i++) {
        const leaf = addMesh(group, new THREE.ConeGeometry(.14, .85, 5), i % 2 ? materials.leaf : materials.leafLight, 0, 1.35, 0);
        leaf.rotation.z = (i - 2) * .3;
        leaf.rotation.y = i * 1.25;
      }
    }
    parent.add(group);
    return group;
  }

  function makeCrate(parent, x, y, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale);
    addBox(group, 1.15, 1.05, 1.15, materials.wood, 0, .53, 0);
    [-.48, .48].forEach(v => {
      addBox(group, .09, 1.09, 1.19, materials.darkMetal, v, .54, 0);
      addBox(group, 1.19, 1.09, .09, materials.darkMetal, 0, .54, v);
    });
    parent.add(group); return group;
  }

  function makeLantern(parent, x, y, z, withLight = false, color = 0xffbd66) {
    const group = new THREE.Group(); group.position.set(x, y, z);
    addCylinder(group, .035, .035, .6, materials.darkMetal, 0, .35, 0, 6);
    addCylinder(group, .31, .22, .14, materials.bronze, 0, -.02, 0, 8);
    addCylinder(group, .25, .3, .12, materials.bronze, 0, -.74, 0, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ color });
    const glow = addMesh(group, new THREE.SphereGeometry(.25, 10, 8), glowMaterial, 0, -.38, 0, false);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      addCylinder(group, .025, .025, .62, materials.darkMetal, Math.cos(angle) * .24, -.38, Math.sin(angle) * .24, 5);
    }
    let light = null;
    if (withLight) {
      light = new THREE.PointLight(color, 18, 21, 2);
      light.position.set(0, -.35, 0); group.add(light);
    }
    animated.lamps.push({ glow, light, phase: random() * Math.PI * 2, baseIntensity: 18 });
    parent.add(group); return group;
  }

  function buildHouse({ x, z, w, d, h, hasWindcatcher }) {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    if (z > 20) group.rotation.y = Math.PI;
    addBox(group, w, h, d, materials.adobe, 0, h / 2, 0);
    addBox(group, w + .25, .65, d + .25, materials.stone, 0, .33, 0);
    addBox(group, w + .3, .28, d + .3, materials.wood, 0, h - .15, 0);
    addBox(group, w + .45, .3, d + .45, materials.adobeDark, 0, h + .15, 0);

    // Parapets, roof beams and restrained turquoise tile bands.
    addBox(group, w + .45, .75, .35, materials.adobeDark, 0, h + .5, d / 2);
    addBox(group, w + .45, .75, .35, materials.adobeDark, 0, h + .5, -d / 2);
    addBox(group, .35, .75, d, materials.adobeDark, -w / 2, h + .5, 0);
    addBox(group, .35, .75, d, materials.adobeDark, w / 2, h + .5, 0);
    addBox(group, w + .12, .34, .12, materials.tile, 0, h - .72, d / 2 + .07);
    addBox(group, .12, .34, d, materials.tile, -w / 2 - .04, h - .72, 0);
    addBox(group, .12, .34, d, materials.tile, w / 2 + .04, h - .72, 0);
    [-w / 2 + .22, w / 2 - .22].forEach(px => addBox(group, .18, h, .2, materials.wood, px, h / 2, d / 2 + .08));
    [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([px, pz]) => addBox(group, .65, 1.1, .65, materials.adobeDark, px, h + .65, pz));

    // Arched wooden door, frame, planks and metal studs.
    const front = d / 2 + .075;
    addArchPanel(group, 2.75, 4.45, materials.stone, 0, .18, front);
    addArchPanel(group, 2.22, 4.02, materials.recess, 0, .25, front + .025);
    for (let i = -2; i <= 2; i++) addBox(group, .39, 3.22, .08, materials.wood, i * .41, 1.88, front + .06);
    addBox(group, 2.13, .11, .1, materials.darkMetal, 0, 1.25, front + .12);
    addBox(group, 2.13, .11, .1, materials.darkMetal, 0, 2.55, front + .12);
    const knob = addMesh(group, new THREE.SphereGeometry(.1, 8, 6), materials.bronze, .62, 1.85, front + .16);
    knob.castShadow = false;
    addBox(group, 2.9, .25, 1.1, materials.stone, 0, .13, d / 2 + .45);

    if (w > 9) {
      makeWindow(group, -w * .29, h * .48, front + .01, .9);
      makeWindow(group, w * .29, h * .48, front + .01, .9);
    } else {
      makeWindow(group, w * .25, h * .51, front + .01, .76);
    }

    // Select houses display woven rugs and a small fabric shade.
    if ((Math.round(Math.abs(x + z)) % 3) !== 0) {
      const rug = addMesh(group, new THREE.PlaneGeometry(1.65, 2.5), materials.rug, -w * .28, 2.35, front + .09, false);
      rug.rotation.z = .025;
      for (let i = 0; i < 6; i++) addBox(group, .025, .22, .025, materials.parchment, -w * .28 - .67 + i * .27, 1.02, front + .1, false);
    }
    const shade = addBox(group, 3.45, .13, 1.7, materials.wood, 0, 4.75, d / 2 + .65);
    shade.rotation.x = -.12;

    if (hasWindcatcher) {
      addBox(group, 3.25, 4.25, 3.25, materials.adobeDark, 0, h + 2.35, 0);
      for (let i = -1; i <= 1; i++) {
        addBox(group, .55, 2.15, .08, materials.recess, i * .86, h + 2.75, 1.66, false);
        addBox(group, .09, 2.3, .12, materials.wood, i * .86 - .34, h + 2.75, 1.72);
      }
      addBox(group, 3.65, .32, 3.65, materials.tile, 0, h + 4.55, 0);
      addBox(group, 3.4, .28, 3.4, materials.wood, 0, h + .35, 0);
    }
    if ((Math.round(Math.abs(x)) % 2) === 0) makePot(group, w * .28, h + .32, 0, .72, true);
    mergeStaticGroup(group);
    return group;
  }

  function buildShopkeeper(type, color) {
    const group = new THREE.Group();
    const robeColor = new THREE.Color(color).multiplyScalar(.43);
    const robe = new THREE.MeshStandardMaterial({ color: robeColor, roughness: .91 });
    addCylinder(group, .58, .92, 2.2, robe, 0, 1.2, 0, 12);
    addCylinder(group, .72, .72, .16, materials.bronze, 0, 1.65, 0, 12);
    const head = addMesh(group, new THREE.SphereGeometry(.59, 14, 10), materials.skin, 0, 2.85, 0);
    head.scale.set(1, 1.12, .95);
    const turban = addMesh(group, new THREE.TorusGeometry(.48, .17, 8, 18), materials.parchment, 0, 3.28, 0);
    turban.rotation.x = Math.PI / 2;
    const cap = addMesh(group, new THREE.SphereGeometry(.43, 12, 8), robe, 0, 3.32, 0);
    cap.scale.y = .55;
    [-1, 1].forEach(side => {
      const arm = addCylinder(group, .17, .22, 1.65, robe, side * .72, 1.55, .05, 8);
      arm.rotation.z = side * -.24;
    });
    if (type === 'apothecary' || type === 'blacksmith') {
      const beard = addMesh(group, new THREE.ConeGeometry(.37, .85, 10), type === 'apothecary' ? materials.beard : materials.darkMetal, 0, 2.5, .4);
      beard.rotation.z = Math.PI;
    }
    return group;
  }

  function buildVillager(robeColor) {
    const person = buildShopkeeper('villager', robeColor);
    person.scale.setScalar(.94);
    // Quest NPCs are stationary, so their static parts can be merged without
    // changing their silhouette or touching the player's animated hero.
    mergeStaticGroup(person);
    return person;
  }

  function buildHero(member, roleObj) {
    const group = new THREE.Group();
    group.name = 'Persian immortal — articulated forged-armour hero';
    const shared = medievalForge.getHeroMaterials();
    const darkTint = new THREE.Color(0x9a9b96);
    const armor = shared.forged.clone();
    armor.name = 'Hero forged steel • shared original 2K maps';
    armor.color.set(roleObj.color).lerp(darkTint, .68);
    armor.metalness = .68;
    armor.roughness = .9;
    armor.emissive.set(0x151719); armor.emissiveIntensity = .12;
    const blackened = shared.forged.clone();
    blackened.color.set(0x858c90);
    blackened.metalness = .62; blackened.roughness = .9;
    blackened.emissive.set(0x101214); blackened.emissiveIntensity = .12;
    const leather = surface(textures.heroLeather, { repeat: [1.6, 1.6], color: 0xd4b08a, roughness: .9, bump: .055 });
    leather.emissive.set(0x1c0e06); leather.emissiveIntensity = .16;
    const cloth = surface(textures.heroCape, { color: 0xd3b1a8, roughness: .96, bump: .025, side: THREE.DoubleSide });
    cloth.emissive.set(0x1a0809); cloth.emissiveIntensity = .14;
    const steel = shared.steel.clone();
    steel.color.set(0xb7c0c4); steel.metalness = .72; steel.roughness = .28;
    const gold = shared.gold.clone();
    gold.color.set(0xd0a24f); gold.metalness = .62; gold.roughness = .38;
    gold.emissive.set(0x2b1a08); gold.emissiveIntensity = .12;
    const heroSkin = materials.skin.clone();
    heroSkin.color.set(0xc58b66); heroSkin.emissive.set(0x1c0d08); heroSkin.emissiveIntensity = .1;

    const rig = new THREE.Group();
    group.add(rig);
    if (member.isLocal) {
      // Short-range cinematic fill, like the forge's warm light on armour.
      // It casts no extra shadow map and is created only for the local hero.
      const armourFill = new THREE.PointLight(0xffb27a, 12, 8, 2);
      armourFill.position.set(1.6, 3.2, 2.1);
      armourFill.castShadow = false;
      group.add(armourFill);
    }
    const auraMaterial = new THREE.MeshStandardMaterial({
      color: member.isLocal ? 0x7dbb91 : 0x659aa5,
      emissive: member.isLocal ? 0x1d6c4c : 0x174c55,
      emissiveIntensity: .55, transparent: true, opacity: .5, side: THREE.DoubleSide
    });
    const aura = addMesh(group, new THREE.RingGeometry(1.18, 1.52, 32), auraMaterial, 0, .055, 0, false);
    aura.rotation.x = -Math.PI / 2;

    // Pelvis, leather belt, metal buckle and lamellar armoured skirt.
    addCylinder(rig, .48, .56, .42, leather, 0, 1.55, 0, 14);
    addCylinder(rig, .59, .59, .17, leather, 0, 1.67, 0, 16);
    addBox(rig, .28, .23, .12, gold, 0, 1.67, .52);
    addBox(rig, .14, .12, .14, blackened, 0, 1.67, .59);
    [-1, 1].forEach(side => {
      addBox(rig, .24, .34, .18, leather, side * .48, 1.43, -.03);
      addBox(rig, .13, .06, .2, gold, side * .48, 1.52, .04);
      for (let row = 0; row < 3; row++) {
        const plate = addBox(rig, .28, .28, .09, row % 2 ? armor : blackened,
          side * (.2 + row * .03), 1.34 - row * .2, .38 - row * .025);
        plate.rotation.z = side * (.04 + row * .025);
      }
    });

    // Torso with the same worn forged-metal PBR used by the blacksmith.
    const torso = new THREE.Group();
    torso.position.set(0, 1.67, 0);
    rig.add(torso);
    addCylinder(torso, .49, .61, 1.02, blackened, 0, .55, 0, 16);
    const armorMesh = addMesh(torso, new THREE.SphereGeometry(.66, 20, 14), armor, 0, .72, .02);
    armorMesh.scale.set(1, .82, .65);
    addBox(torso, .92, .08, .09, gold, 0, .25, .48);
    addBox(torso, .78, .055, .08, gold, 0, 1.03, .39);

    // Instanced chainmail rings: detailed close-up silhouette in one draw call.
    const mailRows = 6, mailCols = 9;
    const mail = new THREE.InstancedMesh(new THREE.TorusGeometry(.052, .012, 5, 8), blackened, mailRows * mailCols * 2);
    mail.castShadow = true;
    const mailMatrix = new THREE.Matrix4();
    const mailQuat = new THREE.Quaternion();
    const mailScale = new THREE.Vector3(1, 1, 1);
    let mailIndex = 0;
    [-1, 1].forEach(back => {
      for (let row = 0; row < mailRows; row++) for (let col = 0; col < mailCols; col++) {
        const x = -.44 + col * .11 + (row % 2) * .035;
        const y = .22 + row * .105;
        const z = back * (.48 - Math.abs(x) * .12);
        mailQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), back < 0 ? Math.PI : 0);
        mailMatrix.compose(new THREE.Vector3(x, y, z), mailQuat, mailScale);
        mail.setMatrixAt(mailIndex++, mailMatrix);
      }
    });
    mail.instanceMatrix.needsUpdate = true;
    torso.add(mail);

    // Persian sun / immortal emblem on the breastplate.
    const emblem = new THREE.Group();
    emblem.position.set(0, .74, .49);
    torso.add(emblem);
    addMesh(emblem, new THREE.TorusGeometry(.17, .025, 7, 20), gold, 0, 0, 0);
    addMesh(emblem, new THREE.SphereGeometry(.07, 10, 7), gold, 0, 0, .015);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const ray = addBox(emblem, .035, .13, .035, gold, Math.sin(a) * .26, Math.cos(a) * .26, 0);
      ray.rotation.z = -a;
    }

    // Articulated legs: thigh, knee, greave and foot each have their own pivot.
    function buildLeg(side) {
      const upper = new THREE.Group();
      upper.position.set(side * .28, 1.52, 0);
      rig.add(upper);
      addCylinder(upper, .19, .23, .6, leather, 0, -.3, 0, 10);
      addCylinder(upper, .21, .24, .42, blackened, 0, -.24, .015, 10);
      const knee = new THREE.Group();
      knee.position.set(0, -.61, 0);
      upper.add(knee);
      const cop = addMesh(knee, new THREE.SphereGeometry(.2, 12, 8), armor, 0, 0, .07);
      cop.scale.set(1, .8, .7);
      addCylinder(knee, .14, .18, .55, blackened, 0, -.29, 0, 10);
      addBox(knee, .08, .43, .08, gold, 0, -.29, .17);
      const foot = new THREE.Group();
      foot.position.set(0, -.56, 0);
      knee.add(foot);
      addBox(foot, .36, .31, .55, leather, 0, -.13, .12);
      addBox(foot, .37, .13, .3, blackened, 0, -.12, .31);
      addBox(foot, .38, .07, .58, materials.darkMetal, 0, -.3, .13);
      return { upper, knee, foot };
    }
    const leftLeg = buildLeg(-1), rightLeg = buildLeg(1);

    // Arms with layered pauldrons and elbow pivots. Weapons follow the hands.
    function buildArm(side) {
      const upper = new THREE.Group();
      upper.position.set(side * .67, 2.65, 0);
      rig.add(upper);
      const pauldron = addMesh(upper, new THREE.SphereGeometry(.35, 14, 9), armor, side * .03, -.02, 0);
      pauldron.scale.set(1.2, .62, .9);
      addBox(upper, .48, .08, .4, gold, side * .04, -.15, .01);
      addCylinder(upper, .14, .19, .52, leather, 0, -.34, 0, 10);
      const elbow = new THREE.Group();
      elbow.position.set(0, -.56, 0);
      upper.add(elbow);
      addMesh(elbow, new THREE.SphereGeometry(.17, 10, 7), blackened, 0, 0, 0);
      addCylinder(elbow, .13, .17, .47, blackened, 0, -.26, .01, 10);
      for (let i = 0; i < 3; i++) addCylinder(elbow, .175, .175, .035, gold, 0, -.12 - i * .13, .01, 10);
      addMesh(elbow, new THREE.SphereGeometry(.15, 10, 7), leather, 0, -.54, .03);
      return { upper, elbow };
    }
    const leftArm = buildArm(-1), rightArm = buildArm(1);

    // Neck, face, short beard and a forged helmet with cheek guards and plume.
    addCylinder(rig, .19, .22, .28, heroSkin, 0, 2.91, 0, 12);
    const head = new THREE.Group();
    head.position.set(0, 3.2, .01);
    rig.add(head);
    const face = addMesh(head, new THREE.SphereGeometry(.38, 18, 12), heroSkin, 0, 0, 0);
    face.scale.set(1, 1.08, .95);
    addMesh(head, new THREE.SphereGeometry(.07, 9, 6), heroSkin, 0, -.03, .37);
    [-1, 1].forEach(side => addMesh(head, new THREE.SphereGeometry(.025, 7, 5), materials.recess, side * .13, .07, .35, false));
    const beard = addMesh(head, new THREE.ConeGeometry(.27, .43, 12), materials.darkMetal, 0, -.28, .22);
    beard.rotation.z = Math.PI;
    const helmet = addMesh(head, new THREE.SphereGeometry(.43, 18, 11, 0, Math.PI * 2, 0, Math.PI * .64), armor, 0, .13, 0);
    helmet.scale.y = .92;
    const helmetBand = addMesh(head, new THREE.TorusGeometry(.4, .035, 7, 22), gold, 0, .12, 0);
    helmetBand.rotation.x = Math.PI / 2;
    addBox(head, .07, .4, .065, gold, 0, -.01, .41);
    [-1, 1].forEach(side => {
      const cheek = addBox(head, .16, .38, .09, blackened, side * .31, -.14, .13);
      cheek.rotation.z = side * -.13;
    });
    addMesh(head, new THREE.ConeGeometry(.12, .46, 10), cloth, 0, .67, -.04);

    // Segmented cloth cape with a painted Persian-gold border.
    const cape = new THREE.Group();
    cape.position.set(0, 2.67, -.43);
    rig.add(cape);
    const capeGeometry = new THREE.PlaneGeometry(1.28, 1.85, 6, 8);
    const capeMesh = addMesh(cape, capeGeometry, cloth, 0, -.925, 0, false);
    const capeBase = capeGeometry.attributes.position.array.slice();

    // Ridged steel sword, leather grip and golden guard attached to right hand.
    const sword = new THREE.Group();
    sword.position.set(0, -.49, .08);
    sword.rotation.z = -.16;
    rightArm.elbow.add(sword);
    addBox(sword, .1, 1.42, .045, steel, 0, -.85, 0);
    addBox(sword, .025, 1.34, .055, blackened, 0, -.82, 0);
    const tip = addMesh(sword, new THREE.ConeGeometry(.071, .25, 4), steel, 0, -1.68, 0);
    tip.rotation.z = Math.PI;
    addBox(sword, .58, .09, .12, gold, 0, -.12, 0);
    addCylinder(sword, .07, .07, .34, leather, 0, .09, 0, 10);
    addMesh(sword, new THREE.SphereGeometry(.1, 10, 7), gold, 0, .3, 0);

    // Kite shield with a raised gold rim and central forged boss.
    function shieldGeometry(scale = 1) {
      const shape = new THREE.Shape();
      shape.moveTo(0, .72 * scale); shape.lineTo(.48 * scale, .46 * scale);
      shape.lineTo(.42 * scale, -.28 * scale); shape.lineTo(0, -.72 * scale);
      shape.lineTo(-.42 * scale, -.28 * scale); shape.lineTo(-.48 * scale, .46 * scale); shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: .065, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1 });
    }
    const shield = new THREE.Group();
    shield.position.set(-.12, -.34, .27);
    shield.rotation.y = -.18;
    leftArm.elbow.add(shield);
    addMesh(shield, shieldGeometry(1.06), gold, 0, 0, 0);
    addMesh(shield, shieldGeometry(.91), blackened, 0, 0, .075);
    const boss = addMesh(shield, new THREE.SphereGeometry(.18, 12, 8), armor, 0, .02, .17);
    boss.scale.z = .45;
    addMesh(shield, new THREE.TorusGeometry(.29, .025, 7, 20), gold, 0, .02, .16);

    // Distance-driven locomotion prevents foot sliding. The phase advances by
    // metres travelled, not by key-down time, and eases back to a breathing idle.
    let travel = 0, time = 0;
    const damp = (current, target, alpha) => current + (target - current) * alpha;
    group.userData.updateLocomotion = (dt, speed, distance = speed * dt) => {
      time += dt;
      travel += Math.max(0, distance);
      const phase = travel * 1.85;
      const move = THREE.MathUtils.clamp(speed / 2.4, 0, 1);
      const alpha = 1 - Math.exp(-dt * 13);
      const swing = Math.sin(phase);
      leftLeg.upper.rotation.x = damp(leftLeg.upper.rotation.x, swing * .52 * move, alpha);
      rightLeg.upper.rotation.x = damp(rightLeg.upper.rotation.x, -swing * .52 * move, alpha);
      leftLeg.knee.rotation.x = damp(leftLeg.knee.rotation.x, Math.max(0, -swing) * .72 * move, alpha);
      rightLeg.knee.rotation.x = damp(rightLeg.knee.rotation.x, Math.max(0, swing) * .72 * move, alpha);
      leftLeg.foot.rotation.x = damp(leftLeg.foot.rotation.x, -leftLeg.upper.rotation.x * .45 - leftLeg.knee.rotation.x * .55, alpha);
      rightLeg.foot.rotation.x = damp(rightLeg.foot.rotation.x, -rightLeg.upper.rotation.x * .45 - rightLeg.knee.rotation.x * .55, alpha);
      leftArm.upper.rotation.x = damp(leftArm.upper.rotation.x, -swing * .4 * move, alpha);
      rightArm.upper.rotation.x = damp(rightArm.upper.rotation.x, swing * .4 * move, alpha);
      leftArm.elbow.rotation.x = damp(leftArm.elbow.rotation.x, -.12 - Math.max(0, swing) * .18 * move, alpha);
      rightArm.elbow.rotation.x = damp(rightArm.elbow.rotation.x, -.12 - Math.max(0, -swing) * .18 * move, alpha);
      torso.rotation.y = damp(torso.rotation.y, swing * .05 * move, alpha);
      torso.rotation.z = damp(torso.rotation.z, swing * .022 * move, alpha);
      head.rotation.y = damp(head.rotation.y, -swing * .035 * move, alpha);
      rig.position.y = Math.sin(phase * 2) * .035 * move + Math.sin(time * 1.7) * .008 * (1 - move);
      rig.position.x = swing * .018 * move;
      cape.rotation.x = -.035 - move * .055;

      const positions = capeGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = capeBase[i * 3], y = capeBase[i * 3 + 1];
        const weight = 1 - (y + .925) / 1.85;
        positions.setX(i, x + Math.sin(phase * 1.2 + weight * 3.2) * .018 * weight * move);
        positions.setZ(i, -weight * (.045 + move * .11) + Math.sin(phase * 1.35 + weight * 4 + x * 2) * .05 * weight * (.25 + move));
      }
      positions.needsUpdate = true;
      capeGeometry.computeVertexNormals();
    };

    return { group, armorMesh };
  }

  function addWares(group, type, color) {
    const glowMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, roughness: .28, metalness: .12 });
    if (type === 'apothecary') {
      [0x58c793, 0xb44236, 0x3d83b7, 0xc49242, 0x7760a4].forEach((c, i) => {
        const glass = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .42, roughness: .18, transparent: true, opacity: .86 });
        const x = -2.7 + i * 1.32;
        addMesh(group, new THREE.SphereGeometry(.27 + (i % 2) * .06, 10, 8), glass, x, 2.5, 1.75);
        addCylinder(group, .1, .12, .35, glass, x, 2.82, 1.75, 8);
        addCylinder(group, .12, .12, .09, materials.wood, x, 3.03, 1.75, 8);
      });
    } else if (type === 'blacksmith') {
      [-2.3, 0, 2.3].forEach((x, i) => {
        const blade = addBox(group, .16, 1.65, .07, materials.darkMetal, x, 2.85, 1.75);
        blade.rotation.z = -.55 + i * .55;
        const guard = addBox(group, .75, .1, .12, materials.bronze, x, 2.25, 1.75); guard.rotation.z = blade.rotation.z;
      });
    } else if (type === 'carpet_bazaar') {
      [-2.4, -.8, .8, 2.4].forEach((x, i) => {
        const roll = addCylinder(group, .35, .35, 1.4, i % 2 ? materials.rug : materials.parchment, x, 2.65, 1.75, 12);
        roll.rotation.z = Math.PI / 2;
      });
    } else if (type === 'teahouse') {
      [-2, 0, 2].forEach(x => {
        const pot = addMesh(group, new THREE.SphereGeometry(.4, 12, 8), materials.bronze, x, 2.55, 1.75);
        pot.scale.y = .8;
        addCylinder(group, .16, .24, .25, materials.bronze, x, 2.93, 1.75, 10);
        addCylinder(group, .18, .14, .3, materials.tile, x + .65, 2.4, 1.8, 10);
      });
    } else {
      [-2.6, -1.3, 0, 1.3, 2.6].forEach((x, i) => {
        const gem = addMesh(group, new THREE.OctahedronGeometry(.35 + (i % 2) * .12), glowMaterial, x, 2.65, 1.75);
        gem.rotation.y = i * .7;
      });
      if (type === 'astrologer') {
        const orb = addMesh(group, new THREE.SphereGeometry(.55, 14, 10), glowMaterial, 0, 3.25, .3);
        animated.orbs.push({ mesh: orb, phase: random() * 6 });
      }
    }
  }

  function buildDistrict(plots) {
    return medievalForge.buildDistrict(plots);
  }

  function buildShop(shopDef) {
    if (shopDef.id === 'blacksmith') return medievalForge.build(shopDef);
    // Every merchant now uses the same detailed stone/timber/slate exterior
    // family as the forge; only its sign, stock and interaction differ.
    return medievalForge.buildShopExterior(shopDef);
  }

  function buildArch({ x, z, spanW, rotY }) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotY;
    const outer = spanW / 2, inner = outer - .72;
    const shape = new THREE.Shape();
    shape.moveTo(outer, 0); shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.lineTo(-inner, 0); shape.absarc(0, 0, inner, Math.PI, 0, true); shape.closePath();
    const arch = addMesh(group, new THREE.ExtrudeGeometry(shape, { depth: 2.1, bevelEnabled: true, bevelSize: .07, bevelThickness: .07, bevelSegments: 1, curveSegments: 18 }), materials.adobeDark, 0, 4.15, -1.05);
    arch.scale.y = .58;
    [-outer + .35, outer - .35].forEach(px => {
      addBox(group, .85, 4.4, 2.2, materials.adobeDark, px, 2.2, 0);
      addBox(group, 1.1, .4, 2.45, materials.stone, px, .2, 0);
    });
    addBox(group, spanW + .4, 1.8, 2.5, materials.adobe, 0, 7.25, 0);
    addBox(group, spanW + .65, .26, 2.75, materials.tile, 0, 8.27, 0);
    addBox(group, spanW + .25, .18, .18, materials.wood, 0, 6.32, 1.31);
    [-2.1, 0, 2.1].forEach(px => makeWindow(group, px, 6.65, 1.28, .5));
    makeLantern(group, 0, 5.3, .2, false);
    mergeStaticGroup(group);
    return group;
  }

  function buildCypress(x, y, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale);
    addCylinder(group, .28, .48, 3.1, materials.wood, 0, 1.55, 0, 9);
    const layers = [[2.2, 4.3, 3.9], [1.85, 4.1, 5.7], [1.4, 3.5, 7.25], [.9, 2.7, 8.55]];
    layers.forEach(([radius, height, py], i) => {
      const crown = addMesh(group, new THREE.ConeGeometry(radius, height, 9), i % 2 ? materials.leafLight : materials.leaf, 0, py, 0);
      crown.rotation.y = i * .47;
    });
    addCylinder(group, 1.25, 1.45, .45, materials.stone, 0, .23, 0, 12);
    mergeStaticGroup(group);
    return group;
  }

  function buildFountain() {
    const group = new THREE.Group();
    addCylinder(group, 5.5, 5.8, .65, materials.stone, 0, .33, 0, 16);
    addCylinder(group, 4.85, 5.15, .7, materials.plaza, 0, .85, 0, 16);
    addCylinder(group, 4.35, 4.35, .18, materials.tile, 0, 1.17, 0, 24);
    const water = addCylinder(group, 4.05, 4.05, .12, materials.water, 0, 1.28, 0, 32, false);
    animated.waters.push(water);
    addCylinder(group, .62, .9, 2.3, materials.stone, 0, 2.1, 0, 12);
    addCylinder(group, 1.55, 1.75, .25, materials.tile, 0, 3.05, 0, 16);
    const orb = addMesh(group, new THREE.SphereGeometry(.68, 18, 12), new THREE.MeshStandardMaterial({ color: 0x79d7af, emissive: 0x2b9d79, emissiveIntensity: 1.2, roughness: .18 }), 0, 4.05, 0);
    animated.orbs.push({ mesh: orb, phase: 0 });
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const start = new THREE.Vector3(Math.cos(angle) * .65, 2.9, Math.sin(angle) * .65);
      const end = new THREE.Vector3(Math.cos(angle) * 3.25, 1.36, Math.sin(angle) * 3.25);
      const middle = start.clone().lerp(end, .5); middle.y += .75;
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      addMesh(group, new THREE.TubeGeometry(curve, 12, .035, 5, false), materials.water, 0, 0, 0, false);
    }
    const light = new THREE.PointLight(0x55d9b0, 24, 25, 2); light.position.set(0, 4, 0); group.add(light);
    animated.lamps.push({ glow: orb, light, phase: 1.4, baseIntensity: 24 });
    mergeStaticGroup(group);
    return group;
  }

  function addSky(group) {
    const skyMaterial = new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
    const sky = addMesh(group, new THREE.SphereGeometry(280, 32, 18), skyMaterial, 0, 0, 0, false);
    sky.name = 'Daylight sky';
    sky.renderOrder = -100;
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x748473, roughness: 1 });
    [[-75, -62, 24, 29], [-42, -72, 29, 35], [0, -78, 32, 30], [43, -72, 25, 34], [76, -60, 24, 27]].forEach(([x, z, r, h], i) => {
      const peak = addMesh(group, new THREE.ConeGeometry(r * 1.35, h * 1.25, 5), mountainMaterial, x * 1.85, h * 1.25 / 2 - 2, z * 1.85, false);
      peak.rotation.y = i * .73;
    });

    const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 128;
    const ctx = sunCanvas.getContext('2d');
    const glow = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
    glow.addColorStop(0, 'rgba(255,253,225,1)'); glow.addColorStop(.2, 'rgba(255,242,185,.95)'); glow.addColorStop(.48, 'rgba(255,222,142,.34)'); glow.addColorStop(1, 'rgba(255,214,128,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    const sunTexture = new THREE.CanvasTexture(sunCanvas); sunTexture.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    sun.name = 'Day sun';
    sun.position.set(88, 105, -132); sun.scale.set(22, 22, 1); group.add(sun);
  }

  function addStringLights(group, z, y) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-21, y, z), new THREE.Vector3(0, y - 1.7, z), new THREE.Vector3(21, y, z));
    addMesh(group, new THREE.TubeGeometry(curve, 32, .035, 4, false), materials.darkMetal, 0, 0, 0, false);
    const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffc56d });
    for (let i = 1; i < 14; i++) {
      const p = curve.getPoint(i / 14);
      addCylinder(group, .025, .025, .34, materials.darkMetal, p.x, p.y - .16, p.z, 5, false);
      const bulb = addMesh(group, new THREE.SphereGeometry(.12, 8, 6), bulbMaterial, p.x, p.y - .4, p.z, false);
      animated.lamps.push({ glow: bulb, light: null, phase: i * .8, baseIntensity: 0 });
    }
  }

  function reset() {
    medievalForge.reset();
    animated.lamps.length = 0;
    animated.waters.length = 0;
    animated.orbs.length = 0;
    animated.dust = null;
  }

  function populate(group, shops) {
    const decorations = new THREE.Group();
    addSky(decorations);

    const lampPositions = [[-8, -8], [8, -8], [-8, 8], [8, 8], [-22, -7], [22, -7], [-21, 21], [21, 21]];
    lampPositions.forEach(([x, z]) => {
      addCylinder(decorations, .1, .16, 4.6, materials.darkMetal, x, 2.3, z, 9);
      addCylinder(decorations, .28, .38, .28, materials.bronze, x, .14, z, 10);
      const arm = addBox(decorations, 1.05, .09, .09, materials.darkMetal, x + .42, 4.5, z); arm.rotation.z = -.08;
      makeLantern(decorations, x + .88, 4.48, z, false);
    });
    addStringLights(decorations, -7, 7.2);
    addStringLights(decorations, 12, 7.5);

    // Small lived-in props remain close to storefronts and leave paths open.
    shops.forEach((shop, index) => {
      const props = new THREE.Group(); props.position.set(shop.pos.x, 0, shop.pos.z); props.rotation.y = shop.rotY || 0;
      makePot(props, index % 2 ? -5.7 : 5.7, 0, 4.6, .72, index === 2);
      decorations.add(props);
    });

    const positions = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      positions[i * 3] = (random() - .5) * 130;
      positions[i * 3 + 1] = 1 + random() * 12;
      positions[i * 3 + 2] = (random() - .5) * 92;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffe0a3, size: .13, transparent: true, opacity: .25, depthWrite: false, blending: THREE.NormalBlending }));
    decorations.add(dust); animated.dust = dust;
    mergeStaticGroup(decorations);
    group.add(decorations);
  }

  function applyLighting(zone, scene, hemi, directional, renderer) {
    if (zone === 'village') {
      scene.background = new THREE.Color(0x91bfd6);
      scene.fog = new THREE.FogExp2(0xc4dbe5, .0022);
      // The original PBR albedos are intentionally dark; strong sky fill makes
      // their detail readable in daylight without resizing or replacing them.
      hemi.color.setHex(0xd8efff); hemi.groundColor.setHex(0xb39a73); hemi.intensity = 6.2;
      directional.color.setHex(0xfff0cf); directional.intensity = 5.8; directional.position.set(42, 68, 28);
      renderer.toneMappingExposure = 1.26;
    } else if (zone === 'open_world') {
      scene.background = new THREE.Color(0x91bfd6);
      scene.fog = new THREE.FogExp2(0xbcd4d6, .002);
      hemi.color.setHex(0xd8efff); hemi.groundColor.setHex(0xa8906c); hemi.intensity = 3.4;
      directional.color.setHex(0xfff0cf); directional.intensity = 3.8; directional.position.set(42, 68, 28);
      renderer.toneMappingExposure = 1.1;
    } else {
      hemi.color.setHex(0xfffbeb); hemi.groundColor.setHex(0x334155); hemi.intensity = .95;
      directional.color.setHex(0xfff7ed); directional.intensity = 1.5; directional.position.set(-40, 85, 45);
      renderer.toneMappingExposure = 1.15;
    }
  }

  function update(elapsed, dt, heroPosition = null) {
    medievalForge.update(elapsed, dt, heroPosition);
    animated.lamps.forEach(({ glow, light, phase, baseIntensity }) => {
      const flicker = 1 + Math.sin(elapsed * 7 + phase) * .035 + Math.sin(elapsed * 13.7 + phase) * .018;
      glow.scale.setScalar(flicker);
      if (light) light.intensity = baseIntensity * flicker;
    });
    animated.waters.forEach((water, i) => { water.rotation.y += dt * (.055 + i * .01); });
    animated.orbs.forEach(({ mesh, phase }) => {
      const pulse = 1 + Math.sin(elapsed * 2.2 + phase) * .055;
      mesh.scale.setScalar(pulse);
      mesh.rotation.y += dt * .35;
    });
    if (animated.dust) {
      animated.dust.rotation.y += dt * .006;
      animated.dust.position.y = Math.sin(elapsed * .18) * .35;
    }
  }

  return { materials, districtBuildingScale: medievalForge.districtBuildingScale, buildHouse, buildDistrict, buildShop, buildArch, buildCypress, buildFountain, buildHero, buildVillager, populate, applyLighting, update, reset };
}
