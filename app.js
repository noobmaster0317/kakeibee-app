/* 江藤家の家計簿：ホーム画面アプリの外枠
 * - 初回だけ「連携コード」を入れて、この端末専用のトークンを受け取る
 * - 起動時はGASから家計簿の画面一式を受け取り、そのまま表示する（前回分を端末に保存して、すぐ出す）
 * - 画面からの通信（google.script.run）は、トークンをつけてGASのAPIへ送る
 */
(function(){
  'use strict';
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
    return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
      .then(function(r){return r.text();},function(){throw netError();})
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
  function showLoading(text){screen.innerHTML='<div class="loading"><div class="ring"></div><div>'+esc(text||'家計簿を準備しています')+'</div></div>';}
  function showError(message){
    screen.innerHTML='<div class="card"><img class="logo" src="icons/apple-touch-icon.png" alt=""><h1>開けませんでした</h1><p class="err" style="text-align:center">'+esc(message)+'</p><button type="button" id="retry">もう一度試す</button></div>';
    document.getElementById('retry').onclick=start;
  }

  // ---- 家計簿の画面へ切り替え ----
  // 画面の中で使う google.script.run を、GASのAPIへの通信に置き換える部品
  function shimSource(){
    return '<script>('+function(API,KEYS){
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
      // 新しい画面が届いていれば、しばらく閉じていたあと表に戻ったときに入れ替える
      var hiddenAt=0;document.addEventListener('visibilitychange',function(){
        if(document.hidden){hiddenAt=Date.now();return;}
        if(hiddenAt&&Date.now()-hiddenAt>30*60e3&&localStorage.getItem(KEYS.ver)!==window.__kbBundleVer)location.reload();
      });
    }.toString()+')('+JSON.stringify(API)+','+JSON.stringify(K)+');</'+'script>';
  }
  function render(html,ver){
    var head='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="家計簿"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="theme-color" content="#f6f8f8"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><link rel="icon" type="image/png" href="icons/favicon.png"><script>window.__kbBundleVer='+JSON.stringify(ver)+';</'+'script>'+shimSource();
    var out=/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,function(m){return m+head;}):head+html;
    out=out.replace(/<base\s+target="_top"\s*\/?>/i,'');
    document.open();document.write(out);document.close();
  }
  function fetchBundle(have){return api({action:'bundle',token:store.get(K.token),have:have||''});}

  function start(){
    if(!API){showConfig();return;}
    var token=store.get(K.token);
    if(!token){if(isIOS&&!standalone)showInstall();else showPair();return;}
    var cached=store.get(K.html),ver=store.get(K.ver);
    if(cached&&ver){
      // 前回の画面ですぐ起動し、裏で新しい画面が出ていないか確認（次に開いたときに反映）
      fetchBundle(ver).then(function(r){if(!r.same&&r.html){store.set(K.html,r.html);store.set(K.ver,r.version);}}).catch(function(){});
      render(cached,ver);return;
    }
    showLoading();
    fetchBundle('').then(function(r){store.set(K.html,r.html);store.set(K.ver,r.version);render(r.html,r.version);})
      .catch(function(e){
        if(e.code==='AUTH'){store.del(K.token);showPair(e.message);return;}
        showError(e.message);
      });
  }
  start();
})();
