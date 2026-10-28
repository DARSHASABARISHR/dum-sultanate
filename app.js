const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LS={g:(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}},s:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};

// Google OAuth Client ID
const GOOGLE_CLIENT_ID="91342186942-do3t9pji2aoe0kcl3drseqc0f01o1c10.apps.googleusercontent.com";
const ADMIN_PASS="sultan-admin"; 
let me=LS.g('ds_me',null),users=LS.g('ds_users',[]),favs=LS.g('ds_favs',{}),reviews=LS.g('ds_reviews',[]),cur=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(m,t=3500){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',t)}
const open=id=>$(id).classList.add('on'),shut=id=>$(id).classList.remove('on');
$$('[data-close]').forEach(b=>b.onclick=()=>{b.closest('.modal').classList.remove('on');if(b.closest('#mRecipe'))vStop();if(b.closest('#mOtp'))clearInterval(otpT)});

/* views */
function go(v){
  if(v==='admin'&&!adminOK()){
    const p=prompt('Admin passcode');
    if(p!==ADMIN_PASS)return toast('Admin passcode not recognised.');
    sessionStorage.adm=1;
  }
  $$('.view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));
  $$('.nav [data-go]').forEach(b=>b.classList.toggle('on',b.dataset.go===v));
  ({favs:renderFavs,review:renderReview,admin:renderAdmin}[v]||(()=>{}))();
  scrollTo(0,0);
}
const adminOK=()=>sessionStorage.adm==='1';
$$('.nav [data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));

/* grid */
function cardHTML(b){
  const f=isFav(b.slug);
  return `<article class="card"><span class="meta">${esc(b.region)} · ${b.prep_time+b.cook_time} min</span><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p>
  <div class="row"><button class="btn pri sm" onclick="openRecipe('${b.slug}')">View recipe</button><button class="btn sm heart ${f?'on':''}" onclick="toggleFav('${b.slug}')">${f?'❤️ Saved':'🤍 Add to Favorites'}</button></div></article>`;
}
function renderGrid(){
  const q=$('#q').value.toLowerCase();
  const l=BIRYANIS.filter(b=>(b.name+b.region).toLowerCase().includes(q));
  $('#cards').innerHTML=l.map(cardHTML).join('')||'<div class="empty">No biryani matches that search. Try a city or a style.</div>';
}
$('#q').oninput=renderGrid;

const isFav=s=>me&&(favs[me.user_id]||[]).includes(s);
function toggleFav(s){
  if(!me){toast('Sign in to save favorites.');return open('#mAuth');}
  const a=favs[me.user_id]||[];
  favs[me.user_id]=a.includes(s)?a.filter(x=>x!==s):[...a,s];
  LS.s('ds_favs',favs);
  toast(a.includes(s)?'Removed from favorites':'Added to your Royal Favorites');
  renderGrid();renderFavs();
  if(cur&&cur.slug===s)recipeFavBtn();
}
function renderFavs(){
  const b=$('#favBox');
  if(!me){b.innerHTML='<div class="empty">Sign in to see your saved biryanis.<br><br><button class="btn pri" onclick="open(\'#mAuth\')">Sign in</button></div>';return;}
  const l=BIRYANIS.filter(x=>isFav(x.slug));
  b.innerHTML=l.length?`<div class="grid">${l.map(cardHTML).join('')}</div>`:'<div class="empty">Nothing saved yet. Tap “Add to Favorites” on any biryani.</div>';
}

/* recipe modal + voice */
function openRecipe(s){
  cur=BIRYANIS.find(b=>b.slug===s);vStop();const r=cur;
  $('#recipeBody').innerHTML=`<h2>${esc(r.name)}</h2><p style="color:var(--mute)">${esc(r.region)}. Prep ${r.prep_time} min, cook ${r.cook_time} min.</p><p>${esc(r.description)}</p>
  <div class="row"><button class="btn sm heart" id="rfav"></button></div>
  <div class="voice"><b>🎙️🔊 Step-by-step voice guide</b><button class="btn pri sm" onclick="vPlay()">▶ Play</button><button class="btn sm" onclick="vPause()">⏸ Pause</button><button class="btn sm" onclick="vNext()">⏭ Next step</button><button class="btn sm" onclick="vStop()">⏹ Stop</button></div>
  <div class="cols"><div class="ing" id="vIng"><h3>Ingredients</h3>${r.ingredients.map(x=>`<label><input type="checkbox">${esc(x)}</label>`).join('')}</div>
  <div><h3>Cooking steps</h3><ol class="steps" id="vSteps">${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></div>`;
  recipeFavBtn();open('#mRecipe');
}
function recipeFavBtn(){
  const b=$('#rfav'),f=isFav(cur.slug);
  b.className='btn sm heart '+(f?'on':'');
  b.textContent=f?'❤️ Saved to Favorites':'❤️ Add to Favorites';
  b.onclick=()=>toggleFav(cur.slug);
}

const V={i:-1,q:[],tok:0,st:'stop'};
function hl(i){
  $('#vIng')?.classList.toggle('hl',i===0);
  $$('#vSteps li').forEach((e,k)=>e.classList.toggle('hl',k===i-1));
}

function getTamilVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'ta-IN' || v.lang.startsWith('ta')) || null;
}

function vSay(i){
  if(!('speechSynthesis' in window))return toast('Voice guide is not supported in this browser.');
  const t=++V.tok;
  speechSynthesis.cancel();
  if(i>=V.q.length)return vStop();
  V.i=i;V.st='play';hl(i);
  
  const u=new SpeechSynthesisUtterance(V.q[i]);
  u.rate=.95;
  const tmVoice = getTamilVoice();
  if(tmVoice){
    u.voice = tmVoice;
    u.lang = tmVoice.lang;
  }
  u.onend=()=>{if(t===V.tok&&V.st==='play')vSay(i+1)};
  speechSynthesis.speak(u);
}
function vPlay(){
  if(V.st==='pause'){speechSynthesis.resume();V.st='play';return;}
  V.q=['Ingredients for '+cur.name+'. '+cur.ingredients.join('. '),...cur.steps.map((s,i)=>'Step '+(i+1)+'. '+s)];
  vSay(0);
}
function vPause(){if(V.st==='play'){speechSynthesis.pause();V.st='pause';}}
function vNext(){if(V.st==='stop')return vPlay();vSay(V.i+1);}
function vStop(){V.tok++;V.st='stop';V.i=-1;if('speechSynthesis' in window)speechSynthesis.cancel();hl(-1);}

/* auth */
const cap={a:0,b:0,robot:false};let otp='',pend=null,otpT;
function newMath(){cap.a=2+Math.floor(Math.random()*9);cap.b=2+Math.floor(Math.random()*9);$('#mq').textContent=`${cap.a} + ${cap.b} = ?`;$('#ma').value='';}
function resetAuth(){cap.robot=false;$('#rbox').className='box';$('#rbox').textContent='';$('#robot').setAttribute('aria-checked','false');$('#authErr').textContent='';newMath();}
function robotClick(){
  if(cap.robot||$('#rbox').classList.contains('spin'))return;
  $('#rbox').className='box spin';
  setTimeout(()=>{cap.robot=true;$('#rbox').className='box ok';$('#rbox').textContent='✓';$('#robot').setAttribute('aria-checked','true');},1100);
}
$('#robot').onclick=robotClick;
$('#robot').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();robotClick();}};
$('#mr').onclick=newMath;

function authOpen(){
  if(me){
    if(confirm('Sign out of '+me.name+'?')){
      me=null;LS.s('ds_me',null);sync();toast('Signed out');renderGrid();
    }
    return;
  }
  resetAuth();open('#mAuth');
}
$('#authBtn').onclick=authOpen;
$('#heroAuth').onclick=authOpen;

function sync(){$('#authBtn').textContent=me?`${me.name.split(' ')[0]} · ${me.user_id}`:'Sign in';}

function finishLogin(name,email,provider,avatar){
  email=email.toLowerCase();
  let u=users.find(x=>x.email===email);
  if(!u){
    let id;
    do{id='SULTAN-USR-'+(1000+Math.floor(Math.random()*9000));}while(users.some(x=>x.user_id===id));
    u={user_id:id,name,email,avatar_url:avatar||'',auth_provider:provider,is_verified:true,created_at:new Date().toISOString()};
    users.push(u);LS.s('ds_users',users);
  }
  me=u;LS.s('ds_me',me);sync();
  ['#mAuth','#mOtp'].forEach(shut);
  clearInterval(otpT);
  toast('Welcome, '+u.name+'. Your Sultan ID is '+u.user_id,5000);
  renderGrid();
  const v=$('.view.on').id.slice(2);
  if(v==='favs')renderFavs();
  if(v==='review')renderReview();
}

/* Google OAuth */
function handleCredentialResponse(resp){
  try{
    const p=JSON.parse(decodeURIComponent(escape(atob(resp.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))));
    finishLogin(p.name,p.email,'google',p.picture);
  }catch{
    toast('Google sign-in failed. Try again.');
  }
}
window.handleCredentialResponse = handleCredentialResponse;

if(GOOGLE_CLIENT_ID){
  $('#gSim').style.display='none';
  const initGSI=()=>{
    if(window.google?.accounts?.id){
      google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleCredentialResponse});
      const gBtnEl=$('#gBtn');
      if(gBtnEl) google.accounts.id.renderButton(gBtnEl,{theme:'filled_black',size:'large',width:300});
    }
  };
  if(window.google?.accounts?.id) initGSI();
  else {
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';
    s.onload=initGSI;
    document.head.appendChild(s);
  }
}

$('#gSim').onclick=()=>{
  const n=prompt('Simulated Google account: your name','Demo Foodie');
  if(!n)return;
  const e=prompt('Simulated Google account: your email','demo@gmail.com');
  if(!e||!/^\S+@\S+\.\S+$/.test(e))return toast('Enter a valid email.');
  handleCredentialResponse({credential:'x.'+btoa(unescape(encodeURIComponent(JSON.stringify({name:n,email:e,picture:''})))).replace(/\+/g,'-').replace(/\//g,'_')+'.x'});
};

$('#sendOtp').onclick=()=>{
  const n=$('#nm').value.trim(),e=$('#em').value.trim(),er=$('#authErr');
  if(n.length<2)return er.textContent='Enter your name.';
  if(!/^\S+@\S+\.\S+$/.test(e))return er.textContent='Enter a valid email address.';
  if(!cap.robot)return er.textContent='Tick “I’m not a robot” first.';
  if(parseInt($('#ma').value,10)!==cap.a+cap.b){newMath();return er.textContent='Wrong answer. Here is a new puzzle.';}
  pend={n,e};sendOtp();shut('#mAuth');open('#mOtp');
};

function sendOtp(){
  otp=String(100000+Math.floor(Math.random()*900000));
  $('#otpTo').textContent=pend.e;$('#otpErr').textContent='';
  const b=$('#otpBoxes');
  b.innerHTML=[...Array(6)].map((_,i)=>`<input maxlength="1" inputmode="numeric" aria-label="Digit ${i+1}">`).join('');
  const ins=$$('#otpBoxes input');
  ins.forEach((x,i)=>{
    x.oninput=()=>{x.value=x.value.replace(/\D/g,'');if(x.value&&ins[i+1])ins[i+1].focus();};
    x.onkeydown=e=>{if(e.key==='Backspace'&&!x.value&&ins[i-1])ins[i-1].focus();};
    x.onpaste=e=>{
      const d=(e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);
      if(d){e.preventDefault();[...d].forEach((c,k)=>ins[k].value=c);ins[Math.min(d.length,5)].focus();}
    };
  });
  ins[0].focus();
  toast(`Demo mode: email simulated. Your OTP is ${otp}`,9000);
  let s=60;$('#otpResend').disabled=true;clearInterval(otpT);
  const tick=()=>{$('#otpTimer').textContent=s>0?`Resend available in ${s}s`:'Code not received?';if(s--<=0){clearInterval(otpT);$('#otpResend').disabled=false;}};
  tick();otpT=setInterval(tick,1000);
}
$('#otpResend').onclick=sendOtp;
$('#otpGo').onclick=()=>{
  const c=$$('#otpBoxes input').map(x=>x.value).join('');
  if(c!==otp)return $('#otpErr').textContent='That code is incorrect.';
  finishLogin(pend.n,pend.e,'email','');
};

/* reviews */
let rv={rating:0,hi:new Set()};
function renderReview(){
  const b=$('#revBox');
  if(!me){b.innerHTML='<div class="empty">Reviews are for signed-in members.<br><br><button class="btn pri" onclick="open(\'#mAuth\')">Sign in</button></div>';return;}
  rv={rating:0,hi:new Set()};
  const H=['Aroma','Rice Texture','Meat Softness','Spiciness','Dalcha'];
  b.innerHTML=`<div class="card" style="max-width:700px">
  <div class="field"><label for="rb">Biryani style</label><select id="rb">${BIRYANIS.map(x=>`<option>${esc(x.name)}</option>`).join('')}</select></div>
  <div class="field"><label>Rating</label><div class="stars" id="st">${[1,2,3,4,5].map(i=>`<button type="button" data-v="${i}" aria-label="${i} star">★</button>`).join('')}</div></div>
  <div class="field"><label>Flavor highlights</label>${H.map(h=>`<span class="chip" tabindex="0" data-h="${h}">${h}</span>`).join('')}</div>
  <div class="field"><label for="rc">குறைகள் / Areas to Improve</label><textarea id="rc" rows="3" placeholder="e.g. excess oil, overcooked rice, unbalanced spices"></textarea></div>
  <div class="field"><label for="rt">Detailed tasting comments</label><textarea id="rt" rows="4"></textarea></div>
  <p id="rerr" style="color:#ff9a8a;margin:0"></p><button class="btn pri" id="rsub">Submit review</button></div>`;
  $$('#st button').forEach(s=>s.onclick=()=>{rv.rating=+s.dataset.v;$$('#st button').forEach(x=>x.classList.toggle('on',+x.dataset.v<=rv.rating));});
  $$('.chip').forEach(c=>{
    const t=()=>{c.classList.toggle('on');c.classList.contains('on')?rv.hi.add(c.dataset.h):rv.hi.delete(c.dataset.h);};
    c.onclick=t;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();t();}};
  });
  $('#rsub').onclick=()=>{
    if(!rv.rating)return $('#rerr').textContent='Choose a star rating.';
    reviews.push({id:reviews.length+1,user_id:me.user_id,name:me.name,email:me.email,biryani:$('#rb').value,rating:rv.rating,highlights:[...rv.hi].join(', '),complaints:$('#rc').value.trim(),comments:$('#rt').value.trim(),created_at:new Date().toISOString()});
    LS.s('ds_reviews',reviews);toast('Thank you. Your review is logged.');renderReview();
  };
}

/* admin */
const csv=(rows)=>rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
function dl(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();}
function renderAdmin(){
  if(!adminOK())return;
  const g=users.filter(u=>u.auth_provider==='google').length,cnt={};
  Object.values(favs).flat().forEach(s=>cnt[s]=(cnt[s]||0)+1);
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0],gr=reviews.filter(r=>r.complaints).length;
  $('#adminBox').innerHTML=`<div class="kpis"><div class="card"><span>Total Foodies Registered</span><b>${users.length}</b></div><div class="card"><span>Google Sign-ins</span><b>${g}</b></div>
  <div class="card"><span>Most Loved Biryani</span><b style="font-size:1.5rem">${top?esc(BIRYANIS.find(x=>x.slug===top[0]).name):'None yet'}</b></div><div class="card"><span>Total Grievances Logged</span><b>${gr}</b></div></div>
  <div class="row" style="margin-bottom:1rem"><button class="btn" id="eu">Export users CSV</button><button class="btn" id="er">Export reviews CSV</button></div>
  <h3>Verified users</h3><div class="tw">${users.length?`<table><tr><th>Sultan ID</th><th>Name</th><th>Email</th><th>Auth</th><th>Joined</th></tr>${users.map(u=>`<tr><td>${u.user_id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.auth_provider}</td><td>${new Date(u.created_at).toLocaleDateString()}</td></tr>`).join('')}</table>`:'<div class="empty">No members yet.</div>'}</div>
  <h3>Review &amp; grievance inspector</h3><div class="tools"><input id="as" type="search" placeholder="Search reviews"><label class="row"><input type="checkbox" id="ag" style="width:auto"> Only grievances</label></div><div class="tw" id="at"></div>`;
  $('#eu').onclick=()=>dl('users.csv',csv([['user_id','name','email','auth_provider','is_verified','created_at'],...users.map(u=>[u.user_id,u.name,u.email,u.auth_provider,u.is_verified,u.created_at])]));
  $('#er').onclick=()=>dl('reviews.csv',csv([['user_id','biryani','rating','highlights','complaints_improvements','comments','created_at'],...reviews.map(r=>[r.user_id,r.biryani,r.rating,r.highlights,r.complaints,r.comments,r.created_at])]));
  const draw=()=>{
    const q=$('#as').value.toLowerCase(),o=$('#ag').checked,l=reviews.filter(r=>(!o||r.complaints)&&JSON.stringify(r).toLowerCase().includes(q));
    $('#at').innerHTML=l.length?`<table><tr><th>User</th><th>Biryani</th><th>Rating</th><th>Highlights</th><th>Grievance</th><th>Comments</th></tr>${l.map(r=>`<tr><td>${esc(r.name)}<br><small>${r.user_id}</small></td><td>${esc(r.biryani)}</td><td>${'★'.repeat(r.rating)}</td><td>${esc(r.highlights)}</td><td>${esc(r.complaints)}</td><td>${esc(r.comments)}</td></tr>`).join('')}</table>`:'<div class="empty">No reviews match these filters.</div>';
  };
  $('#as').oninput=draw;$('#ag').onchange=draw;draw();
}

renderGrid();sync();