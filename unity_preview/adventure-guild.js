/** Guild exterior, furnished hall and walkable three-level stair system. */
export const GUILD = Object.freeze({zone:'guild',floors:3,center:{x:0,z:-3},entrance:{x:0,z:8.8},villageArrival:{x:0,z:23,yaw:0},interiorSpawn:{x:0,z:10},interiorExit:{x:0,z:25.5},bounds:{x:20.5,z:27}});

export const GUILD_UPPER_FLOORS_OPEN = false;
export function guildUpperFloorBlocked(x,z) {
  return !GUILD_UPPER_FLOORS_OPEN && Math.abs(x)>=14.8 && z < -15.5;
}

export const GUILD_STAIRS = Object.freeze([-1,1].flatMap(side=>[
  {side,flight:0,x:side*16.3,width:2.6,startZ:-16,endZ:-26,base:0,rise:7},
  {side,flight:1,x:side*19.2,width:2.6,startZ:-26,endZ:-16,base:7,rise:7}
]));

export function guildWalkHeight(x,z,previousY=0) {
  if(!GUILD_UPPER_FLOORS_OPEN)return 0;
  const floor=Math.max(0,Math.min(2,Math.round(previousY/7)))*7;
  // Turn on the rear landing to reach the parallel upper flight.
  if(Math.abs(x)>=14.9&&Math.abs(x)<=20.5&&z<=-26&&z>=-27.5&&previousY>5.6&&previousY<8.4)return 7;
  for(const stair of GUILD_STAIRS){
    if(Math.abs(x-stair.x)>stair.width/2 || z < -26 || z > -16)continue;
    const t=(z-stair.startZ)/(stair.endZ-stair.startZ);
    const height=stair.base+stair.rise*Math.max(0,Math.min(1,t));
    if(Math.abs(height-previousY)<1.25)return height;
  }
  return floor;
}

export function guildCanWalkTo(x,z,previousY) {
  if(!GUILD_UPPER_FLOORS_OPEN)return !guildUpperFloorBlocked(x,z);
  if(previousY<5.8 || Math.abs(x)<14.9 || z>=-16)return true;
  if(z<=-26)return Math.abs(previousY-7)<1.3;
  const stair=GUILD_STAIRS.find(s=>Math.abs(x-s.x)<=s.width/2);
  if(!stair)return false;
  const t=(z-stair.startZ)/(stair.endZ-stair.startZ);
  return Math.abs(previousY-(stair.base+stair.rise*t))<1.25;
}

export function guildDoorReached(position,door){
  return Math.abs(position.x-door.x)<2.3&&Math.abs(position.z-door.z)<2&&Math.abs(position.y)<1.5;
}

export function buildGuildExterior(THREE, m) {
  const root=new THREE.Group();root.name='Adventure guild • three floors';root.position.set(0,0,-3);root.userData.floors=3;
  const box=(w,h,d,x,y,z,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  box(24,1,20,0,-.2,0,m.stone);
  for(let floor=0;floor<3;floor++){
    const y=floor*7;
    box(22,6.9,18,0,y+3.7,0,floor===0?m.stone:m.adobe);
    box(23,.45,19,0,y+7.1,0,m.wood);
    for(const x of [-7,-3.5,3.5,7]){
      if(floor===0&&Math.abs(x)<4)continue;
      box(2,3,.18,x,y+4.2,9.1,m.recess);
      box(1.65,2.65,.22,x,y+4.2,9.23,m.window);
      box(.12,2.8,.3,x,y+4.2,9.37,m.wood);
      box(2.2,.22,.5,x,y+2.7,9.25,m.stone);
    }
    for(const side of [-1,1]) for(const z of [-5,1,5]){
      box(.15,2.8,1.8,side*11.1,y+4,z,m.window);
      box(.25,3,.12,side*11.2,y+4,z,m.wood);
    }
  }
  // Heavy double door, turquoise lintel, balcony and guild banners.
  box(5.6,5.4,.4,0,2.9,9.2,m.wood);
  box(.12,5.4,.48,0,2.9,9.45,m.bronze);
  for(const x of [-3.2,3.2])box(.7,6.2,.9,x,3.1,9.5,m.stone);
  box(7.5,1,1.4,0,6.3,9.4,m.tile);
  box(9,.45,3,0,7.25,10,m.stone);
  for(const x of [-4,-2,0,2,4])box(.13,1.2,.13,x,8,11.2,m.bronze);
  box(8.5,.15,.15,0,8.6,11.2,m.bronze);
  for(const x of [-9,9]){box(1.5,4.8,.16,x,11.2,9.4,m.tile);box(1.8,.2,.35,x,13.7,9.4,m.bronze);}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(16.1,4,4),m.wood);roof.rotation.y=Math.PI/4;roof.position.y=23.3;roof.castShadow=true;root.add(roof);
  return root;
}

export function guildFurniturePlan() {
  const tables=[];
  for(const side of [-1,1]) for(let row=0;row<6;row++) {
    const x=side*12,z=-14+row*6;
    tables.push({x,z,chairs:Array.from({length:5},(_,i)=>{
      const angle=i*Math.PI*2/5;
      return {x:x+Math.sin(angle)*2.5,z:z+Math.cos(angle)*2.5,yaw:angle+Math.PI};
    })});
  }
  return {tables,counter:{x:0,z:-20},staff:[
    {id:'registrar',title:'مهرداد — مسئول ثبت‌نام',x:-4,z:-22,color:0x315d69},
    {id:'buyer',title:'پرنیان — خریدار غنائم ماجراجویان',x:4,z:-22,color:0x79513f}
  ]};
}

export function buildGuildInteriorStage(THREE,m){
  const root=new THREE.Group();root.name='Guild hall • 12 tables / 60 chairs';
  root.userData.interiorDesignPending=false;
  const colliders=[];
  const box=(w,h,d,x,y,z,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  box(44,1,56,0,-.5,0,m.plaza);
  box(43,6,.5,0,3,-27,m.adobe);
  for(const side of [-1,1]) {
    box(.5,6,54,side*21.5,3,0,m.adobe);
    box(16,6,.5,side*13.5,3,27,m.adobe);
  }
  // Continuous central aisle (at least 12 units wide); all furniture is lateral.
  const plan=guildFurniturePlan();
  for(const table of plan.tables){
    const top=box(3.6,.22,2.6,table.x,1.55,table.z,m.wood);top.userData.furniture='table';
    for(const dx of [-1.4,1.4]) for(const dz of [-.9,.9]) box(.2,1.45,.2,table.x+dx,.73,table.z+dz,m.wood);
    colliders.push({x:table.x,z:table.z,halfW:1.95,halfD:1.45});
    for(const chair of table.chairs){
      const group=new THREE.Group();group.position.set(chair.x,0,chair.z);group.rotation.y=chair.yaw;group.userData.furniture='chair';
      const part=(w,h,d,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m.wood);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);};
      part(1,.16,1,0,.85,0);part(1,1,.13,0,1.35,-.48);
      for(const dx of [-.36,.36])for(const dz of [-.36,.36])part(.12,.8,.12,dx,.4,dz);
      root.add(group);colliders.push({x:chair.x,z:chair.z,halfW:.75,halfD:.75});
    }
  }
  box(16,1.7,2,0,.85,-20,m.wood);box(16.4,.2,2.3,0,1.8,-20,m.stone);
  colliders.push({x:0,z:-20,halfW:8.4,halfD:1.3});
  // Ledgers, parcels and brass candle holders establish the guild's work area.
  for(const x of [-4,4]){box(1.3,.15,.9,x,1.98,-20,m.parchment);box(.35,.5,.35,x+1,2.2,-20,m.bronze);}
  // Natural interior door: no magical ring, columns or teleport platform.
  box(5.5,5.4,.25,0,2.7,26.7,m.wood);
  box(.12,5.2,.35,0,2.7,26.5,m.bronze);
  const upperDecks=[];
  for(let level=1;GUILD_UPPER_FLOORS_OPEN&&level<=2;level++) {
    const deck=new THREE.Group();deck.name=`Guild floor ${level+1}`;
    const slab=(w,d,x,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.35,d),m.plaza);mesh.position.set(x,level*7-.175,z);mesh.receiveShadow=true;deck.add(mesh);};
    slab(29.8,54,0,0);
    for(const side of [-1,1])slab(6.2,42,side*18,-16+21);
    deck.visible=false;upperDecks.push(deck);root.add(deck);
  }
  // Two U-shaped staircases, one beside each end of the counter.
  for(const stair of GUILD_STAIRS.filter(s=>GUILD_UPPER_FLOORS_OPEN||s.flight===0)){
    const flight=new THREE.Group();flight.name=`Guild stair ${stair.side<0?'left':'right'} flight ${stair.flight+1}`;
    flight.userData.staircase=stair;
    for(let i=0;i<28;i++){
      const h=(i+1)*stair.rise/28,z=stair.startZ+(i+.5)/28*(stair.endZ-stair.startZ);
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(stair.width,h,10/28+.02),m.stone);
      mesh.position.set(stair.x,stair.base+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;flight.add(mesh);
      if(i%4===0)for(const edge of [-1,1]){
        const post=new THREE.Mesh(new THREE.BoxGeometry(.1,1.1,.1),m.wood);post.position.set(stair.x+edge*(stair.width/2-.08),stair.base+h+.55,z);flight.add(post);
      }
    }
    // Continuous inclined handrails, with height-aware collision to prevent side stepping.
    for(const edge of [-1,1]){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.12,Math.hypot(10,7),.12),m.wood);
      rail.position.set(stair.x+edge*(stair.width/2-.08),stair.base+4.55,-21);
      rail.rotation.x=Math.atan2(-(stair.endZ-stair.startZ),7);flight.add(rail);
      colliders.push({x:stair.x+edge*(stair.width/2-.08),z:-21,halfW:.1,halfD:4.9,minY:stair.base-.2,maxY:stair.base+8});
    }
    root.add(flight);
  }
  if(GUILD_UPPER_FLOORS_OPEN)for(const side of [-1,1])box(5.6,.35,1.5,side*17.75,6.825,-26.7,m.stone);
  else for(const side of [-1,1]) {
    for(const dx of [-2.2,2.2])box(.18,1.5,.2,side*17.65+dx,.75,-15.4,m.wood);
    box(5.5,.2,.18,side*17.65,1.1,-15.4,m.wood);
    box(5.5,.15,.18,side*17.65,.5,-15.4,m.bronze);
    colliders.push({x:side*17.65,z:-21.5,halfW:2.85,halfD:6,minY:-.5,maxY:30});
  }
  root.userData.upperDecks=upperDecks;
  root.userData.furniturePlan=plan;root.userData.colliders=colliders.map(c=>({...c,minY:c.minY??-.5,maxY:c.maxY??3.5}));
  return root;
}
