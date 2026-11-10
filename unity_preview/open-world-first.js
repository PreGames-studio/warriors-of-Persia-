/** The original west bank (-128..-11, -88..88) expanded 10x per axis = 100x area. */
export const WEST_FIELD = Object.freeze({minX:-1181,maxX:-11,minZ:-880,maxZ:880,originalArea:117*176});
export const OPEN_WORLD_BOUNDS = Object.freeze({x:1181,z:880,minX:-1181,maxX:128,minZ:-880,maxZ:880});
export const WEST_SPAWN = Object.freeze({x:-1120,z:0});
export const VILLAGE_GATE = Object.freeze({x:-1150,z:0});
export const SAFE_TRAIL_HALF_WIDTH = 7;
export const OPEN_WORLD_ROUTES = [
 [[-1170,0],[-1150,0],[-1120,0],[-1040,-30],[-850,70],[-630,-50],[-400,45],[-210,-30],[-80,0],[-11,0],[11,0],[32,3],[58,0],[91,8],[124,4]],
 [[-1040,-30],[-1030,-300],[-850,-600],[-550,-770],[-240,-620],[-80,-360],[-80,0]],
 [[-850,70],[-1000,330],[-850,650],[-550,770],[-220,640],[-80,350],[-80,0]],
 [[-630,-50],[-620,-360],[-550,-770]],
 [[-630,-50],[-600,330],[-550,770]],
 [[32,3],[43,-12],[54,-28]],
 [[58,0],[69,14],[78,30]]
];
export function routeDistance(x,z,routes=OPEN_WORLD_ROUTES){
 let nearest=Infinity;
 for(const route of routes)for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
 }
 return nearest;
}
export const isSafeWestTrail=(x,z)=>x<-7&&routeDistance(x,z)<=SAFE_TRAIL_HALF_WIDTH;
export function isOpenWorldLand(x,z){
 return (x>=WEST_FIELD.minX&&x<=-7&&Math.abs(z)<=880)||(x>=-7&&x<=128&&Math.abs(z)<=88);
}
export function slimeCanMove(from,to){
 if(to.x<-1170||to.x>-24||Math.abs(to.z)>868)return false;
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.5));
 for(let i=0;i<=steps;i++){
  const x=from.x+(to.x-from.x)*i/steps,z=from.z+(to.z-from.z)*i/steps;
  if(routeDistance(x,z)<=SAFE_TRAIL_HALF_WIDTH+2)return false;
 }
 return true;
}
export const SLIME = Object.freeze({kind:'slime',hp:100,xp:1,attack:3,drop:{type:'green_slime',title:'کریستال سبز اسلایم',color:0x32dd77,coinValue:1,count:1}});
export function createSlimeSpawns(){
 let seed=39191;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const spawns=[];
 for(let cell=0;cell<100;cell++){
  let placed=false;
  for(let attempt=0;attempt<1000;attempt++){
   const x=-1160+(cell%10+random())*112,z=-860+(Math.floor(cell/10)+random())*172;
   if(x>-24||routeDistance(x,z)<22||spawns.some(p=>Math.hypot(x-p.x,z-p.z)<35))continue;
   spawns.push({id:`slime_${cell+1}`,x,z});placed=true;break;
  }
  if(!placed)throw new Error('Unable to place slime outside safe paths');
 }
 return spawns;
}

let shared;
export function buildSlime(THREE){
 if(!shared){
  const points=[[0,0],[.65,.07],[1.1,.35],[1.22,.8],[1.14,1.2],[.9,1.65],[.56,2.05],[.24,2.45],[.07,2.8],[0,3.05]].map(([x,y])=>new THREE.Vector2(x,y));
  shared={body:new THREE.LatheGeometry(points,28),eye:new THREE.SphereGeometry(1,10,8),gel:new THREE.MeshStandardMaterial({color:0x5fcfdb,roughness:.15,metalness:.03,transparent:true,opacity:.88}),black:new THREE.MeshStandardMaterial({color:0x102838,roughness:.3}),white:new THREE.MeshBasicMaterial({color:0xf2ffff})};
 }
 const root=new THREE.Group();root.name='Slime • water droplet';
 const body=new THREE.Mesh(shared.body,shared.gel);body.castShadow=true;body.receiveShadow=true;root.add(body);
 for(const side of [-1,1]){
  const eye=new THREE.Mesh(shared.eye,shared.black);eye.position.set(side*.37,1.3,1.07);eye.scale.set(.12,.17,.1);root.add(eye);
  const glint=new THREE.Mesh(shared.eye,shared.white);glint.position.set(side*.37-.025,1.36,1.16);glint.scale.setScalar(.035);root.add(glint);
 }
 root.userData.kind='slime';return root;
}
