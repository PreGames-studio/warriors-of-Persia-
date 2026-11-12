/** Ground-floor decoration and seated conversation groups. No new remote assets. */
export function createGuildAtmosphere(THREE,m,plan){
  const root=new THREE.Group();root.name='Guild flowers, carpets, lamps and seated guests';
  const guests=[],conversations=[],vases=[];
  const petal=new THREE.MeshStandardMaterial({color:0xd99092,roughness:.8});
  const amber=new THREE.MeshStandardMaterial({color:0xf0c27d,roughness:.85});
  const robes=[0x41645c,0x775866,0x666e85,0x8c7051].map(color=>new THREE.MeshStandardMaterial({color,roughness:.93}));
  const cache=new Map();
  const geometry=(key,make)=>{if(!cache.has(key))cache.set(key,make());return cache.get(key);};
  function mesh(parent,geo,material,x,y,z){const object=new THREE.Mesh(geo,material);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;}
  const box=(parent,w,h,d,material,x,y,z)=>mesh(parent,geometry(`b${w},${h},${d}`,()=>new THREE.BoxGeometry(w,h,d)),material,x,y,z);
  const sphere=geometry('sphere',()=>new THREE.SphereGeometry(1,8,6));
  function flowerpot(x,y,z,scale=1){
    const vase=new THREE.Group();vase.position.set(x,y,z);vase.scale.setScalar(scale);vase.userData.flowerArrangement=true;root.add(vase);vases.push(vase);
    mesh(vase,geometry('pot',()=>new THREE.CylinderGeometry(.55,.38,.9,12)),m.terracotta,0,.45,0);
    mesh(vase,geometry('soil',()=>new THREE.CylinderGeometry(.48,.48,.08,12)),m.recess,0,.9,0);
    for(let i=0;i<5;i++){
      const angle=i*2.399,x=Math.cos(angle)*.27,z=Math.sin(angle)*.27,h=1.3+(i%3)*.15;
      mesh(vase,geometry('stem',()=>new THREE.CylinderGeometry(.018,.025,.7,5)),m.leaf,x,h-.3,z);
      const leaf=mesh(vase,sphere,m.leafLight,x+.13,h-.35,z);leaf.scale.set(.22,.06,.1);leaf.rotation.z=.5;
      for(let p=0;p<5;p++){
        const a=p*Math.PI*2/5;
        const flower=mesh(vase,sphere,i%2?petal:amber,x+Math.cos(a)*.11,h,z+Math.sin(a)*.11);flower.scale.set(.11,.045,.09);
      }
      const heart=mesh(vase,sphere,m.bronze,x,h+.01,z);heart.scale.setScalar(.06);
    }
  }
  for(const side of [-1,1])for(const z of [-10,3,19])flowerpot(side*19,0,z,1.25);
  flowerpot(-6,1.95,-20,.5);flowerpot(6,1.95,-20,.5);
  for(const [i,table] of plan.tables.entries()){
    flowerpot(table.x,1.69,table.z,.35);
    const carpet=box(root,7.6,.025,5.4,m.rug,table.x,.025,table.z);carpet.userData.decoration='rug';
    for(const j of [0,2]){
      const chair=table.chairs[j],guest=new THREE.Group();guest.position.set(chair.x,0,chair.z);guest.rotation.y=chair.yaw;guest.userData.seated=true;root.add(guest);
      const robe=robes[(i+j)%robes.length];
      mesh(guest,geometry('torso',()=>new THREE.CylinderGeometry(.34,.5,1,10)),robe,0,1.37,0);
      for(const side of [-1,1]){
        box(guest,.24,.22,.7,robe,side*.22,.85,.25);
        box(guest,.2,.64,.2,robe,side*.22,.48,.58);
        box(guest,.23,.14,.4,m.wood,side*.22,.12,.67);
      }
      const head=new THREE.Group();head.position.y=2.12;guest.add(head);
      const face=mesh(head,sphere,m.skin,0,0,0);face.scale.set(.35,.42,.33);
      const cap=mesh(head,sphere,j?m.parchment:robe,0,.31,-.03);cap.scale.set(.37,.18,.35);
      const arms=[];
      for(const side of [-1,1]){
        const arm=new THREE.Group();arm.position.set(side*.48,1.7,0);guest.add(arm);
        mesh(arm,geometry('arm',()=>new THREE.CylinderGeometry(.1,.14,.65,7)),robe,0,-.3,0);
        const hand=mesh(arm,sphere,m.skin,0,-.65,0);hand.scale.set(.11,.14,.11);
        arm.rotation.x=-.7;arms.push(arm);
      }
      guests.push({group:guest,head,arms,table:i,phase:i*1.9+j});
    }
    conversations.push({position:{x:table.x,y:3,z:table.z},phase:i*1.7,active:false,text:''});
  }
  // Warm wall sconces and textile banners, kept outside the central aisle.
  for(const side of [-1,1])for(const z of [-12,0,12]){
    box(root,.25,.7,.6,m.bronze,side*20.8,3.4,z);
    const glow=mesh(root,sphere,m.window,side*20.55,3.8,z);glow.scale.set(.2,.32,.2);
    box(root,.08,2.6,1.4,m.tile,side*21.1,4.3,z+3);
  }
  root.userData.colliders=vases.filter(v=>v.position.y===0).map(v=>({x:v.position.x,z:v.position.z,halfW:.75,halfD:.75}));
  const lines=['برای سفر بعدی توشه برداشتی؟','شنیدم مسیر جنگل امن‌تر شده.','بعد از استراحت به پیشخوان سر بزنیم.','این گل‌ها بوی خوبی دارند.','فردا با هم راه می‌افتیم.','ماجرای سفرت را تعریف کن!'];
  return {root,guests,conversations,vases,update(time){
    for(const guest of guests){
      const speaking=Math.sin(time*.65+guest.phase)>.1;
      guest.head.rotation.y=Math.sin(time*.6+guest.phase)*.2;
      guest.head.rotation.x=Math.sin(time*2.1+guest.phase)*(speaking?.055:.015);
      guest.arms[0].rotation.x=-.7+(speaking?Math.sin(time*2+guest.phase)*.2:0);
      guest.arms[1].rotation.z=Math.sin(time*.9+guest.phase)*.1;
    }
    conversations.forEach((conversation,i)=>{
      const cycle=(time+conversation.phase)%18;conversation.active=cycle<4;
      conversation.text=lines[(i+Math.floor((time+conversation.phase)/18))%lines.length];
    });
  }};
}
