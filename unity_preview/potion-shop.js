const POTIONS = [
  {
    id: 'potion_vitality',
    title: 'معجون حیات',
    short: 'بازیابی فوری ۸۰ واحد جان',
    lore: 'ترکیب گل‌گاوزبان، عسل کوهی و رازقیان؛ نخستین انتخاب هر جنگجویی پیش از ورود به نبرد.',
    stat: 'بازیابی +۸۰ جان',
    price: 180,
    category: 'healing',
    rarity: 'common',
    rarityLabel: 'استاندارد',
    type: 'hp',
    power: 80,
    image: './assets/apothecary/potion_vitality.jpg'
  },
  {
    id: 'potion_mana',
    title: 'مانای لاجورد',
    short: 'بازیابی فوری ۷۰ واحد مانا',
    lore: 'قطره‌های لاجورد با نور ماه و عصاره‌ی نیلوفر آبی، برای جادوگرانی که هرگز متوقف نمی‌شوند.',
    stat: 'بازیابی +۷۰ مانا',
    price: 220,
    category: 'mana',
    rarity: 'common',
    rarityLabel: 'استاندارد',
    type: 'mana',
    power: 70,
    image: './assets/apothecary/potion_mana.jpg'
  },
  {
    id: 'potion_hero',
    title: 'اکسیر پهلوان',
    short: 'افزایش دائمی ۶ قدرت حمله',
    lore: 'عصاره‌ی غلیظ زعفران و گیاهان آتشین زاگرس؛ تلخ، سوزان و سرشار از نیروی پهلوانان کهن.',
    stat: '+۶ قدرت حمله دائمی',
    price: 540,
    category: 'boost',
    rarity: 'rare',
    rarityLabel: 'کمیاب',
    type: 'atk',
    power: 6,
    image: './assets/apothecary/potion_hero.jpg'
  },
  {
    id: 'potion_mountain',
    title: 'شفای کوهستان',
    short: 'بازیابی فوری ۱۸۰ واحد جان',
    lore: 'از برگ‌های تازه‌ی گیاهان مرتفع دماوند و آب چشمه‌های بکر؛ شفایی عمیق برای زخم‌های سنگین.',
    stat: 'بازیابی +۱۸۰ جان',
    price: 420,
    category: 'healing',
    rarity: 'rare',
    rarityLabel: 'کمیاب',
    type: 'hp',
    power: 180,
    image: './assets/apothecary/potion_mountain.jpg'
  },
  {
    id: 'potion_guardian',
    title: 'سپر فیروزه',
    short: 'افزایش دائمی ۳۵ سقف جان',
    lore: 'فیروزه‌ی نیشابور در محلولی از عرق کاسنی حل شده است؛ سپری نامرئی برای پایداری بیشتر در نبرد.',
    stat: '+۳۵ سقف جان دائمی',
    price: 680,
    category: 'boost',
    rarity: 'epic',
    rarityLabel: 'حماسه‌ای',
    type: 'max_hp',
    power: 35,
    image: './assets/apothecary/potion_guardian.jpg'
  },
  {
    id: 'potion_restoration',
    title: 'اکسیر احیای کامل',
    short: 'پر شدن کامل جان و مانا',
    lore: 'نور صبح، عسل سپید و هفت گیاه کهن در شیشه‌ای بلورین؛ یک جرعه تا آغازی دوباره فاصله است.',
    stat: 'احیای کامل جان و مانا',
    price: 950,
    category: 'healing',
    rarity: 'legendary',
    rarityLabel: 'افسانه‌ای',
    type: 'full_restore',
    power: 999,
    image: './assets/apothecary/potion_restoration.jpg'
  },
  {
    id: 'potion_zagros',
    title: 'خشم زاگرس',
    short: 'افزایش دائمی ۱۰ قدرت حمله',
    lore: 'جوشانده‌ای آتشین از ریشه‌های کهن و فلفل کوهی؛ مناسب جنگجویانی که خط مقدم را می‌شکنند.',
    stat: '+۱۰ قدرت حمله دائمی',
    price: 780,
    category: 'boost',
    rarity: 'epic',
    rarityLabel: 'حماسه‌ای',
    type: 'atk',
    power: 10,
    image: './assets/apothecary/potion_zagros.jpg'
  },
  {
    id: 'potion_starlight',
    title: 'عصاره‌ی ستاره',
    short: 'افزایش دائمی ۴۵ سقف مانا',
    lore: 'ستاره‌باران شب‌های کویر در شیشه‌ای بنفش ثبت شده؛ هر ذره، ظرفیت تازه‌ای برای جادو می‌سازد.',
    stat: '+۴۵ سقف مانا دائمی',
    price: 820,
    category: 'mana',
    rarity: 'epic',
    rarityLabel: 'حماسه‌ای',
    type: 'max_mana',
    power: 45,
    image: './assets/apothecary/potion_starlight.jpg'
  },
  {
    id: 'potion_immortal',
    title: 'معجون جاودان',
    short: 'افزایش دائمی ۸۰ سقف جان',
    lore: 'دستور کهن حکیمان پارس با زمرد، زعفران و طلای خوراکی؛ گران‌بهاترین اکسیر این عطاری.',
    stat: '+۸۰ سقف جان دائمی',
    price: 1450,
    category: 'boost',
    rarity: 'legendary',
    rarityLabel: 'افسانه‌ای',
    type: 'max_hp',
    power: 80,
    image: './assets/apothecary/potion_immortal.jpg'
  }
];

const CATEGORY_NAMES = {
  all: 'همه‌ی معجون‌ها',
  healing: 'شفا و بازیابی جان',
  mana: 'مانا و جادو',
  boost: 'تقویت قهرمان',
  rare: 'گنجینه‌ی حکیم'
};

function icon(name, className = '') {
  return `<svg class="ap-icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#ap-i-${name}"></use></svg>`;
}

function shopMarkup() {
  return `
    <div id="modal-apothecary" class="ap-modal" role="dialog" aria-modal="true" aria-labelledby="ap-sign-title">
      <svg class="ap-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <symbol id="ap-i-flask" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.6 8.6A2.3 2.3 0 0 0 6.3 21h11.4a2.3 2.3 0 0 0 1.9-3.4L14 9V3"/><path d="M7.5 16h9M9.5 13h5"/></symbol>
        <symbol id="ap-i-heart" viewBox="0 0 24 24"><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"/><path d="M7 12h3l1.2-2.4L13 15l1.3-3H17"/></symbol>
        <symbol id="ap-i-drop" viewBox="0 0 24 24"><path d="M12 2S5 9.5 5 14.5a7 7 0 0 0 14 0C19 9.5 12 2 12 2Z"/><path d="M9 16.5c.7 1.3 1.8 1.8 3.4 1.7"/></symbol>
        <symbol id="ap-i-spark" viewBox="0 0 24 24"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></symbol>
        <symbol id="ap-i-star" viewBox="0 0 24 24"><path d="m12 2 3 6.2 6.8 1-5 4.8 1.2 6.8-6-3.2-6 3.2L7.2 14l-5-4.8 6.8-1L12 2Z"/></symbol>
        <symbol id="ap-i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
        <symbol id="ap-i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 8 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L12 8Z"/></symbol>
        <symbol id="ap-i-close" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></symbol>
        <symbol id="ap-i-bag" viewBox="0 0 24 24"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></symbol>
        <symbol id="ap-i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
        <symbol id="ap-i-up" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></symbol>
        <symbol id="ap-i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
        <symbol id="ap-i-leaf" viewBox="0 0 24 24"><path d="M20 3C11 3 5 6 5 13a6 6 0 0 0 6 6c7 0 9-7 9-16Z"/><path d="M3 21c3-6 7-10 13-13"/></symbol>
      </svg>

      <div class="ap-layout">
        <aside class="ap-scene" aria-label="حکیم در عطاری">
          <img class="ap-scene-photo" src="./assets/apothecary/apothecary_keeper.jpg" alt="حکیم، عطار کهن، در میان شیشه‌های معجون و گیاهان" />
          <div class="ap-scene-shade"></div>
          <canvas id="ap-particles" aria-hidden="true"></canvas>

          <div class="ap-hanging-sign">
            <div class="ap-sign-chains"><i></i><i></i></div>
            <div class="ap-sign-plaque">
              <div class="ap-sign-emblem">${icon('flask')}</div>
              <div class="ap-sign-copy">
                <span class="ap-sign-kicker">راسته‌ی عطاران • از ۱۲۰۰ سال پیش</span>
                <strong class="ap-sign-title" id="ap-sign-title">عطاری حکیم</strong>
                <span class="ap-sign-subtitle">شفا از دل طبیعت، نیرو برای نبرد</span>
              </div>
            </div>
          </div>

          <div class="ap-merchant-tag"><i></i><span>حکیم بزرگ • استاد معجون‌سازی</span></div>
          <div class="ap-dialogue">
            <div class="ap-dialogue-name">سخن حکیم</div>
            <div class="ap-dialogue-text" id="ap-dialogue-text">هر دردی مرهمی دارد پهلوان.<br>بگو جان می‌خواهی، جادو یا نیرو؟</div>
          </div>
        </aside>

        <section class="ap-shop" aria-label="فروشگاه معجون">
          <header class="ap-header">
            <div class="ap-heading">
              <div class="ap-heading-overline">دست‌ساز • خالص • آزموده‌شده</div>
              <div class="ap-heading-title">ویترین معجون‌ها <span>۹ ترکیب کهن برای سرنوشت‌های تازه</span></div>
            </div>
            <div class="ap-gold-box" aria-label="موجودی سکه طلا">
              <div class="ap-gold-icon">${icon('coin')}</div>
              <div class="ap-gold-copy"><span class="ap-gold-label">سکه‌ی طلا</span><strong class="ap-gold-value" id="ap-gold-value">12,450</strong></div>
            </div>
            <button class="ap-close" id="ap-close" type="button" aria-label="بستن عطاری" title="بستن عطاری">${icon('close')}</button>
          </header>

          <div class="ap-main-frame">
            <div class="ap-grid-shell">
              <div class="ap-collection-bar">
                <div class="ap-collection-name">${icon('leaf')}<span id="ap-collection-name">همه‌ی معجون‌ها</span><span class="ap-collection-count" id="ap-collection-count">۹ قلم</span></div>
                <div class="ap-bag-summary">${icon('bag')}<span>ظرفیت کیف: <strong id="ap-bag-count">۱ / ۱۶</strong></span></div>
              </div>
              <div class="ap-grid-scroll" id="ap-grid" aria-live="polite"></div>
            </div>

            <aside class="ap-rail" aria-label="دسته‌بندی معجون‌ها">
              <button class="ap-rail-arrow" id="ap-scroll-up" type="button" aria-label="اسکرول به بالا">${icon('up')}</button>
              <div class="ap-categories">
                <button class="ap-category active" type="button" data-ap-category="all" data-tip="همه‌ی معجون‌ها" aria-label="همه‌ی معجون‌ها">${icon('grid')}</button>
                <button class="ap-category" type="button" data-ap-category="healing" data-tip="شفا و جان" aria-label="شفا و جان">${icon('heart')}</button>
                <button class="ap-category" type="button" data-ap-category="mana" data-tip="مانا و جادو" aria-label="مانا و جادو">${icon('drop')}</button>
                <button class="ap-category" type="button" data-ap-category="boost" data-tip="تقویت قهرمان" aria-label="تقویت قهرمان">${icon('spark')}</button>
                <button class="ap-category" type="button" data-ap-category="rare" data-tip="گنجینه‌ی حکیم" aria-label="معجون‌های حماسه‌ای و افسانه‌ای">${icon('star')}</button>
              </div>
              <div class="ap-scroll-track" id="ap-scroll-track"><div class="ap-scroll-thumb" id="ap-scroll-thumb"></div></div>
              <button class="ap-rail-arrow" id="ap-scroll-down" type="button" aria-label="اسکرول به پایین">${icon('down')}</button>
            </aside>
          </div>

          <footer class="ap-bottom">
            <div class="ap-details">
              <div class="ap-detail-thumb"><img id="ap-detail-image" src="./assets/apothecary/potion_vitality.jpg" alt="" /></div>
              <div class="ap-detail-copy">
                <div class="ap-detail-heading"><strong class="ap-detail-name" id="ap-detail-name">معجون حیات</strong><span class="ap-detail-stat" id="ap-detail-stat">بازیابی +۸۰ جان</span></div>
                <div class="ap-detail-lore" id="ap-detail-lore">ترکیب گل‌گاوزبان، عسل کوهی و رازقیان.</div>
              </div>
              <button class="ap-buy" id="ap-buy" type="button">${icon('bag')}<span id="ap-buy-label">خرید و افزودن به کیف</span></button>
            </div>
            <div class="ap-page" id="ap-page" aria-label="صفحه‌ی فروشگاه">1 / 2</div>
          </footer>
        </section>
      </div>
      <div class="ap-toast" id="ap-toast" role="status">${icon('check')}<span id="ap-toast-text"></span></div>
    </div>`;
}

/**
 * Mount and control the apothecary using the game's existing state/save layer.
 * @returns {{open: Function, close: Function, render: Function}}
 */
export function createPotionShop({ state, onSave, onInventoryChange, onToast, onSound, formatGold }) {
  if (!document.getElementById('modal-apothecary')) {
    document.body.insertAdjacentHTML('beforeend', shopMarkup());
  }

  const modal = document.getElementById('modal-apothecary');
  const grid = document.getElementById('ap-grid');
  const dialogue = document.getElementById('ap-dialogue-text');
  const buyButton = document.getElementById('ap-buy');
  const toast = document.getElementById('ap-toast');
  const canvas = document.getElementById('ap-particles');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeCategory = 'all';
  let selected = POTIONS[0];
  let toastTimer = 0;
  let scrollFrame = 0;
  let particleFrame = 0;
  let previousFocus = null;
  let previousTime = 0;
  let elapsed = 0;
  const particles = Array.from({ length: 34 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    speed: .018 + Math.random() * .045,
    drift: (Math.random() - .5) * .025,
    radius: .6 + Math.random() * 1.55,
    phase: Math.random() * Math.PI * 2,
    green: index % 3 === 0
  }));

  const number = value => formatGold ? formatGold(value) : Number(value).toLocaleString('en-US');
  const faNumber = value => Number(value).toLocaleString('fa-IR');
  const countInBag = id => state.inventory.filter(item => item.id === id).length;
  const isRare = item => item.rarity === 'epic' || item.rarity === 'legendary';
  const filteredItems = () => POTIONS.filter(item => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'rare') return isRare(item);
    return item.category === activeCategory;
  });

  function localToast(message, error = false) {
    clearTimeout(toastTimer);
    document.getElementById('ap-toast-text').textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2900);
  }

  function setDialogue(html) {
    dialogue.innerHTML = html;
  }

  function renderGrid() {
    const items = filteredItems();
    grid.innerHTML = '';

    items.forEach(item => {
      const owned = countInBag(item.id);
      const card = document.createElement('article');
      card.className = `ap-card ${item.rarity} ${selected.id === item.id ? 'selected' : ''}`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${item.title}، ${item.stat}، ${number(item.price)} سکه`);
      card.dataset.potion = item.id;
      card.innerHTML = `
        <div class="ap-card-art">
          <img src="${item.image}" alt="${item.title}" loading="eager" />
          <span class="ap-rarity"><i></i>${item.rarityLabel}</span>
          ${owned ? `<span class="ap-owned">${icon('check')} در کیف: ${faNumber(owned)}</span>` : ''}
        </div>
        <div class="ap-card-body">
          <strong class="ap-card-title">${item.title}</strong>
          <div class="ap-card-desc">${item.short}</div>
          <div class="ap-card-footer">
            <button class="ap-price" type="button" aria-label="خرید ${item.title} به قیمت ${number(item.price)} سکه">
              ${icon('coin')}<span class="ap-price-value">${number(item.price)}</span><span class="ap-price-label">سکه</span>
            </button>
          </div>
        </div>`;

      card.addEventListener('click', () => selectPotion(item));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectPotion(item);
        }
      });
      card.querySelector('.ap-price').addEventListener('click', event => {
        event.stopPropagation();
        selectPotion(item, true);
        buySelected();
      });
      grid.appendChild(card);
    });

    document.getElementById('ap-collection-name').textContent = CATEGORY_NAMES[activeCategory];
    document.getElementById('ap-collection-count').textContent = `${faNumber(items.length)} قلم`;
    document.getElementById('ap-bag-count').textContent = `${faNumber(state.inventory.length)} / ۱۶`;
    document.getElementById('ap-gold-value').textContent = number(state.coins);
    updateDetails();
    requestScrollSync();
  }

  function updateDetails() {
    const inBag = countInBag(selected.id);
    document.getElementById('ap-detail-image').src = selected.image;
    document.getElementById('ap-detail-image').alt = selected.title;
    document.getElementById('ap-detail-name').textContent = selected.title;
    document.getElementById('ap-detail-stat').textContent = selected.stat;
    document.getElementById('ap-detail-lore').textContent = selected.lore;

    const label = document.getElementById('ap-buy-label');
    buyButton.disabled = false;
    if (state.inventory.length >= 16) {
      buyButton.disabled = true;
      label.textContent = 'کیف ۱۶ خانه‌ای شما پر است';
    } else if (state.coins < selected.price) {
      buyButton.disabled = true;
      label.textContent = `سکه کافی نیست • ${number(selected.price)}`;
    } else {
      label.innerHTML = `خرید معجون • ${number(selected.price)} سکه${inBag ? `<small>اکنون ${faNumber(inBag)} عدد در کیف دارید</small>` : ''}`;
    }
  }

  function selectPotion(item, silent = false) {
    selected = item;
    if (!silent && onSound) onSound(560, .07, 'sine');
    setDialogue(`«<strong>${item.title}</strong>» انتخاب دقیقی است.<br><span style="color:#b9d9c4;font-size:.88em">${item.stat}؛ پس از خرید در کیف شما خواهد بود.</span>`);
    renderGrid();
  }

  function buySelected() {
    if (state.inventory.length >= 16) {
      setDialogue('کیفت جای خالی ندارد پهلوان!<br>نخست یکی از معجون‌ها را مصرف کن، بعد بازگرد.');
      localToast('کیف شما پر است؛ ابتدا یک خانه را خالی کنید.', true);
      if (onSound) onSound(190, .14, 'sawtooth');
      return;
    }
    if (state.coins < selected.price) {
      setDialogue(`برای «<strong>${selected.title}</strong>» سکه‌ی کافی نداری.<br>از شکار کریستال آغاز کن و دوباره سراغم بیا.`);
      localToast('موجودی سکه برای این خرید کافی نیست.', true);
      if (onSound) onSound(180, .15, 'sawtooth');
      return;
    }

    state.coins -= selected.price;
    state.inventory.push({
      id: selected.id,
      title: selected.title,
      desc: selected.short,
      price: selected.price,
      type: selected.type,
      power: selected.power,
      image: selected.image
    });

    if (onSound) {
      onSound(720, .13, 'triangle');
      window.setTimeout(() => onSound(960, .16, 'sine'), 80);
    }
    setDialogue(`«<strong>${selected.title}</strong>» را با دقت برایت بستم.<br>در کیفت است؛ هرگاه نیاز داشتی، یک جرعه بنوش.`);
    localToast(`${selected.title} خریداری شد و به کیف شما اضافه شد.`);
    if (onToast) onToast(`خریداری شد: ${selected.title}`, '#66e0ae');
    if (onInventoryChange) onInventoryChange();
    if (onSave) onSave();
    renderGrid();
  }

  function changeCategory(category) {
    activeCategory = category;
    document.querySelectorAll('[data-ap-category]').forEach(button => {
      const active = button.dataset.apCategory === category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const first = filteredItems()[0];
    if (first) selected = first;
    grid.scrollTop = 0;
    if (onSound) onSound(510, .07, 'sine');
    renderGrid();
    syncScrollIndicator();
  }

  function cardsPerPage() {
    return window.matchMedia('(max-width: 720px) and (orientation: landscape), (orientation: portrait) and (max-width: 700px)').matches ? 4 : 6;
  }

  function syncScrollIndicator() {
    if (!modal.classList.contains('open')) return;
    const maximum = Math.max(0, grid.scrollHeight - grid.clientHeight);
    const ratio = maximum > 0 ? Math.min(1, Math.max(0, grid.scrollTop / maximum)) : 0;
    const track = document.getElementById('ap-scroll-track');
    const thumb = document.getElementById('ap-scroll-thumb');
    const distance = Math.max(0, track.clientHeight - 10);
    thumb.style.transform = `translate(-50%, ${ratio * distance}px)`;
    thumb.style.opacity = maximum > 0 ? '1' : '.35';

    const pages = Math.max(1, Math.ceil(filteredItems().length / cardsPerPage()));
    const page = Math.min(pages, Math.round(ratio * (pages - 1)) + 1);
    document.getElementById('ap-page').textContent = `${page} / ${pages}`;
  }

  function requestScrollSync() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(syncScrollIndicator);
  }

  function drawParticles(time) {
    if (!modal.classList.contains('open')) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) {
      particleFrame = requestAnimationFrame(drawParticles);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : 0;
    previousTime = time;
    elapsed += dt;

    const glow = ctx.createRadialGradient(width * .3, height * .39, 0, width * .3, height * .39, width * .38);
    glow.addColorStop(0, `rgba(52, 232, 168, ${.035 + Math.sin(elapsed * 2.1) * .01})`);
    glow.addColorStop(1, 'rgba(20, 90, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    particles.forEach(particle => {
      particle.y -= particle.speed * dt;
      particle.x += (particle.drift + Math.sin(elapsed + particle.phase) * .006) * dt;
      if (particle.y < -.02) {
        particle.y = 1.02;
        particle.x = Math.random();
      }
      if (particle.x < 0) particle.x = 1;
      if (particle.x > 1) particle.x = 0;
      const alpha = .18 + (Math.sin(elapsed * 2.5 + particle.phase) + 1) * .22;
      ctx.beginPath();
      ctx.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = particle.green ? `rgba(118, 238, 182, ${alpha})` : `rgba(240, 200, 114, ${alpha})`;
      ctx.shadowColor = particle.green ? '#65d9a4' : '#e4b85e';
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    particleFrame = requestAnimationFrame(drawParticles);
  }

  function open() {
    previousFocus = document.activeElement;
    modal.classList.add('open');
    renderGrid();
    if (onSound) onSound(470, .12, 'triangle');
    cancelAnimationFrame(particleFrame);
    previousTime = 0;
    if (!reduceMotion) particleFrame = requestAnimationFrame(drawParticles);
    requestAnimationFrame(() => {
      syncScrollIndicator();
      document.getElementById('ap-close').focus({ preventScroll: true });
    });
  }

  function close() {
    modal.classList.remove('open');
    toast.classList.remove('show');
    cancelAnimationFrame(particleFrame);
    if (onSound) onSound(330, .09, 'sine');
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-ap-category]').forEach(button => {
    button.addEventListener('click', () => changeCategory(button.dataset.apCategory));
  });
  document.getElementById('ap-close').addEventListener('click', close);
  document.getElementById('ap-scroll-up').addEventListener('click', () => grid.scrollBy({ top: -grid.clientHeight * .72, behavior: 'smooth' }));
  document.getElementById('ap-scroll-down').addEventListener('click', () => grid.scrollBy({ top: grid.clientHeight * .72, behavior: 'smooth' }));
  buyButton.addEventListener('click', buySelected);
  grid.addEventListener('scroll', requestScrollSync, { passive: true });
  window.addEventListener('resize', requestScrollSync);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) close();
  });

  return { open, close, render: renderGrid };
}
