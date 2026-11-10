// Floor content is deliberately a provisional template until individually designed.
export const FIRST_DUNGEON_FLOORS = 100;
export function floorNumber(value) { return Math.max(1, Math.min(100, Math.floor(Number(value)||1))); }
export function restoreDungeonProgress(raw) {
  const cleared = [...new Set((Array.isArray(raw?.cleared)?raw.cleared:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=100))];
  // Permissions are sequential: corrupt/out-of-order entries cannot skip bosses.
  let highest=1; while(highest<100 && cleared.includes(highest))highest++;
  return {cleared:cleared.filter(n=>n<=highest),highest};
}
export function canEnterFloor(progress,floor) { return Number.isInteger(floor)&&floor>=1&&floor<=restoreDungeonProgress(progress).highest; }
export function clearDungeonFloor(progress,floor) {
  const p=restoreDungeonProgress(progress);
  if(!canEnterFloor(p,floor))return p;
  return restoreDungeonProgress({cleared:[...p.cleared,floor]});
}
export function dungeonFloorDefinition(value) {
  const floor=floorNumber(value);
  return {floor,status:'template',corridors:[[[0,42],[0,28],[6,16],[-4,4],[0,-8],[0,-24]],[[6,16],[29,22],[43,5],[34,-16],[22,-27]],[[-4,4],[-30,13],[-46,-4],[-36,-26],[-22,-29]]],
    enemies:[{x:-14,z:6,rank:'normal'},{x:14,z:6,rank:'normal'},{x:0,z:-4,rank:'elite'}],
    boss:{x:0,z:-24,rank:'boss'},traps:[{id:'spikes-west',x:-30,z:13,radius:2.4,damage:5,period:4,active:1.5}],spawn:{x:0,z:28},next:{x:0,z:-38}};
}
