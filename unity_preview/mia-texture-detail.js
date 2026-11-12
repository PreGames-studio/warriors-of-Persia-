/**
 * Procedural surface micro-detail for Mia's baked maps.
 *
 * The supplied CC0 textures are painted at 512-2048 px and read soft in
 * close-ups. Rather than upscaling or re-encoding them (which would break the
 * "no texture quality reduction" rule and bloat the APK by ~13 MB), the detail
 * is generated once on the GPU-upload path from a deterministic noise field and
 * added to the *existing* normal map as a height gradient. Source pixels stay
 * fetchable as originally authored; only a derived canvas is uploaded.
 *
 * Cost: one pass over ~3 M pixels during load (~100 ms on desktop), then the
 * canvas is cached per source texture and shared by every mesh that uses it.
 */

function makeNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Value noise at the requested grid size, bilinearly sampled. */
function lattices(random, grids) {
  return grids.map((grid) => {
    const data = new Float32Array(grid * grid);
    for (let i = 0; i < data.length; i++) data[i] = random();
    return { grid, data };
  });
}

function sample(layer, grid, u, v) {
  const x = u * grid;
  const y = v * grid;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x1 = (x0 + 1) % grid;
  const y1 = (y0 + 1) % grid;
  const d = layer.data;
  const a = d[y0 * grid + x0];
  const b = d[y0 * grid + x1];
  const c = d[y1 * grid + x0];
  const e = d[y1 * grid + x1];
  return (a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy;
}

function heightField(size, seed, kind) {
  const random = makeNoise(seed);
  const base = Math.max(2, size);
  const grids = kind === 'strands'
    ? [Math.max(2, Math.round(base / 24)), Math.max(2, Math.round(base / 48)), Math.max(2, Math.round(base / 96))]
    : kind === 'weave'
      ? [Math.max(2, Math.round(base / 10)), Math.max(2, Math.round(base / 20)), Math.max(2, Math.round(base / 40))]
      : kind === 'folds'
        // Broad drape, not thread: long ridges with soft shoulders.
        ? [Math.max(2, Math.round(base / 5)), Math.max(2, Math.round(base / 11)), Math.max(2, Math.round(base / 26))]
        : [Math.max(2, Math.round(base / 4)), Math.max(2, Math.round(base / 8)), Math.max(2, Math.round(base / 16))];
  const layers = lattices(random, grids);

  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let value = 0;
      let amplitude = 1;
      let total = 0;
      for (let i = 0; i < layers.length; i++) {
        value += sample(layers[i], layers[i].grid, u, v) * amplitude;
        total += amplitude;
        amplitude *= 0.52;
      }
      value /= total;
      if (kind === 'pores') {
        // Soft, rounded pore cells — not per-pixel grain.
        const pits = Math.pow(1 - value, 1.6);
        field[y * size + x] = pits;
      } else if (kind === 'weave') {
        // Thread pitch is a real woven scale, not sub-pixel: 1-2 px threads on a
        // 512 px atlas alias into corduroy stripes under mipmapping.
        const threadSize = Math.max(3.2, size / 150);
        const warp = Math.sin((x / threadSize) * Math.PI) * 0.5 + 0.5;
        const weft = Math.sin((y / threadSize) * Math.PI) * 0.5 + 0.5;
        field[y * size + x] = (warp * 0.5 + weft * 0.5) * 0.24 + value * 0.76;
      } else if (kind === 'folds') {
        // Ridges follow the noise gradient, so folds bend the way cloth drapes
        // instead of forming a regular stripe pattern.
        const warp = Math.sin((x / size) * 6.2 * Math.PI + value * 9.5)
          + Math.sin((y / size) * 3.4 * Math.PI + value * 5.1) * 0.7;
        field[y * size + x] = 0.5 + warp * 0.16 + (value - 0.5) * 0.45;
      } else {
        const groove = Math.sin((x / size) * 420 * Math.PI + value * 30) * 0.5 + 0.5;
        field[y * size + x] = groove * 0.78 + value * 0.22;
      }
    }
  }
  return field;
}

function imageReady(image) {
  if (!image) return false;
  const width = image.naturalWidth || image.width || 0;
  return Boolean(width) && (image.complete === undefined || image.complete);
}

function waitForImage(image) {
  if (!image) return Promise.resolve(null);
  if (imageReady(image)) return Promise.resolve(image);
  if (typeof image.decode === 'function') {
    return image.decode().then(() => image).catch(() => (imageReady(image) ? image : null));
  }
  if (typeof image.addEventListener === 'function') {
    return new Promise((resolve) => {
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => resolve(null), { once: true });
    });
  }
  return Promise.resolve(imageReady(image) ? image : null);
}

function context2d(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * Augment a tangent-space normal map with new high-frequency relief.
 * `kind` is 'pores' (skin), 'weave' (cloth) or 'strands' (hair).
 */
export { waitForImage };

export async function addNormalDetail(THREE, texture, kind, strength, seed) {
  if (!texture || !texture.image) return texture;
  const image = await waitForImage(texture.image);
  if (!image) return texture;
  const size = Math.min(1024, image.naturalWidth || image.width || 512);
  if (!size) return texture;
  if (!size) return texture;
  const canvas = context2d(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size);
  const data = pixels.data;
  const height = heightField(size, seed, kind);

  for (let y = 0; y < size; y++) {
    const ym = y > 0 ? y - 1 : y;
    const yp = y < size - 1 ? y + 1 : y;
    for (let x = 0; x < size; x++) {
      const xm = x > 0 ? x - 1 : x;
      const xp = x < size - 1 ? x + 1 : x;
      const dx = (height[y * size + xp] - height[y * size + xm]) * 0.5;
      const dy = (height[yp * size + x] - height[ym * size + x]) * 0.5;
      const i = (y * size + x) * 4;
      let nx = (data[i] / 255) * 2 - 1 - dx * strength;
      let ny = (data[i + 1] / 255) * 2 - 1 - dy * strength;
      const nz = (data[i + 2] / 255) * 2 - 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      data[i] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255);
    }
  }
  ctx.putImageData(pixels, 0, 0);

  const detailed = new THREE.CanvasTexture(canvas);
  detailed.wrapS = texture.wrapS;
  detailed.wrapT = texture.wrapT;
  detailed.repeat.copy(texture.repeat);
  detailed.offset.copy(texture.offset);
  detailed.flipY = texture.flipY;
  detailed.colorSpace = texture.colorSpace;
  detailed.anisotropy = texture.anisotropy;
  detailed.needsUpdate = true;
  return detailed;
}


/**
 * Cavity shading from the normal map: seams, creases and stitches are darkened
 * while convex edges pick up a hint of wear, which is what makes painted cloth
 * and leather stop looking like flat vinyl under a moving light. Runs at the
 * albedo's own resolution so nothing is downscaled.
 */
export async function addCavityShade(THREE, albedo, normalMap, amount = 0.5, wear = 0.25) {
  if (!albedo || !albedo.image || !normalMap || !normalMap.image) return albedo;
  const [colorImage, normalImage] = await Promise.all([waitForImage(albedo.image), waitForImage(normalMap.image)]);
  if (!colorImage || !normalImage) return albedo;
  const size = Math.min(1024, colorImage.naturalWidth || colorImage.width || 512);
  if (!size) return albedo;

  const colorCanvas = context2d(size);
  const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
  colorCtx.drawImage(colorImage, 0, 0, size, size);
  const colorPixels = colorCtx.getImageData(0, 0, size, size);

  const normalCanvas = context2d(size);
  const normalCtx = normalCanvas.getContext('2d', { willReadFrequently: true });
  normalCtx.drawImage(normalImage, 0, 0, size, size);
  const normalPixels = normalCtx.getImageData(0, 0, size, size).data;

  // Smooth the tangent-space field first: 512² painted normals carry pixel
  // noise that would otherwise show up as speckled dirt instead of creases.
  const field = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      field[(y * size + x) * 2] = normalPixels[i] / 255 * 2 - 1;
      field[(y * size + x) * 2 + 1] = normalPixels[i + 1] / 255 * 2 - 1;
    }
  }
  const smooth = new Float32Array(field.length);
  const radius = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= size) continue;
          const k = (yy * size + xx) * 2;
          sumX += field[k];
          sumY += field[k + 1];
          count += 1;
        }
      }
      smooth[(y * size + x) * 2] = sumX / count;
      smooth[(y * size + x) * 2 + 1] = sumY / count;
    }
  }
  const at = (x, y, channel) => smooth[((y * size + x) * 2) + channel];

  const data = colorPixels.data;
  for (let y = 0; y < size; y++) {
    const ym = y > 0 ? y - 1 : y;
    const yp = y < size - 1 ? y + 1 : y;
    for (let x = 0; x < size; x++) {
      const xm = x > 0 ? x - 1 : x;
      const xp = x < size - 1 ? x + 1 : x;
      // Divergence of the tangent-space normal field: negative bends inward
      // (a crease), positive bends outward (a ridge or a worn edge).
      const divergence = (at(xp, y, 0) - at(xm, y, 0)) * 0.5 + (at(x, yp, 1) - at(x, ym, 1)) * 0.5;
      // Creases (negative divergence) darken, ridges brighten a little: the
      // asymmetry keeps contact shadow from turning into a glow.
      const scale = 1 + Math.max(-amount, Math.min(wear, divergence * 2.4));
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, data[i] * scale));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * scale));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * scale));
    }
  }
  colorCtx.putImageData(colorPixels, 0, 0);

  const shaded = new THREE.CanvasTexture(colorCanvas);
  shaded.wrapS = albedo.wrapS;
  shaded.wrapT = albedo.wrapT;
  shaded.repeat.copy(albedo.repeat);
  shaded.offset.copy(albedo.offset);
  shaded.flipY = albedo.flipY;
  shaded.colorSpace = albedo.colorSpace;
  shaded.anisotropy = albedo.anisotropy;
  shaded.needsUpdate = true;
  return shaded;
}

/**
 * Strand-aligned gloss variation so a single light does not turn the hair into
 * one plastic highlight. Returned in glTF layout (G = roughness) so it can feed
 * `roughnessMap` directly.
 */
export function strandRoughness(THREE, texture, seed = 9001, size = 512) {
  const canvas = context2d(size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const height = heightField(size, seed, 'strands');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Soft roots (rougher) and glossier mid-lengths.
      const value = 0.44 + (1 - height[y * size + x]) * 0.44;
      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = Math.round(Math.min(1, value) * 255);
      image.data[i + 2] = 0;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const generated = new THREE.CanvasTexture(canvas);
  generated.wrapS = generated.wrapT = THREE.RepeatWrapping;
  generated.repeat.copy(texture ? texture.repeat : { x: 1, y: 1 });
  generated.colorSpace = THREE.NoColorSpace;
  generated.needsUpdate = true;
  return generated;
}

/** Subtle albedo mottling: pores and thread gaps are shadow, never highlight. */
export async function addAlbedoDetail(THREE, texture, kind, amount, seed) {
  if (!texture || !texture.image) return texture;
  const image = await waitForImage(texture.image);
  if (!image) return texture;
  const size = Math.min(1024, image.naturalWidth || image.width || 512);
  if (!size) return texture;
  const canvas = context2d(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size);
  const data = pixels.data;
  const height = heightField(size, seed, kind);
  for (let i = 0, p = 0; p < height.length; i += 4, p++) {
    const gain = 1 - (1 - height[p]) * amount * 0.5 - (0.5 - height[p]) * amount * 0.5;
    data[i] = Math.min(255, data[i] * gain);
    data[i + 1] = Math.min(255, data[i + 1] * gain);
    data[i + 2] = Math.min(255, data[i + 2] * gain);
  }
  ctx.putImageData(pixels, 0, 0);
  const detailed = new THREE.CanvasTexture(canvas);
  detailed.wrapS = texture.wrapS;
  detailed.wrapT = texture.wrapT;
  detailed.repeat.copy(texture.repeat);
  detailed.flipY = texture.flipY;
  detailed.colorSpace = texture.colorSpace;
  detailed.anisotropy = texture.anisotropy;
  detailed.needsUpdate = true;
  return detailed;
}
