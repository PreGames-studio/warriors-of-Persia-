/** Exterior landmark and deliberately empty, separately addressable interior staging zone. */
export const GUILD = Object.freeze({zone:'guild',floors:3,center:{x:0,z:-3},entrance:{x:0,z:13},villageArrival:{x:0,z:23,yaw:0},interiorSpawn:{x:0,z:10},interiorExit:{x:0,z:21},bounds:{x:20,z:25}});

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
  const badge=new THREE.Mesh(new THREE.TorusGeometry(.85,.13,8,24),m.bronze);badge.position.set(0,5.9,10.2);root.add(badge);
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
  root.userData.furniturePlan=plan;root.userData.colliders=colliders;
  return root;
}
