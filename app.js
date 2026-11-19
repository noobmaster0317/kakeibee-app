/* 江藤家の家計簿：ホーム画面アプリの外枠
 * - 初回だけ「連携コード」を入れて、この端末専用のトークンを受け取る
 * - 起動時はGASから家計簿の画面一式を受け取り、そのまま表示する（前回分を端末に保存して、すぐ出す）
 * - 画面からの通信（google.script.run）は、トークンをつけてGASのAPIへ送る
 */
(function(){
  'use strict';
  window.__kbShell=true;
  var API=String(window.KAKEIBO_API_URL||'').trim();
  var K={token:'kb.token',user:'kb.user',html:'kb.bundle.html',ver:'kb.bundle.ver',device:'kb.device'};
  var screen=document.getElementById('screen');
  var store={
    get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
    set:function(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
    del:function(k){try{localStorage.removeItem(k);}catch(e){}}
  };
  var ua=navigator.userAgent||'';
  var isIOS=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var standalone=window.navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function guessDevice(){if(/iPad/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))return 'iPad';if(/iPhone/.test(ua))return 'iPhone';if(/Android/.test(ua))return 'Android';if(/Mac/.test(ua))return 'Mac';if(/Windows/.test(ua))return 'Windows';return '端末';}

  if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(function(){});}

  function api(body){
    var ctrl=window.AbortController?new AbortController():null,timedOut=false;
    var timer=setTimeout(function(){timedOut=true;if(ctrl)ctrl.abort();},body.action==='bundle'?45000:30000);
    return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl?ctrl.signal:undefined})
      .then(function(r){clearTimeout(timer);return r.text();},function(){clearTimeout(timer);if(timedOut){var e=Error('サーバーからの応答がありませんでした（時間切れ）。電波の良い場所でもう一度お試しください。');e.code='TIMEOUT';throw e;}throw netError();})
      .then(function(t){var j;try{j=JSON.parse(t);}catch(e){var x=Error('サーバーから家計簿の返事がありませんでした。GASの「ホーム画面アプリ用」デプロイの設定（次のユーザーとして実行：自分／アクセスできるユーザー：全員）を確認してください。');x.code='CONFIG';throw x;}
        if(!j.ok){var err=Error(j.error||'エラーが発生しました。');err.code=j.code||'';throw err;}return j.result;});
  }
  function netError(){var e=Error(navigator.onLine===false?'インターネットにつながっていません。つながってからもう一度お試しください。':'通信できませんでした。電波の良い場所でもう一度お試しください。');e.code='NET';return e;}

  // ---- 画面：設定不足 ----
  function showConfig(){
    screen.innerHTML='<div class="card"><img class="logo" src="icons/apple-touch-icon.png" alt=""><h1>江藤家の家計簿</h1><p class="sub">接続先がまだ設定されていません。</p><p style="font-size:14px">config.js に、GASの「ホーム画面アプリ用」デプロイのURLを入れてください。</p></div>';
  }
  // ---- 画面：ホーム画面に追加の案内（iPhone/iPadのSafariで開いたとき） ----
  function showInstall(){
    screen.innerHTML='<div class="card"><img class="logo" src="icons/apple-touch-icon.png" alt=""><h1>ホーム画面に追加</h1><p class="sub">アプリとして使うために、先にホーム画面へ追加します。</p>'+
      '<ol><li>画面下（iPadは右上）の <span class="share" aria-label="共有"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00897b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span> 共有ボタンをタップ</li><li>「ホーム画面に追加」をタップ</li><li>右上の「追加」をタップ</li><li>ホーム画面にできた「家計簿」アイコンから開く</li></ol>'+
      '<p style="font-size:12px;color:var(--muted)">連携コードの入力は、ホーム画面のアイコンから開いたあとに行ってください（Safariとアプリでは保存場所が別のため）。</p>'+
      '<button type="button" class="ghost" id="skip">このままブラウザで使う</button></div>';
    document.getElementById('skip').onclick=showPair;
  }
  // ---- 画面：連携コードの入力 ----
  function showPair(message){
    var dev=store.get(K.device)||guessDevice();
    screen.innerHTML='<div class="card"><img class="logo" src="icons/apple-touch-icon.png" alt=""><h1>江藤家の家計簿</h1><p class="sub">この端末を家計簿に連携します（最初の1回だけ）</p>'+
      '<ol><li>パソコンかSafariで、いつもの家計簿を開く</li><li>「設定」の「iPhone・iPadアプリ」で<b>連携コードを発行</b></li><li>表示された8桁を下に入力</li></ol>'+
      '<form id="f" autocomplete="off"><label for="code">連携コード（8桁）</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="9" placeholder="0000 0000" required>'+
      '<label for="dev">この端末の名前</label><input id="dev" maxlength="30" value="'+esc(dev)+'">'+
      '<p class="err" id="err" role="alert">'+esc(message||'')+'</p><button type="submit" id="go">連携する</button></form></div>';
    var code=document.getElementById('code'),go=document.getElementById('go'),err=document.getElementById('err');
    code.addEventListener('input',function(){err.textContent='';var d=code.value.replace(/[^0-9]/g,'').slice(0,8);code.value=d.length>4?d.slice(0,4)+' '+d.slice(4):d;});
    document.getElementById('f').onsubmit=function(e){
      e.preventDefault();var digits=code.value.replace(/[^0-9]/g,'');
      if(digits.length!==8){err.textContent='8桁の数字を入力してください。';code.focus();return;}
      var name=document.getElementById('dev').value.trim()||guessDevice();
      go.disabled=true;go.textContent='確認しています…';err.textContent='';
      api({action:'pair',code:digits,device:name}).then(function(r){
        if(!store.set(K.token,r.token)){throw Error('この端末に連携情報を保存できませんでした。プライベートブラウズをやめてもう一度お試しください。');}
        store.set(K.device,name);store.set(K.user,JSON.stringify(r.user||{}));
        start();
      }).catch(function(e){go.disabled=false;go.textContent='連携する';err.textContent=e.message;});
    };
    setTimeout(function(){code.focus();},300);
  }
  var watchdog=0;
  function showLoading(text){
    screen.innerHTML='<div class="loading"><div class="ring"></div><div>'+esc(text||'家計簿を準備しています')+'</div><div id="slow" hidden style="max-width:320px"><p style="margin:8px 0 0">時間がかかっています。電波を確認して、もう一度お試しください。</p><button type="button" id="again">もう一度試す</button><button type="button" class="ghost" id="fresh">画面を取り直す</button></div></div>';
    clearTimeout(watchdog);watchdog=setTimeout(function(){var el=document.getElementById('slow');if(el)el.hidden=false;},12000);
    document.getElementById('again').onclick=function(){location.reload();};
    document.getElementById('fresh').onclick=function(){store.del(K.html);store.del(K.ver);location.reload();};
  }
  function showError(message){
    screen.innerHTML='<div class="card"><img class="logo" src="icons/apple-touch-icon.png" alt=""><h1>開けませんでした</h1><p class="err" style="text-align:center">'+esc(message)+'</p><button type="button" id="retry">もう一度試す</button><button type="button" class="ghost" id="fresh">画面を取り直す</button><button type="button" class="ghost" id="repair">連携をやり直す</button></div>';
    document.getElementById('retry').onclick=start;
    document.getElementById('fresh').onclick=function(){store.del(K.html);store.del(K.ver);start();};
    document.getElementById('repair').onclick=function(){if(confirm('この端末の連携情報を消して、連携コードの入力からやり直しますか？')){store.del(K.token);store.del(K.html);store.del(K.ver);start();}};
  }

  // ---- 家計簿の画面へ切り替え ----
  // 画面の中で使う google.script.run を、GASのAPIへの通信に置き換える部品
  function shimCode(){
    return '('+function(API,KEYS){
      var token=localStorage.getItem(KEYS.token);
      function lost(message){try{localStorage.removeItem(KEYS.token);}catch(e){}alert(message+'\n\nもう一度、連携コードを入力してください。');location.reload();}
      function call(fn,args){
        return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'call',token:token,fn:fn,args:args}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
          .then(function(r){return r.text();},function(){throw Error(navigator.onLine===false?'インターネットにつながっていません。つながってからもう一度お試しください。':'通信できませんでした。電波の良い場所でもう一度お試しください。');})
          .then(function(t){var j;try{j=JSON.parse(t);}catch(e){throw Error('サーバーから家計簿の返事がありませんでした。時間をおいてもう一度お試しください。');}
            if(!j.ok){if(j.code==='AUTH'){lost(j.error);return new Promise(function(){});}throw Error(j.error||'エラーが発生しました。');}return j.result;});
      }
      function runner(ok,ng){
        return new Proxy({},{get:function(_,name){
          if(name==='withSuccessHandler')return function(h){return runner(h,ng);};
          if(name==='withFailureHandler')return function(h){return runner(ok,h);};
          if(name==='withUserObject')return function(){return runner(ok,ng);};
          if(typeof name!=='string'||name==='then')return undefined;
          return function(){var args=Array.prototype.slice.call(arguments);call(name,args).then(function(r){ok&&ok(r);},function(e){ng&&ng(e);});};
        }});
      }
      window.google={script:{run:runner(null,null),host:{close:function(){},setHeight:function(){},setWidth:function(){}}}};
      window.__kbPWA={unpair:function(){try{localStorage.removeItem(KEYS.token);}catch(e){}location.reload();}};
      // 裏で新しい画面が出ていないか確認し、あれば保存（次に開いたときに反映）
      setTimeout(function(){
        fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'bundle',token:token,have:window.__kbBundleVer||''}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
          .then(function(r){return r.json();}).then(function(j){if(j&&j.ok&&j.result&&!j.result.same&&j.result.html){try{localStorage.setItem(KEYS.html,j.result.html);localStorage.setItem(KEYS.ver,j.result.version);}catch(e){}}}).catch(function(){});
      },4000);
      // 新しい画面が届いていれば、しばらく閉じていたあと表に戻ったときに入れ替える
      var hiddenAt=0;document.addEventListener('visibilitychange',function(){
        if(document.hidden){hiddenAt=Date.now();return;}
        if(hiddenAt&&Date.now()-hiddenAt>30*60e3&&localStorage.getItem(KEYS.ver)!==window.__kbBundleVer)location.reload();
      });
    }.toString()+')('+JSON.stringify(API)+','+JSON.stringify(K)+');';
  }
  function render(html,ver){
    try{renderNow(html,ver);}catch(e){store.del(K.html);store.del(K.ver);showError('画面を表示できませんでした（'+(e&&e.message||e)+'）。');}
  }
  // document.write は使わず、受け取った画面をDOMとして組み立て直す（iPhoneのSafariで確実に差し替えるため）
  function freshScript(old,text){var n=document.createElement('script');if(old)for(var k=0;k<old.attributes.length;k++)n.setAttribute(old.attributes[k].name,old.attributes[k].value);n.text=text!=null?text:old.text;return n;}
  function activate(node){
    if(node.nodeType===1&&node.tagName==='SCRIPT'){var s=freshScript(node);node.parentNode.replaceChild(s,node);return;}
    if(node.querySelectorAll){var list=node.querySelectorAll('script');for(var i=0;i<list.length;i++)list[i].parentNode.replaceChild(freshScript(list[i]),list[i]);}
  }
  function renderNow(html,ver){
    clearTimeout(watchdog);
    var doc=new DOMParser().parseFromString(html,'text/html');
    var bases=doc.querySelectorAll('base');for(var b=0;b<bases.length;b++)bases[b].parentNode.removeChild(bases[b]);
    var head=document.head,body=document.body;
    // 外枠の見た目（style）と表示中の内容を片付ける。CSP・アイコン・ホーム画面用の設定は残す
    Array.prototype.slice.call(head.children).forEach(function(n){
      var keep=n.tagName==='LINK'||(n.tagName==='META'&&(n.getAttribute('http-equiv')||n.getAttribute('charset')!=null||/^(apple-|mobile-|theme-color|referrer)/.test(n.getAttribute('name')||'')));
      if(!keep)head.removeChild(n);
    });
    while(body.firstChild)body.removeChild(body.firstChild);
    Array.prototype.slice.call(body.attributes).forEach(function(at){body.removeAttribute(at.name);});
    if(doc.documentElement.getAttribute('lang'))document.documentElement.setAttribute('lang',doc.documentElement.getAttribute('lang'));
    document.title=doc.title||document.title;
    window.__kbBundleVer=ver;
    head.appendChild(freshScript(null,shimCode()));
    Array.prototype.slice.call(doc.head.childNodes).forEach(function(n){var x=document.importNode(n,true);head.appendChild(x);activate(x);});
    Array.prototype.slice.call(doc.body.attributes).forEach(function(at){body.setAttribute(at.name,at.value);});
    Array.prototype.slice.call(doc.body.childNodes).forEach(function(n){var x=document.importNode(n,true);body.appendChild(x);activate(x);});
    window.scrollTo(0,0);
  }
  function fetchBundle(have){return api({action:'bundle',token:store.get(K.token),have:have||''});}

  function start(){
    if(!API){showConfig();return;}
    var token=store.get(K.token);
    if(!token){if(isIOS&&!standalone)showInstall();else showPair();return;}
    var cached=store.get(K.html),ver=store.get(K.ver);
    if(cached&&ver){
      // 前回の画面ですぐ起動し、裏で新しい画面が出ていないか確認（次に開いたときに反映）
      render(cached,ver);return;
    }
    showLoading();
    fetchBundle('').then(function(r){store.set(K.html,r.html);store.set(K.ver,r.version);render(r.html,r.version);})
      .catch(function(e){
        if(e.code==='AUTH'){store.del(K.token);showPair(e.message);return;}
        showError(e.message);
      });
  }
  window.addEventListener('error',function(ev){if(document.getElementById('loading')||document.querySelector('.loading'))showError('起動中にエラーが発生しました：'+(ev.message||'不明なエラー'));});
  var q=location.search||'';if(/[?&]reset=1/.test(q)){store.del(K.html);store.del(K.ver);}
  // 読み込みの途中で画面を差し替えると、iPhoneでは古い画面の下に付け足されてしまうため、読み込みが終わってから始める
  function boot(){setTimeout(start,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
