// 画面の外枠（アイコン・連携画面）だけを端末に保存して、電波が弱くてもすぐ起動できるようにする。
// 家計簿のデータそのものは保存しない（毎回サーバーから読む）。
const CACHE='kakeibo-shell-v2';
const FILES=['./','./index.html','./app.js','./config.js','./manifest.webmanifest','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./icons/favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return; // GASへの通信には触らない
  // ネット優先（2.5秒で返事がなければ端末に保存した分）。公開し直した内容がすぐ反映されるように。
  const key=req.mode==='navigate'?'./index.html':req;
  const net=fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(key,copy));}return res;});
  const cached=()=>caches.match(key).then(r=>r||caches.match('./index.html'));
  e.respondWith(new Promise(resolve=>{
    let done=false;const finish=r=>{if(!done&&r){done=true;resolve(r);}};
    const t=setTimeout(()=>cached().then(r=>r?finish(r):net.then(finish)),2500);
    net.then(r=>{clearTimeout(t);finish(r);}).catch(()=>{clearTimeout(t);cached().then(r=>finish(r||Response.error()));});
  }));
});
