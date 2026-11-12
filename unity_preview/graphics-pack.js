/**
 * In-app graphics pack installer.
 *
 * The APK ships a lossless 2K texture set so the game is playable with no
 * download at all. The 4K/8K PBR maps live in an optional pack that the Android
 * shell (`window.WoPPack`) downloads and unpacks into app storage; once it is
 * installed the texture module resolves `pack/*.webp` from that storage instead
 * of the inline data URIs. In a desktop browser there is no bridge and this
 * module renders nothing.
 */

const bridge = () => (typeof window !== 'undefined' ? window.WoPPack : undefined);

function readStatus() {
  const api = bridge();
  if (!api || typeof api.status !== 'function') return null;
  try {
    return JSON.parse(api.status());
  } catch (error) {
    return null;
  }
}

export function graphicsPackStatus() {
  return readStatus();
}

export function graphicsPackInstalled() {
  const status = readStatus();
  return Boolean(status && status.installed);
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
}

const STYLE = `
#wop-pack { position: fixed; inset-inline-start: 14px; inset-block-end: calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 9000; font-family: Vazirmatn, "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #f7efe2;
  -webkit-user-select: none; user-select: none; }
#wop-pack-chip { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 14px;
  border-radius: 22px; border: 1px solid rgba(226, 184, 106, .55); background: rgba(24, 18, 12, .82);
  box-shadow: 0 6px 22px rgba(0, 0, 0, .45); font-size: 14px; cursor: pointer; backdrop-filter: blur(6px); }
#wop-pack-chip b { color: #e2b86a; font-weight: 700; }
#wop-pack-card { display: none; width: min(420px, 82vw); margin-block-end: 10px; padding: 16px;
  border-radius: 16px; border: 1px solid rgba(226, 184, 106, .45); background: rgba(20, 15, 10, .94);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .55); backdrop-filter: blur(8px); }
#wop-pack.open #wop-pack-card { display: block; }
#wop-pack h3 { margin: 0 0 4px; font-size: 16px; color: #f3d9a4; font-weight: 700; }
#wop-pack p { margin: 0 0 12px; font-size: 12.5px; line-height: 1.7; color: #cdbfa8; }
#wop-pack .row { display: flex; gap: 10px; margin-block-end: 10px; }
#wop-pack button { flex: 1; min-height: 46px; border-radius: 11px; border: 1px solid rgba(226, 184, 106, .5);
  background: linear-gradient(180deg, rgba(74, 55, 32, .95), rgba(46, 33, 19, .95)); color: #f7efe2;
  font-size: 13.5px; font-family: inherit; cursor: pointer; padding: 6px 10px; }
#wop-pack button[data-primary] { border-color: #e2b86a; background: linear-gradient(180deg, #b8862f, #8a5f1f); }
#wop-pack button:disabled { opacity: .45; cursor: default; }
#wop-pack small { display: block; font-size: 11.5px; color: #b9a98f; margin-block-start: 2px; }
#wop-pack-progress { display: none; margin-block-start: 10px; }
#wop-pack.progress #wop-pack-progress { display: block; }
#wop-pack .bar { height: 8px; border-radius: 5px; background: rgba(255, 255, 255, .12); overflow: hidden; }
#wop-pack .bar i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #b8862f, #f0d394); }
#wop-pack .hint { margin-block-start: 8px; font-size: 11.5px; color: #cdbfa8; }
`;

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount the chip/panel. Safe to call once; returns false when there is no
 * Android bridge (browser preview) so nothing is drawn there.
 */
export function mountGraphicsPack(options = {}) {
  const status = readStatus();
  if (!status) return false;
  if (document.getElementById('wop-pack')) return true;

  const style = el('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = el('div', { id: 'wop-pack' });
  const card = el('div', { id: 'wop-pack-card' });
  const chip = el('div', { id: 'wop-pack-chip', role: 'button', tabindex: '0' });

  const title = el('h3', {}, 'گرافیک بازی');
  const intro = el('p', {}, 'نسخهٔ استاندارد با بافت ۲K نصب شده است. برای سنگ، چوب، سقف، سنگفرش و فلز با جزئیات ۴K/۸K می‌توانی بستهٔ گرافیکی را همین‌جا دانلود کنی. بازی بدون آن هم کامل کار می‌کند.');
  const buttons = el('div', { class: 'row' });
  const manage = el('div', { class: 'row' });
  const progressWrap = el('div', { id: 'wop-pack-progress' });
  const bar = el('div', { class: 'bar' });
  const barFill = el('i');
  const hint = el('div', { class: 'hint' }, '');

  bar.appendChild(barFill);
  progressWrap.append(bar, hint);
  card.append(title, intro, buttons, manage, progressWrap);
  root.append(card, chip);
  document.body.appendChild(root);

  const packs = Array.isArray(status.packs) ? status.packs : [];
  const tierButtons = new Map();

  function paintChip() {
    const current = readStatus();
    chip.textContent = '';
    const installed = current && current.installed;
    const active = installed ? packs.find((pack) => pack.tier === current.tier) : null;
    chip.append(
      el('span', {}, installed ? `گرافیک: ${active ? active.label : 'بستهٔ HQ'}` : 'گرافیک: ۲K استاندارد'),
      el('b', {}, installed ? 'تغییر' : 'ارتقا'),
    );
    hint.textContent = installed
      ? `بستهٔ نصب‌شده: ${active ? active.label : current.tier} — ${formatBytes(current.packBytes)} روی حافظه`
      : 'دانلود فقط روی Wi-Fi توصیه می‌شود؛ پس از نصب، بازی یک‌بار دوباره بارگذاری می‌شود.';
  }

  for (const pack of packs) {
    const button = el('button', { type: 'button' });
    button.append(el('span', {}, pack.label), el('small', {}, formatBytes(pack.bytes)));
    button.addEventListener('click', () => startDownload(pack.tier));
    tierButtons.set(pack.tier, button);
    buttons.appendChild(button);
  }

  const removeButton = el('button', { type: 'button' }, 'حذف بستهٔ گرافیکی');
  removeButton.addEventListener('click', () => {
    const api = bridge();
    if (!api || typeof api.remove !== 'function') return;
    api.remove();
    setTimeout(() => location.reload(), 300);
  });
  manage.appendChild(removeButton);

  function setBusy(busy, percent = 0, message = '') {
    root.classList.toggle('progress', busy);
    barFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    hint.textContent = message;
    tierButtons.forEach((button) => { button.disabled = busy; });
    removeButton.disabled = busy;
  }

  function startDownload(tier) {
    const api = bridge();
    if (!api || typeof api.start !== 'function') return;
    setBusy(true, 0, 'در حال شروع دانلود…');
    api.start(tier);
  }

  window.__wopPackProgress = (event) => {
    if (!event) return;
    if (event.state === 'start') {
      setBusy(true, 0, `آماده‌سازی دانلود (${formatBytes(event.total)})…`);
    } else if (event.state === 'progress') {
      setBusy(true, event.percent, `دانلود ${event.percent}% — ${formatBytes(event.received)} از ${formatBytes(event.total)}`);
    } else if (event.state === 'done') {
      setBusy(true, 100, 'نصب کامل شد؛ بازی دوباره بارگذاری می‌شود…');
      setTimeout(() => location.reload(), 900);
    } else if (event.state === 'cancelled') {
      setBusy(false, 0, 'دانلود لغو شد.');
      paintChip();
    } else if (event.state === 'removed') {
      setBusy(false, 0, 'بسته حذف شد.');
      paintChip();
    } else if (event.state === 'error') {
      setBusy(false, 0, `دانلود ناموفق بود: ${event.message || 'خطای شبکه'}`);
      paintChip();
    }
  };

  const toggle = () => {
    root.classList.toggle('open');
    paintChip();
  };
  chip.addEventListener('click', toggle);
  chip.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') toggle();
  });

  paintChip();
  removeButton.style.display = status.installed ? '' : 'none';

  // First launch on a phone: open the card once so the option is discoverable,
  // unless the player already dismissed it.
  const seenKey = 'wop.pack.prompt';
  let seen = false;
  try { seen = localStorage.getItem(seenKey) === '1'; } catch (error) { seen = true; }
  if (!status.installed && !seen && options.promptOnFirstRun !== false) {
    root.classList.add('open');
    try { localStorage.setItem(seenKey, '1'); } catch (error) { /* private mode */ }
  }
  window.__wopPack = { status: readStatus, start: startDownload, toggle };
  return true;
}
