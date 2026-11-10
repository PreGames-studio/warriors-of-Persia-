import {createCave} from './cave-dungeon.js';
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
  const cave=createCave(floor);
  return {floor,status:'cave',corridors:cave.routes,enemies:cave.slimes.map(e=>({...e,rank:'slime'})),boss:{...cave.boss,rank:'boss'},traps:[{id:'cave-spikes',...cave.center(Math.floor(cave.cells.length/2)),radius:2.4,damage:5,period:4,active:1.5}],spawn:cave.spawn,next:{x:cave.boss.x+12,z:cave.boss.z}};
}
