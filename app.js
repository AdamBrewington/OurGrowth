// ═══════════════════════════════════════════════════════
// OurGrowth v2.5 — The Big UX Fix
// ═══════════════════════════════════════════════════════
var OG = (function() {
  'use strict';

  // ── Utilities ──
  function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
  function uid(p){return(p||'x')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function $(id){return document.getElementById(id);}
  function hashPin(pin){var h=0,salt='ourgrowth_salt_2026',s=salt+pin+salt;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);h=((h<<5)-h)+c;h=h&h;}return'ph_'+Math.abs(h).toString(36);}
  function ensureIds(arr,prefix){if(!Array.isArray(arr))return[];arr.forEach(function(item){if(!item.id)item.id=uid(prefix);});return arr;}
  function findById(arr,id){for(var i=0;i<arr.length;i++){if(arr[i].id===id)return i;}return-1;}
  function removeById(arr,id){var i=findById(arr,id);if(i>=0)return arr.splice(i,1)[0];return null;}

  // ── Timezone-safe date comparison ──
  // Converts any date/ISO string to local YYYY-MM-DD for comparison
  function toLocalDateStr(d){
    if(!d)return'';
    var dt=typeof d==='string'?new Date(d):d;
    return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  }
  function todayStr(){return toLocalDateStr(new Date());}
  function daysDiff(isoOrDate){
    if(!isoOrDate)return 999;
    var d=typeof isoOrDate==='string'?new Date(isoOrDate):isoOrDate;
    var now=new Date();
    // Compare using local dates only
    var dLocal=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    var nLocal=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    return Math.round((dLocal-nLocal)/86400000);
  }

  // ── Constants ──
  var PIN_KEY_ADAM='ourgrowth_pin_adam',PIN_KEY_BRIT='ourgrowth_pin_brit';
  var SESSION_KEY='ourgrowth_session',SESSION_MS=24*60*60*1000;
  var STORAGE_KEY='ourgrowth_v4',DEVICE_KEY='ourgrowth_device_id';
  var THEME_KEY='ourgrowth_theme';
  var SYNC_POLL_MS=15000;
  var SYNC_TOKEN='99031e6b3d8b39cb3bc37908cf48a510ae88d2b02c4166562ead803b619a38ceddcbbeb4e323b73d34417abe8f81b12d';

  var THEMES=[
    {id:'warm',name:'Warm',bg:'#fffdf9',accent:'#c49a3c',text:'#1c1a16'},
    {id:'midnight',name:'Midnight',bg:'#0f1117',accent:'#d4a854',text:'#e8e6e1'},
    {id:'forest',name:'Forest',bg:'#f4f1eb',accent:'#7a9a5a',text:'#2d3a28'},
    {id:'slate',name:'Slate',bg:'#f0f2f5',accent:'#5b7cba',text:'#1a1d24'},
    {id:'noir',name:'Noir',bg:'#18181b',accent:'#e4e4e7',text:'#fafafa'}
  ];

  var QUOTES=[
    {q:"A small daily task, if it be really daily, will beat the labours of a spasmodic Hercules.",a:"Anthony Trollope"},
    {q:"We do not remember days, we remember moments.",a:"Cesare Pavese"},
    {q:"The secret of getting ahead is getting started.",a:"Mark Twain"},
    {q:"Build your own dreams, or someone else will hire you to build theirs.",a:"Farrah Gray"},
    {q:"The best time to plant a tree was 20 years ago. The second best time is now.",a:"Chinese Proverb"},
    {q:"Do not wait to strike till the iron is hot, but make it hot by striking.",a:"W.B. Yeats"},
    {q:"Together is a wonderful place to be.",a:""},
    {q:"The whole is greater than the sum of its parts.",a:"Aristotle"},
    {q:"Discipline is choosing between what you want now and what you want most.",a:"Abraham Lincoln"},
    {q:"You don't have to be great to start, but you have to start to be great.",a:"Zig Ziglar"},
    {q:"It is not the mountain we conquer, but ourselves.",a:"Edmund Hillary"},
    {q:"Fall seven times, stand up eight.",a:"Japanese Proverb"},
    {q:"A ship in harbor is safe, but that is not what ships are built for.",a:"John A. Shedd"},
    {q:"The only way to do great work is to love what you do.",a:"Steve Jobs"},
    {q:"What we achieve inwardly will change outer reality.",a:"Plutarch"},
    {q:"Comparison is the thief of joy.",a:"Theodore Roosevelt"},
    {q:"The obstacle is the way.",a:"Marcus Aurelius"},
    {q:"Fortune favors the bold.",a:"Virgil"},
    {q:"Not all who wander are lost.",a:"J.R.R. Tolkien"},
    {q:"The best project you'll ever work on is you.",a:""},
    {q:"Be the partner you'd want to have.",a:""},
    {q:"Little by little, one travels far.",a:"J.R.R. Tolkien"},
    {q:"We rise by lifting others.",a:"Robert Ingersoll"},
    {q:"Done is better than perfect.",a:""},
    {q:"If you want to go fast, go alone. If you want to go far, go together.",a:"African Proverb"},
    {q:"Courage is not the absence of fear, but the triumph over it.",a:"Nelson Mandela"},
    {q:"Happiness is not something ready-made. It comes from your own actions.",a:"Dalai Lama"},
    {q:"The way to get started is to quit talking and begin doing.",a:"Walt Disney"}
  ];

  // ── State ──
  var tasks=[],notes=[],groceryItems=[],discussItems=[],bills=[],subs=[];
  var goalsFinancial=[],goalsLife=[],goalsRelationship=[];
  var chores=[],projects=[],plans=[];
  var budget={adam:{paycheckAmount:0,nextPaycheckISO:''},brit:{paycheckAmount:0,nextPaycheckISO:''}};
  var currentTaskFilter='all',currentOwner='adam';
  var expandedNotes={},expandedGoals={};
  var activeUser='',activeUserName='';
  var pinBuffer='',pinMode='',pinSetupValue='';
  var syncTimer=null,syncIntervalId=null,lastSyncedAt=0;
  var localStateUpdatedAt=0,syncInFlight=false,syncBootstrapped=false,pendingSyncPush=false;
  var noteSaveTimer=null,undoItem=null,undoTimer=null;

  function getDeviceId(){var x=localStorage.getItem(DEVICE_KEY);if(x)return x;var id='dev_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(DEVICE_KEY,id);return id;}
  var DEVICE_ID=getDeviceId();

  // ══════════════════════════════════
  // CONFIRM DELETE
  // ══════════════════════════════════
  function confirmDelete(name,callback){
    closeModal();
    var html='<div class="modal-overlay" onclick="OG.closeModal()">'+
      '<div class="modal-sheet" onclick="event.stopPropagation()" style="text-align:center;padding:28px 20px calc(28px + env(safe-area-inset-bottom,0));">'+
        '<div style="font-size:1.1rem;margin-bottom:6px;">Delete '+esc(name)+'?</div>'+
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:20px;">This can\'t be undone.</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;">'+
          '<button class="goal-cancel-btn" onclick="OG.closeModal()" style="flex:1;max-width:140px;padding:12px;">Cancel</button>'+
          '<button class="goal-save-btn" id="confirm-del-btn" style="flex:1;max-width:140px;padding:12px;background:var(--rose);">Delete</button>'+
        '</div>'+
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
    $('confirm-del-btn').onclick=function(){closeModal();callback();};
  }

  // ══════════════════════════════════
  // THEME SYSTEM
  // ══════════════════════════════════
  function getThemeKey(){return THEME_KEY+'_'+(activeUser||'default');}
  function applyTheme(themeId){
    document.documentElement.setAttribute('data-theme',themeId);
    var theme=THEMES.find(function(t){return t.id===themeId;});
    if(theme){var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme.bg;}
    try{localStorage.setItem(getThemeKey(),themeId);}catch(e){}
  }
  function loadTheme(){var saved='';try{saved=localStorage.getItem(getThemeKey());}catch(e){}applyTheme(saved||'warm');}
  function getCurrentTheme(){return document.documentElement.getAttribute('data-theme')||'warm';}

  // ══════════════════════════════════
  // NOTIFICATION PREFERENCES (per user)
  // ══════════════════════════════════
  var NOTIF_PREFS_KEY='ourgrowth_notif_prefs';
  var DEFAULT_PREFS={payday:true,bills:true,events:true,chores:true};
  function getNotifPrefs(){
    var key=NOTIF_PREFS_KEY+'_'+(activeUser||'default');
    try{var raw=localStorage.getItem(key);if(raw)return JSON.parse(raw);}catch(e){}
    return Object.assign({},DEFAULT_PREFS);
  }
  function setNotifPref(type,val){
    var prefs=getNotifPrefs();prefs[type]=val;
    var key=NOTIF_PREFS_KEY+'_'+(activeUser||'default');
    try{localStorage.setItem(key,JSON.stringify(prefs));}catch(e){}
  }

  // ══════════════════════════════════
  // PUSH SUBSCRIPTION
  // ══════════════════════════════════
  var PUSH_SUB_KEY='ourgrowth_push_sub';
  function subscribePush(){
    if(!('serviceWorker' in navigator)||!('PushManager' in window))return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.getSubscription().then(function(sub){
        if(sub)return sub;
        // VAPID public key — replace with yours
        var vapidPublic='if(vapidPublic==='BNV2RDlh5rRXeTraywwxos__4W_xY4qvN40Rsu4Rpue3v6h0SUv5qD4TnTIOMPMAwCQOcuVbePzEAEhyl8Hajc')return null;;
        if(vapidPublic==='if(vapidPublic==='BNV2RDlh5rRXeTraywwxos__4W_xY4qvN40Rsu4Rpue3v6h0SUv5qD4TnTIOMPMAwCQOcuVbePzEAEhyl8Hajc')return null;'){console.log('VAPID key not configured');return null;}
        var key=urlBase64ToUint8Array(vapidPublic);
        return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      });
    }).then(function(sub){
      if(sub){
        // Send subscription to sync worker
        var url=getSyncUrl();if(!url)return sub;
        var pushUrl=url+(url.endsWith('/')?'':'/')+'/push-subscribe'.replace(/^\/+/,'');
        // Clean double slashes
        pushUrl=pushUrl.replace(/([^:]\/)\/+/g,'$1');
        fetch(pushUrl,{
          method:'POST',
          headers:{'Content-Type':'application/json','X-Sync-Token':SYNC_TOKEN},
          body:JSON.stringify({user:activeUser,subscription:sub.toJSON()})
        }).then(function(res){
          if(res.ok)console.log('Push subscription stored for '+activeUser);
          else console.log('Push subscribe failed:',res.status);
        }).catch(function(e){console.log('Push subscribe error:',e);});
      }
      return sub;
    }).catch(function(e){console.log('Push sub failed:',e);return null;});
  }
  function urlBase64ToUint8Array(base64String){
    var padding='='.repeat((4-base64String.length%4)%4);
    var base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    var rawData=window.atob(base64);var outputArray=new Uint8Array(rawData.length);
    for(var i=0;i<rawData.length;++i)outputArray[i]=rawData.charCodeAt(i);
    return outputArray;
  }

  // ══════════════════════════════════
  // SETTINGS MODAL (themes + notification prefs)
  // ══════════════════════════════════
  function openSettings(){
    closeModal();
    var current=getCurrentTheme();
    var swatches=THEMES.map(function(t){
      return'<div class="theme-swatch'+(t.id===current?' active':'')+'" onclick="OG.setTheme(\''+t.id+'\')" style="background:'+t.bg+';border-color:'+(t.id===current?t.accent:'var(--border)')+';"><div class="theme-swatch-dot" style="background:'+t.accent+';"></div><div class="theme-swatch-name" style="color:'+t.text+';">'+t.name+'</div></div>';
    }).join('');

    var prefs=getNotifPrefs();
    function tog(type,label){
      var on=prefs[type];
      return'<label class="notif-pref-row"><span>'+label+'</span><input type="checkbox" '+(on?'checked':'')+' onchange="OG.setNotifPref(\''+type+'\',this.checked)" style="accent-color:var(--accent);width:18px;height:18px;cursor:pointer;"></label>';
    }
    var notifSection=
      '<div style="font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin:20px 0 8px;">Notifications for '+esc(activeUserName||'you')+'</div>'+
      '<div class="card" style="padding:10px 14px;">'+
        tog('payday','Payday alerts')+
        tog('bills','Bill reminders')+
        tog('events','Event reminders')+
        tog('chores','Chore reminders')+
      '</div>'+
      '<div style="font-size:0.67rem;color:var(--text-dim);margin-top:6px;">Push notifications require permission. Tap the 🔔 bell to enable.</div>';

    var html='<div class="modal-overlay" onclick="OG.closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-header"><div class="modal-title">Settings</div><button class="modal-close" onclick="OG.closeModal()">×</button></div>'+
      '<div style="font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Theme for '+esc(activeUserName||'you')+'</div>'+
      '<div class="theme-grid">'+swatches+'</div>'+
      '<div style="font-size:0.67rem;color:var(--text-dim);margin-top:8px;">Each user gets their own theme preference.</div>'+
      notifSection+
    '</div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
  }
  function setTheme(id){applyTheme(id);openSettings();}
  function closeModal(){var existing=document.querySelector('.modal-overlay');if(existing)existing.remove();}

  // ══════════════════════════════════
  // DONE TODAY MODAL (with un-complete)
  // ══════════════════════════════════
  function showDoneToday(){
    closeModal();
    var today=new Date().toDateString();
    var done=tasks.filter(function(t){return t.done&&t.doneAt&&new Date(t.doneAt).toDateString()===today;});
    var body='';
    if(!done.length){body='<div class="empty">No tasks completed today yet</div>';}
    else{body=done.map(function(t){
      var tc={adam:'tag-adam',brit:'tag-brit',home:'tag-home',both:'tag-both'}[t.owner]||'tag-both';
      var ol={adam:'Adam',brit:'Brittany',home:'Home',both:'Together'}[t.owner]||'Together';
      var time=t.doneAt?new Date(t.doneAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';
      return'<div class="task-item" style="cursor:pointer;" onclick="OG.undoComplete(\''+t.id+'\')">'+
        '<div class="task-check done"></div>'+
        '<div style="flex:1;min-width:0;"><div class="task-text done">'+esc(t.text)+'</div>'+
        (time?'<div style="font-size:0.62rem;color:var(--text-dim);margin-top:2px;">Completed at '+time+' · tap to undo</div>':'')+
        '</div><span class="task-tag '+tc+'">'+ol+'</span></div>';
    }).join('');}
    var html='<div class="modal-overlay" onclick="OG.closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-header"><div class="modal-title">Done Today</div><button class="modal-close" onclick="OG.closeModal()">×</button></div><div style="font-size:0.67rem;color:var(--text-muted);margin-bottom:12px;">'+done.length+' task'+(done.length!==1?'s':'')+' completed</div><div class="card">'+body+'</div></div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
  }
  function undoComplete(id){
    var i=findById(tasks,id);if(i<0)return;
    tasks[i].done=false;tasks[i].doneAt=null;
    renderAll();saveAll();showDoneToday();// re-render modal
  }

  // ══════════════════════════════════
  // SYNC (unchanged except buildState/applyState)
  // ══════════════════════════════════
  function getSyncUrl(){var meta=document.querySelector('meta[name="ourgrowth-sync-url"]');if(meta&&meta.content)return meta.content.trim();return'';}
  function setSyncStatus(msg){var el=$('sync-indicator');if(el)el.textContent=msg;}
  function buildState(){return{tasks:tasks,notes:notes,groceryItems:groceryItems,discussItems:discussItems,bills:bills,subs:subs,goalsFinancial:goalsFinancial,goalsLife:goalsLife,goalsRelationship:goalsRelationship,chores:chores,projects:projects,plans:plans,budget:budget};}
  function countState(d){if(!d||typeof d!=='object')return 0;return[d.tasks,d.notes,d.groceryItems,d.discussItems,d.bills,d.subs,d.goalsFinancial,d.goalsLife,d.goalsRelationship,d.chores,d.projects,d.plans].reduce(function(t,a){return t+(Array.isArray(a)?a.length:0);},0);}
  function hasMeaningfulState(d){return countState(d)>0;}
  function applyState(d){
    tasks=ensureIds(Array.isArray(d.tasks)?d.tasks:[],'task');notes=ensureIds(Array.isArray(d.notes)?d.notes:[],'note');
    groceryItems=ensureIds(Array.isArray(d.groceryItems)?d.groceryItems:[],'groc');discussItems=ensureIds(Array.isArray(d.discussItems)?d.discussItems:[],'disc');
    bills=ensureIds(Array.isArray(d.bills)?d.bills:[],'bill');subs=ensureIds(Array.isArray(d.subs)?d.subs:[],'sub');
    goalsFinancial=ensureIds(Array.isArray(d.goalsFinancial)?d.goalsFinancial:[],'gfin');goalsLife=ensureIds(Array.isArray(d.goalsLife)?d.goalsLife:[],'glif');
    goalsRelationship=ensureIds(Array.isArray(d.goalsRelationship)?d.goalsRelationship:[],'grel');chores=ensureIds(Array.isArray(d.chores)?d.chores:[],'chor');
    projects=ensureIds(Array.isArray(d.projects)?d.projects:[],'proj');plans=ensureIds(Array.isArray(d.plans)?d.plans:[],'plan');
    if(d.budget&&typeof d.budget==='object'){budget=d.budget;if(!budget.adam)budget.adam={paycheckAmount:0,nextPaycheckISO:''};if(!budget.brit)budget.brit={paycheckAmount:0,nextPaycheckISO:''};}
  }
  function persistPayload(payload){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}catch(e){}}
  function saveAll(skipSync){localStateUpdatedAt=Date.now();var payload={updatedAt:localStateUpdatedAt,deviceId:DEVICE_ID,data:buildState()};persistPayload(payload);if(!skipSync)queueSyncPush();}
  function loadAll(){try{var raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;var payload=JSON.parse(raw);localStateUpdatedAt=payload.updatedAt||0;applyState(payload.data||payload||{});}catch(e){}}

  function syncPull(){
    var url=getSyncUrl();if(!url||syncInFlight){setSyncStatus(url?'Sync busy…':'Local only');return Promise.resolve();}
    syncInFlight=true;
    return fetch(url,{method:'GET',cache:'no-store',headers:{'X-Sync-Token':SYNC_TOKEN}})
    .then(function(res){if(!res.ok)throw new Error('pull failed');return res.json();})
    .then(function(payload){
      if(!payload||!payload.data){setSyncStatus('Cloud empty');return;}
      var rd=payload.data,rc=countState(rd),ld=buildState(),lc=countState(ld),ru=payload.updatedAt||0;
      if(!rc){setSyncStatus('Cloud empty');return;}
      if(lc>0&&rc<Math.ceil(lc*0.35)&&ru>localStateUpdatedAt){setSyncStatus('Blocked bad sync');return;}
      if(!hasMeaningfulState(ld)&&rc>0){applyState(rd);localStateUpdatedAt=ru;lastSyncedAt=ru;persistPayload({updatedAt:ru,deviceId:payload.deviceId||DEVICE_ID,data:rd});renderAll();setSyncStatus('Recovered cloud data');return;}
      if(ru>localStateUpdatedAt){applyState(rd);localStateUpdatedAt=ru;lastSyncedAt=ru;persistPayload({updatedAt:ru,deviceId:payload.deviceId||DEVICE_ID,data:rd});renderAll();setSyncStatus('Pulled latest');}
      else{setSyncStatus('In sync');}
    }).catch(function(){setSyncStatus('Sync unavailable');})
    .finally(function(){syncInFlight=false;if(!syncBootstrapped){syncBootstrapped=true;if(pendingSyncPush){pendingSyncPush=false;queueSyncPush();}}});
  }
  function syncPushNow(){
    var url=getSyncUrl();if(!url){setSyncStatus('Local only');return;}
    if(!syncBootstrapped){pendingSyncPush=true;setSyncStatus('Waiting for cloud…');return;}
    if(syncInFlight){pendingSyncPush=true;setSyncStatus('Sync busy…');return;}
    syncInFlight=true;
    var payload={updatedAt:localStateUpdatedAt||Date.now(),deviceId:DEVICE_ID,data:buildState()};
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Token':SYNC_TOKEN},body:JSON.stringify(payload)})
    .then(function(res){if(!res.ok)throw new Error('push failed');return res.json();})
    .then(function(saved){lastSyncedAt=saved.updatedAt||payload.updatedAt;localStateUpdatedAt=Math.max(localStateUpdatedAt,lastSyncedAt);setSyncStatus('Changes synced');})
    .catch(function(){setSyncStatus('Saved locally');})
    .finally(function(){syncInFlight=false;if(pendingSyncPush){pendingSyncPush=false;queueSyncPush();}});
  }
  function queueSyncPush(){clearTimeout(syncTimer);syncTimer=setTimeout(syncPushNow,500);}
  function startSyncLoop(){if(!getSyncUrl()){setSyncStatus('Local only');syncBootstrapped=true;return;}setSyncStatus('Cloud sync enabled');syncPull();if(syncIntervalId)clearInterval(syncIntervalId);syncIntervalId=setInterval(syncPull,SYNC_POLL_MS);}
  window.addEventListener('storage',function(e){
    if(e.key===STORAGE_KEY&&e.newValue){try{var payload=JSON.parse(e.newValue);var changedAt=payload.updatedAt||0;var incomingData=payload.data||{};if(changedAt>localStateUpdatedAt){if(countState(buildState())>0&&countState(incomingData)<Math.ceil(countState(buildState())*0.5))return;localStateUpdatedAt=changedAt;applyState(incomingData);renderAll();}}catch(err){}}
  });

  // ══════════════════════════════════
  // PIN AUTH
  // ══════════════════════════════════
  function initPin(){
    var session=localStorage.getItem(SESSION_KEY);
    if(session){try{var s=JSON.parse(session);if(s&&s.expiresAt&&Date.now()<s.expiresAt){activeUser=s.user;activeUserName=s.name;loadTheme();unlock(true);return;}localStorage.removeItem(SESSION_KEY);}catch(e){localStorage.removeItem(SESSION_KEY);}}
    loadTheme();$('lock-step-user').style.display='';$('lock-step-pin').style.display='none';
  }
  function selectUser(user){
    activeUser=user;activeUserName=user==='adam'?'Adam':'Brittany';
    loadTheme();
    var pinKey=user==='adam'?PIN_KEY_ADAM:PIN_KEY_BRIT;var hasPin=localStorage.getItem(pinKey);
    $('lock-step-user').style.display='none';$('lock-step-pin').style.display='';
    pinBuffer='';updateDots();$('pin-error').innerHTML='&nbsp;';
    if(!hasPin){pinMode='setup';$('lock-label').textContent=activeUserName+' — create your PIN';}
    else{pinMode='check';$('lock-label').textContent='Hey '+activeUserName+' — enter PIN';}
  }
  function pinBack(){pinBuffer='';pinSetupValue='';updateDots();$('pin-error').innerHTML='&nbsp;';$('lock-step-user').style.display='';$('lock-step-pin').style.display='none';}
  function pinInput(digit){if(pinBuffer.length>=4)return;pinBuffer+=digit;updateDots();if(pinBuffer.length===4)setTimeout(pinSubmit,150);}
  function pinBackspace(){pinBuffer=pinBuffer.slice(0,-1);updateDots();$('pin-error').innerHTML='&nbsp;';}
  function updateDots(){for(var i=0;i<4;i++)$('dot-'+i).className='pin-dot'+(i<pinBuffer.length?' filled':'');}
  function pinSubmit(){
    var pinKey=activeUser==='adam'?PIN_KEY_ADAM:PIN_KEY_BRIT;
    if(pinMode==='setup'){pinSetupValue=pinBuffer;pinBuffer='';updateDots();pinMode='confirm';$('lock-label').textContent='Confirm your PIN, '+activeUserName;$('pin-error').innerHTML='&nbsp;';}
    else if(pinMode==='confirm'){if(pinBuffer===pinSetupValue){localStorage.setItem(pinKey,hashPin(pinBuffer));unlock();}else{pinWrong("Didn't match — try again");pinMode='setup';pinSetupValue='';$('lock-label').textContent=activeUserName+' — create your PIN';}}
    else{if(hashPin(pinBuffer)===localStorage.getItem(pinKey))unlock();else pinWrong('Wrong PIN');}
  }
  function pinWrong(msg){$('pin-error').textContent=msg;for(var i=0;i<4;i++)$('dot-'+i).className='pin-dot wrong';pinBuffer='';setTimeout(updateDots,500);}
  function unlock(skipWrite){
    $('lock-screen').classList.add('unlocked');$('app').style.display='';
    if(!skipWrite)localStorage.setItem(SESSION_KEY,JSON.stringify({user:activeUser,name:activeUserName,expiresAt:Date.now()+SESSION_MS}));
    updateGreeting();initNotifications();
    // Auto-subscribe to push if permission already granted
    if('Notification' in window&&Notification.permission==='granted')subscribePush();
  }
  function updateGreeting(){
    var h=new Date().getHours();var timeWord=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    $('dash-greeting').textContent=timeWord;
    $('dash-greeting-name').innerHTML=activeUserName?esc(activeUserName):'Adam <em>&amp;</em><br>Brittany';
  }

  // ══════════════════════════════════
  // UNDO (12 second timer)
  // ══════════════════════════════════
  function showUndo(label,collection,item){
    clearTimeout(undoTimer);var existing=document.querySelector('.undo-toast');if(existing)existing.remove();
    undoItem={collection:collection,item:item};
    var el=document.createElement('div');el.className='undo-toast';
    el.innerHTML=esc(label)+' deleted <button onclick="OG.doUndo()">Undo</button>';
    document.body.appendChild(el);
    undoTimer=setTimeout(function(){el.remove();undoItem=null;},12000);
  }
  function doUndo(){
    if(!undoItem)return;var col=undoItem.collection,item=undoItem.item;
    if(col==='tasks')tasks.unshift(item);else if(col==='bills')bills.push(item);else if(col==='subs')subs.push(item);
    else if(col==='chores')chores.push(item);else if(col==='projects')projects.push(item);else if(col==='plans')plans.push(item);
    else if(col==='notes')notes.unshift(item);else if(col==='groceryItems')groceryItems.push(item);else if(col==='discussItems')discussItems.push(item);
    else if(col==='goalsFinancial')goalsFinancial.push(item);else if(col==='goalsLife')goalsLife.push(item);else if(col==='goalsRelationship')goalsRelationship.push(item);
    undoItem=null;clearTimeout(undoTimer);var toast=document.querySelector('.undo-toast');if(toast)toast.remove();
    renderAll();saveAll();
  }

  // ══════════════════════════════════
  // NAV
  // ══════════════════════════════════
  function navTo(id){
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
    $('page-'+id).classList.add('active');var b=$('nav-'+id);if(b)b.classList.add('active');window.scrollTo(0,0);
  }
  function setOwner(owner,btn){currentOwner=owner;document.querySelectorAll('.owner-pill').forEach(function(p){p.className='owner-pill';});btn.classList.add('sel-'+owner);}

  // ══════════════════════════════════
  // TASKS
  // ══════════════════════════════════
  function taskDueBadge(t){
    if(!t.dueISO)return'';var diff=daysDiff(t.dueISO);
    var fmt=new Date(t.dueISO).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    if(diff<0)return'<span class="task-due-badge due-urgent">⚠ '+fmt+'</span>';if(diff===0)return'<span class="task-due-badge due-urgent">Today</span>';
    if(diff===1)return'<span class="task-due-badge due-soon">Tomorrow</span>';if(diff<=7)return'<span class="task-due-badge due-soon">'+fmt+'</span>';
    return'<span class="task-due-badge due-ok">'+fmt+'</span>';
  }
  function toggleTaskNotes(id,event){event.stopPropagation();expandedNotes[id]=!expandedNotes[id];renderTasks();}
  function saveTaskNote(id,val){var i=findById(tasks,id);if(i>=0){tasks[i].notes=val;clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(function(){saveAll();},800);}}
  function renderTasks(){
    var list=$('task-list');var all=currentTaskFilter==='all'?tasks:tasks.filter(function(t){return t.owner===currentTaskFilter;});
    var src=all.filter(function(t){return!t.done;});
    if(!src.length){list.innerHTML=all.length?'<div class="empty">All done! 🎉</div>':'<div class="empty">No tasks here — add one below</div>';return;}
    list.innerHTML=src.map(function(t){
      var id=t.id;var tc={adam:'tag-adam',brit:'tag-brit',home:'tag-home',both:'tag-both'}[t.owner]||'tag-both';
      var ol={adam:'Adam',brit:'Brittany',home:'Home',both:'Together'}[t.owner]||'Together';
      var noteSection=expandedNotes[id]?'<div style="width:100%;padding:4px 10px 8px 44px;"><textarea class="task-notes-input" placeholder="Add a note…" oninput="OG.saveTaskNote(\''+id+'\',this.value)">'+esc(t.notes||'')+'</textarea></div>':'';
      return'<div class="task-item" id="tr-'+id+'" style="flex-wrap:wrap;">'+
        '<div class="task-check" onclick="OG.toggleTask(\''+id+'\')"></div>'+
        '<div class="task-text" onclick="OG.toggleTask(\''+id+'\')">'+esc(t.text)+'</div>'+
        taskDueBadge(t)+'<span class="task-tag '+tc+'">'+ol+'</span>'+
        '<button class="task-note-btn'+(t.notes?' has-note':'')+'" onclick="OG.toggleTaskNotes(\''+id+'\',event)" title="Notes">📝</button>'+
        '<button class="edit-btn" onclick="event.stopPropagation();OG.editTask(\''+id+'\')" title="Edit">✏️</button>'+
        '<button class="del-btn" onclick="event.stopPropagation();OG.deleteTask(\''+id+'\')">×</button>'+
        noteSection+'</div>';
    }).join('');
  }
  function renderTaskPreview(){
    var el=$('dash-task-preview');var open=tasks.filter(function(t){return!t.done;}).slice(0,3);
    if(!open.length){el.innerHTML=tasks.length?'<div class="empty">All done! 🎉</div>':'<div class="empty">Add tasks to see them here</div>';return;}
    el.innerHTML=open.map(function(t){
      var tc={adam:'tag-adam',brit:'tag-brit',home:'tag-home',both:'tag-both'}[t.owner]||'tag-both';
      var ol={adam:'Adam',brit:'Brittany',home:'Home',both:'Together'}[t.owner]||'Together';
      return'<div class="task-item" onclick="OG.toggleTask(\''+t.id+'\')"><div class="task-check"></div><div class="task-text">'+esc(t.text)+'</div>'+taskDueBadge(t)+'<span class="task-tag '+tc+'">'+ol+'</span></div>';
    }).join('');
  }
  function filterTasks(owner,btn){currentTaskFilter=owner;document.querySelectorAll('#task-tabs .tab-pill').forEach(function(p){p.classList.remove('active');});btn.classList.add('active');renderTasks();}
  function toggleTask(id){
    var i=findById(tasks,id);if(i<0)return;var wasDone=tasks[i].done;tasks[i].done=!wasDone;tasks[i].doneAt=tasks[i].done?new Date().toISOString():null;
    if(!wasDone){var row=$('tr-'+id);if(row){row.style.transition='opacity 0.35s, transform 0.35s';var chk=row.querySelector('.task-check');if(chk)chk.classList.add('done');row.style.opacity='0';row.style.transform='translateX(24px)';setTimeout(function(){renderTasks();renderTaskPreview();updateDashStats();},380);saveAll();return;}}
    renderTasks();renderTaskPreview();updateDashStats();saveAll();
  }
  function deleteTask(id){var removed=removeById(tasks,id);if(removed)showUndo(removed.text,'tasks',removed);renderTasks();renderTaskPreview();updateDashStats();saveAll();}
  function editTask(id){
    var i=findById(tasks,id);if(i<0)return;var t=tasks[i];var row=$('tr-'+id);if(!row||row.querySelector('.edit-inline'))return;
    var dueVal=t.dueISO?new Date(t.dueISO).toISOString().split('T')[0]:'';
    var form=document.createElement('div');form.className='edit-inline';form.style.width='100%';
    form.innerHTML='<div class="add-row" style="flex-wrap:wrap;gap:8px;margin:0"><input class="add-input" id="edit-task-text-'+id+'" value="'+esc(t.text)+'" style="flex:1;min-width:140px;"><input class="add-input" type="date" id="edit-task-due-'+id+'" value="'+dueVal+'" style="max-width:148px;"></div><div class="edit-actions"><button class="goal-cancel-btn" onclick="OG.renderTasks()">Cancel</button><button class="goal-save-btn" onclick="OG.saveTaskEdit(\''+id+'\')">Save</button></div>';
    row.appendChild(form);$('edit-task-text-'+id).focus();
  }
  function saveTaskEdit(id){var i=findById(tasks,id);if(i<0)return;var textEl=$('edit-task-text-'+id),dueEl=$('edit-task-due-'+id);if(textEl&&textEl.value.trim())tasks[i].text=textEl.value.trim();if(dueEl)tasks[i].dueISO=dueEl.value?new Date(dueEl.value+'T12:00:00').toISOString():'';renderTasks();renderTaskPreview();saveAll();}
  function addTask(){var input=$('task-input'),text=input.value.trim(),dueIn=$('task-due-in')?$('task-due-in').value:'';if(!text)return;var dueISO=dueIn?new Date(dueIn+'T12:00:00').toISOString():'';tasks.unshift({id:uid('task'),text:text,owner:currentOwner,done:false,doneAt:null,createdAt:new Date().toISOString(),dueISO:dueISO,notes:''});input.value='';if($('task-due-in'))$('task-due-in').value='';renderTasks();renderTaskPreview();updateDashStats();saveAll();}

  // ══════════════════════════════════
  // DASHBOARD STATS
  // ══════════════════════════════════
  function updateDashStats(){
    var today=new Date().toDateString();
    var doneToday=tasks.filter(function(t){return t.done&&t.doneAt&&new Date(t.doneAt).toDateString()===today;}).length;
    $('dash-tasks-open').textContent=tasks.filter(function(t){return!t.done;}).length;
    $('dash-tasks-done').textContent=doneToday;
    renderDashToday();renderDashRecap();
  }
  function renderDashToday(){
    var el=$('dash-today');if(!el)return;
    var items=[];
    // Tasks
    tasks.filter(function(t){return!t.done&&t.dueISO;}).forEach(function(t){
      var diff=daysDiff(t.dueISO);
      if(diff<0)items.push({dot:'red',label:esc(t.text),cat:'Task overdue'});
      else if(diff===0)items.push({dot:'red',label:esc(t.text),cat:'Task due today'});
      else if(diff===1)items.push({dot:'amber',label:esc(t.text),cat:'Task due tomorrow'});
    });
    // Chores
    chores.forEach(function(ch){
      if(!ch.nextDueISO)return;var diff=daysDiff(ch.nextDueISO);
      if(diff<0)items.push({dot:'red',label:esc(ch.text),cat:'Chore overdue'});
      else if(diff===0)items.push({dot:'red',label:esc(ch.text),cat:'Chore due today'});
      else if(diff===1)items.push({dot:'amber',label:esc(ch.text),cat:'Chore due tomorrow'});
    });
    // Bills
    bills.filter(function(b){return!b.paid&&b.dueISO;}).forEach(function(b){
      var diff=daysDiff(b.dueISO);var lbl=esc(b.name)+' · $'+Number(b.amount||0).toFixed(0);
      if(diff<0)items.push({dot:'red',label:lbl,cat:'Bill overdue'});
      else if(diff===0)items.push({dot:'amber',label:lbl,cat:'Bill due today'});
      else if(diff===1)items.push({dot:'amber',label:lbl,cat:'Bill due tomorrow'});
      else if(diff<=3)items.push({dot:'amber',label:lbl,cat:'Bill due in '+diff+' days'});
    });
    // Events (TODAY fixed with daysDiff)
    plans.forEach(function(p){
      if(!p.dateISO)return;var diff=daysDiff(p.dateISO);
      if(diff===0)items.push({dot:'green',label:esc(p.title),cat:'Event today'});
      else if(diff===1)items.push({dot:'green',label:esc(p.title),cat:'Event tomorrow'});
    });
    if(!items.length){el.innerHTML='<div class="empty">Nothing urgent today 🌿</div>';return;}
    el.innerHTML=items.map(function(it){return'<div class="today-item"><div class="today-dot '+it.dot+'"></div><div class="today-label">'+it.label+'<div class="today-cat">'+it.cat+'</div></div></div>';}).join('');
  }
  function renderDashRecap(){
    var now=new Date(),todayS=now.toDateString();var weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
    var doneToday=tasks.filter(function(t){return t.done&&t.doneAt&&new Date(t.doneAt).toDateString()===todayS;}).length;
    var doneWeek=tasks.filter(function(t){return t.done&&t.doneAt&&new Date(t.doneAt)>=weekStart;}).length;
    var choresToday=chores.filter(function(ch){return ch.lastDoneISO&&new Date(ch.lastDoneISO).toDateString()===todayS;}).length;
    var billsPaid=bills.filter(function(b){return b.paid;}).length;
    var r=function(id,v){var el=$(id);if(el)el.textContent=v;};
    r('recap-done-today',doneToday);r('recap-chores-today',choresToday);r('recap-done-week',doneWeek);r('recap-bills-paid',billsPaid);
  }

  // ══════════════════════════════════
  // BILLS (with confirm delete)
  // ══════════════════════════════════
  function billDaysUntil(b){return daysDiff(b.dueISO);}
  function billUrgencyClass(b){if(b.paid)return'bill-paid';var d=billDaysUntil(b);if(d<=1)return'bill-due';if(d<=7)return'bill-approaching';return'bill-good';}
  function billStatusLabel(b){
    if(b.paid){var suffix=b.recurring&&b.dueISO?' · Next: '+new Date(b.dueISO).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';return'Paid ✓'+suffix;}
    var d=billDaysUntil(b);var fmt=b.dueISO?new Date(b.dueISO).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
    if(d<0)return'⚠ Overdue '+Math.abs(d)+'d';if(d===0)return'Due Today';if(d===1)return'Due Tomorrow';if(d<=7)return'Approaching · '+fmt;return'Good · '+fmt;
  }
  function checkBillAutoReset(){var changed=false;bills.forEach(function(b){if(b.paid&&b.recurring&&b.dueISO){var diff=daysDiff(b.dueISO);if(diff<=0){b.paid=false;changed=true;}}});if(changed)saveAll();}
  function renderBills(){
    checkBillAutoReset();var list=$('bills-list');if(!bills.length){list.innerHTML='<div class="empty">No bills yet — add one below</div>';return;}
    var sorted=bills.slice().sort(function(a,b){if(a.paid&&!b.paid)return 1;if(!a.paid&&b.paid)return-1;return billDaysUntil(a)-billDaysUntil(b);});
    list.innerHTML=sorted.map(function(b){var id=b.id,urg=billUrgencyClass(b);return'<div class="bill-item '+urg+'"><div style="flex:1;min-width:0;"><div class="bill-name">'+esc(b.name)+(b.recurring?'<span class="bill-recurring-tag">recurring</span>':'')+'</div><div class="bill-sub">'+billStatusLabel(b)+'</div></div><div class="bill-amount">$'+Number(b.amount||0).toFixed(0)+'</div><button class="bill-status-btn" onclick="OG.toggleBillPaid(\''+id+'\')">'+(b.paid?'Paid':'Mark Paid')+'</button><button class="edit-btn" onclick="OG.editBill(\''+id+'\')" title="Edit">✏️</button><button class="del-btn" onclick="OG.deleteBill(\''+id+'\')">×</button></div>';}).join('');
  }
  function toggleBillPaid(id){var i=findById(bills,id);if(i<0)return;var b=bills[i];b.paid=!b.paid;if(b.paid&&b.recurring&&b.dueISO){var next=new Date(b.dueISO);next.setMonth(next.getMonth()+1);b.dueISO=next.toISOString();}renderBills();saveAll();}
  function deleteBill(id){var i=findById(bills,id);if(i<0)return;var b=bills[i];confirmDelete(b.name,function(){removeById(bills,id);renderBills();saveAll();});}
  function editBill(id){var i=findById(bills,id);if(i<0)return;var b=bills[i];var text=prompt('Bill name:',b.name);if(text===null)return;if(text.trim())b.name=text.trim();var amt=prompt('Amount:',b.amount);if(amt!==null)b.amount=parseFloat(amt)||0;renderBills();saveAll();}
  function addBill(){var name=$('bill-name-in').value.trim(),amt=$('bill-amt-in').value.trim(),dueIn=$('bill-due-in').value;var recurEl=$('bill-recurring-in'),recurring=recurEl?recurEl.checked:false;if(!name)return;var dueISO=dueIn?new Date(dueIn+'T12:00:00').toISOString():'';bills.push({id:uid('bill'),name:name,amount:parseFloat(amt)||0,dueISO:dueISO,paid:false,recurring:recurring});$('bill-name-in').value='';$('bill-amt-in').value='';$('bill-due-in').value='';if(recurEl)recurEl.checked=false;renderBills();saveAll();}

  // ══════════════════════════════════
  // MONEY TAB (no subs tab)
  // ══════════════════════════════════
  function moneyTab(tab,btn){document.querySelectorAll('#page-money .tab-pill').forEach(function(p){p.classList.remove('active');});btn.classList.add('active');['bills','budget','mgoals'].forEach(function(t){$('money-'+t).style.display=t===tab?'block':'none';});if(tab==='mgoals')renderSavingsGoals();if(tab==='budget')renderBudgetTab();}
  function renderSavingsGoals(){var list=$('savings-list');if(!goalsFinancial.length){list.innerHTML='<div class="empty">Add goals in the Goals tab</div>';return;}list.innerHTML=goalsFinancial.map(function(g){var pct=g.target>0?Math.min(100,Math.round(g.current/g.target*100)):0;var unit=g.unit||'$';var fmtC=unit==='$'?('$'+Number(g.current).toLocaleString()):(Number(g.current).toLocaleString()+' '+esc(unit));var fmtT=unit==='$'?('$'+Number(g.target).toLocaleString()):(Number(g.target).toLocaleString()+' '+esc(unit));return'<div class="goal-item"><div class="goal-top"><span class="goal-name">'+esc(g.name)+'</span><span class="goal-pct">'+pct+'%</span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:'+pct+'%"></div></div><div class="goal-meta"><span>'+fmtC+' of '+fmtT+'</span></div></div>';}).join('');}

  // ══════════════════════════════════
  // GOALS (with confirm delete, non-$ defaults for life/relationship)
  // ══════════════════════════════════
  function addGoal(){
    var name=$('goal-name-in').value.trim(),cat=$('goal-cat-in').value;
    var current=parseFloat($('goal-current-in').value)||0;var target=parseFloat($('goal-target-in').value)||0;
    var defaultUnit=cat==='financial'?'$':'';
    var unit=$('goal-unit-in').value.trim()||defaultUnit;
    if(!name)return;var g={id:uid('g'+cat.charAt(0)),name:name,current:current,target:target,unit:unit};
    if(cat==='financial')goalsFinancial.push(g);else if(cat==='life')goalsLife.push(g);else goalsRelationship.push(g);
    $('goal-name-in').value='';$('goal-current-in').value='';$('goal-target-in').value='';$('goal-unit-in').value='';renderGoalsAll();renderDashGoals();saveAll();
  }
  function updateGoalLabels(){
    var cat=$('goal-cat-in').value;
    if(cat==='financial')$('goal-unit-in').placeholder='Unit ($)';
    else if(cat==='life')$('goal-unit-in').placeholder='Unit (books, miles, habits…)';
    else $('goal-unit-in').placeholder='Unit (dates, trips, things…)';
  }
  function toggleGoalEdit(catKey,id){expandedGoals[id]=!expandedGoals[id];renderGoalsAll();}
  function saveGoalEdit(catKey,id){var arr=catKey==='financial'?goalsFinancial:catKey==='life'?goalsLife:goalsRelationship;var i=findById(arr,id);if(i<0)return;var g=arr[i];var nameEl=$('gedit-name-'+id),curEl=$('gedit-cur-'+id),tgtEl=$('gedit-tgt-'+id),unitEl=$('gedit-unit-'+id);if(!nameEl||!curEl||!tgtEl||!unitEl)return;if(nameEl.value.trim())g.name=nameEl.value.trim();g.current=parseFloat(curEl.value)||0;g.target=parseFloat(tgtEl.value)||0;g.unit=unitEl.value.trim()||(catKey==='financial'?'$':'');delete expandedGoals[id];renderGoalsAll();renderDashGoals();renderSavingsGoals();saveAll();}
  function cancelGoalEdit(id){delete expandedGoals[id];renderGoalsAll();}
  function deleteGoal(catKey,id){
    var arr=catKey==='financial'?goalsFinancial:catKey==='life'?goalsLife:goalsRelationship;
    var i=findById(arr,id);if(i<0)return;var g=arr[i];
    confirmDelete(g.name,function(){removeById(arr,id);renderGoalsAll();renderDashGoals();saveAll();});
  }
  function milestonePips(pct){return'<div class="goal-milestones">'+[25,50,75,100].map(function(m){var r=pct>=m;return'<div class="milestone-pip'+(r?(' reached'+(m===100?' full':'')):'')+'">'+m+'%</div>';}).join('')+'</div>';}
  function renderGoalSection(elId,arr,cls,catKey){
    var el=$(elId);if(!arr.length){el.innerHTML='<div class="empty">No goals yet</div>';return;}
    el.innerHTML=arr.map(function(g){
      var id=g.id;var pct=g.target>0?Math.min(100,Math.round(g.current/g.target*100)):0;
      var unit=g.unit||(catKey==='financial'?'$':'');
      function fmtVal(v){return unit==='$'?('$'+Number(v).toLocaleString()):(Number(v).toLocaleString()+' '+esc(unit));}
      var isEditing=!!expandedGoals[id];
      var editForm=isEditing?('<div class="goal-edit-form"><div class="goal-edit-row"><input class="add-input" style="flex:1;min-width:120px;" id="gedit-name-'+id+'" value="'+esc(g.name)+'" placeholder="Goal name"></div><div class="goal-edit-row"><input class="add-input" style="flex:1;" type="number" inputmode="decimal" id="gedit-cur-'+id+'" value="'+g.current+'" placeholder="Current"><input class="add-input" style="flex:1;" type="number" inputmode="decimal" id="gedit-tgt-'+id+'" value="'+g.target+'" placeholder="Target"><input class="add-input" style="max-width:88px;" id="gedit-unit-'+id+'" value="'+esc(unit)+'" placeholder="Unit"></div><div class="goal-edit-actions"><button class="goal-cancel-btn" onclick="OG.cancelGoalEdit(\''+id+'\')">Cancel</button><button class="goal-save-btn" onclick="OG.saveGoalEdit(\''+catKey+'\',\''+id+'\')">Save</button></div></div>'):'';
      return'<div class="goal-item"><div class="goal-top"><span class="goal-name">'+esc(g.name)+'</span><span style="display:flex;align-items:center;gap:8px;"><button class="mini-btn" onclick="OG.toggleGoalEdit(\''+catKey+'\',\''+id+'\')">'+(isEditing?'Close':'Edit')+'</button><span class="goal-pct">'+pct+'%</span><button class="del-btn" onclick="OG.deleteGoal(\''+catKey+'\',\''+id+'\')">×</button></span></div><div class="goal-bar-track"><div class="goal-bar-fill '+cls+'" style="width:'+pct+'%"></div></div><div class="goal-meta"><span>'+fmtVal(g.current)+' of '+fmtVal(g.target)+'</span></div>'+milestonePips(pct)+editForm+'</div>';
    }).join('');
  }
  function renderGoalsAll(){renderGoalSection('goals-financial',goalsFinancial,'','financial');renderGoalSection('goals-life',goalsLife,'green','life');renderGoalSection('goals-relationship',goalsRelationship,'rose','relationship');}
  function renderDashGoals(){var el=$('dash-goals-preview');var all=[].concat(goalsFinancial,goalsLife,goalsRelationship).slice(0,2);if(!all.length){el.innerHTML='<div class="empty">Add goals to track progress</div>';return;}el.innerHTML=all.map(function(g){var pct=g.target>0?Math.min(100,Math.round(g.current/g.target*100)):0;return'<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:0.82rem;">'+esc(g.name)+'</span><span style="font-family:\'Cormorant Garamond\',serif;color:var(--accent);">'+pct+'%</span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:'+pct+'%"></div></div></div>';}).join('');}

  // ══════════════════════════════════
  // NOTES / GROCERY / DISCUSS
  // ══════════════════════════════════
  function notesTab(tab,btn){document.querySelectorAll('#page-notes .tab-pill').forEach(function(p){p.classList.remove('active');});btn.classList.add('active');['quick','grocery','discuss'].forEach(function(t){$('notes-'+t).style.display=t===tab?'block':'none';});}
  function renderNotes(){var list=$('notes-list');if(!notes.length){list.innerHTML='<div class="empty">Tap below to add a note</div>';return;}list.innerHTML=notes.map(function(n){var id=n.id;return'<div class="note-card"><textarea placeholder="Write something…" oninput="OG.saveNoteText(\''+id+'\',this.value)">'+esc(n.text)+'</textarea><div class="note-footer"><span class="note-time">'+esc(n.time)+'</span><span class="note-del" onclick="OG.deleteNote(\''+id+'\')">remove</span></div></div>';}).join('');}
  function saveNoteText(id,val){var i=findById(notes,id);if(i>=0){notes[i].text=val;clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(function(){saveAll();},800);}}
  function deleteNote(id){var removed=removeById(notes,id);if(removed)showUndo('Note','notes',removed);renderNotes();saveAll();}
  function addNote(){var now=new Date();var time=now.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · '+now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});notes.unshift({id:uid('note'),text:'',time:time});renderNotes();saveAll();var ta=document.querySelector('.note-card textarea');if(ta)ta.focus();}
  function renderGrocery(){var list=$('grocery-list');if(!groceryItems.length){list.innerHTML='<div class="empty">List is clear</div>';return;}list.innerHTML=groceryItems.map(function(item){var id=item.id;return'<div class="task-item" onclick="OG.toggleGrocery(\''+id+'\')"><div class="task-check'+(item.checked?' done':'')+'"></div><div class="task-text'+(item.checked?' done':'')+'">'+esc(item.text)+'</div><button class="del-btn" onclick="event.stopPropagation();OG.deleteGrocery(\''+id+'\')">×</button></div>';}).join('');}
  function toggleGrocery(id){var i=findById(groceryItems,id);if(i>=0){groceryItems[i].checked=!groceryItems[i].checked;renderGrocery();saveAll();}}
  function deleteGrocery(id){var removed=removeById(groceryItems,id);if(removed)showUndo(removed.text,'groceryItems',removed);renderGrocery();saveAll();}
  function addGrocery(){var inp=$('grocery-in'),v=inp.value.trim();if(!v)return;groceryItems.push({id:uid('groc'),text:v,checked:false});inp.value='';renderGrocery();saveAll();}
  function renderDiscuss(){var list=$('discuss-list');if(!discussItems.length){list.innerHTML='<div class="empty">Nothing to discuss yet</div>';return;}list.innerHTML=discussItems.map(function(item){var id=item.id;return'<div class="task-item" onclick="OG.toggleDiscuss(\''+id+'\')"><div class="task-check'+(item.checked?' done':'')+'"></div><div class="task-text'+(item.checked?' done':'')+'">'+esc(item.text)+'</div><button class="del-btn" onclick="event.stopPropagation();OG.deleteDiscuss(\''+id+'\')">×</button></div>';}).join('');}
  function toggleDiscuss(id){var i=findById(discussItems,id);if(i>=0){discussItems[i].checked=!discussItems[i].checked;renderDiscuss();saveAll();}}
  function deleteDiscuss(id){var removed=removeById(discussItems,id);if(removed)showUndo(removed.text,'discussItems',removed);renderDiscuss();saveAll();}
  function addDiscuss(){var inp=$('discuss-in'),v=inp.value.trim();if(!v)return;discussItems.push({id:uid('disc'),text:v,checked:false});inp.value='';renderDiscuss();saveAll();}

  // ══════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════
  var notifPermission='default';
  function initNotifications(){if(!('Notification' in window))return;notifPermission=Notification.permission;checkReminders(false);setInterval(function(){checkReminders(false);},60*60*1000);}
  function onBellClick(){if(!('Notification' in window)){showToast('Not supported','Your browser does not support notifications.','info');return;}if(Notification.permission==='default'){Notification.requestPermission().then(function(p){notifPermission=p;if(p==='granted'){showToast('Reminders on','You\'ll get alerts for payday, bills, chores, and events.','info');subscribePush();checkReminders(true);}});}else{if(Notification.permission==='granted')subscribePush();checkReminders(true);}}
  function checkReminders(force){var alerts=gatherAlerts();var bell=$('notif-bell');if(bell)bell.classList.toggle('has-alerts',alerts.length>0);if(!force&&!alerts.length)return;if(force&&!alerts.length){showToast('All clear ✓','Nothing urgent right now.','info');return;}if(force){alerts.forEach(function(a){showToast(a.title,a.body,a.type);});}else if(Notification.permission==='granted'){alerts.forEach(function(a){try{new Notification(a.title,{body:a.body});}catch(e){}});}}
  function gatherAlerts(){
    var alerts=[];var prefs=getNotifPrefs();
    // Payday
    if(prefs.payday){
      ['adam','brit'].forEach(function(p){
        autoAdvancePaycheck(p);
        var days=daysUntilPaycheck(p);
        if(days===0){
          var billsDue=bills.filter(function(b){return!b.paid&&b.dueISO&&daysDiff(b.dueISO)>=0&&daysDiff(b.dueISO)<=14;});
          var totalDue=billsDue.reduce(function(t,b){return t+parseFloat(b.amount||0);},0);
          var name=p==='adam'?'Adam':'Brittany';
          alerts.push({title:'💸 It\'s Payday!',body:name+'\'s paycheck'+(totalDue>0?' · '+billsDue.length+' bills totalling $'+totalDue.toFixed(0)+' this check':''),type:'info'});
        }
      });
    }
    // Bills
    if(prefs.bills){
      bills.forEach(function(b){if(b.paid||!b.dueISO)return;var diff=daysDiff(b.dueISO);
        if(diff<0)alerts.push({title:'⚠ Bill Overdue',body:b.name+' ($'+Number(b.amount||0).toFixed(0)+')',type:'warning'});
        else if(diff===0)alerts.push({title:'🔴 Bill Due Today',body:b.name+' · $'+Number(b.amount||0).toFixed(0),type:'warning'});
        else if(diff===1)alerts.push({title:'🟠 Bill Due Tomorrow',body:b.name+' · $'+Number(b.amount||0).toFixed(0),type:'warning'});
        else if(diff<=3)alerts.push({title:'🟡 Bill Due Soon',body:b.name+' in '+diff+' days',type:'info'});
      });
    }
    // Chores
    if(prefs.chores){
      chores.forEach(function(c){if(!c.nextDueISO)return;var diff=daysDiff(c.nextDueISO);
        if(diff<0)alerts.push({title:'🧹 Chore Overdue',body:c.text,type:'warning'});
        else if(diff===0)alerts.push({title:'🧹 Chore Due Today',body:c.text,type:'info'});
      });
    }
    // Events
    if(prefs.events){
      plans.forEach(function(p){if(!p.dateISO)return;var diff=daysDiff(p.dateISO);
        if(diff===0)alerts.push({title:'📅 Event Today',body:p.title,type:'info'});
        else if(diff===1)alerts.push({title:'📅 Event Tomorrow',body:p.title,type:'info'});
      });
    }
    return alerts;
  }
  function showToast(title,body,type){var stack=$('toast-stack');if(!stack)return;var t=document.createElement('div');t.className='toast '+(type||'info');t.innerHTML='<div class="toast-title">'+esc(title)+'</div><div class="toast-body">'+esc(body)+'</div>';stack.appendChild(t);setTimeout(function(){t.style.animation='toastOut 0.3s ease forwards';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},320);},4500);t.onclick=function(){if(t.parentNode)t.parentNode.removeChild(t);};}

  // ══════════════════════════════════
  // PLANS (with confirm delete, fixed timezone)
  // ══════════════════════════════════
  function advanceRecurringPlans(){var changed=false;plans.forEach(function(p){if(!p.recurring||!p.dateISO)return;var diff=daysDiff(p.dateISO);if(diff<0){var due=new Date(p.dateISO);due.setFullYear(due.getFullYear()+1);p.dateISO=due.toISOString();p.day=due.getDate().toString();p.mon=due.toLocaleDateString('en-US',{month:'short'}).toUpperCase();changed=true;}});if(changed)saveAll();}
  function renderPlans(){advanceRecurringPlans();var list=$('plans-list');if(!plans.length){list.innerHTML='<div class="empty">No events yet</div>';return;}var sorted=plans.slice().sort(function(a,b){return new Date(a.dateISO||0)-new Date(b.dateISO||0);});list.innerHTML=sorted.map(function(p){var id=p.id;return'<div class="event-item"><div class="event-date-block"><div class="event-day">'+esc(p.day)+'</div><div class="event-mon">'+esc(p.mon)+'</div></div><div style="flex:1;min-width:0;"><div class="event-title">'+esc(p.title)+'</div>'+(p.note?'<div class="event-desc">'+esc(p.note)+'</div>':'')+(p.recurring?'<span class="event-recurring">↻ yearly</span>':'')+'</div><button class="del-btn" onclick="OG.deletePlan(\''+id+'\')">×</button></div>';}).join('');}
  function deletePlan(id){var i=findById(plans,id);if(i<0)return;var p=plans[i];confirmDelete(p.title,function(){removeById(plans,id);renderPlans();updateNextEvent();saveAll();});}
  function addPlan(){var dateEl=$('plan-date'),title=$('plan-title').value.trim(),note=$('plan-note').value.trim();var recurEl=$('plan-recurring'),recurring=recurEl?recurEl.checked:false;if(!title)return;var dateISO='',day='—',mon='';if(dateEl.value){var d=new Date(dateEl.value+'T12:00:00');dateISO=d.toISOString();day=d.getDate().toString();mon=d.toLocaleDateString('en-US',{month:'short'}).toUpperCase();}plans.push({id:uid('plan'),title:title,note:note,dateISO:dateISO,day:day,mon:mon,recurring:recurring});dateEl.value='';$('plan-title').value='';$('plan-note').value='';if(recurEl)recurEl.checked=false;renderPlans();updateNextEvent();saveAll();}
  function updateNextEvent(){
    var upcoming=plans.filter(function(p){return p.dateISO&&daysDiff(p.dateISO)>=0;}).sort(function(a,b){return daysDiff(a.dateISO)-daysDiff(b.dateISO);});
    var el=$('dash-next-event');
    if(upcoming.length){var diff=daysDiff(upcoming[0].dateISO);el.textContent=diff===0?'Today':diff===1?'Tomorrow':diff+'d';}
    else{el.textContent='—';}
  }

  // ══════════════════════════════════
  // CHORES / PROJECTS (with EoD, streak clear, freq display, confirm delete)
  // ══════════════════════════════════
  function homeTab(tab,btn){document.querySelectorAll('#page-home .tab-pill').forEach(function(p){p.classList.remove('active');});btn.classList.add('active');['chores','projects'].forEach(function(t){$('home-'+t).style.display=t===tab?'block':'none';});}
  function advanceChoreDate(ch){
    var base=ch.nextDueISO?new Date(ch.nextDueISO):new Date();base.setHours(12,0,0,0);
    if(ch.freq==='Daily')base.setDate(base.getDate()+1);
    else if(ch.freq==='Every Other Day')base.setDate(base.getDate()+2);
    else if(ch.freq==='Weekly')base.setDate(base.getDate()+7);
    else if(ch.freq==='Biweekly')base.setDate(base.getDate()+14);
    else if(ch.freq==='Monthly')base.setMonth(base.getMonth()+1);
    return base.toISOString();
  }
  function choreDueLabel(ch){
    if(!ch.nextDueISO)return ch.freq;
    var diff=daysDiff(ch.nextDueISO);var fmt=new Date(ch.nextDueISO).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    if(diff<0)return{label:'⚠ Overdue · '+fmt,cls:'urgent'};
    if(diff===0)return{label:'Due today',cls:'urgent'};
    if(diff===1)return{label:'Due tomorrow',cls:'soon'};
    if(diff<=3)return{label:fmt,cls:'soon'};
    return{label:fmt,cls:''};
  }
  function streakValid(ch){if(!ch.lastDoneISO||!ch.streak)return false;var last=new Date(ch.lastDoneISO);last.setHours(0,0,0,0);var now=new Date();now.setHours(0,0,0,0);var win={Daily:2,'Every Other Day':3,Weekly:9,Biweekly:16,Monthly:35}[ch.freq]||9;return Math.ceil((now-last)/86400000)<=win;}
  function clearStreak(id,event){
    event.stopPropagation();
    var i=findById(chores,id);if(i<0)return;
    chores[i].streak=0;chores[i].lastDoneISO='';
    renderChores();saveAll();
  }
  function renderChores(){
    var list=$('chores-list');if(!chores.length){list.innerHTML='<div class="empty">No chores yet</div>';return;}
    var ownerCls={adam:'own-adam',brit:'own-brit',both:'own-both'};var ownerLbl={adam:'Adam',brit:'Brittany',both:'Both'};
    list.innerHTML=chores.map(function(ch){
      var id=ch.id;var dl=choreDueLabel(ch),label=typeof dl==='string'?dl:dl.label,dueCls=typeof dl==='object'?dl.cls:'';
      var owner=ch.owner||'both';
      var hasStreak=ch.streak&&streakValid(ch)&&ch.streak>=2;
      var streakHtml=hasStreak?'<span class="chore-streak" style="display:inline-flex;align-items:center;gap:2px;">🔥 '+ch.streak+'<button class="del-btn" onclick="OG.clearStreak(\''+id+'\',event)" style="font-size:0.65rem;padding:1px 4px;opacity:0.5;" title="Clear streak">×</button></span>':'';
      var freqTag='<span class="chore-freq-tag">'+esc(ch.freq)+'</span>';
      return'<div class="chore-item" id="cr-'+id+'" onclick="OG.completeChore(\''+id+'\')"><div style="flex:1;min-width:0;"><div class="chore-text">'+esc(ch.text)+'</div><span class="chore-due '+dueCls+'">'+label+'</span> '+freqTag+'</div><span class="chore-owner '+ownerCls[owner]+'">'+ownerLbl[owner]+'</span>'+streakHtml+'<button class="del-btn" onclick="event.stopPropagation();OG.deleteChore(\''+id+'\')">×</button></div>';
    }).join('');
  }
  function completeChore(id){var row=$('cr-'+id);if(row){row.style.transition='opacity 0.3s, transform 0.3s';row.style.opacity='0';row.style.transform='translateX(20px)';}setTimeout(function(){var i=findById(chores,id);if(i<0)return;var ch=chores[i];var prev=(ch.streak&&streakValid(ch))?ch.streak:0;ch.streak=prev+1;ch.lastDoneISO=new Date().toISOString();ch.nextDueISO=advanceChoreDate(ch);renderChores();renderDashToday();renderDashRecap();saveAll();},320);}
  function deleteChore(id){var i=findById(chores,id);if(i<0)return;var ch=chores[i];confirmDelete(ch.text,function(){removeById(chores,id);renderChores();saveAll();});}
  function addChore(){var inp=$('chore-in'),freq=$('chore-freq').value,dateIn=$('chore-date-in').value;var ownerEl=$('chore-owner-in'),owner=ownerEl?ownerEl.value:'both';var v=inp.value.trim();if(!v)return;var nextDueISO=dateIn?new Date(dateIn+'T12:00:00').toISOString():'';chores.push({id:uid('chor'),text:v,freq:freq,owner:owner,nextDueISO:nextDueISO,streak:0,lastDoneISO:''});inp.value='';$('chore-date-in').value='';renderChores();saveAll();}
  function renderProjects(){var list=$('projects-list');if(!projects.length){list.innerHTML='<div class="empty">No projects yet</div>';return;}list.innerHTML=projects.map(function(p){var id=p.id;return'<div class="task-item" onclick="OG.toggleProject(\''+id+'\')"><div class="task-check'+(p.done?' done':'')+'"></div><div class="task-text'+(p.done?' done':'')+'">'+esc(p.text)+'</div><button class="del-btn" onclick="event.stopPropagation();OG.deleteProject(\''+id+'\')">×</button></div>';}).join('');}
  function toggleProject(id){var i=findById(projects,id);if(i>=0){projects[i].done=!projects[i].done;renderProjects();saveAll();}}
  function deleteProject(id){var removed=removeById(projects,id);if(removed)showUndo(removed.text,'projects',removed);renderProjects();saveAll();}
  function addProject(){var inp=$('project-in'),v=inp.value.trim();if(!v)return;projects.push({id:uid('proj'),text:v,done:false});inp.value='';renderProjects();saveAll();}

  // ══════════════════════════════════
  // BUDGET ENGINE
  // ══════════════════════════════════
  function budgetMonthlyIncome(person){var b=budget[person];if(!b||!b.paycheckAmount)return 0;return b.paycheckAmount*26/12;}
  function autoAdvancePaycheck(person){var b=budget[person];if(!b||!b.nextPaycheckISO)return;var now=new Date();now.setHours(0,0,0,0);var next=new Date(b.nextPaycheckISO);next.setHours(0,0,0,0);var changed=false;while(next<now){next.setDate(next.getDate()+14);changed=true;}if(changed){b.nextPaycheckISO=next.toISOString();saveAll();}}
  function daysUntilPaycheck(person){var b=budget[person];if(!b||!b.nextPaycheckISO)return null;autoAdvancePaycheck(person);return daysDiff(b.nextPaycheckISO);}
  function totalSubsMonthly(){return subs.reduce(function(s,sub){return s+parseFloat(sub.amount||0);},0);}
  function totalBillsMonthly(){return bills.filter(function(b){return!b.paid;}).reduce(function(s,b){return s+parseFloat(b.amount||0);},0);}
  function saveBudgetInput(person,field,val){
    if(!budget[person])budget[person]={paycheckAmount:0,nextPaycheckISO:''};
    if(field==='amount')budget[person].paycheckAmount=parseFloat(val)||0;
    if(field==='date')budget[person].nextPaycheckISO=val?new Date(val+'T12:00:00').toISOString():'';
    autoAdvancePaycheck(person);renderBudgetTab();renderDashPaycheck();saveAll();
  }
  function renderBudgetTab(){
    var el=$('money-budget');if(!el)return;
    var adamB=budget.adam||{};var britB=budget.brit||{};
    var adamMonthly=budgetMonthlyIncome('adam');var britMonthly=budgetMonthlyIncome('brit');
    var combined=adamMonthly+britMonthly;var committed=totalBillsMonthly()+totalSubsMonthly();var surplus=combined-committed;
    var adamDays=daysUntilPaycheck('adam');var britDays=daysUntilPaycheck('brit');
    var nextDays=adamDays!==null?adamDays:britDays;
    if(adamDays!==null&&britDays!==null)nextDays=Math.min(adamDays,britDays);
    var daysLabel=nextDays===null?'':nextDays===0?'Payday! 🎉':nextDays===1?'Tomorrow':nextDays+' days';
    var dailyBudget=(nextDays&&nextDays>0&&surplus>0)?(surplus/30).toFixed(0):0;
    var adamDateVal=adamB.nextPaycheckISO?new Date(adamB.nextPaycheckISO).toISOString().split('T')[0]:'';
    var britDateVal=britB.nextPaycheckISO?new Date(britB.nextPaycheckISO).toISOString().split('T')[0]:'';

    // Bills due BEFORE payday (strict < not <=)
    var billsBeforePay='';
    if(nextDays!==null&&nextDays>0){
      var now=new Date();var nLocal=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var payLocal=new Date(nLocal);payLocal.setDate(payLocal.getDate()+nextDays);
      var before=bills.filter(function(b){
        if(b.paid||!b.dueISO)return false;
        var diff=daysDiff(b.dueISO);
        return diff>=0&&diff<nextDays;// strict less than — payday bills are NOT "before"
      });
      if(before.length){
        var bTotal=before.reduce(function(t,b){return t+parseFloat(b.amount||0);},0);
        billsBeforePay='<div class="budget-section-label">Due Before Payday</div><div class="budget-timing-list">'+
          before.map(function(b){var d=daysDiff(b.dueISO);var cls=d<=1?'timing-red':d<=4?'timing-amber':'timing-green';return'<div class="budget-timing-item '+cls+'"><span>'+esc(b.name)+'</span><span>$'+Number(b.amount||0).toFixed(0)+'</span></div>';}).join('')+
          '<div class="budget-timing-item" style="font-weight:500;margin-top:4px;border-top:1px solid var(--border);padding-top:6px;"><span>Total</span><span>$'+bTotal.toFixed(0)+'</span></div></div>';
      }
    }

    el.innerHTML=
      '<div class="card"><div class="card-label">Paycheck Setup</div>'+
      '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">Bi-weekly · Same pay schedule</div>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">'+
        '<span style="font-size:0.72rem;color:var(--text-muted);min-width:60px;">Adam</span>'+
        '<input class="add-input" type="number" inputmode="decimal" placeholder="$ per check" value="'+(adamB.paycheckAmount||'')+'" style="flex:1;min-width:100px;" oninput="OG.saveBudgetInput(\'adam\',\'amount\',this.value)">'+
        '<input class="add-input" type="date" value="'+adamDateVal+'" style="max-width:150px;" onchange="OG.saveBudgetInput(\'adam\',\'date\',this.value)">'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'+
        '<span style="font-size:0.72rem;color:var(--text-muted);min-width:60px;">Brittany</span>'+
        '<input class="add-input" type="number" inputmode="decimal" placeholder="$ per check" value="'+(britB.paycheckAmount||'')+'" style="flex:1;min-width:100px;" oninput="OG.saveBudgetInput(\'brit\',\'amount\',this.value)">'+
        '<input class="add-input" type="date" value="'+britDateVal+'" style="max-width:150px;" onchange="OG.saveBudgetInput(\'brit\',\'date\',this.value)">'+
      '</div></div>'+
      (daysLabel?'<div class="budget-countdown"><div class="bcd-days">'+daysLabel+'</div><div class="bcd-label">until next payday</div></div>':'')+
      (combined>0?
        '<div class="card"><div class="card-label">Monthly Overview</div>'+
        '<div class="budget-bar-wrap"><div class="budget-bar-fill" style="width:'+Math.min(100,(committed/(combined||1)*100)).toFixed(1)+'%;background:'+(committed>combined?'var(--rose)':'var(--accent)')+'"></div></div>'+
        '<div class="budget-line-row"><span>Combined Income</span><span>$'+combined.toFixed(0)+'</span></div>'+
        (adamMonthly?'<div class="budget-line-row" style="font-size:0.76rem;color:var(--text-muted);"><span>&nbsp;&nbsp;Adam</span><span>$'+adamMonthly.toFixed(0)+'</span></div>':'')+
        (britMonthly?'<div class="budget-line-row" style="font-size:0.76rem;color:var(--text-muted);"><span>&nbsp;&nbsp;Brittany</span><span>$'+britMonthly.toFixed(0)+'</span></div>':'')+
        '<div class="budget-line-row"><span>Bills + Subs</span><span style="color:var(--rose);">−$'+committed.toFixed(0)+'</span></div>'+
        '<div class="budget-line-row" style="font-weight:600;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;"><span>Remaining</span><span style="color:'+(surplus>=0?'var(--green)':'var(--rose)')+';">'+(surplus>=0?'+':'')+' $'+Math.abs(surplus).toFixed(0)+'</span></div>'+
        (dailyBudget>0?'<div style="font-size:0.7rem;color:var(--text-muted);text-align:center;margin-top:8px;">≈ $'+dailyBudget+'/day discretionary</div>':'')+
        '</div>'
      :'<div class="card"><div class="empty">Enter paycheck amounts above to see your budget</div></div>')+
      billsBeforePay;
  }
  function renderDashPaycheck(){
    autoAdvancePaycheck('adam');autoAdvancePaycheck('brit');
    var adamDays=daysUntilPaycheck('adam');var britDays=daysUntilPaycheck('brit');
    var combined=budgetMonthlyIncome('adam')+budgetMonthlyIncome('brit');
    var committed=totalBillsMonthly()+totalSubsMonthly();
    var surplus=combined-committed;
    // Budget stat card number
    var budgetEl=$('dash-budget-num');
    if(budgetEl){
      if(combined>0){budgetEl.textContent=(surplus>=0?'+':'-')+' $'+Math.abs(surplus).toFixed(0);budgetEl.className='stat-num '+(surplus>=0?'green':'rose');}
      else{budgetEl.textContent='—';budgetEl.className='stat-num gold';}
    }
    // Budget stat card label — include payday countdown
    var labelEl=$('dash-budget-label');
    if(labelEl){
      var days=null;
      if(adamDays!==null&&britDays!==null)days=Math.min(adamDays,britDays);
      else if(adamDays!==null)days=adamDays;
      else if(britDays!==null)days=britDays;
      if(days!==null){
        var payStr=days===0?'Payday!':days===1?'Payday tomorrow':days+'d to payday';
        labelEl.textContent='Budget · '+payStr;
      }else{labelEl.textContent='Budget';}
    }
  }

  // ══════════════════════════════════
  // RENDER ALL + INIT
  // ══════════════════════════════════
  function renderAll(){updateDashStats();renderTasks();renderTaskPreview();renderDashToday();renderDashRecap();renderNotes();renderGrocery();renderDiscuss();renderBills();renderSubs();renderGoalsAll();renderDashGoals();renderChores();renderProjects();renderPlans();updateNextEvent();renderBudgetTab();renderDashPaycheck();}

  // Keep renderSubs for data compat — just no UI tab
  function renderSubs(){}

  function init(){
    loadAll();
    var now=new Date();$('tasks-date').textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    var q=QUOTES[now.getDate()%QUOTES.length];$('dash-quote-text').textContent='"'+q.q+'"';$('dash-quote-author').textContent=q.a?'— '+q.a:'';
    updateGreeting();renderAll();startSyncLoop();setInterval(updateGreeting,60000);
  }
  initPin();init();

  return {
    navTo:navTo,setOwner:setOwner,filterTasks:filterTasks,addTask:addTask,toggleTask:toggleTask,deleteTask:deleteTask,editTask:editTask,saveTaskEdit:saveTaskEdit,toggleTaskNotes:toggleTaskNotes,saveTaskNote:saveTaskNote,renderTasks:renderTasks,
    addBill:addBill,toggleBillPaid:toggleBillPaid,deleteBill:deleteBill,editBill:editBill,moneyTab:moneyTab,
    addGoal:addGoal,updateGoalLabels:updateGoalLabels,toggleGoalEdit:toggleGoalEdit,saveGoalEdit:saveGoalEdit,cancelGoalEdit:cancelGoalEdit,deleteGoal:deleteGoal,
    notesTab:notesTab,addNote:addNote,saveNoteText:saveNoteText,deleteNote:deleteNote,
    addGrocery:addGrocery,toggleGrocery:toggleGrocery,deleteGrocery:deleteGrocery,
    addDiscuss:addDiscuss,toggleDiscuss:toggleDiscuss,deleteDiscuss:deleteDiscuss,
    addPlan:addPlan,deletePlan:deletePlan,
    homeTab:homeTab,addChore:addChore,completeChore:completeChore,deleteChore:deleteChore,clearStreak:clearStreak,
    addProject:addProject,toggleProject:toggleProject,deleteProject:deleteProject,
    selectUser:selectUser,pinBack:pinBack,pinInput:pinInput,pinBackspace:pinBackspace,
    onBellClick:onBellClick,doUndo:doUndo,undoComplete:undoComplete,
    openSettings:openSettings,closeModal:closeModal,setTheme:setTheme,showDoneToday:showDoneToday,
    saveBudgetInput:saveBudgetInput,renderBudgetTab:renderBudgetTab,confirmDelete:confirmDelete,
    setNotifPref:setNotifPref
  };
})();
