export function registerPwa(){
  if(!('serviceWorker' in navigator)||!(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)))return;
  let requested=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requested)location.reload();});
  navigator.serviceWorker.register(new URL('../../sw.js',import.meta.url),{updateViaCache:'none'}).then(registration=>{
    const offer=()=>{
      if(!registration.waiting||document.querySelector('#pwa-update'))return;
      const box=document.createElement('section');box.className='card';box.id='pwa-update';
      const text=document.createElement('p');text.textContent='มี MyDash รุ่นใหม่ บันทึกฟอร์มที่เปิดอยู่ก่อนอัปเดต';
      const button=document.createElement('button');button.className='button';button.textContent='อัปเดตและโหลดใหม่';
      button.onclick=()=>{if(confirm('บันทึกงานในฟอร์มแล้วหรือยัง? อัปเดตจะโหลดหน้าใหม่')){requested=true;registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});}};
      box.append(text,button);document.querySelector('main').before(box);
    };
    offer();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
  }).catch(()=>{document.querySelector('#data-notice')?.append(document.createTextNode(' · ติดตั้งส่วนออฟไลน์ไม่สำเร็จ แต่ยังใช้เว็บออนไลน์ได้'));});
}
