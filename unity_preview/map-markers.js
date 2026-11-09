/** Canvas marker sizes are specified in displayed CSS pixels, not backing pixels. */
export function mapMarkerMetrics(backingWidth, displayWidth, expanded) {
  const scale = backingWidth / Math.max(1, displayWidth);
  return { scale, shopRadius: (expanded ? 12 : 3) * scale, shopFont: (expanded ? 17 : 8) * scale,
    labelFont: 12 * scale, playerRadius: (expanded ? 11 : 4.5) * scale };
}

function labelBox(ctx, text, point, width, height, metrics, occupied, offset = 0, player = false) {
  const s = metrics.scale, font = (player ? 13 : 12) * s;
  ctx.font = `bold ${font}px sans-serif`;
  const bw = Math.min(width - 8*s, ctx.measureText(text).width + 12*s), bh = 22*s;
  let box;
  for (const dy of [offset, offset+28*s, offset-28*s, offset+56*s, offset-56*s, offset+84*s]) {
    box = {x: Math.max(4*s, Math.min(width-bw-4*s,point.x-bw/2)), y: Math.max(4*s,Math.min(height-bh-4*s,point.y+dy)),w:bw,h:bh};
    if (!occupied.some(b=>box.x < b.x+b.w && box.x+box.w > b.x && box.y < b.y+b.h && box.y+box.h > b.y)) break;
  }
  occupied.push(box);
  ctx.strokeStyle = player ? '#a9ffdc' : '#ddbf83'; ctx.lineWidth = s;
  ctx.beginPath(); ctx.moveTo(point.x,point.y); ctx.lineTo(box.x+box.w/2,box.y+box.h/2); ctx.stroke();
  ctx.fillStyle = player ? '#07372f' : '#1a1915'; ctx.fillRect(box.x,box.y,box.w,box.h);
  ctx.strokeRect(box.x,box.y,box.w,box.h);
  ctx.fillStyle = player ? '#ffffff' : '#fff4d1'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,box.x+box.w/2,box.y+box.h/2,box.w-8*s);
}

export function drawShopMarker(ctx, point, shop, metrics, expanded, width, height, occupied) {
  ctx.save();
  const forge = shop.id === 'blacksmith', s = metrics.scale;
  ctx.beginPath(); ctx.arc(point.x,point.y,metrics.shopRadius,0,Math.PI*2);
  ctx.fillStyle = forge ? '#ff963f' : '#f6d575'; ctx.fill();
  ctx.lineWidth=2*s; ctx.strokeStyle='#201b13'; ctx.stroke();
  if (expanded) {
    const symbol = forge ? '⚒' : (shop.title.match(/^\S+/u)?.[0] || '◆');
    ctx.fillStyle='#181b16'; ctx.font=`bold ${metrics.shopFont}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(symbol,point.x,point.y+1*s);
    const name = forge ? 'آهنگری کاوه' : shop.title.replace(/^\S+\s*/u,'');
    labelBox(ctx,name,point,width,height,metrics,occupied,-40*s);
  }
  ctx.restore();
}

export function drawPlayerMarker(ctx, point, yaw, metrics, expanded, width, height, now = 0) {
  const s=metrics.scale,r=metrics.playerRadius;
  ctx.save();
  ctx.beginPath();ctx.arc(point.x,point.y,r+(expanded ? 6+Math.sin(now/220)*2 : 2)*s,0,Math.PI*2);
  ctx.fillStyle='#052e2be6';ctx.fill();ctx.lineWidth=2*s;ctx.strokeStyle='#aaffdd';ctx.stroke();
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(-yaw);
  ctx.beginPath();ctx.moveTo(0,r+3*s);ctx.lineTo(-r,-r);ctx.lineTo(0,-r*.45);ctx.lineTo(r,-r);ctx.closePath();
  ctx.fillStyle='#4dffb5';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2*s;ctx.stroke();ctx.restore();
  if(expanded) labelBox(ctx,'شما اینجا هستید',point,width,height,metrics,[],24*s,true);
  ctx.restore();
}
