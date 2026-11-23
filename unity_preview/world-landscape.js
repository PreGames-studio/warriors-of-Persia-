import {CAVE,createCave,buildCave} from './cave-dungeon.js';
import { WEST_FIELD, OPEN_WORLD_BOUNDS, OPEN_WORLD_ROUTES, VILLAGE_GATE, routeDistance, createSlimeSpawns } from './open-world-first.js';
export const BUSH_CARDS_PER_CLUMP = 50;
/** Shared deterministic landscape grammar for every combat map.
 * Existing PBR architecture/materials are reused; no remote assets.
 */
export function combatBounds(zone, tier=1) {
  return zone === 'dungeon' ? (tier===1?{x:CAVE.width/2,z:CAVE.depth/2}:{x:68,z:53}) : OPEN_WORLD_BOUNDS;
}

export function combatHeight(zone, tier, x, z) {
  if (zone === 'open_world') {
    // Both banks meet the bridge at zero without a step at either end.
    const bank = Math.min(1, Math.max(0, (Math.abs(x) - 11) / 20));
    return bank * (.065 * x - .075 * z + 2.8 * Math.sin(x / 28) * Math.sin(z / 23));
  }
  if(tier===1)return 0;
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

function createExpandedOpenWorldPlan(){
  let seed=6201;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const trees=[],rocks=[],slimes=createSlimeSpawns();
  for(let i=0;i<6200;i++){
    const west=i<5900;
    const x=west ? -1175+random()*1150 : 18+random()*106;
    const z=(random()*2-1)*(west?870:84);
    if(routeDistance(x,z)<13||slimes.some(p=>Math.hypot(p.x-x,p.z-z)<5))continue;
    // Keep the former west bank untouched; sparse east trees no longer hide the terrain.
    if(!west)continue;
    const p={x,z,y:combatHeight('open_world',1,x,z),scale:.7+random()*1.9,yaw:random()*Math.PI};
    (random()<.68?trees:rocks).push(p);
  }
  // East-bank lanes stay clear. Small clusters use the village's existing
  // instanced architecture, keeping both dungeon entrances and bridge open.
  const plots=[], bushes=[];
  const portals=[[54,-28],[78,30],[30,-4],[58,10]];
  for(let i=0;i<1600;i++){
    const x=150+random()*1010, z=(random()*2-1)*850;
    if(routeDistance(x,z)<22 || portals.some(p=>Math.hypot(x-p[0],z-p[1])<28)) continue;
    if(i<260 && !plots.some(p=>Math.hypot(p.x-x,p.z-z)<25)) {
      plots.push({x,z,y:combatHeight('open_world',1,x,z),scale:.8,rotY:Math.round(random()*4)*Math.PI/2,floors:1+Math.floor(random()*3),kind:'house'});
    } else if(!plots.some(p=>Math.hypot(p.x-x,p.z-z)<12)) {
      const item={x,z,y:combatHeight('open_world',1,x,z),scale:.8+random()*1.3,yaw:random()*Math.PI};
      (random()<.78?bushes:random()<.35?trees:rocks).push(item);
    }
  }
  // Short irregular rock ridges create landmarks and cover, while leaving
  // generous gaps around roads, buildings, portal approaches and the bridge.
  const walls=[];
  const clearFeature=(x,z,margin)=>x>25 && x<1160 && Math.abs(z)<855 &&
    routeDistance(x,z)>margin && portals.every(p=>Math.hypot(x-p[0],z-p[1])>margin+18) &&
    plots.every(p=>Math.hypot(x-p.x,z-p.z)>margin+10);
  const centres=[];
  for(let x=45;x<1150;x+=72) for(let z=-810;z<=810;z+=90){
    const cx=x+(random()-.5)*20, cz=z+(random()-.5)*20;
    if(!clearFeature(cx,cz,35) || centres.some(p=>Math.hypot(p.x-cx,p.z-cz)<60))continue;
    centres.push({x:cx,z:cz});
    const angle=random()*Math.PI, count=3+Math.floor(random()*3);
    for(let n=0;n<count;n++){
      const offset=(n-(count-1)/2)*4.2;
      const px=cx+Math.cos(angle)*offset, pz=cz+Math.sin(angle)*offset;
      if(!clearFeature(px,pz,22))continue;
      walls.push({x:px,z:pz,y:combatHeight('open_world',1,px,pz),yaw:angle+n*.18,
        scale:1.15+random()*.5});
    }
  }
  // Hand-placed groups make the new landscape legible as soon as the player
  // crosses the bridge; the same clearance rules protect the dungeon routes.
  for (const [cx,cz] of [[36,-62],[38,66],[105,-52],[112,60]]) {
    for(let n=0;n<4;n++) {
      const px=cx+(n-1.5)*4, pz=cz+Math.sin(n)*2;
      if(clearFeature(px,pz,20)) walls.push({x:px,z:pz,y:combatHeight('open_world',1,px,pz),yaw:n*.3,scale:1.25});
    }
    for(let n=0;n<7;n++) {
      const px=cx-6+n*2, pz=cz+8+(n%3)*2;
      if(clearFeature(px,pz,14)) bushes.push({x:px,z:pz,y:combatHeight('open_world',1,px,pz),scale:1.1,yaw:n*.6});
    }
  }
  // Grass fringes along the stone edges, leaving the path and portal buffers clear.
  walls.forEach((wall,i)=>{
    if(i%2) return;
    for(let n=0;n<5;n++){
      const angle=wall.yaw+n*1.18, radius=4.8+(n%2)*2;
      const px=wall.x+Math.sin(angle)*radius, pz=wall.z-Math.cos(angle)*radius;
      if(clearFeature(px,pz,14)) bushes.push({x:px,z:pz,y:combatHeight('open_world',1,px,pz),scale:.95+random()*.65,yaw:angle});
    }
  });
  // Fill the near-bank clearings too, rather than waiting until far beyond
  // the dungeon entrances for the first meaningful clusters of vegetation.
  for(let x=30;x<=150;x+=12) for(let z=-78;z<=78;z+=12){
    const px=x+(random()-.5)*4,pz=z+(random()-.5)*4;
    if(!clearFeature(px,pz,14)) continue;
    for(let n=0;n<3;n++){
      const bx=px+(random()-.5)*5,bz=pz+(random()-.5)*5;
      if(clearFeature(bx,bz,14)) bushes.push({x:bx,z:bz,y:combatHeight('open_world',1,bx,bz),scale:.8+random()*.7,yaw:random()*Math.PI});
    }
  }
  // Organic bush clusters: visual cover only, not a hidden-hero mechanic.
  for(let x=40;x<1150;x+=45) for(let z=-810;z<=810;z+=60){
    const cx=x+(random()-.5)*16,cz=z+(random()-.5)*16;
    if(!clearFeature(cx,cz,20) || walls.some(p=>Math.hypot(cx-p.x,cz-p.z)<12))continue;
    for(let n=0;n<4;n++){
      const px=cx+(random()-.5)*7,pz=cz+(random()-.5)*7;
      if(!clearFeature(px,pz,14))continue;
      bushes.push({x:px,z:pz,y:combatHeight('open_world',1,px,pz),scale:.8+random()*.8,yaw:random()*Math.PI});
    }
  }
  // Preserve every existing clump and add four local companions: exactly 5x
  // the previous density. Shrink offsets at path/portal boundaries.
  const baseBushCount=bushes.length;
  for(let i=0;i<baseBushCount;i++){
    const parent=bushes[i];
    for(let n=0;n<4;n++){
      const angle=parent.yaw+n*Math.PI/2+i*.071;
      let distance=1.6+(n%2)*.85, x=parent.x, z=parent.z;
      for(let attempt=0;attempt<5;attempt++){
        const px=parent.x+Math.cos(angle)*distance, pz=parent.z+Math.sin(angle)*distance;
        if(clearFeature(px,pz,14)){x=px;z=pz;break;}
        distance*=.5;
      }
      bushes.push({x,z,y:combatHeight('open_world',1,x,z),scale:parent.scale*(.72+(n%3)*.1),yaw:angle});
    }
  }
  return {bounds:OPEN_WORLD_BOUNDS,routes:OPEN_WORLD_ROUTES,portals:[[VILLAGE_GATE.x,VILLAGE_GATE.z],[54,-28],[78,30]],plots,trees,rocks,bushes,baseBushCount,walls,slimes,fire:false,landmarks:[
    {x:-550,z:770,title:'چشم‌انداز دامنه',symbol:'△'},{x:0,z:0,title:'پل رودخانه',symbol:'≋'}]};
}

export function createCombatPlan(zone, tier = 1, floor = 1) {
  if(zone==='open_world')return createExpandedOpenWorldPlan();
  if(zone==='dungeon'&&tier===1){const cave=createCave(floor);return {floor,bounds:combatBounds(zone,tier),routes:cave.routes,portals:[[cave.spawn.x,cave.spawn.z]],plots:[],trees:[],rocks:[],fire:false,landmarks:[]};}
  const bounds = combatBounds(zone, tier), fire = zone === 'dungeon' && tier >= 3;
  let seed = zone === 'open_world' ? 6201 : fire ? 937 : 493;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const routes = zone === 'open_world' ? [
    [[-124, 0], [-88, 0], [-58, 3], [-26, -2], [-11, 0], [11, 0], [32, 3], [58, 0], [91, 8], [124, 4]],
    [[32, 3], [43, -12], [54, -28]],
    [[58, 0], [69, 14], [78, 30]],
    [[-58, 3], [-66, 25], [-95, 49]],
  ] : [[[0,48],[0,28],[6,16],[-4,4],[0,-8],[0,-24]],[[6,16],[29,22],[43,5],[34,-16],[22,-27]],[[-4,4],[-30,13],[-46,-4],[-36,-26],[-22,-29]]];
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
  if(zone==='dungeon'&&tier===1)return buildCave(THREE,createCave(plan.floor||1),materials.volcanicRock);
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
    const uv=geometry.attributes.uv;
    if(zone==='open_world')for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/258,uv.getY(i)*d/180);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, 0, z); mesh.receiveShadow = true; root.add(mesh);
  }
  const ground = zone === 'open_world' ? kit.materials.ground : plan.fire ? materials.volcanicRock : materials.highlandGrass;
  if(zone==='open_world'){
    surface(WEST_FIELD.maxX-WEST_FIELD.minX,WEST_FIELD.maxZ-WEST_FIELD.minZ,(WEST_FIELD.maxX+WEST_FIELD.minX)/2,0,ground);
    // Tile the expanded bank: each geometry stays within 16-bit index limits.
    for(let ix=0;ix<4;ix++) for(let iz=0;iz<6;iz++) {
      const w=1188/4, d=1760/6;
      surface(w,d,-7+w*(ix+.5),-880+d*(iz+.5),ground);
    }
  }else surface(plan.bounds.x * 2 + 4, plan.bounds.z * 2 + 4, 0, 0, ground);
  // Sloping ribbons share exactly the terrain height; no floating box roads.
  plan.routes.forEach(route => route.slice(1).forEach((b, i) => {
    const a = route[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.ceil(length / 2);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const halfWidth=zone==='open_world'&&a[0]<0?7:2.5;
    const vertices = [], indices = [], uvs = [];
    for (let j = 0; j <= steps; j++) for (const side of [-1, 1]) {
      const x = a[0] + (b[0]-a[0])*j/steps - dz*side*halfWidth, z = a[1] + (b[1]-a[1])*j/steps + dx*side*halfWidth;
      vertices.push(x, height(x, z) + .07, z);uvs.push(j/steps*length/8,(side+1)/2);
    }
    for (let j = 0; j < steps; j++) { const k = j * 2; indices.push(k, k+1, k+2, k+1, k+3, k+2); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, kit.materials.road); road.receiveShadow = true; root.add(road);
  }));
  if (plan.plots.length) root.add(kit.buildDistrict(plan.plots));
  const matrix = new THREE.Object3D();
  function batch(geometry, material, items, yOffset, scaleY = 1, castShadow = true) {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((p, i) => {
      matrix.position.set(p.x, p.y + yOffset * p.scale, p.z); matrix.rotation.set(0, p.yaw, 0); matrix.scale.set(p.scale, p.scale * scaleY, p.scale); matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix);
    });
    mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
    return mesh;
  }
  batch(new THREE.DodecahedronGeometry(1.6, 0), plan.fire ? materials.volcanicRock : materials.mountainRock, plan.rocks, .7, .85);
  batch(new THREE.CylinderGeometry(.18, .3, 3, 6), materials.darkWood, plan.trees, 1.5);
  batch(new THREE.ConeGeometry(1.7, 6, 7), materials.cypressFoliage, plan.trees, 4.4);
  if (plan.walls && plan.walls.length) {
    // Weathered, flattened slabs rather than spherical masonry boulders.
    // The lumpy outline is generated once and shared by every instance.
    const stone = new THREE.SphereGeometry(2.6, 20, 12);
    const v = stone.attributes.position;
    for (let i=0;i<v.count;i++) {
      const x=v.getX(i), y=v.getY(i), z=v.getZ(i);
      const noise=1+.12*Math.sin(x*2.1+z*1.5+y*1.2)+.05*Math.sin(x*4.3-z*2.8);
      v.setXYZ(i,x*noise*1.35,Math.max(-1.35,Math.min(1.3,y*.72*noise)),z*noise*.88);
    }
    stone.computeVertexNormals();
    // Locally generated grain and hairline seams add weathered detail without
    // downloading textures or embedding third-party artwork.
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(256,256);
    for(let y=0;y<256;y++) for(let x=0;x<256;x++){
      const n=Math.sin(x*12.9898+y*78.233)*43758.5453;
      const grain=(n-Math.floor(n)-.5)*24;
      const layered=10*Math.sin(x*.105+Math.sin(y*.11)*1.4)+8*Math.sin(y*.19+x*.025);
      const seam=Math.abs(Math.sin(y*.072+Math.sin(x*.036)*1.8))<.035 ? -26 : 0;
      const c=Math.max(70,Math.min(235,174+grain+layered+seam));
      const k=(y*256+x)*4; pixels.data[k]=c; pixels.data[k+1]=c; pixels.data[k+2]=c; pixels.data[k+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    const stoneTexture=new THREE.CanvasTexture(canvas);
    const stoneMaterial = new THREE.MeshStandardMaterial({color:0x68786a,map:stoneTexture,roughness:1});
    const capMaterial = new THREE.MeshStandardMaterial({color:0x314f35,roughness:1});
    batch(stone, stoneMaterial, plan.walls, 1.05, 1);
    // Moss crowns break the hard stone silhouette and blend into the shrubs.
    batch(new THREE.IcosahedronGeometry(1.55,1), capMaterial, plan.walls.filter((_,i)=>i%2===0), 1.9, .22);
  }
  if (plan.bushes && plan.bushes.length) {
    // Fifty independently oriented botanical cards are packed into one shared
    // geometry. This multiplies visible bush count without allocating one
    // million Object3Ds or one million instance matrices.
    const atlas=document.createElement('canvas'); atlas.width=1024; atlas.height=256;
    const paint=atlas.getContext('2d');
    let leafSeed=73491;
    const randomLeaf=()=>{leafSeed=(Math.imul(leafSeed,1664525)+1013904223)>>>0;return leafSeed/4294967296;};
    for(let variant=0;variant<4;variant++){
      const origin=variant*256;
      for(let n=0;n<26;n++){
        const rootX=origin+128+(randomLeaf()-.5)*74, rootY=235-randomLeaf()*25;
        const tipX=origin+128+(randomLeaf()-.5)*206;
        const tipY=34+randomLeaf()*145, width=8+randomLeaf()*19;
        const midX=(rootX+tipX)*.5, midY=(rootY+tipY)*.5;
        const green=92+Math.floor(randomLeaf()*75);
        paint.fillStyle=`rgb(${Math.floor(green*.40)},${green},${Math.floor(green*.43)})`;
        paint.beginPath();paint.moveTo(rootX,rootY);
        paint.quadraticCurveTo(midX-width,midY,tipX,tipY);
        paint.quadraticCurveTo(midX+width,midY,rootX,rootY);paint.fill();
        paint.strokeStyle='rgba(183,207,121,0.25)';paint.lineWidth=1;
        paint.beginPath();paint.moveTo(rootX,rootY);paint.quadraticCurveTo(midX,midY,tipX,tipY);paint.stroke();
      }
    }
    const foliageTexture=new THREE.CanvasTexture(atlas);
    if(THREE.SRGBColorSpace) foliageTexture.colorSpace=THREE.SRGBColorSpace;
    const positions=[], uvs=[], indices=[];
    for(let n=0;n<BUSH_CARDS_PER_CLUMP;n++){
      const angle=n*2.399963, radius=.2+1.25*Math.sqrt(n/(BUSH_CARDS_PER_CLUMP-1));
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      const facing=angle*.63, dx=Math.cos(facing)*.52, dz=Math.sin(facing)*.52;
      const h=1.30+(n%7)*.11, lean=.12+(n%3)*.07;
      const k=n*4, v=n%4, u0=(v*256+3)/1024,u1=((v+1)*256-3)/1024;
      positions.push(x-dx,0,z-dz, x+dx,0,z+dz,
        x-dx+Math.cos(angle)*lean,h,z-dz+Math.sin(angle)*lean,
        x+dx+Math.cos(angle)*lean,h,z+dz+Math.sin(angle)*lean);
      uvs.push(u0,0,u1,0,u0,1,u1,1);
      indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
    const foliage=new THREE.BufferGeometry();
    foliage.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    foliage.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    foliage.setIndex(indices);foliage.computeVertexNormals();
    const grass=new THREE.MeshStandardMaterial({map:foliageTexture,color:0xb9d8b6,
      roughness:1,side:THREE.DoubleSide,alphaTest:.32});
    // Spatial batches let the renderer cull distant vegetation; all plants
    // remain present rather than reducing density or quality on mobile.
    const tiles=new Map();
    plan.bushes.forEach((p,i)=>{
      const key=`${Math.floor(p.x/100)},${Math.floor(p.z/100)}`;
      if(!tiles.has(key)) tiles.set(key,[]);
      tiles.get(key).push({p,i});
    });
    const variation=new THREE.Color();
    tiles.forEach(entries=>{
      const grassMesh=batch(foliage,grass,entries.map(e=>e.p),0,1,false);
      entries.forEach(({i},index)=>{
        const t=Math.abs((Math.sin(i*12.9898)*43758.5453)%1);
        variation.setRGB(.9+t*.1,.9+t*.1,.88+t*.12);
        grassMesh.setColorAt(index,variation);
      });
      grassMesh.instanceColor.needsUpdate=true;
    });
  }
  if (plan.fire) {
    // Ember seams are outside traversal routes; warm emissive material is reused.
    batch(new THREE.OctahedronGeometry(.5), materials.portalFire, plan.rocks.filter((_, i) => i % 4 === 0), .7);
  }
  return root;
}
