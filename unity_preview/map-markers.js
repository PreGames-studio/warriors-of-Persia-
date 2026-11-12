/** Canvas marker sizes are specified in displayed CSS pixels, not backing pixels. */
export function mapMarkerMetrics(backingWidth, displayWidth, expanded) {
  const scale = backingWidth / Math.max(1, displayWidth);
  return { scale, shopRadius: (expanded ? 12 : 3) * scale, shopFont: (expanded ? 17 : 8) * scale,
    labelFont: 12 * scale, playerRadius: (expanded ? 11 : 4.5) * scale };
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
  ctx.restore();
}
