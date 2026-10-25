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
    awning: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#b7a986'; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 64) { ctx.fillStyle = '#4d5548'; ctx.fillRect(x, 0, 32, s); }
      noise(ctx, s, 1000, 180, .08);
    }),
    sky: canvasTexture(1024, (ctx, s) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, s);
      gradient.addColorStop(0, '#030b12');
      gradient.addColorStop(.45, '#0b2025');
      gradient.addColorStop(.72, '#264038');
      gradient.addColorStop(1, '#8a6941');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 430; i++) {
        const y = random() * s * .63;
        const a = .18 + random() * .62;
        ctx.fillStyle = `rgba(235,225,184,${a})`;
        const r = random() < .06 ? 1.5 : .65;
        ctx.beginPath(); ctx.arc(random() * s, y, r, 0, Math.PI * 2); ctx.fill();
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
    window: new THREE.MeshStandardMaterial({ color: 0xe8bd69, emissive: 0xc77b28, emissiveIntensity: 1.25, roughness: .55 }),
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
    const armorColor = new THREE.Color(roleObj.color).lerp(new THREE.Color(0x263a34), .32);
    const armor = new THREE.MeshStandardMaterial({ color: armorColor, roughness: .34, metalness: .62 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x89928b, roughness: .3, metalness: .78 });
    const cape = new THREE.MeshStandardMaterial({ color: 0x5d2728, roughness: .93, side: THREE.DoubleSide });

    const auraMaterial = new THREE.MeshStandardMaterial({ color: member.isLocal ? 0x65c79a : 0x55a7b0, emissive: member.isLocal ? 0x1d6c4c : 0x174c55, emissiveIntensity: .65, transparent: true, opacity: .65, side: THREE.DoubleSide });
    const aura = addMesh(group, new THREE.RingGeometry(1.35, 1.85, 28), auraMaterial, 0, .08, 0, false);
    aura.rotation.x = -Math.PI / 2;

    [-.29, .29].forEach(x => {
      addCylinder(group, .19, .23, 1.05, materials.darkMetal, x, .7, 0, 8);
      addBox(group, .43, .34, .65, materials.wood, x, .22, .12);
    });
    const torso = addCylinder(group, .59, .78, 1.65, armor, 0, 1.65, 0, 12);
    addBox(group, 1.08, .92, .34, armor, 0, 1.83, .38);
    addBox(group, 1.16, .1, .4, materials.bronze, 0, 2.16, .39);
    addBox(group, 1.25, .16, .68, materials.wood, 0, 1.13, 0);
    addBox(group, .23, .25, .12, materials.bronze, 0, 1.13, .4);

    [-1, 1].forEach(side => {
      const shoulder = addMesh(group, new THREE.SphereGeometry(.37, 10, 7), armor, side * .7, 2.15, 0);
      shoulder.scale.set(1.2, .65, 1);
      const arm = addCylinder(group, .15, .2, 1.25, materials.darkMetal, side * .77, 1.48, .02, 8);
      arm.rotation.z = side * -.12;
      addCylinder(group, .19, .19, .38, materials.bronze, side * .84, .96, .04, 8);
    });

    const head = addMesh(group, new THREE.SphereGeometry(.5, 14, 10), materials.skin, 0, 2.9, .02);
    head.scale.set(1, 1.08, .95);
    const helmet = addMesh(group, new THREE.SphereGeometry(.57, 14, 9, 0, Math.PI * 2, 0, Math.PI * .62), steel, 0, 3.08, 0);
    helmet.scale.y = .85;
    addBox(group, .1, .65, .09, materials.bronze, 0, 2.91, .5);
    addMesh(group, new THREE.ConeGeometry(.12, .45, 8), materials.bronze, 0, 3.73, 0);

    const capeShape = new THREE.Shape();
    capeShape.moveTo(-.66, 1); capeShape.lineTo(.66, 1); capeShape.lineTo(.58, -.72); capeShape.lineTo(0, -1.08); capeShape.lineTo(-.58, -.72); capeShape.closePath();
    const capeMesh = addMesh(group, new THREE.ShapeGeometry(capeShape), cape, 0, 1.7, -.48);
    capeMesh.rotation.x = -.09;

    const sword = new THREE.Group(); sword.position.set(1.03, 1.25, .27); sword.rotation.z = -.24;
    addBox(sword, .12, 1.9, .065, steel, 0, .45, 0);
    addBox(sword, .72, .1, .13, materials.bronze, 0, -.52, 0);
    addCylinder(sword, .09, .09, .6, materials.wood, 0, -.85, 0, 8);
    group.add(sword);
    const shield = addCylinder(group, .57, .57, .12, materials.bronze, -.87, 1.48, .3, 12);
    shield.rotation.x = Math.PI / 2;
    const shieldFace = addCylinder(group, .45, .45, .14, armor, -.87, 1.48, .32, 12);
    shieldFace.rotation.x = Math.PI / 2;
    addMesh(group, new THREE.SphereGeometry(.15, 9, 7), materials.bronze, -.87, 1.48, .43);

    return { group, armorMesh: torso };
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
    const skyMaterial = new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = addMesh(group, new THREE.SphereGeometry(280, 32, 18), skyMaterial, 0, 0, 0, false);
    sky.renderOrder = -100;
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x15251f, roughness: 1 });
    [[-75, -62, 24, 29], [-42, -72, 29, 35], [0, -78, 32, 30], [43, -72, 25, 34], [76, -60, 24, 27]].forEach(([x, z, r, h], i) => {
      const peak = addMesh(group, new THREE.ConeGeometry(r * 1.35, h * 1.25, 5), mountainMaterial, x * 1.85, h * 1.25 / 2 - 2, z * 1.85, false);
      peak.rotation.y = i * .73;
    });

    const moonCanvas = document.createElement('canvas'); moonCanvas.width = moonCanvas.height = 128;
    const ctx = moonCanvas.getContext('2d');
    const glow = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    glow.addColorStop(0, 'rgba(255,239,190,1)'); glow.addColorStop(.38, 'rgba(244,222,165,.9)'); glow.addColorStop(1, 'rgba(244,215,145,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f3dfae'; ctx.beginPath(); ctx.arc(64, 64, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1b20'; ctx.beginPath(); ctx.arc(75, 56, 23, 0, Math.PI * 2); ctx.fill();
    const moonTexture = new THREE.CanvasTexture(moonCanvas); moonTexture.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture, transparent: true, depthWrite: false, fog: false }));
    moon.position.set(-72, 64, -125); moon.scale.set(17, 17, 1); group.add(moon);
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
    const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe7c579, size: .16, transparent: true, opacity: .48, depthWrite: false, blending: THREE.AdditiveBlending }));
    decorations.add(dust); animated.dust = dust;
    mergeStaticGroup(decorations);
    group.add(decorations);
  }

  function applyLighting(zone, scene, hemi, directional, renderer) {
    if (zone === 'village') {
      scene.background = new THREE.Color(0x071512);
      scene.fog = new THREE.FogExp2(0x10241f, .0045);
      hemi.color.setHex(0x9db9ad); hemi.groundColor.setHex(0x49372a); hemi.intensity = 1.08;
      directional.color.setHex(0xffddb0); directional.intensity = 1.6; directional.position.set(-38, 72, 30);
      renderer.toneMappingExposure = 1.12;
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
