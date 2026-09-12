(function(root) {
  'use strict';
  const destinations = [
    { page:'strava', icon:'🔌', title:'Sources & sync', description:'Connected services and activity imports' },
    { page:'news', icon:'💬', title:'AI Q&A', description:'Ask about training and recovery' },
    { page:'settings', icon:'⚙️', title:'Settings', description:'Profile, preferences, and account' }
  ];
  function closeMoreMenu(){ document.getElementById('ui-more-overlay')?.remove(); }
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
  root.openMoreMenu=openMoreMenu; root.closeMoreMenu=closeMoreMenu;
})(window);
