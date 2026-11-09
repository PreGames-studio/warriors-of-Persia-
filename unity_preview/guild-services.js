export function registerGuildMember(state){
  if(state.currentZone!=='guild')return {ok:false,message:'ثبت‌نام فقط در گیلد انجام می‌شود.'};
  if(state.guildMembership?.registered)return {ok:false,message:'شما قبلاً عضو گیلد شده‌اید.'};
  state.guildMembership={registered:true,name:state.party[0].name,joinedAt:new Date().toISOString(),rank:'تازه‌وارد'};
  return {ok:true,message:'ثبت‌نام رایگان انجام شد. به گیلد ماجراجویان خوش آمدید!'};
}
export function guildResaleValue(item){return Number.isFinite(item?.price)&&item.price>0?Math.max(1,Math.floor(item.price*.35)):0;}
export function sellGuildItem(state,index){
  if(state.currentZone!=='guild')return {ok:false,message:'فروش فقط در گیلد انجام می‌شود.'};
  if(!Number.isInteger(index)||index<0||index>=state.inventory.length)return {ok:false,message:'آیتم موجود نیست.'};
  const price=guildResaleValue(state.inventory[index]);if(!price)return {ok:false,message:'این آیتم قابل خرید نیست.'};
  const [item]=state.inventory.splice(index,1);state.coins+=price;
  return {ok:true,message:`${item.title} به مبلغ ${price} سکه فروخته شد.`};
}
export function createGuildServices({state,onSave,onChange,onToast}){
  const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='modal-guild-services';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.innerHTML='<div class="modal-window"><div class="modal-win-header"><span class="guild-service-title"></span><button class="top-btn guild-service-close">✕ بستن</button></div><div class="modal-win-body guild-service-body"></div></div>';
  document.body.appendChild(modal);let role='registrar',previousFocus;
  const close=()=>{modal.classList.remove('open');previousFocus?.focus?.();};modal.querySelector('.guild-service-close').onclick=close;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close();});
  function transaction(result){onToast(result.message,result.ok?'#d8b66a':'#f87171');if(result.ok){onChange();onSave();}render();}
  function render(){
    modal.querySelector('.guild-service-title').textContent=role==='registrar'?'دفتر ثبت‌نام گیلد':'پیشخوان خرید غنائم ماجراجویان';
    const body=modal.querySelector('.guild-service-body');body.replaceChildren();
    const p=document.createElement('p');p.textContent=role==='registrar'?(state.guildMembership?.registered?`عضو گیلد: ${state.guildMembership.name} — رتبه: ${state.guildMembership.rank}`:'ثبت‌نام رایگان است. عضویت شما به‌صورت دائمی ذخیره می‌شود.'):`موجودی: ${state.coins} سکه — خرید آیتم‌ها با ۳۵٪ قیمت اصلی؛ امتیازهای قبلاً اعمال‌شده تغییر نمی‌کنند.`;body.appendChild(p);
    if(role==='registrar'){
      const b=document.createElement('button');b.className='top-btn gold';b.textContent=state.guildMembership?.registered?'عضویت ثبت شده است':'ثبت‌نام در گیلد';b.disabled=!!state.guildMembership?.registered;b.onclick=()=>transaction(registerGuildMember(state));body.appendChild(b);
    }else{
      state.inventory.forEach((item,index)=>{
        const row=document.createElement('div');row.className='catalog-row';const name=document.createElement('span');name.textContent=item.title;
        const b=document.createElement('button');b.className='top-btn gold';const value=guildResaleValue(item);b.textContent=value?`فروش · ${value} سکه`:'غیرقابل‌فروش';b.disabled=!value;b.onclick=()=>transaction(sellGuildItem(state,index));row.append(name,b);body.appendChild(row);
      });
      if(!state.inventory.length){const empty=document.createElement('p');empty.textContent='کیف شما خالی است.';body.appendChild(empty);}
      const b=document.createElement('button');b.className='top-btn gold';b.textContent=`فروش کریستال‌ها (${state.crystals.length} عدد)`;b.disabled=!state.crystals.length;b.onclick=()=>{
        if(state.currentZone!=='guild'||!state.crystals.length)return;
        const value=state.crystals.reduce((sum,c)=>sum+Math.max(0,Number(c.coinValue)||0),0);state.coins+=value;state.crystals=[];transaction({ok:true,message:`کریستال‌ها به مبلغ ${value} سکه فروخته شدند.`});
      };body.appendChild(b);
    }
  }
  return {open(staff){if(state.currentZone!=='guild')return;role=staff.id;previousFocus=document.activeElement;render();modal.classList.add('open');modal.querySelector('.guild-service-close').focus();},close};
}
