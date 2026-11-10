// Deterministic perfect maze: connected passages, many dead ends, longest-distance boss.
export const CAVE={cols:26,rows:35,width:1309,depth:1760,wall:3,height:28};
const cache=new Map();
export function createCave(floor=1){
 if(cache.has(floor))return cache.get(floor);
 const {cols,rows,width,depth}=CAVE,cw=width/cols,ch=depth/rows;
 let seed=9173+floor*811;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const cells=Array.from({length:cols*rows},(_,id)=>({id,links:[]})),seen=new Set([0]),stack=[0];
 const neighbors=id=>[id%cols? id-1:-1,id%cols<cols-1?id+1:-1,id>=cols?id-cols:-1,id<cols*(rows-1)?id+cols:-1].filter(n=>n>=0);
 while(stack.length){const id=stack.at(-1),options=neighbors(id).filter(n=>!seen.has(n));if(!options.length){stack.pop();continue;}const n=options[Math.floor(random()*options.length)];cells[id].links.push(n);cells[n].links.push(id);seen.add(n);stack.push(n);}
 const center=id=>({x:-width/2+(id%cols+.5)*cw,z:-depth/2+(Math.floor(id/cols)+.5)*ch});
 const distances=[0],queue=[0];for(const id of queue)for(const n of cells[id].links)if(distances[n]===undefined){distances[n]=distances[id]+1;queue.push(n);}
 const bossId=distances.indexOf(Math.max(...distances));
 const walls=[];
 for(const c of cells){const p=center(c.id),col=c.id%cols,row=Math.floor(c.id/cols);
 if(row===0)walls.push({x:p.x,z:p.z-ch/2,w:cw+3,d:3});
 if(col===0)walls.push({x:p.x-cw/2,z:p.z,w:3,d:ch+3});
 if(col===cols-1||!c.links.includes(c.id+1))walls.push({x:p.x+cw/2,z:p.z,w:3,d:ch+3});
 if(row===rows-1||!c.links.includes(c.id+cols))walls.push({x:p.x,z:p.z+ch/2,w:cw+3,d:3});
 }
 const wallBuckets=Array.from({length:cells.length},()=>[]);
 for(const w of walls)for(let row=Math.max(0,Math.floor((w.z-w.d/2-3+depth/2)/ch));row<=Math.min(rows-1,Math.floor((w.z+w.d/2+3+depth/2)/ch));row++)for(let col=Math.max(0,Math.floor((w.x-w.w/2-3+width/2)/cw));col<=Math.min(cols-1,Math.floor((w.x+w.w/2+3+width/2)/cw));col++)wallBuckets[row*cols+col].push(w);
 const cave={cells,walls,wallBuckets,center,cw,ch,bossId,spawn:center(0),boss:center(bossId),routes:cells.flatMap(c=>c.links.filter(n=>n>c.id).map(n=>{const a=center(c.id),b=center(n);return [[a.x,a.z],[b.x,b.z]];})),slimes:cells.filter(c=>c.id!==0&&c.id!==bossId&&c.id%3===0).map(c=>({...center(c.id),id:`cave_slime_${c.id}`}))};
 cache.set(floor,cave);return cave;
}
export function caveCell(x,z){const col=Math.floor((x+CAVE.width/2)/(CAVE.width/CAVE.cols)),row=Math.floor((z+CAVE.depth/2)/(CAVE.depth/CAVE.rows));return col>=0&&col<CAVE.cols&&row>=0&&row<CAVE.rows?row*CAVE.cols+col:-1;}
export function caveWalkable(cave,x,z,radius=1.8){
 if(Math.abs(x)>CAVE.width/2-radius||Math.abs(z)>CAVE.depth/2-radius)return false;
 return !(cave.wallBuckets[caveCell(x,z)]||cave.walls).some(w=>Math.abs(x-w.x)<w.w/2+radius&&Math.abs(z-w.z)<w.d/2+radius);
}
export function caveCanMove(cave,from,to){const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)));for(let i=1;i<=steps;i++)if(!caveWalkable(cave,from.x+(to.x-from.x)*i/steps,from.z+(to.z-from.z)*i/steps))return false;return true;}
export function buildCave(THREE,cave,rock){
 const root=new THREE.Group(),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 const stone=rock.clone();stone.color.setHex(0x494842);stone.roughness=1;
 const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stone,cave.walls.length);
 cave.walls.forEach((w,i)=>{matrix.compose(new THREE.Vector3(w.x,CAVE.height/2,w.z),q,new THREE.Vector3(w.w,CAVE.height,w.d));walls.setMatrixAt(i,matrix);});walls.receiveShadow=true;root.add(walls);
 // Keep a genuine roof, high enough for the existing third-person camera.
 for(const y of [-.3,CAVE.height]){const geometry=new THREE.BoxGeometry(CAVE.width,.6,CAVE.depth);const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*CAVE.width/12,uv.getY(i)*CAVE.depth/12);const slab=new THREE.Mesh(geometry,stone);slab.position.y=y;slab.receiveShadow=true;root.add(slab);}
 const crystalMat=new THREE.MeshStandardMaterial({color:0x6eafa3,emissive:0x22554c,roughness:.55});
 const crystals=new THREE.InstancedMesh(new THREE.ConeGeometry(2,7,5),crystalMat,Math.ceil(cave.cells.length/9));let i=0;
 for(const c of cave.cells.filter(c=>c.id%9===0)){const p=cave.center(c.id);matrix.compose(new THREE.Vector3(p.x+16,3.5,p.z+16),q,new THREE.Vector3(1,1,1));crystals.setMatrixAt(i++,matrix);}root.add(crystals);
 const stalactites=new THREE.InstancedMesh(new THREE.ConeGeometry(3.5,10,7),stone,Math.ceil(cave.cells.length/4));i=0;
 for(const c of cave.cells.filter(c=>c.id%4===0)){const p=cave.center(c.id);const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);matrix.compose(new THREE.Vector3(p.x-15,CAVE.height-5,p.z+15),rotation,new THREE.Vector3(1,1,1));stalactites.setMatrixAt(i++,matrix);}root.add(stalactites);return root;
}
