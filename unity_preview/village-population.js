/** Ambient villagers use a shared collision grid and house-to-house A* routes. */
export function createVillageNavigation(colliders, half=258, step=2) {
  const n=Math.floor(half*2/step)+1, blocked=new Uint8Array(n*n);
  const position=id=>({x:(id%n)*step-half,z:Math.floor(id/n)*step-half});
  for(const b of colliders){
    const minX=Math.max(0,Math.floor((b.minX-.55+half)/step)),maxX=Math.min(n-1,Math.ceil((b.maxX+.55+half)/step));
    const minZ=Math.max(0,Math.floor((b.minZ-.55+half)/step)),maxZ=Math.min(n-1,Math.ceil((b.maxZ+.55+half)/step));
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)blocked[z*n+x]=1;
  }
  function nearest(p){
    const x=Math.round((p.x+half)/step),z=Math.round((p.z+half)/step);
    for(let r=0;r<10;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
      if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;
      const xx=x+dx,zz=z+dz,id=zz*n+xx;
      if(xx>=0&&zz>=0&&xx<n&&zz<n&&!blocked[id])return id;
    }
    return -1;
  }
  function path(start,end){
    const from=nearest(start),to=nearest(end);if(from<0||to<0)return null;
    const heap=[],cost=new Map([[from,0]]),parent=new Map();
    const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
    const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[i].f<=heap[child].f)break;[heap[i],heap[child]]=[heap[child],heap[i]];i=child;}}return first.id;};
    const target=position(to),closed=new Set();push(from,0);
    while(heap.length&&closed.size<25000){
      const id=pop();if(closed.has(id))continue;if(id===to){const ids=[id];while(parent.has(ids.at(-1)))ids.push(parent.get(ids.at(-1)));return ids.reverse().map(position);}
      closed.add(id);const x=id%n,z=Math.floor(id/n);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const xx=x+dx,zz=z+dz,next=zz*n+xx;if(xx<0||zz<0||xx>=n||zz>=n||blocked[next]||closed.has(next))continue;
        if(dx&&dz&&(blocked[z*n+xx]||blocked[zz*n+x]))continue;
        const value=cost.get(id)+Math.hypot(dx,dz)*step;
        if(value>=(cost.get(next)??Infinity))continue;
        cost.set(next,value);parent.set(next,id);const p=position(next);push(next,value+Math.hypot(target.x-p.x,target.z-p.z));
      }
    }
    return null;
  }
  return {path,nearest,position};
}

export function accessibleHouseDoors(houses,colliders,navigation){
  const blockedByOther=(x,z,house)=>colliders.some(b=>!(Math.abs((b.minX+b.maxX)/2-house.x)<.01&&Math.abs((b.minZ+b.maxZ)/2-house.z)<.01)&&x>b.minX-.4&&x<b.maxX+.4&&z>b.minZ-.4&&z<b.maxZ+.4);
  return houses.flatMap(house=>{
    const dx=Math.sin(house.rotY),dz=Math.cos(house.rotY),door={x:house.x+dx*4.6,z:house.z+dz*4.6};
    for(let distance=9;distance<=17;distance+=2){
      const outer={x:house.x+dx*distance,z:house.z+dz*distance};
      const node=navigation.nearest(outer);if(node<0)continue;const anchor=navigation.position(node);
      if(Math.hypot(anchor.x-outer.x,anchor.z-outer.z)>3)continue;
      let clear=true;
      for(let t=0;t<=1;t+=.1)if(blockedByOther(door.x+(anchor.x-door.x)*t,door.z+(anchor.z-door.z)*t,house)){clear=false;break;}
      if(clear)return [{house,door,anchor}];
    }
    return [];
  });
}

export function createVillagePopulation(THREE,kit,houses,colliders,height,parent,count=200){
  let seed=82039;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const navigation=createVillageNavigation(colliders),homes=accessibleHouseDoors(houses,colliders,navigation);
  if(homes.length<2)throw new Error('No accessible houses for village population');
  const templates=new Map();
  const residents=[],profiles=['child','elder','woman','man'];
  const colors=[0x537864,0x7d5360,0x5b6c86,0x97815c,0x74668a,0x8d624a];
  for(let i=0;i<count;i++){
    const home=homes[Math.floor(i*homes.length/count)%homes.length],profile=profiles[i%4];
    const key=`${profile}:${colors[i%colors.length]}`;
    if(!templates.has(key))templates.set(key,kit.buildVillager(colors[i%colors.length],profile));
    const group=templates.get(key).clone(true);group.name=`Resident ${i+1} • ${profile}`;
    group.position.set(home.door.x,height(home.door.x,home.door.z),home.door.z);group.visible=i%4!==0;parent.add(group);
    residents.push({group,profile,home,phase:i%4===0?'inside':'leaving',wait:random()*16,route:[home.anchor],index:0,destination:home,speed:profile==='elder'?1.25:profile==='child'?2.4:1.8,phaseOffset:random()*6});
  }
  let time=0;
  function chooseTrip(resident){
    for(let attempt=0;attempt<5;attempt++){
      const destination=homes[Math.floor(random()*homes.length)];
      if(destination===resident.home)continue;
      const route=navigation.path(resident.home.anchor,destination.anchor);
      if(!route)continue;
      resident.destination=destination;resident.route=[resident.home.anchor,...route,destination.door];resident.index=0;resident.phase='walking';return true;
    }
    resident.phase='resting';resident.wait=3+random()*5;return false;
  }
  return {residents,homes,update(dt){
    time+=dt;let routeBudget=2;
    for(const r of residents){
      if(r.phase==='inside'){
        r.wait-=dt;if(r.wait>0)continue;
        if(routeBudget<=0)continue;routeBudget--;
        if(!chooseTrip(r)){r.group.visible=false;r.phase='inside';r.wait=4;continue;}
        r.group.position.set(r.home.door.x,height(r.home.door.x,r.home.door.z),r.home.door.z);r.group.visible=true;
      }
      if(r.phase==='resting'){
        r.wait-=dt;if(r.wait<=0&&routeBudget>0){routeBudget--;chooseTrip(r);}continue;
      }
      const target=r.route[r.index];if(!target)continue;
      const dx=target.x-r.group.position.x,dz=target.z-r.group.position.z,distance=Math.hypot(dx,dz),step=r.speed*dt;
      if(distance<=step+.03){
        r.group.position.x=target.x;r.group.position.z=target.z;r.index++;
        if(r.index>=r.route.length){
          if(r.phase==='leaving'){r.phase='resting';r.wait=1+random()*5;}
          else{r.home=r.destination;r.phase='inside';r.group.visible=false;r.wait=6+random()*22;}
        }
      }else{
        r.group.position.x+=dx/distance*step;r.group.position.z+=dz/distance*step;
        const yaw=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(yaw-r.group.rotation.y),Math.cos(yaw-r.group.rotation.y));r.group.rotation.y+=delta*Math.min(1,dt*5);
      }
      r.group.position.y=height(r.group.position.x,r.group.position.z)+(r.group.visible?Math.sin(time*5+r.phaseOffset)*.025:0);
    }
  }};
}
