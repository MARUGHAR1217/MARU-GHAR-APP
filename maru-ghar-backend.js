import { firebaseConfig, cloudinaryConfig, isFirebaseConfigured, isCloudinaryConfigured } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, orderBy, limit, startAfter, addDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const form = document.getElementById('propertyForm');
const statusBox = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitListingBtn');
const grid = document.getElementById('properties');
// Never leave design/demo cards visible if Firebase is unavailable; public listings must come from Firestore only.
if (grid) grid.replaceChildren();
const count = document.getElementById('count');
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setStatus = (msg, bad=false) => { if(statusBox){statusBox.textContent=msg;statusBox.style.color=bad?'#ffb4a9':'#f3d37b';} };
let db=null, auth=null, liveMode=false, lastListingDoc=null, loadingMore=false, hasMoreListings=true;
const PAGE_SIZE=12;

async function uploadPhoto(file) {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary Cloud Name ગોઠવાયેલું નથી. firebase-config.js માં cloudName ભરો.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('માત્ર JPG, PNG અથવા WEBP ફોટા સ્વીકારાય છે.');
  if (file.size > 8*1024*1024) throw new Error('દરેક ફોટો 8 MB કરતાં નાનો હોવો જોઈએ.');
  const body = new FormData(); body.append('file', file); body.append('upload_preset', cloudinaryConfig.uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`, {method:'POST',body});
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.secure_url) throw new Error(data.error?.message || `ફોટા અપલોડ નિષ્ફળ (HTTP ${response.status}). Cloud Name / unsigned preset તપાસો.`);
  return {url:data.secure_url, publicId:data.public_id};
}


const VIDEO_TYPES=['video/mp4','video/webm','video/quicktime'];
const VIDEO_MAX=25*1024*1024;
function uploadVideoOnce(file,onProgress){
  return new Promise((resolve,reject)=>{
    const body=new FormData(); body.append('file',file); body.append('upload_preset',cloudinaryConfig.videoUploadPreset||cloudinaryConfig.uploadPreset);
    const xhr=new XMLHttpRequest();
    xhr.open('POST',`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/video/upload`);
    xhr.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onerror=()=>reject(new Error('ઇન્ટરનેટ કનેક્શન તૂટ્યું.'));
    xhr.onload=()=>{let d={};try{d=JSON.parse(xhr.responseText)}catch(_){}
      if(xhr.status>=200&&xhr.status<300&&d.secure_url)resolve({url:d.secure_url,publicId:d.public_id,format:d.format||'',bytes:d.bytes||file.size});
      else reject(new Error(d.error?.message||`વિડિયો અપલોડ નિષ્ફળ (HTTP ${xhr.status}). Cloudinary preset વિડિયો માટે મંજૂર છે કે નહીં તપાસો.`));};
    xhr.send(body);
  });
}
async function uploadVideo(file,onProgress){
  if(!isCloudinaryConfigured())throw new Error('Cloudinary ગોઠવાયેલું નથી.');
  if(!VIDEO_TYPES.includes(file.type))throw new Error('વિડિયો માત્ર MP4, WEBM અથવા MOV હોવો જોઈએ.');
  if(file.size>VIDEO_MAX)throw new Error('દરેક વિડિયો 25 MB કરતાં નાનો હોવો જોઈએ.');
  let lastErr;
  for(let attempt=1;attempt<=3;attempt++){
    try{return await uploadVideoOnce(file,onProgress);}catch(e){lastErr=e;if(attempt<3&&onProgress)onProgress(-attempt);await new Promise(r=>setTimeout(r,1200*attempt));}
  }
  throw lastErr;
}

const cld=(u,t)=>/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?!(?:[a-z]{1,3}_[^/]*,?)+\/)/.test(u)?u.replace('/image/upload/','/image/upload/'+t+'/'):u;
const isHttps=u=>typeof u==='string'&&/^https:\/\//i.test(u);
const posterOf=u=>{const p=u.replace(/\.[a-z0-9]+(\?.*)?$/i,'.jpg');return /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(p)?p.replace('/video/upload/','/video/upload/so_0,w_640,q_auto/'):p;};
function buildMedia(p){
  const photos=(Array.isArray(p.photos)?p.photos:[]).filter(x=>x&&isHttps(x.url)).map(x=>({t:'img',url:x.url,s:cld(x.url,'f_auto,q_auto,w_900'),l:cld(x.url,'f_auto,q_auto,w_1600')}));
  const videos=(Array.isArray(p.videos)?p.videos:[]).filter(x=>x&&isHttps(x.url)).map(x=>({t:'vid',url:x.url}));
  return [...photos,...videos];
}
function slideHtml(m,i,alt){
  return m.t==='img'
    ? `<div class="mg-slide" data-i="${i}" data-mg-open="1" role="button" aria-label="ફોટો મોટો જુઓ" data-bg="${esc(m.s||m.url)}"${i===0?` style="background-image:url('${esc(m.s||m.url)}')"`:''}></div>`
    : `<div class="mg-slide mg-vid" data-i="${i}"><video src="${esc(m.url)}" poster="${esc(posterOf(m.url))}" controls playsinline preload="metadata" aria-label="${esc(alt)} વિડિયો"></video><button type="button" class="mg-full" data-mg-open="1" aria-label="મોટા સ્ક્રીનમાં જુઓ">⤢</button></div>`;
}
function sliderHtml(p,media){
  const alt=p.type||'પ્રોપર્ટી';
  const pill=`<span class="pill">${esc(p.purpose||'પ્રોપર્ટી')}</span>`;
  if(!media.length) return `<div class="photo">${pill}</div>`;
  const nav=media.length>1?`<button type="button" class="mg-nav mg-prev" data-mg-step="-1" aria-label="પાછળનો">‹</button><button type="button" class="mg-nav mg-next" data-mg-step="1" aria-label="આગળનો">›</button><span class="mg-count">1 / ${media.length}</span>`:'';
  return `<div class="photo mg-slider" data-n="${media.length}" data-cur="0"><div class="mg-track">${media.map((m,i)=>slideHtml(m,i,alt)).join('')}</div>${pill}${nav}</div>`;
}
const sliderData=new WeakMap();
function goTo(sl,idx){
  const n=+sl.dataset.n; idx=(idx+n)%n; sl.dataset.cur=idx;
  sl.querySelector('.mg-track').style.transform=`translateX(-${idx*100}%)`;
  const c=sl.querySelector('.mg-count'); if(c)c.textContent=`${idx+1} / ${n}`;
  [idx,(idx+1)%n].forEach(k=>{const s=sl.querySelector(`.mg-slide[data-i="${k}"][data-bg]`);if(s&&!s.style.backgroundImage)s.style.backgroundImage=`url('${s.dataset.bg}')`;});
  sl.querySelectorAll('video').forEach(v=>{try{v.pause()}catch(_){}});
}
let lb=null, lbMedia=[], lbIdx=0;
function ensureLb(){
  if(lb)return lb;
  lb=document.createElement('div'); lb.className='mg-lb'; lb.hidden=true;
  lb.innerHTML='<button type="button" class="mg-lb-x" aria-label="બંધ કરો">✕</button><button type="button" class="mg-nav mg-prev" data-lb="-1" aria-label="પાછળનો">‹</button><div class="mg-lb-stage"></div><button type="button" class="mg-nav mg-next" data-lb="1" aria-label="આગળનો">›</button><span class="mg-count"></span>';
  document.body.appendChild(lb);
  lb.addEventListener('click',e=>{
    if(e.target.closest('.mg-lb-x')||e.target===lb||e.target.classList.contains('mg-lb-stage')){closeLb();return;}
    const s=e.target.closest('[data-lb]'); if(s)showLb(lbIdx+ +s.dataset.lb);
  });
  let sx=null; lb.addEventListener('touchstart',e=>{sx=e.touches[0].clientX},{passive:true});
  lb.addEventListener('touchend',e=>{if(sx==null||lbMedia.length<2)return;const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)showLb(lbIdx+(dx<0?1:-1));sx=null},{passive:true});
  document.addEventListener('keydown',e=>{if(lb.hidden)return;if(e.key==='Escape')closeLb();if(e.key==='ArrowRight')showLb(lbIdx+1);if(e.key==='ArrowLeft')showLb(lbIdx-1);});
  return lb;
}
function showLb(i){
  if(!lbMedia.length)return; lbIdx=(i+lbMedia.length)%lbMedia.length; const m=lbMedia[lbIdx]; const st=lb.querySelector('.mg-lb-stage');
  st.replaceChildren();
  if(m.t==='img'){const im=document.createElement('img');im.src=m.l||m.url;im.alt='પ્રોપર્ટી ફોટો';st.appendChild(im);}
  else{const v=document.createElement('video');v.src=m.url;v.controls=true;v.autoplay=true;v.playsInline=true;st.appendChild(v);}
  lb.querySelector('.mg-count').textContent=`${lbIdx+1} / ${lbMedia.length}`;
  lb.querySelectorAll('.mg-nav').forEach(x=>x.style.display=lbMedia.length>1?'':'none');
}
function openLb(media,i){ensureLb();lbMedia=media;lb.hidden=false;document.body.style.overflow='hidden';showLb(i);}
function closeLb(){if(!lb)return;lb.hidden=true;lb.querySelector('.mg-lb-stage').replaceChildren();document.body.style.overflow='';}
if(grid){
  grid.addEventListener('click',e=>{
    const sl=e.target.closest('.mg-slider'); if(!sl)return;
    const step=e.target.closest('[data-mg-step]');
    if(step){goTo(sl,+sl.dataset.cur + +step.dataset.mgStep);return;}
    if(e.target.closest('[data-mg-open]')){const m=sliderData.get(sl);if(m)openLb(m,+sl.dataset.cur);}
  });
  let tx=null,tsl=null;
  grid.addEventListener('touchstart',e=>{const t=e.target.closest('.mg-track');if(!t||e.target.closest('video')){tsl=null;return;}tsl=t.closest('.mg-slider');tx=e.touches[0].clientX},{passive:true});
  grid.addEventListener('touchend',e=>{if(!tsl||tx==null||+tsl.dataset.n<2)return;const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40){goTo(tsl,+tsl.dataset.cur+(dx<0?1:-1));}tx=null},{passive:true});
}

function renderLiveProperties(items) {
  if (!grid) return;
  // Only live approved items are rendered in configured mode; demo sample cards are removed.
  if (!items.length && !lastListingDoc) { grid.innerHTML='<div class="empty">હાલ મંજૂર થયેલી પ્રોપર્ટી ઉપલબ્ધ નથી. માલિકની લિસ્ટિંગ એડમિન મંજૂરી પછી અહીં દેખાશે.</div>'; }
  for (const p of items) {
    const article=document.createElement('article'); article.className='property';
    article.dataset.type=p.type||''; article.dataset.purpose=p.purpose==='ભાડે'?'rent':'sale';
    article.dataset.search=[p.location,p.type,p.title,p.description].join(' ').toLowerCase();
    const media=buildMedia(p);
    const ownerPhone=String(p.ownerPhone||'6357030198');
    const waPhone=ownerPhone.replace(/\D/g,'').replace(/^0/,'').replace(/^91(?=\d{10}$)/,'');
    const waDigits=waPhone.length===10?'91'+waPhone:waPhone;
    const waText=encodeURIComponent(`નમસ્તે, મને ${p.type||'પ્રોપર્ટી'} (${p.purpose||''}) વિશે માહિતી જોઈએ. વિસ્તાર: ${p.location||'ગાંધીનગર'}. મારું ઘર પરથી લિસ્ટિંગ જોયું છે.`);
    article.innerHTML=`${sliderHtml(p,media)}<div class="property-body"><h3>${esc(p.title||p.type||'પ્રોપર્ટી')}</h3><div class="loc">📍 ગાંધીનગર · ${esc(p.location||'વિગતો માટે સંપર્ક')}</div><div class="price">${esc(p.price||'કિંમત માટે સંપર્ક')}</div><div class="details"><span>${esc(p.type||'પ્રોપર્ટી')}</span></div></div><div class="property-foot"><a class="btn" href="tel:${esc(ownerPhone)}">📞 કોલ કરો</a><a class="wa-btn" href="https://wa.me/${esc(waDigits)}?text=${waText}" target="_blank" rel="noopener noreferrer">WhatsApp ચેટ</a></div>`;
    grid.appendChild(article);
    const slEl=article.querySelector('.mg-slider'); if(slEl) sliderData.set(slEl,media);
  }
  if(count) count.textContent=`હમણાં સુધી ${grid.querySelectorAll('.property').length} મંજૂર લિસ્ટિંગ લોડ`;
  const more=document.getElementById('loadMoreListings'); if(more) more.hidden=!hasMoreListings;
}

const CACHE_KEY='mg_first_page_v1', CACHE_MS=10*60*1000;
let lastCursorMs=null;
function readCache(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c&&Date.now()-c.t<CACHE_MS&&Array.isArray(c.items))return c;}catch(_){}return null;}
function writeCache(items,lastMs,hasMore){try{localStorage.setItem(CACHE_KEY,JSON.stringify({t:Date.now(),items,lastMs,hasMore}));}catch(_){}}
async function loadApproved(reset=false) {
  if(loadingMore || (!hasMoreListings && !reset)) return;
  loadingMore=true;
  const more=document.getElementById('loadMoreListings'); if(more){more.disabled=true;more.textContent='લોડ થઈ રહ્યું છે…';}
  try {
    if(reset){lastListingDoc=null;lastCursorMs=null;hasMoreListings=true;grid?.replaceChildren();
      const c=readCache(); if(c){lastCursorMs=c.lastMs||null;hasMoreListings=!!c.hasMore;renderLiveProperties(c.items);return;}}
    const constraints=[where('status','==','approved'),orderBy('createdAt','desc'),limit(PAGE_SIZE)];
    const isFirst=!lastListingDoc&&!lastCursorMs;
    if(lastListingDoc) constraints.push(startAfter(lastListingDoc)); else if(lastCursorMs) constraints.push(startAfter(Timestamp.fromMillis(lastCursorMs)));
    const snap=await getDocs(query(collection(db,'listings'),...constraints));
    lastListingDoc=snap.docs.at(-1)||lastListingDoc;
    hasMoreListings=snap.size===PAGE_SIZE;
    const items=snap.docs.map(d=>{const {createdAt,...r}=d.data();return {id:d.id,...r};});
    if(isFirst){const lm=snap.docs.at(-1)?.data()?.createdAt;writeCache(items,lm&&lm.toMillis?lm.toMillis():null,hasMoreListings);}
    renderLiveProperties(items);
  } catch(e) {
    console.error('Maru Ghar listing page load failed:',e);
    setStatus(`લિસ્ટિંગ લોડ ન થઈ: ${e.message||'Firebase rules અથવા index તપાસો.'}`,true);
  } finally {
    loadingMore=false;
    if(more){more.disabled=false;more.textContent='વધુ પ્રોપર્ટી જુઓ';more.hidden=!hasMoreListings;}
  }
}

async function init() {
  if (!isFirebaseConfigured()) {
    if(count) count.textContent='ડેમો લિસ્ટિંગ';
    setStatus('સેટઅપ બાકી: Firebase web config અને Cloudinary Cloud Name ભરીને જ live save/upload થશે.',true);
    return;
  }
  try {
    const app=initializeApp(firebaseConfig); db=getFirestore(app); auth=getAuth(app); liveMode=true;
    await loadApproved(true);
    setStatus(isCloudinaryConfigured()?'Firebase જોડાયું. મંજૂર લિસ્ટિંગ લોડ થઈ. ફોટા અપલોડ તૈયાર છે.':'Firebase જોડાયું; ફોટા અપલોડ માટે Cloudinary Cloud Name ભરો.',!isCloudinaryConfigured());
  } catch (e) {
    console.error('Maru Ghar Firebase init/read failed:',e);
    setStatus(`Firebase જોડાણ/રીડ નિષ્ફળ: ${e.message||'કન્ફિગરેશન અને Firestore rules તપાસો.'}`,true);
  }
}

if(form) form.addEventListener('submit', async ev=>{
  ev.preventDefault();
  if(!isFirebaseConfigured() || !db || !auth) { setStatus('લિસ્ટિંગ સાચવી શકાતી નથી: firebase-config.js માં Firebaseની સંપૂર્ણ web app માહિતી ભરો.',true); return; }
  const files=[...(document.getElementById('propertyPhotos')?.files||[])];
  submitBtn.disabled=true; submitBtn.textContent='માહિતી અને ફોટા મોકલાઈ રહ્યા છે…'; setStatus('કૃપા કરીને રાહ જુઓ…');
  try {
    // Anonymous sign-in lets the Firestore rule require an authenticated request without exposing private keys.
    if(!auth.currentUser) await signInAnonymously(auth);
    const uploaded=[];
    for(let i=0;i<files.length;i++){setStatus(`ફોટો ${i+1}/${files.length} અપલોડ થઈ રહ્યો છે…`);uploaded.push(await uploadPhoto(files[i]));}
    const vfiles=[...(document.getElementById('propertyVideos')?.files||[])];
    const uploadedVideos=[];
    for(let i=0;i<vfiles.length;i++){
      setStatus(`વિડિયો ${i+1}/${vfiles.length} અપલોડ થઈ રહ્યો છે…`);
      const v=await uploadVideo(vfiles[i],pct=>{ if(pct>=0) setStatus(`વિડિયો ${i+1}/${vfiles.length} અપલોડ: ${pct}%`); else setStatus(`નેટવર્ક સમસ્યા. ફરી પ્રયાસ ${-pct+1}/3…`,true); });
      uploadedVideos.push({url:v.url,publicId:v.publicId,format:v.format,bytes:v.bytes});
    }
    const fd=new FormData(form); const payload={
      ownerName:String(fd.get('ownerName')||'').trim(), ownerPhone:String(fd.get('ownerPhone')||'').trim(),
      type:String(fd.get('type')||''), purpose:String(fd.get('purpose')||''), location:String(fd.get('location')||'').trim(),
      price:String(fd.get('price')||'').trim(), description:String(fd.get('description')||'').trim(), ownerConsent:fd.get('ownerConsent')==='on', photos:uploaded, videos:uploadedVideos,
      status:'pending', createdAt:serverTimestamp(), submitterUid:auth.currentUser.uid
    };
    if(payload.ownerName.length<2 || payload.location.length<2) throw new Error('નામ અને વિસ્તાર યોગ્ય રીતે ભરો.');
    await addDoc(collection(db,'listings'),payload);
    form.reset(); setStatus('લિસ્ટિંગ સફળતાપૂર્વક મોકલાઈ. એડમિન મંજૂરી મળે પછી જ વેબસાઇટ અને APKમાં જાહેર થશે.');
  } catch(e) {
    console.error('Maru Ghar listing submission failed:',e);
    setStatus(`લિસ્ટિંગ મોકલવામાં નિષ્ફળ: ${e.message||'Firebase rules, Auth અને Cloudinary preset તપાસો.'}`,true);
  } finally {submitBtn.disabled=false;submitBtn.textContent='પ્રોપર્ટી મંજૂરી માટે મોકલો';}
});

const videoInput=document.getElementById('propertyVideos');
if(videoInput){videoInput.addEventListener('change',()=>{const st=document.getElementById('videoSelectionStatus');const fs=[...(videoInput.files||[])];const bad=fs.find(f=>!VIDEO_TYPES.includes(f.type)||f.size>VIDEO_MAX);if(st)st.textContent=bad?'ભૂલ: વિડિયો MP4/WEBM/MOV અને 25 MB સુધી જ હોવો જોઈએ.':(fs.length?`${fs.length} વિડિયો પસંદ કર્યા.`:'વૈકલ્પિક: MP4/WEBM/MOV, દરેક વિડિયો 25 MB સુધી.');if(bad)videoInput.value='';});}
const photoInput=document.getElementById('propertyPhotos');
if(photoInput){photoInput.addEventListener('change',()=>{const status=document.getElementById('photoSelectionStatus');const files=[...(photoInput.files||[])];if(status)status.textContent=files.length?`${files.length} ફોટા પસંદ કર્યા. દરેક ફોટો 8 MB સુધી; ફોટાની સંખ્યા પર કોઈ નક્કી મર્યાદા નથી.`:'એક સાથે અનેક ફોટા પસંદ કરી શકો છો. ફોટાની સંખ્યા પર કોઈ નક્કી મર્યાદા નથી.';});}

init();

const moreButton=document.getElementById('loadMoreListings'); if(moreButton) moreButton.addEventListener('click',()=>loadApproved(false));
