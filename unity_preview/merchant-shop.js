import {SIGNATURE_ITEM_ART} from './merchant-signature-items.js';
import {MERCHANT_KEEPERS,merchantKeeper} from './merchant-keepers.js';
import {MERCHANT_CATALOG,purchaseMerchantItem} from './merchant-catalog.js';

// Locally authored material studies for professions without photographic item assets.
export function merchantItemArt(item, color) {
  if(SIGNATURE_ITEM_ART[item.id])return SIGNATURE_ITEM_ART[item.id];
  if(item.shopId==='district_shop_05' && Number.isInteger(item.variant) && item.variant>=0 && item.variant<12)return `./assets/merchants/books/book-${String(item.variant+1).padStart(2,'0')}.png`;
  // Reuse original photographic equipment portraits without resizing the files.
  const photos = {
    sword: ['iron_sword','sword_radiant','battle_axe_double','immortal_spear','bow_arash','war_hammer'],
    armor: ['armor_persian','chest_plate_royal','iron_shield','iron_helmet','armored_gauntlets','armor_persian']
  };
  if (photos[item.art]) return `./assets/blacksmith/${photos[item.art][item.variant]}.jpg`;

  const bookColors=['#416f67','#723c3b','#4a547e','#78633a','#496040','#663f6f','#354a5c','#647e72','#7c403b','#735e8c','#3c777b','#9c7741'];
  const bookColor=item.art==='book'?bookColors[item.variant%12]:color;
  const forms={
    gem:'<path d="M65 75L105 45H145L185 75L125 160Z" fill="url(#gem)"/><path d="M65 75H185M105 45L92 75L125 160L157 75L145 45M92 75L125 45L157 75" fill="none" stroke="#ffffff88"/>',
    ring:'<ellipse cx="125" cy="119" rx="49" ry="35" fill="none" stroke="url(#gold)" stroke-width="15"/><path d="M100 72L125 53L150 72L125 103Z" fill="url(#gem)" stroke="#edd6a2" stroke-width="5"/>',
    book:'<path d="M72 55L162 43L183 151L89 169Z" fill="${bookColor}" stroke="#b79861" stroke-width="4"/><path d="M82 58L99 164M102 78L153 69M107 129L159 120" stroke="url(#gold)" stroke-width="4"/><circle cx="131" cy="100" r="${10+item.variant%5}" fill="none" stroke="#e8cb84" stroke-width="2"/><text x="129" y="106" text-anchor="middle" fill="#f2dca2" font-size="14">${item.variant+1}</text>',
    cloth:'<path d="M57 64L166 47L195 151L80 170Z" fill="url(#gem)" stroke="url(#gold)" stroke-width="6"/><path d="M77 77L154 63L174 140L94 153Z" fill="none" stroke="#d9b977" stroke-width="3"/><path d="M126 81L151 108L128 138L105 112Z" fill="#bc9a58"/><path d="M80 170L83 180M93 169L96 178M108 166L111 177M125 163L129 175M141 161L145 173M158 159L162 171M176 155L180 165" stroke="#e5c686" stroke-width="3"/>',
    cup:'<ellipse cx="125" cy="156" rx="67" ry="15" fill="url(#gold)"/><path d="M72 87H164L151 145Q122 168 86 145Z" fill="url(#gold)"/><path d="M163 96C210 85 195 142 154 136" fill="none" stroke="#b79c65" stroke-width="10"/><ellipse cx="118" cy="88" rx="46" ry="12" fill="#4f2510"/><path d="M108 65Q94 53 110 40M132 64Q148 50 131 34" stroke="#ffe0b944" fill="none" stroke-width="4"/>',
    sword:'<g transform="rotate(35 125 110)"><path d="M119 135L114 48L125 25L136 48L131 135Z" fill="url(#steel)"/><path d="M125 32V132" stroke="#fff8"/><rect x="95" y="131" width="60" height="10" rx="4" fill="url(#gold)"/><rect x="119" y="141" width="12" height="43" fill="url(#leather)"/><circle cx="125" cy="187" r="9" fill="url(#gold)"/></g>',
    armor:'<path d="M96 49L74 69L58 107L82 118L91 155Q125 176 159 155L168 118L192 107L176 69L154 49Q125 78 96 49Z" fill="url(#steel)" stroke="#c4ac75" stroke-width="3"/><path d="M125 74V160M86 106Q125 124 164 106M92 138H158" stroke="#454948" stroke-width="4"/>',
    leather:'<path d="M99 41H149L145 115Q160 133 182 137L190 158Q154 180 83 157L92 114Z" fill="url(#leather)" stroke="#bd9364" stroke-width="3"/><path d="M96 65L145 72M94 81L144 88M92 98L144 104M85 149Q142 169 185 151" stroke="#c9a67c" stroke-width="3"/>',
    candle:'<ellipse cx="125" cy="170" rx="52" ry="10" fill="url(#gold)"/><path d="M104 81H146V166H104Z" fill="url(#wax)"/><ellipse cx="125" cy="81" rx="21" ry="7" fill="#f5dfb3"/><path d="M125 74Q101 58 128 30Q148 62 125 74" fill="#ffbe4e"/><path d="M125 72Q117 60 128 49Q136 66 125 72" fill="#fff6be"/>',
    bread:'<ellipse cx="126" cy="139" rx="74" ry="21" fill="#20160e"/><path d="M57 125Q58 61 125 65Q188 63 194 123Q150 160 57 125Z" fill="url(#bread)"/><path d="M91 83L80 119M125 77L116 130M158 85L151 125" stroke="#936039" stroke-width="5"/><g fill="#f6d5a2"><ellipse cx="92" cy="101" rx="2" ry="4"/><ellipse cx="134" cy="116" rx="2" ry="4"/><ellipse cx="163" cy="101" rx="2" ry="4"/></g>',
    honey:'<path d="M90 62H160L174 145Q125 175 76 145Z" fill="url(#bread)" stroke="#bf9d59" stroke-width="3"/><ellipse cx="125" cy="62" rx="36" ry="11" fill="url(#gold)"/><path d="M96 99H155V137H96Z" fill="#4f3b21"/><path d="M112 111L125 104L138 111V125L125 132L112 125Z" fill="none" stroke="#edcd7e" stroke-width="2"/>',
    oil:'<path d="M111 46H139V80Q170 93 167 148Q125 174 83 148Q80 94 111 80Z" fill="url(#gem)" stroke="#c6ad71" stroke-width="3"/><rect x="109" y="35" width="32" height="17" rx="4" fill="url(#gold)"/><path d="M95 110H155V140H95Z" fill="#201f16"/><path d="M124 116Q105 127 124 136Q140 128 124 116" fill="#c6ac69"/>',
    saddle:'<path d="M62 126Q91 63 123 94Q158 52 186 118L174 151Q145 137 124 151Q93 139 76 156Z" fill="url(#leather)" stroke="url(#gold)" stroke-width="5"/><path d="M79 117Q103 101 124 118Q153 94 174 112M115 141L110 177M141 144L149 177" fill="none" stroke="#b59363" stroke-width="5"/>',
    pot:'<path d="M104 51H146L138 76Q188 91 170 148Q125 176 80 148Q62 91 112 76Z" fill="url(#gem)" stroke="#bdab7c" stroke-width="3"/><ellipse cx="125" cy="51" rx="22" ry="7" fill="#202c2a"/><path d="M84 111Q125 133 169 111M90 137Q125 152 163 137" fill="none" stroke="#e4cc8e" stroke-width="4"/>',
    coin:'<ellipse cx="125" cy="108" rx="61" ry="63" fill="url(#gold)" stroke="#efd99e" stroke-width="4"/><ellipse cx="125" cy="108" rx="49" ry="51" fill="none" stroke="#795a27" stroke-width="3"/><path d="M125 69L135 96L162 98L140 116L148 144L125 128L102 144L110 116L88 98L115 96Z" fill="#a77f37" stroke="#f8df9c" stroke-width="2"/>'
  };
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="210" viewBox="0 0 250 210"><defs><radialGradient id="bg"><stop stop-color="#343328"/><stop offset="1" stop-color="#0c1210"/></radialGradient><linearGradient id="gold"><stop stop-color="#66502b"/><stop offset=".45" stop-color="#efd49b"/><stop offset="1" stop-color="#92703e"/></linearGradient><linearGradient id="steel"><stop stop-color="#383d40"/><stop offset=".45" stop-color="#c7d2cb"/><stop offset=".6" stop-color="#727f7d"/><stop offset="1" stop-color="#303b3f"/></linearGradient><linearGradient id="gem"><stop stop-color="${color}"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="#183633"/></linearGradient><linearGradient id="leather"><stop stop-color="#704d36"/><stop offset=".55" stop-color="#39261e"/><stop offset="1" stop-color="#9c7351"/></linearGradient><linearGradient id="wax"><stop stop-color="#a48d61"/><stop offset=".5" stop-color="#eddab1"/><stop offset="1" stop-color="#bba172"/></linearGradient><linearGradient id="bread"><stop stop-color="#e5b461"/><stop offset=".5" stop-color="#b67c39"/><stop offset="1" stop-color="#734825"/></linearGradient></defs><path fill="url(#bg)" d="M0 0H250V210H0Z"/><ellipse cx="125" cy="184" rx="80" ry="11" fill="#0008"/><g transform="translate(${(item.variant%6-2)*2} 0) rotate(${(item.variant%6-2)*3} 125 110)">${forms[item.art]||forms.gem}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

export function createMerchantShop({state,onSave,onChange,onToast,onSound,onSellCrystals,onRecoverLevel}) {
  const modal=document.createElement('section');modal.className='merchant-modal';modal.id='modal-merchant';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','merchant-title');
  modal.innerHTML=`<div class="merchant-layout"><aside class="merchant-scene"><img src="./assets/merchants/merchant-hall.jpg" alt="حجرهٔ بازرگان پارسی"/><div class="merchant-sign"><small>بازار روستای پارس</small><h2 id="merchant-title"></h2><p class="merchant-tagline"></p></div><div class="merchant-dialogue"><strong class="merchant-keeper"></strong><p class="merchant-speech"></p></div></aside><div class="merchant-stock"><header><div><small>خرید از بازرگان محلی</small><h3>کالاهای برگزیده</h3></div><span class="merchant-gold"></span><button class="merchant-close" aria-label="بستن مغازه">✕</button></header><nav class="merchant-filters" aria-label="دسته‌بندی کالاها"></nav><div class="merchant-services"></div><div class="merchant-grid"></div><footer><div><strong class="merchant-item-name"></strong><p class="merchant-item-desc"></p><small class="merchant-item-lore"></small></div><button class="merchant-buy"></button><span class="merchant-capacity"></span></footer><div class="merchant-status" role="status" aria-live="polite"></div></div></div>`;
  document.body.appendChild(modal);
  let shop=null,definition=null,selected=null,filter='همه',previousFocus=null;
  const q=selector=>modal.querySelector(selector);
  function close(){modal.classList.remove('open');previousFocus?.focus?.();}
  q('.merchant-close').onclick=close;
  document.addEventListener('keydown',e=>{if(!modal.classList.contains('open'))return;if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  function render(){
    q('.merchant-gold').textContent=`◈ ${state.coins.toLocaleString('fa-IR')} سکه`;
    q('.merchant-capacity').textContent=`کیف: ${state.inventory.length} / ۱۶ — استفاده از کالا در کیف`;
    const filters=['همه',...new Set(definition.items.map(i=>i.category)),'ممتاز'];
    q('.merchant-filters').replaceChildren(...filters.map(name=>{const b=document.createElement('button');b.textContent=name;b.classList.toggle('active',filter===name);b.setAttribute('aria-pressed',String(filter===name));b.onclick=()=>{filter=name;render();};return b;}));
    const items=definition.items.filter(i=>filter==='همه'||i.category===filter||i.rarity===filter);
    if(!items.some(i=>i.id===selected?.id))selected=items[0];
    q('.merchant-grid').replaceChildren(...items.map(item=>{
      const card=document.createElement('button');card.className='merchant-card';card.classList.toggle('selected',item.id===selected.id);card.setAttribute('aria-pressed',String(item.id===selected.id));
      const img=document.createElement('img');img.src=merchantItemArt(item,definition.color);img.alt=item.title;
      const title=document.createElement('strong');title.textContent=item.title;
      const desc=document.createElement('small');desc.textContent=item.desc;
      const price=document.createElement('span');price.textContent=`◈ ${item.price.toLocaleString('fa-IR')} سکه · ${item.rarity}`;
      card.append(img,title,desc,price);card.onclick=()=>{selected=item;render();};return card;
    }));
    q('.merchant-item-name').textContent=selected.title;q('.merchant-item-desc').textContent=selected.desc;q('.merchant-item-lore').textContent=selected.lore;
    const buy=q('.merchant-buy');buy.disabled=state.currentZone!=='village'||state.inventory.length>=16||state.coins<selected.price;
    buy.textContent=state.currentZone!=='village'?'فقط در روستا':state.inventory.length>=16?'کیف پر است':state.coins<selected.price?'سکه کافی نیست':`خرید · ${selected.price.toLocaleString('fa-IR')} سکه`;
    const services=q('.merchant-services');services.replaceChildren();
    if(shop.id==='jeweler'||shop.id==='astrologer') {
      const b=document.createElement('button');
      if(shop.id==='jeweler'){const total=state.crystals.reduce((s,c)=>s+c.coinValue,0);b.textContent=`فروش ${state.crystals.length} کریستال · دریافت ${total.toLocaleString('fa-IR')} سکه`;b.disabled=state.currentZone!=='village'||!state.crystals.length;b.onclick=()=>{onSellCrystals();render();};}
      else {const cost=45*Math.max(1,state.party[0].level);b.textContent=`بازیابی سطح ازدست‌رفته · ${cost} سکه`;b.disabled=state.currentZone!=='village'||state.lostLevelsRecoverable<=0||state.coins<cost;b.onclick=()=>{onRecoverLevel();render();};}
      services.appendChild(b);
    }
  }
  q('.merchant-buy').onclick=()=>{const result=purchaseMerchantItem(state,shop.id,selected.id);q('.merchant-status').textContent=result.message;if(result.ok){onChange();onSave();onSound(720,.14,'sine');}onToast(result.message,result.ok?'#fde047':'#f87171');render();};
  return {open(shopDef){definition=MERCHANT_CATALOG[shopDef.id];if(!definition)return false;previousFocus=document.activeElement;shop=shopDef;selected=definition.items[0];filter='همه';modal.classList.toggle('bookshop',shop.id==='district_shop_05');const keeper=merchantKeeper(shop.id);modal.classList.toggle('dedicated-keeper',Boolean(MERCHANT_KEEPERS[shop.id]));q('.merchant-scene>img').src=keeper.image;q('.merchant-scene>img').alt=keeper.description;modal.style.setProperty('--merchant-accent',definition.color);q('#merchant-title').textContent=shop.title;q('.merchant-tagline').textContent=definition.tagline;q('.merchant-keeper').textContent=definition.keeper;q('.merchant-speech').textContent=`به حجرهٔ من خوش آمدی، میا. ${definition.tagline}.`;q('.merchant-status').textContent='';render();modal.classList.add('open');q('.merchant-close').focus();return true;},close};
}
