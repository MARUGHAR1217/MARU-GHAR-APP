(function(){
'use strict';
var grid=document.getElementById('properties'); if(!grid)return;
var KEY='marughar_favs_v1', favs=new Set();
try{favs=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch(_){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(Array.from(favs)));}catch(_){}}
function q(s,r){return (r||document).querySelector(s);}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return 'p'+h;}
function parsePrice(t){
  t=(t||'').replace(/[૦-૯]/g,function(d){return '૦૧૨૩૪૫૬૭૮૯'.indexOf(d);}).replace(/,/g,'');
  var m=t.match(/(\d+(\.\d+)?)/); if(!m)return null; var n=parseFloat(m[1]);
  if(/કરોડ|crore|\bcr\b/i.test(t))n*=1e7; else if(/લાખ|lakh|lac/i.test(t))n*=1e5; else if(/હજાર|thousand/i.test(t))n*=1e3;
  return n;
}
function bhkOf(c){var m=((c.dataset.search||'')+' '+((q('h3',c)||{}).textContent||'')).match(/(\d+)\s*(bhk|બીએચકે)/i);return m?+m[1]:0;}
var ord=0;
function enhance(){
  grid.querySelectorAll('article.property:not([data-x])').forEach(function(c){
    c.dataset.x='1'; c.dataset.ord=String(++ord);
    c.dataset.fid=hash(((q('h3',c)||{}).textContent||'')+'|'+((q('.loc',c)||{}).textContent||'')+'|'+((q('.price',c)||{}).textContent||'')+'|'+(((q('.property-foot a',c)||{}).getAttribute||function(){return ''}).call(q('.property-foot a',c)||{},'href')||''));
    var ph=q('.photo',c); if(!ph)return;
    var b=document.createElement('button'); b.type='button'; b.className='x-fav'; b.setAttribute('aria-label','મનપસંદમાં ઉમેરો');
    b.textContent=favs.has(c.dataset.fid)?'♥':'♡'; if(favs.has(c.dataset.fid))b.classList.add('on');
    b.addEventListener('click',function(e){e.stopPropagation();var id=c.dataset.fid;
      if(favs.has(id)){favs.delete(id);b.classList.remove('on');b.textContent='♡';}else{favs.add(id);b.classList.add('on');b.textContent='♥';}
      save();apply();});
    ph.appendChild(b);
  });
}
var bar=document.createElement('div'); bar.className='x-bar';
bar.innerHTML='<select id="xBhk" aria-label="BHK"><option value="all">BHK: બધા</option><option value="1">1 BHK</option><option value="2">2 BHK</option><option value="3">3 BHK</option><option value="4">4+ BHK</option></select>'+
 '<input id="xMin" type="number" min="0" inputmode="numeric" placeholder="ઓછામાં ઓછી કિંમત ₹">'+
 '<input id="xMax" type="number" min="0" inputmode="numeric" placeholder="વધુમાં વધુ કિંમત ₹">'+
 '<select id="xSort" aria-label="ક્રમ"><option value="new">નવી પ્રોપર્ટી પહેલાં</option><option value="low">કિંમત: ઓછીથી વધુ</option><option value="high">કિંમત: વધુથી ઓછી</option></select>'+
 '<button type="button" id="xFav" class="x-favbtn">♥ મનપસંદ</button><button type="button" id="xClear" class="x-favbtn">સાફ કરો</button>';
grid.parentNode.insertBefore(bar,grid);
function apply(){
  var bhk=q('#xBhk').value,min=+q('#xMin').value||0,max=+q('#xMax').value||Infinity,fav=q('#xFav').classList.contains('on'),sort=q('#xSort').value;
  var cards=Array.prototype.slice.call(grid.querySelectorAll('article.property')),shown=0;
  cards.forEach(function(c){
    var ok=true;
    if(bhk!=='all'){var n=bhkOf(c);ok=(bhk==='4')?n>=4:n===+bhk;}
    if(ok&&(min>0||max!==Infinity)){var p=parsePrice((q('.price',c)||{}).textContent);ok=p!=null&&p>=min&&p<=max;}
    if(ok&&fav)ok=favs.has(c.dataset.fid);
    c.classList.toggle('x-hide',!ok); if(ok&&!c.classList.contains('hidden'))shown++;
  });
  cards.sort(function(a,b){
    if(sort==='new')return a.dataset.ord-b.dataset.ord;
    var pa=parsePrice((q('.price',a)||{}).textContent),pb=parsePrice((q('.price',b)||{}).textContent);
    pa=pa==null?Infinity:pa;pb=pb==null?Infinity:pb;return sort==='low'?pa-pb:(pb===Infinity?-1:(pa===Infinity?1:pb-pa));
  });
  cards.forEach(function(c){grid.appendChild(c);});
  var empty=q('#xEmpty'); if(cards.length&&!shown){ if(!empty){empty=document.createElement('div');empty.id='xEmpty';empty.className='empty';empty.textContent='આ પસંદગી મુજબ કોઈ પ્રોપર્ટી મળી નથી. ફિલ્ટર બદલીને ફરી પ્રયાસ કરો.';grid.parentNode.insertBefore(empty,grid.nextSibling);} } else if(empty)empty.remove();
}
['xBhk','xMin','xMax','xSort'].forEach(function(id){q('#'+id).addEventListener('input',apply);});
q('#xFav').addEventListener('click',function(){this.classList.toggle('on');apply();});
q('#xClear').addEventListener('click',function(){q('#xBhk').value='all';q('#xMin').value='';q('#xMax').value='';q('#xSort').value='new';q('#xFav').classList.remove('on');apply();});
var busy=false;
new MutationObserver(function(){if(busy)return;busy=true;setTimeout(function(){enhance();apply();busy=false;},0);}).observe(grid,{childList:true});
enhance();
// Offline notice
var nb=document.createElement('div'); nb.className='x-offline'; nb.hidden=navigator.onLine!==false; nb.hidden=navigator.onLine;
nb.textContent='ઇન્ટરનેટ બંધ છે. કનેક્શન ચાલુ કરશો ત્યારે લિસ્ટિંગ લોડ થશે.';
document.body.appendChild(nb);
window.addEventListener('offline',function(){nb.hidden=false;});
window.addEventListener('online',function(){nb.hidden=true;});
})();
