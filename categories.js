(function () {
  const catalogue = [
    ['ANIMALS','Animals',0],['FOOD','Food & Drink',0],['OBJECTS','Everyday Objects',0],['TRANSPORT','Transport',0],
    ['SPORT','Sport',20],['LANDMARKS','Famous Landmarks',30],['MUSIC','Musical Instruments',20],['PLANTS','Plants & Flowers',20],
    ['TOOLS','Tools & DIY',20],['JOBS','Jobs & Professions',25],['SPACE','Space',30],['CLOTHING','Clothing & Accessories',20]
  ];
  let rendering = 0;
  async function render(container, onChoose) {
    const version = ++rendering;
    container.replaceChildren();
    const status = document.createElement('p'); status.className = 'category-status';status.textContent='Loading categories…';container.append(status);
    const backend = window.battlePiczBackend;
    const signedIn = Boolean(backend?.readSession()?.user?.id);
    try {
      const data = signedIn ? await backend.rpc('list_categories') : {coins:0,categories:catalogue.map(([id,name,price])=>({id,name,price,owned:price===0,pictureCount:window.BATTLE_PICZ_QUESTIONS[id]?.length || 0}))};
      if (version !== rendering || !container.isConnected) return;
      container.replaceChildren(status);
      const topCoins=document.getElementById('categoryTopCoins');
      if (topCoins) topCoins.textContent=`${Number(data.coins).toLocaleString()} COINS`;
      // Keep this area for real errors only; the coin balance is already in the header.
      status.hidden=true;
      for (const category of [...data.categories].sort((a,b) => Number(b.owned) - Number(a.owned))) {
        const ready = category.pictureCount >= 3;
        const button = document.createElement('button');button.type='button';button.className='category-card' + (category.owned ? '' : ' is-locked');
        const label=document.createElement('strong');label.textContent=category.name;
        const badge=document.createElement('span');badge.className='category-card-badge';
        if (!ready) badge.textContent='SOON';
        else if (category.owned) badge.textContent='▶';
        else {
          badge.textContent=`🔒 ${category.price} `;
          const coin=document.createElement('span');coin.className='gold-coin';coin.setAttribute('aria-hidden','true');
          badge.append(coin);
        }
        badge.setAttribute('aria-hidden', 'true');
        button.setAttribute('aria-label', !ready ? `${category.name}, coming soon` : category.owned ? `Play ${category.name}` : `Unlock ${category.name} for ${category.price} coins`);
        button.append(label,badge);button.disabled=!ready;
        button.dataset.category=category.id;
        button.onclick=async()=>{
          if(category.owned){ if(onChoose)onChoose(category.id);return; }
          if(!signedIn){status.hidden=false;status.textContent='Sign in to earn coins and unlock categories.';return;}
          if(data.coins<category.price){status.hidden=false;status.textContent=`You need ${category.price-data.coins} more coins to unlock ${category.name}.`;return;}
          if(!window.confirm(`Permanently unlock ${category.name} for ${category.price} coins? Your opponent can play it for free.`))return;
          button.disabled=true;
          try {
            const result = await backend.rpc('purchase_category',{p_category:category.id});
            await render(container,onChoose);
            window.dispatchEvent(new CustomEvent('battle-picz:balance',{detail:result.coins}));
          } catch(error){status.hidden=false;status.textContent=error.message||'Could not unlock. Try again.';button.disabled=false;}
        };
        container.append(button);
      }
    } catch(error){status.hidden=false;status.textContent=error.message||'Could not load categories.';const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>render(container,onChoose);container.append(retry);}
  }
  function openShop() {
    let panel=document.getElementById('categoryShop');
    if(!panel){
      panel=document.createElement('section');panel.id='categoryShop';panel.className='category-shop';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Category shop');panel.setAttribute('aria-modal','true');
      const back=document.createElement('button');back.textContent='‹ Back';back.className='category-shop-back';back.onclick=()=>{panel.hidden=true;};
      const title=document.createElement('h2');title.textContent='CATEGORIES';
      const note=document.createElement('p');note.textContent='Only the chooser needs to own a category. Your opponent plays free.';
      const grid=document.createElement('div');grid.className='category-options';panel.append(back,title,note,grid);document.getElementById('game').append(panel);
    }
    panel.hidden=false;render(panel.querySelector('.category-options'));
  }
  window.BattlePiczCategories={catalogue,render,openShop};
})();
