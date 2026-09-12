(function(root) {
  'use strict';
  const destinations = [
    { page:'strava', icon:'🔌', title:'Sources & sync', description:'Connected services and activity imports' },
    { page:'news', icon:'💬', title:'AI Q&A', description:'Ask about training and recovery' },
    { page:'settings', icon:'⚙️', title:'Settings', description:'Profile, preferences, and account' }
  ];
  function closeMoreMenu(){ document.getElementById('ui-more-overlay')?.remove(); }
  function compactManualActivityForm(){
    const quick=document.getElementById('activity-quick-experience');
    const rpe=document.getElementById('r-rpe')?.closest('.form-group');
    const note=document.getElementById('r-note')?.closest('.form-group');
    if(!quick||!rpe||!note||quick.dataset.ready)return;
    quick.append(rpe,note);
    quick.dataset.ready='true';
  }
  function installMobileTabbar(){
    if(document.getElementById('daily-tabbar'))return;
    const tabbar=document.createElement('nav');tabbar.id='daily-tabbar';tabbar.setAttribute('aria-label','Primary navigation');
    const items=[['today','⌂','Today'],['fitness-log','◷','Activities'],['coach','▣','Plan'],['wellness','♥','Health'],['more','☰','More']];
    tabbar.innerHTML=items.map(([page,icon,label])=>`<button type="button" data-daily-page="${page}"><span>${icon}</span><small>${label}</small></button>`).join('');
    tabbar.querySelectorAll('[data-daily-page]').forEach(button=>button.addEventListener('click',()=>{const page=button.dataset.dailyPage;page==='more'?openMoreMenu():root.showPage?.(page);}));
    document.body.appendChild(tabbar);
    const sync=()=>{const active=document.querySelector('.page.active')?.id?.replace('page-','')||'today';tabbar.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.dailyPage===active));};
    const original=root.showPage;
    if(typeof original==='function'&&!original._dailyTabbar){const wrapped=function(page){const result=original.apply(this,arguments);sync();return result;};wrapped._dailyTabbar=true;root.showPage=wrapped;}
    sync();
  }
  function openMoreMenu(){
    closeMoreMenu();
    const overlay=document.createElement('div'); overlay.id='ui-more-overlay'; overlay.className='ui-more-overlay';
    overlay.innerHTML=`<section class="ui-more-panel" role="dialog" aria-modal="true" aria-label="More navigation"><header class="ui-more-head"><div><h2>More</h2><p>Connections, help, and preferences</p></div><button type="button" class="ui-more-close" aria-label="Close menu">Close</button></header><div class="ui-more-list">${destinations.map(item=>`<button type="button" class="ui-more-item" data-ui-more-page="${item.page}"><span class="ui-more-item-icon">${item.icon}</span><span><b>${item.title}</b><small>${item.description}</small></span><span class="ui-more-item-arrow">›</span></button>`).join('')}</div></section>`;
    const close=()=>closeMoreMenu();
    overlay.querySelector('.ui-more-close').addEventListener('click',close);
    overlay.querySelectorAll('[data-ui-more-page]').forEach(button=>button.addEventListener('click',()=>{const page=button.dataset.uiMorePage;close();root.showPage?.(page);}));
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();}); overlay.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    document.body.appendChild(overlay); overlay.querySelector('.ui-more-close')?.focus();
  }
  root.openMoreMenu=openMoreMenu; root.closeMoreMenu=closeMoreMenu; compactManualActivityForm(); installMobileTabbar();
})(window);
