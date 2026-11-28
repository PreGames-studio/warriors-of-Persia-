import assert from 'node:assert/strict';
import {mountGraphicsPack} from '../../unity_preview/graphics-pack.js';
class Node {
  constructor(tag){this.tag=tag;this.attributes={};this.children=[];this.style={};this.listeners={};this.textContent='';this.classes=new Set();this.classList={toggle:(name,force)=>{let state=force===undefined?!this.classes.has(name):force;state?this.classes.add(name):this.classes.delete(name);return state;}};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  appendChild(c){this.children.push(c);return c;}
  append(...children){children.forEach(c=>this.appendChild(c));}
  insertBefore(c,ref){this.children.splice(this.children.indexOf(ref),0,c);}
  addEventListener(k,f){this.listeners[k]=f;}
  click(){this.listeners.click?.();}
}
const button=new Node('button');button.setAttribute('id','btn-settings');
const head=new Node('head'),body=new Node('body');
const byId=(node,id)=>node.attributes.id===id?node:node.children.map(c=>byId(c,id)).find(Boolean);
globalThis.document={head,body,createElement:tag=>new Node(tag),getElementById:id=>id==='btn-settings'?button:byId(body,id)};
const starts=[];globalThis.window={WoPPack:{status:()=>JSON.stringify({installed:false,packs:[{tier:'hd',label:'HD',bytes:1024}]}),start:t=>starts.push(t)}};
assert(mountGraphicsPack());
const root=byId(body,'wop-pack'), card=byId(body,'wop-pack-card'), chip=byId(body,'wop-pack-chip');
assert(root && card && card.children.includes(chip));
assert(!root.classes.has('open'),'settings start closed');
button.click();assert(root.classes.has('open'));assert.equal(button.attributes['aria-expanded'],'true');
assert.equal(chip.children[1].textContent,'ارتقا');
window.__wopPack.start('hd');assert.deepEqual(starts,['hd']);
button.click();assert(!root.classes.has('open'));assert.equal(button.attributes['aria-expanded'],'false');
assert(mountGraphicsPack());assert.equal(body.children.length,1,'mount is idempotent');
console.log('Settings placement, toggle and graphics-pack bridge: PASS');
