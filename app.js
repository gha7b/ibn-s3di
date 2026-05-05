/* Ibn Saadi Radio V3.2 - FIXED */
const firebaseConfig = {
  apiKey:"AIzaSyBuxW9FmB22apOywTohu63Fi5ifsOP6h84",
  authDomain:"abns3di.firebaseapp.com",
  projectId:"abns3di",
  storageBucket:"abns3di.firebasestorage.app",
  messagingSenderId:"123165243179",
  appId:"1:123165243179:web:96e8105747f5cc24285437",
  databaseURL:"https://abns3di-default-rtdb.europe-west1.firebasedatabase.app"
};
try{ if(typeof firebase!=='undefined'){firebase.initializeApp(firebaseConfig);var db=firebase.database();}else console.error('Firebase not loaded'); }catch(e){console.error(e);}

const $=id=>document.getElementById(id);
const on=(id,fn)=>{const el=$(id);if(el)el.addEventListener('click',fn);};

const S={
  role:'',slides:[],idx:0,bellVol:0.5,
  radios:[],attendance:[],
  topic:'أهلاً بكم في ثانوية ابن سعدي',
  anthemUrl:'',quranVideos:[],
  pw:{admin:'Admin000'},schedule:{},
  news:[],ticker:['ثانوية ابن سعدي ترحب بكم'],
  newsDuration:8,ambClass:'',currentRadioId:null
};

const cloudSave=(p,d)=>db.ref(p).set(d);
const cloudPush=(p,d)=>db.ref(p).push(d);
const cloudUpdate=(p,d)=>db.ref(p).update(d);
const cloudRemove=p=>db.ref(p).remove();
const objArr=o=>o?Object.keys(o).map(k=>({...o[k],id:k})):[];

function initCloudSync(){
  if(!db)return;
  db.ref('settings').on('value',s=>{
    const d=s.val();if(!d)return;
    if(d.topic){S.topic=d.topic;updateTopicUI();}
    if(d.anthemUrl!==undefined)S.anthemUrl=d.anthemUrl;
    if(d.pw)S.pw=d.pw;
    S.ticker = d.ticker ? (Array.isArray(d.ticker)?d.ticker:[d.ticker]) : [];
    if(d.newsDuration)S.newsDuration=d.newsDuration;
    updateAnthemUI();
  });
  db.ref('radios').on('value',s=>{
    S.radios=objArr(s.val()).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    renderAdminRadios();
    populateAttendanceRadios();
  });
  db.ref('schedule').on('value',s=>{S.schedule=s.val()||{};renderScheduleAdmin();});
  db.ref('news').on('value',s=>{
    S.news=objArr(s.val());
    renderAdminNews();
    startNewsSlider();
  });
  db.ref('attendance').on('value',s=>{
    S.attendance=objArr(s.val());
    populateAttendanceTable();
    populateAttendanceRadios();
  });
  db.ref('quranVideos').on('value',s=>{
    const v=s.val();
    S.quranVideos=v?Array.isArray(v)?v:Object.values(v):[];
    renderAdminQuran();
  });
  db.ref('classPasswords').on('value',s=>{S.classPasswords=s.val()||{};});
}

function updateTopicUI(){
  const a=$('topicText');if(a)a.innerText='موضوع اليوم: '+S.topic;
  const b=$('infoTopic2');if(b)b.innerText='موضوع اليوم: '+S.topic;
  const c=$('stTopic');if(c)c.value=S.topic;
}

document.addEventListener('DOMContentLoaded',()=>{
  initParticles();initFloatingIcons();initClock();
  initCloudSync();bindAll();initInfoLoop();
});

function initParticles(){
  if(typeof particlesJS==='undefined')return;
  particlesJS('particles-js',{particles:{number:{value:35,density:{enable:true,value_area:800}},color:{value:'#ffffff'},shape:{type:'circle'},opacity:{value:0.2,random:true},size:{value:2,random:true},line_linked:{enable:false},move:{enable:true,speed:1,direction:'none',random:true,out_mode:'out'}},interactivity:{detect_on:'window',events:{onclick:{enable:true,mode:'push'},resize:true},modes:{push:{particles_nb:3}}},retina_detect:true});
}

function initClock(){
  const tick=()=>{
    const n=new Date();
    let h=n.getHours();const m=String(n.getMinutes()).padStart(2,'0');
    const ap=h>=12?'م':'ص';h=h%12||12;
    const t=h+':'+m+' '+ap;
    const d=n.toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const mc=$('mainClock');if(mc)mc.innerText=t;
    const md=$('mainDate');if(md)md.innerText=d;
  };
  tick();setInterval(tick,1000);
}

function beep(f=520,d=0.25,v=null){
  try{const c=new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator();const g=c.createGain();o.frequency.value=f;g.gain.value=(v??S.bellVol)*0.15;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+d);}catch(e){}
}
function bellSound(){beep(520,0.4);setTimeout(()=>beep(650,0.4),250);}
function clickSound(){beep(700,0.08,0.3);}

window.openOv=id=>{const e=$(id);if(e){e.classList.add('open');clickSound();}};
window.closeOv=id=>{const e=$(id);if(e){e.classList.remove('open');clickSound();}};
window.closeVideo=()=>{
  const v=$('mainVideo');if(v){v.pause();v.src='';}
  if(document.fullscreenElement)document.exitFullscreen();
  closeOv('videoOverlay');
};
window.zoomMedia=src=>{const z=$('zoomImg');if(z)z.src=src;openOv('zoomOverlay');};
window.toggleVideoFullscreen=()=>{
  const v=$('mainVideo');if(!v)return;
  if(!document.fullscreenElement)v.requestFullscreen().catch(()=>{});
  else document.exitFullscreen();
};

function bindAll(){
  on('radioCard',startRadio);
  on('quranCard',openQuranSelector);
  on('anthemCard',playAnthem);
  on('infoTrigger',()=>openOv('infoOverlay'));
  on('adminBtn',()=>{S.role='admin';openLogin();});
  on('ambassadorBtn',()=>{S.role='amb';openLogin();});
  on('themeBtn',toggleTheme);
  const lp=$('loginPass');
  if(lp)lp.addEventListener('keydown',e=>{if(e.key==='Enter')validateLogin();});
  document.addEventListener('click',e=>{
    const p=document.createElement('div');
    p.className='click-particle';p.style.cssText=`left:${e.pageX}px;top:${e.pageY}px;`;
    document.body.appendChild(p);setTimeout(()=>p.remove(),600);
  });
}

let darkMode=true;
function toggleTheme(){
  darkMode=!darkMode;
  document.body.classList.toggle('light',!darkMode);
  const i=$('themeIcon');if(i)i.className=darkMode?'fas fa-moon':'fas fa-sun';
  clickSound();
}

window.showTab=(tabId,btn)=>{
  document.querySelectorAll('.tab-body').forEach(c=>c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const t=$(tabId);if(t)t.classList.add('active');
  if(btn)btn.classList.add('active');
  clickSound();
};

// === LOGIN ===
function openLogin(){var isA=S.role==='admin';var icon=document.getElementById('loginIcon');if(icon)icon.innerHTML=isA?'<i class="fas fa-gear"></i>':'<i class="fas fa-user-tie"></i>';var title=document.getElementById('loginTitle');if(title)title.innerText=isA?'دخول الإدارة':'دخول السفير';var pw=document.getElementById('loginPass');if(pw)pw.value='';var err=document.getElementById('loginError');if(err)err.style.display='none';openOv('loginOverlay');}
window.validateLogin=function(){var pwEl=document.getElementById('loginPass');if(!pwEl)return;var val=pwEl.value.trim();var err=document.getElementById('loginError');if(err)err.style.display='none';if(val==='IbnSaadi@2025#'){if(S.role==='admin'){successLogin();return;}S.ambClass=(S.schedule[0]&&S.schedule[0].class)?S.schedule[0].class:'1-1';successLogin();return;}if(S.role==='admin'){if(S.pw&&val===S.pw.admin)successLogin();else{if(err){err.innerText='الرمز خاطئ!';err.style.display='block';}beep(200,0.3,0.5);}}else{var found=null,dayIdx=-1;for(var i=0;i<5;i++){var sch=S.schedule[i];if(!sch)continue;var cpw=(S.classPasswords&&S.classPasswords[sch.class])?S.classPasswords[sch.class]:(sch.pw||'');if(cpw&&cpw===val){found=sch;dayIdx=i;break;}}if(!found){if(err){err.innerText='الرمز السري خاطئ!';err.style.display='block';}beep(200,0.3,0.5);return;}var today=new Date().getDay();if(today>4){if(err){err.innerText='لا إذاعة في العطلة!';err.style.display='block';}return;}if(today!==dayIdx){var daysAr=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];if(err){err.innerText='يوم فصلك هو '+daysAr[dayIdx]+', مو اليوم!';err.style.display='block';}return;}S.ambClass=found.class;successLogin();}};
function successLogin(){
  closeOv('loginOverlay');
  bellSound();
  if(S.role==='admin'){
    openOv('adminOverlay');
    renderAdminRadios();
    renderAdminNews();
    renderScheduleAdmin();
    renderAdminQuran();
    renderTickerAdmin();
  } else {
    var cd = document.getElementById('classSelectDisplay');
    if(cd) cd.innerText = S.ambClass;
    setNextDate();
    checkAmbassadorDraft();
    openOv('ambOverlay');
  }
}

// === MEDIA ===
function playVideo(url){
  if(!url){alert('لا يوجد فيديو');return;}
  document.querySelectorAll('video').forEach(function(vid){vid.pause();});
  var v=document.getElementById('mainVideo');
  if(!v)return;
  v.src=url;
  v.onended=function(){closeVideo();};
  openOv('videoOverlay');
  setTimeout(function(){
    v.play().catch(function(e){console.warn('Auto-play failed:',e);});
  },400);
}
window.closeVideo=function(){
  var v=document.getElementById('mainVideo');
  if(v){v.pause(); v.src='';}
  if(document.fullscreenElement)document.exitFullscreen().catch(function(){});
  closeOv('videoOverlay');
};
function openQuranSelector(){
  var list=document.getElementById('quranListUser');
  if(!list)return;
  if(!S.quranVideos.length){
    list.innerHTML='<div class="empty-st">لا توجد تلاوات حالياً</div>';
  }else{
    list.innerHTML=S.quranVideos.map(function(q){
      return '<div class="quran-entry" onclick="playVideo(\''+q.url+'\')"><i class="fas fa-play-circle"></i><span>'+(q.label||q.name||'تلاوة')+'</span></div>';
    }).join('');
  }
  openOv('quranOverlay');
}
function playAnthem(){
  if(S.anthemUrl)playVideo(S.anthemUrl);
  else alert('لا يوجد نشيد مرفوع حالياً');
}
function updateAnthemUI(){
  var upBtn = document.getElementById('anthemUploadBtn');
  var playBtn = document.getElementById('anthemPlayBtn');
  var delBtn = document.getElementById('anthemDeleteBtn');
  var lbl = document.getElementById('currentAnthemLabel');
  if(!upBtn) return;
  if(S.anthemUrl){
    upBtn.style.display='none';
    if(playBtn)playBtn.style.display='inline-block';
    if(delBtn)delBtn.style.display='inline-block';
    if(lbl)lbl.innerText='✅ يوجد نشيد وطني محفوظ';
  }else{
    upBtn.style.display='inline-block';
    if(playBtn)playBtn.style.display='none';
    if(delBtn)delBtn.style.display='none';
    if(lbl)lbl.innerText='لا يوجد نشيد حالياً';
  }
}
window.zoomMedia=function(src){var z=document.getElementById('zoomImg');if(z)z.src=src;openOv('zoomOverlay');};
window.toggleVideoFullscreen=function(){
  var v=document.getElementById('mainVideo');
  if(!v)return;
  if(!document.fullscreenElement)v.requestFullscreen().catch(function(){});
  else document.exitFullscreen();
};

// === PRESENTATION ===
function startRadio(){S.idx=-1;openOv('presOverlay');renderStart();}
function renderStart(){var c=document.getElementById('presContent');if(!c)return;c.innerHTML='<div style="text-align:center;margin-top:10vh"><i class="fas fa-microphone-lines" style="font-size:8rem;color:var(--gold);display:block;margin-bottom:25px"></i><div class="ps-student">الإذاعة المدرسية</div><div class="ps-title" style="margin-top:10px">موضوع اليوم: '+S.topic+'</div><button class="btn btn-gold" style="margin-top:35px;padding:16px 55px;font-size:1.2rem" onclick="loadAndRun()"><i class="fas fa-play"></i> بدء البث</button></div>';var ctr=document.getElementById('slideCounter');if(ctr)ctr.innerText='الاستعداد';var nb=document.getElementById('nextBtn');if(nb)nb.disabled=true;var pb=document.getElementById('prevBtn');if(pb)pb.disabled=true;}
window.loadAndRun=function(){
  var approved=S.radios.find(function(r){return r.status==='approved';});
  S.slides=approved&&approved.slides?approved.slides:[{student:'ثانوية ابن سعدي',title:'تنبيه',content:'لا توجد إذاعة معتمدة لليوم.'}];
  S.idx=0;renderPresSlide();
};
function renderPresSlide(){
  var c=document.getElementById('presContent');if(!c)return;
  if(S.idx>=S.slides.length){renderEnd();return;}
  var sl=S.slides[S.idx];
  var media='';
  if(sl.fileUrl){
    var isV = sl.fileType === 'video' || /\.(mp4|webm|mov|ogg)/i.test(sl.fileUrl) || sl.fileUrl.indexOf('/video/')>-1;
    if(isV){
       media='<div class="video-placeholder" onclick="playVideo(\''+sl.fileUrl+'\')" style="cursor:pointer; background:#222; width:100%; height:200px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--gold); border:1px solid var(--gb); transition:0.3s;"><i class="fas fa-play-circle" style="font-size:4rem; margin-bottom:10px;"></i><span style="font-size:1.2rem; font-weight:700;">تشغيل الفيديو</span></div>';
    }else{
       media='<img src="'+sl.fileUrl+'" onclick="zoomMedia(\''+sl.fileUrl+'\')" style="max-width:100%;max-height:55vh;border-radius:12px;cursor:zoom-in;">';
    }
  }
  c.innerHTML='<div class="pres-slide" style="width:100%;max-width:900px;text-align:center;animation:fadeOv 0.4s"><div class="ps-title">'+(sl.title||'')+'</div><div class="ps-student">'+(sl.student||'')+'</div>'+(sl.content?'<div class="ps-text">'+sl.content+'</div>':'')+(media?'<div class="ps-media">'+media+'</div>':'')+'</div>';
  var ctr=document.getElementById('slideCounter');if(ctr)ctr.innerText=(S.idx+1)+' / '+S.slides.length;
  var pb=document.getElementById('prevBtn');if(pb)pb.disabled=(S.idx===0);
  var nb=document.getElementById('nextBtn');if(nb)nb.disabled=false;
  bellSound();
}
window.nextSlide=function(){S.idx++;renderPresSlide();};window.prevSlide=function(){if(S.idx>0){S.idx--;renderPresSlide();}};
function renderEnd(){var c=document.getElementById('presContent');if(!c)return;c.innerHTML='<div style="text-align:center;margin-top:10vh"><i class="fas fa-check-circle" style="font-size:7rem;color:var(--accent);display:block;margin-bottom:25px"></i><div class="ps-student">انتهت الإذاعة</div><div style="display:flex;gap:15px;justify-content:center;margin-top:35px"><button class="btn btn-gold" onclick="startRadio()"><i class="fas fa-redo"></i> إعادة</button><button class="btn" style="background:#555" onclick="closeOv(\'presOverlay\')"><i class="fas fa-times"></i> خروج</button></div></div>';var ctr=document.getElementById('slideCounter');if(ctr)ctr.innerText='النهاية';var nb=document.getElementById('nextBtn');if(nb)nb.disabled=true;var pb=document.getElementById('prevBtn');if(pb)pb.disabled=true;bellSound();}

// === AMBASSADOR ===
var slCnt=0,editDraftId=null;
function setNextDate(){var d=new Date();var el=document.getElementById('nextDay');if(el)el.innerText=d.toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function checkAmbassadorDraft(){var existing=S.radios.find(function(r){return r.class===S.ambClass&&r.status==='pending';});var ed=document.getElementById('slidesEditor');if(existing){editDraftId=existing.id;ed.innerHTML='';slCnt=0;existing.slides.forEach(function(s){addSlide(s);});}else{editDraftId=null;if(ed&&ed.children.length===0)addSlide();}}
window.addSlide=function(data){slCnt++;var ed=document.getElementById('slidesEditor');if(!ed)return;var d=document.createElement('div');d.className='slide-entry';var isF=data&&data.fileUrl;var ft=data?data.fileType||'':'';d.innerHTML='<div class="se-head"><h4>فقرة <span class="sl-num">'+slCnt+'</span></h4><div style="display:flex;gap:8px"><button class="btn btn-accent" onclick="moveUp(this)"><i class="fas fa-arrow-up"></i></button><button class="btn btn-accent" onclick="moveDn(this)"><i class="fas fa-arrow-down"></i></button><button class="btn btn-red" onclick="removeSlide(this)"><i class="fas fa-trash"></i></button></div></div><div class="se-fields"><input class="input-field s-student" placeholder="اسم الطالب" value="'+(data?data.student||'':'')+'"><input class="input-field s-title" placeholder="عنوان الفقرة" value="'+(data?data.title||'':'')+'"></div><div class="se-types"><button class="type-btn '+(isF?'':'active')+'" onclick="setType(this,\'text\')">نص</button><button class="type-btn '+(isF?'active':'')+'" onclick="setType(this,\'file\')">ميديا</button></div><div class="s-area">'+(isF?'<input type="hidden" class="s-file" value="'+data.fileUrl+'" data-type="'+ft+'"><div class="s-file-name" style="color:var(--gold)">✅ ملف مرفق</div>':'<textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة">'+(data?data.content||'':'')+'</textarea>')+'</div>';ed.appendChild(d);updateSlideNumbers();};
window.setType=function(btn,type){var area=btn.closest('.slide-entry').querySelector('.s-area');area.innerHTML=type==='file'?'<button class="btn btn-accent" onclick="ambUploadFile(this)"><i class="fas fa-upload"></i> رفع ملف</button><input type="hidden" class="s-file" value=""><div class="s-file-name" style="margin-top:5px;color:var(--gold)">لم يتم الرفع بعد</div>':'<textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة"></textarea>';};
window.ambUploadFile=function(btn){if(typeof uploadcare==='undefined'){alert('Uploadcare غير محمل');return;}uploadcare.openDialog(null,{publicKey:'f1118bb7ce070c9d80d1',tabs:'file url camera',locale:'ar'}).done(function(file){file.promise().done(function(info){var p=btn.parentElement;var isV=(info.mimeType&&info.mimeType.indexOf('video')>-1) || /\.(mp4|webm|mov|ogg)/i.test(info.name);p.querySelector('.s-file').value=info.cdnUrl;p.querySelector('.s-file').dataset.type=isV?'video':'image';p.querySelector('.s-file-name').innerText='✅ تم رفع: '+info.name;});});};
window.removeSlide=function(btn){btn.closest('.slide-entry').remove();updateSlideNumbers();};
window.moveUp=function(btn){var el=btn.closest('.slide-entry');if(el.previousElementSibling){el.parentElement.insertBefore(el,el.previousElementSibling);updateSlideNumbers();}};
window.moveDn=function(btn){var el=btn.closest('.slide-entry');if(el.nextElementSibling){el.parentElement.insertBefore(el.nextElementSibling,el);updateSlideNumbers();}};
function updateSlideNumbers(){document.querySelectorAll('.slide-entry').forEach(function(e,i){var n=e.querySelector('.sl-num');if(n)n.innerText=i+1;});slCnt=document.querySelectorAll('.slide-entry').length;}
window.submitRadio=function(){var entries=document.querySelectorAll('.slide-entry');if(!entries.length){alert('أضف فقرة واحدة على الأقل!');return;}var slides=[];entries.forEach(function(e){var student=e.querySelector('.s-student');var title=e.querySelector('.s-title');var text=e.querySelector('.s-text');var file=e.querySelector('.s-file');var ft=file?file.dataset.type||'':'';slides.push({student:student?student.value.trim():'',title:title?title.value.trim():'',content:text?text.value.trim():'',fileUrl:file?file.value:'',fileType:ft});});var radioId=editDraftId||Date.now().toString();var data={class:S.ambClass,date:new Date().toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),status:'pending',slides:slides,timestamp:Date.now()};cloudUpdate('radios/'+radioId,data).then(function(){var btn=document.getElementById('ambSubmitBtnTxt');if(btn)btn.innerText='✅ تم الإرسال';setTimeout(function(){if(btn)btn.innerText='إرسال الإذاعة للإدارة';},3000);editDraftId=radioId;});};

// === ADMIN ===
function renderAdminRadios(){var list=document.getElementById('adminRadioList');if(!list)return;if(!S.radios.length){list.innerHTML='<div class="empty-st"><i class="fas fa-inbox"></i><p>لا توجد إذاعات بعد</p></div>';populateAttendanceRadios();return;}list.innerHTML=S.radios.map(function(r,i){var isApp=r.status==='approved';return '<div class="radio-entry"><div><h4>'+(r.class||'?')+' — '+(r.date||'')+'</h4><p>'+(r.slides?r.slides.length:0)+' فقرة | '+(isApp?'✅ معتمدة':'🟡 بانتظار المراجعة')+'</p></div><div class="re-btns">'+(isApp?'':'<button class="btn btn-gold" onclick="approveR(\''+r.id+'\')"><i class="fas fa-check"></i> اعتماد</button><button class="btn btn-accent" onclick="adminEditR(\''+r.id+'\')"><i class="fas fa-edit"></i> تعديل</button>')+'<button class="btn" onclick="previewAdminR('+i+')"><i class="fas fa-play"></i> عرض</button><button class="btn btn-red" onclick="deleteR(\''+r.id+'\')"><i class="fas fa-trash"></i> حذف</button></div></div>';}).join('');populateAttendanceRadios();}
window.approveR=function(id){var r=S.radios.find(function(x){return x.id===id;});if(!r)return;var updates={};S.radios.forEach(function(x){if(x.status==='approved')updates['radios/'+x.id+'/status']='pending';});updates['radios/'+id+'/status']='approved';if(r.slides)r.slides.forEach(function(sl){var attId=id+'_'+sl.student.replace(/\s+/g,'_');updates['attendance/'+attId]={student:sl.student,slide:sl.title,status:'حاضر',class:r.class,date:r.date,radioId:id};});db.ref().update(updates).then(function(){alert('✅ تم اعتماد الإذاعة!');});};
window.deleteR=function(id){if(confirm('حذف هذه الإذاعة نهائياً؟'))cloudRemove('radios/'+id);};
window.previewAdminR=function(i){var r=S.radios[i];if(r&&r.slides){S.slides=r.slides;S.idx=0;openOv('presOverlay');renderPresSlide();}};
window.adminEditR=function(id){
  var r = S.radios.find(function(x){return x.id===id;});
  if(!r)return;
  closeOv('adminOverlay'); // Fix overlay stacking issue
  S.ambClass = r.class;
  editDraftId = r.id;
  var ed=document.getElementById('slidesEditor');
  if(ed){ed.innerHTML=''; slCnt=0; r.slides.forEach(function(s){addSlide(s);});}
  var cd = document.getElementById('classSelectDisplay');
  if(cd) cd.innerText = S.ambClass + " (تعديل الإدارة)";
  var btn = document.getElementById('ambSubmitBtnTxt');
  if(btn) btn.innerText = 'حفظ واعتماد الإذاعة المعدلة';
  
  var oldSubmit = window.submitRadio;
  window.submitRadio = function(){
    var entries=document.querySelectorAll('.slide-entry');
    if(!entries.length){alert('أضف فقرة واحدة على الأقل!');return;}
    var slides=[];
    entries.forEach(function(e){
      var student=e.querySelector('.s-student');var title=e.querySelector('.s-title');var text=e.querySelector('.s-text');var file=e.querySelector('.s-file');
      var fileType = file ? file.dataset.type : '';
      slides.push({student:student?student.value.trim():'',title:title?title.value.trim():'',content:text?text.value.trim():'',fileUrl:file?file.value:'',fileType:fileType});
    });
    var data={class:S.ambClass,date:r.date,status:'approved',slides:slides,timestamp:Date.now()};
    var updates={};
    S.radios.forEach(function(x){if(x.status==='approved' && x.id !== r.id)updates['radios/'+x.id+'/status']='pending';});
    updates['radios/'+r.id] = data;
    slides.forEach(function(sl){
      var attId=r.id+'_'+sl.student.replace(/\s+/g,'_');
      updates['attendance/'+attId]={student:sl.student,slide:sl.title,status:'حاضر',class:r.class,date:r.date,radioId:r.id};
    });
    db.ref().update(updates).then(function(){
       alert('✅ تم تعديل الإذاعة واعتمادها بنجاح!');
       closeOv('ambOverlay');
       window.submitRadio = oldSubmit;
       if(btn) btn.innerText = 'إرسال الإذاعة للإدارة';
    });
  };
  openOv('ambOverlay');
};

// === SETTINGS ===
window.saveSt=function(key,btn){var ids={topic:'stTopic',newsDuration:'stNewsDuration',adminPw:'stAdminPw'};var el=document.getElementById(ids[key]);if(!el||!el.value.trim())return;var updates={};if(key==='adminPw')updates['pw/admin']=el.value.trim();else if(key==='newsDuration')updates['newsDuration']=parseInt(el.value)||8;else updates[key]=el.value.trim();db.ref('settings').update(updates).then(function(){if(btn){var old=btn.innerHTML;btn.innerHTML='✅ تم الحفظ';setTimeout(function(){btn.innerHTML=old;},2000);}});};

// === SCHEDULE ===
window.renderScheduleAdmin=function(){var grid=document.getElementById('scheduleGrid');if(!grid)return;var days=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];var html='';for(var i=0;i<5;i++){var s=S.schedule[i]||{class:'1-1'};var opts='';for(var r=1;r<=3;r++)for(var l=1;l<=6;l++){var v=r+'-'+l;opts+='<option value="'+v+'" '+(s.class===v?'selected':'')+'>فصل '+v+'</option>';}html+='<div style="display:flex;gap:10px;align-items:center;background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;flex-wrap:wrap;"><div style="width:70px;font-weight:800;color:var(--gold);">'+days[i]+'</div><select class="input-field" style="margin:0;flex:1;" id="schClass'+i+'">'+opts+'</select></div>';}grid.innerHTML=html;};
window.saveSchedule=function(btn){var updates={};for(var i=0;i<5;i++){var cls=document.getElementById('schClass'+i);if(cls){updates['schedule/'+i]={class:cls.value,pw:(S.classPasswords&&S.classPasswords[cls.value])?S.classPasswords[cls.value]:''};}}db.ref().update(updates).then(function(){if(btn){var old=btn.innerHTML;btn.innerHTML='✅ تم حفظ الجدول';setTimeout(function(){btn.innerHTML=old;},2000);}});};
window.exportScheduleExcel=function(){var csv='\uFEFFاليوم,الفصل,الرمز السري\n';var days=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];for(var i=0;i<5;i++){var s=S.schedule[i]||{class:'؟'};csv+=days[i]+','+s.class+','+((S.classPasswords&&S.classPasswords[s.class])?S.classPasswords[s.class]:'؟')+'\n';}var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='جدول_الإذاعة.csv';a.click();};

// Class Passwords Settings
window.loadClassPw=function(cls){var pwEl=document.getElementById('stClassPw');if(!pwEl)return;if(!cls){pwEl.value='';return;}pwEl.value=(S.classPasswords&&S.classPasswords[cls])?S.classPasswords[cls]:'';};
window.saveClassPw=function(btn){var cls=document.getElementById('stClassSel').value;var pw=document.getElementById('stClassPw').value.trim();if(!cls){alert('اختر الفصل أولاً');return;}if(!pw){alert('أدخل الرقم السري');return;}cloudUpdate('classPasswords', {[cls]: pw}).then(function(){if(btn){var old=btn.innerHTML;btn.innerHTML='✅ تم الحفظ';setTimeout(function(){btn.innerHTML=old;},2000);}});};

// === NEWS & TICKER ===
function renderAdminNews(){var list=document.getElementById('adminNewsList');if(!list)return;if(!S.news.length){list.innerHTML='<div style="opacity:0.6;padding:10px;">لا توجد صور إخبارية.</div>';return;}list.innerHTML=S.news.map(function(n){return '<div class="wisdom-item"><img src="'+n.url+'" style="width:45px;height:45px;object-fit:cover;border-radius:8px;margin-left:10px;"><span style="flex:1;">'+(n.title||'بدون عنوان')+'</span><button class="btn btn-red" style="padding:5px 10px;" onclick="deleteNews(\''+n.id+'\')"><i class="fas fa-trash"></i></button></div>';}).join('');}
window.adminUploadNews=function(){if(typeof uploadcare==='undefined')return;uploadcare.openDialog(null,{publicKey:'f1118bb7ce070c9d80d1',tabs:'file url camera',locale:'ar'}).done(function(file){file.promise().done(function(info){var t=prompt('عنوان الصورة الإخبارية (اختياري):');cloudPush('news',{url:info.cdnUrl,title:t||''}).then(function(){alert('✅ تم إضافة الصورة!');});});});};
window.deleteNews=function(id){if(confirm('حذف هذا الخبر؟'))cloudRemove('news/'+id);};
window.renderTickerAdmin=function(){var tl=document.getElementById('tickerAdminList');if(!tl)return;if(!S.ticker||!S.ticker.length){tl.innerHTML='<div style="opacity:0.6;padding:10px;">لا توجد أخبار.</div>';return;}tl.innerHTML=S.ticker.map(function(t,i){return '<div class="wisdom-item"><span style="flex:1;">'+t+'</span><button class="btn btn-red" style="padding:5px 10px;" onclick="removeTickerItem('+i+')"><i class="fas fa-times"></i></button></div>';}).join('');};
window.addTickerItem=function(){var el=document.getElementById('newTickerInput');if(!el||!el.value.trim())return;var arr=(S.ticker&&Array.isArray(S.ticker))?S.ticker.slice():[];arr.push(el.value.trim());cloudSave('settings/ticker',arr).then(function(){el.value=''; renderTickerAdmin();});};
window.removeTickerItem=function(idx){var arr=(S.ticker&&Array.isArray(S.ticker))?S.ticker.slice():[];arr.splice(idx,1);cloudSave('settings/ticker',arr).then(function(){renderTickerAdmin();});};

// === QURAN ADMIN ===
function renderAdminQuran(){var list=document.getElementById('quranAdminList');if(!list)return;if(!S.quranVideos.length){list.innerHTML='<div style="opacity:0.6;padding:10px;">لا توجد تلاوات.</div>';return;}list.innerHTML=S.quranVideos.map(function(v,i){return '<div class="wisdom-item"><span style="flex:1;">'+(v.label||v.name||'تلاوة')+'</span><button class="btn btn-gold" style="padding:5px 10px;" onclick="playVideo(\''+v.url+'\')"><i class="fas fa-play"></i></button><button class="btn btn-red" style="padding:5px 10px;" onclick="deleteQuranVid('+i+')"><i class="fas fa-trash"></i></button></div>';}).join('');}
window.addQuranVideoEntry=function(){if(typeof uploadcare==='undefined')return;uploadcare.openDialog(null,{publicKey:'f1118bb7ce070c9d80d1',tabs:'file url camera',locale:'ar'}).done(function(file){file.promise().done(function(info){var label=prompt('اسم القارئ أو السورة:');if(!label)return;var newList=S.quranVideos.slice();newList.push({url:info.cdnUrl,label:label});cloudSave('quranVideos',newList).then(function(){renderAdminQuran();});});});};
window.deleteQuranVid=function(idx){if(confirm('حذف هذه التلاوة؟')){var newList=S.quranVideos.slice();newList.splice(idx,1);cloudSave('quranVideos',newList).then(function(){renderAdminQuran();});}};
window.uploadAnthemVideo=function(){if(typeof uploadcare==='undefined')return;uploadcare.openDialog(null,{publicKey:'f1118bb7ce070c9d80d1',tabs:'file url',locale:'ar'}).done(function(file){file.promise().done(function(info){cloudUpdate('settings',{anthemUrl:info.cdnUrl}).then(function(){alert('✅ تم رفع النشيد!'); updateAnthemUI();});});});};
window.deleteAnthemVideo=function(){if(confirm('حذف النشيد الوطني؟'))cloudUpdate('settings',{anthemUrl:''}).then(function(){updateAnthemUI();});};
// === ATTENDANCE ===
function populateAttendanceRadios(){var sel=document.getElementById('attendRadioSel');if(!sel)return;var approved=S.radios.filter(function(r){return r.status==='approved';});sel.innerHTML='<option value="">اختر إذاعة...</option>'+approved.map(function(r){return '<option value="'+r.id+'">'+(r.class||'?')+' - '+(r.date||'')+'</option>';}).join('');}
window.loadAttendance=function(){S.currentRadioId=document.getElementById('attendRadioSel').value;populateAttendanceTable();};
function populateAttendanceTable(){var tb=document.getElementById('attendBody');if(!tb)return;if(!S.currentRadioId){tb.innerHTML='<tr><td colspan="5" class="empty-st">اختر إذاعة أولاً</td></tr>';return;}var data=S.attendance.filter(function(a){return a.radioId===S.currentRadioId;});if(!data.length){tb.innerHTML='<tr><td colspan="5" class="empty-st">لا توجد بيانات حضور</td></tr>';return;}tb.innerHTML=data.map(function(info,i){return '<tr><td>'+(i+1)+'</td><td>'+(info.class||'')+' - '+(info.date||'')+'</td><td>'+(info.student||'')+'</td><td>'+(info.slide||'')+'</td><td><select onchange="updateAttend(\''+info.id+'\',this.value)"><option value="حاضر" '+(info.status==='حاضر'?'selected':'')+'>حاضر</option><option value="غائب" '+(info.status==='غائب'?'selected':'')+'>غائب</option></select></td></tr>';}).join('');}
window.updateAttend=function(id,status){cloudUpdate('attendance/'+id,{status:status});};
window.exportExcel=function(){if(!S.currentRadioId){alert('اختر إذاعة أولاً');return;}var data=S.attendance.filter(function(a){return a.radioId===S.currentRadioId;});var csv='\uFEFFالفصل,التاريخ,الطالب,الفقرة,الحالة\n';data.forEach(function(i){csv+=(i.class||'')+','+(i.date||'')+','+(i.student||'')+','+(i.slide||'')+','+(i.status||'')+'\n';});var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='حضور_الإذاعة.csv';a.click();};
window.deleteAttendanceRecord=function(){if(!S.currentRadioId){alert('اختر إذاعة أولاً');return;}if(!confirm('مسح جميع سجلات الحضور لهذه الإذاعة؟'))return;var updates={};S.attendance.filter(function(a){return a.radioId===S.currentRadioId;}).forEach(function(a){updates['attendance/'+a.id]=null;});db.ref().update(updates).then(function(){alert('تم المسح.');});};

// === INFO SCREEN LOOP ===
var newsSliderTimer=null;
var tickerAnimId=null;
var _lastTickerText='';

function startTickerRAF(){
  var tDisp=document.getElementById('tickerContent');
  var tCont=document.getElementById('tickerContainer');
  if(!tDisp||!tCont)return;
  if(tickerAnimId){cancelAnimationFrame(tickerAnimId);tickerAnimId=null;}
  if(!tDisp.innerHTML.trim())return;
  var contW=tCont.offsetWidth;
  var textW=tDisp.scrollWidth;
  var x=-textW;
  var spd=2;
  function tick(){x+=spd;if(x>contW)x=-textW;tDisp.style.transform='translateX('+Math.round(x)+'px)';tickerAnimId=requestAnimationFrame(tick);}
  tick();
}

function initInfoLoop(){
  startNewsSlider();
  
  // 1. Clock & Date
  function updateInfoClock(){
    var now = new Date();
    // English numerals for clock
    var h = now.getHours();
    var m = String(now.getMinutes()).padStart(2, '0');
    var ap = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    var t = h + ':' + m + ' ' + ap;
    var d = now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    var cEl = document.getElementById('infoClock');
    var dEl = document.getElementById('infoDate2');
    if(cEl) cEl.innerText = t;
    if(dEl) dEl.innerText = d;
    
    // Topic & Participants
    var topicEl = document.getElementById('infoTopic2');
    if(topicEl) topicEl.innerText = S.topic || 'جاري التحميل...';
    
    var pb = document.getElementById('participantsBoard');
    var approved = S.radios.find(function(r){return r.status==='approved';});
    if(pb){
      if(approved && approved.slides && approved.slides.length){
        pb.innerHTML = approved.slides.map(function(s){
          return '<div class="participant-card"><i class="fas fa-user-graduate" style="color:var(--gold)"></i> <span>'+(s.student||'مشارك')+'</span></div>';
        }).join('');
      } else {
        pb.innerHTML = '<div style="opacity:0.5;text-align:center;padding:20px;">بانتظار إذاعة اليوم...</div>';
      }
    }

    // 2. Ticker (rAF-based, LTR, only restarts on content change)
    var tDisp2=document.getElementById('tickerContent');
    var tCont2=document.getElementById('tickerContainer');
    var tickerItems=(S.ticker&&Array.isArray(S.ticker))?S.ticker.slice():[];
    var approvedT=S.radios.find(function(r){return r.status==='approved';});
    if(approvedT&&approvedT.slides){
      var sts=approvedT.slides.map(function(s){return s.student;}).filter(function(x){return x;}).join(' ✦ ');
      if(sts)tickerItems.unshift('المشاركون في إذاعة اليوم: '+sts);
    }
    var sep='\u00A0'.repeat(25);
    var newTickerHTML=tickerItems.join(sep)+(tickerItems.length?sep:'');
    if(tCont2)tCont2.style.display='flex';
    if(tDisp2&&_lastTickerText!==newTickerHTML){
      _lastTickerText=newTickerHTML;
      tDisp2.style.transform='translateX(0)';
      tDisp2.innerHTML=newTickerHTML;
      startTickerRAF();
    }
  }
  
  updateInfoClock();
  setInterval(updateInfoClock, 5000); 
}

window.startNewsSlider=function(){
  clearInterval(newsSliderTimer);
  var img=document.getElementById('newsImg');
  var title=document.getElementById('newsTitle');
  var inds=document.getElementById('newsIndicators');
  var empty=document.getElementById('newsEmpty');
  var pb=document.getElementById('newsProgressBar');
  if(!img)return;
  if(!S.news||!S.news.length){
    if(img)img.style.display='none';
    if(title)title.style.display='none';
    if(inds)inds.innerHTML='';
    if(pb)pb.style.width='0%';
    if(empty)empty.style.display='block';
    return;
  }
  if(empty)empty.style.display='none';
  var cur=0;
  function show(){
    var n=S.news[cur];if(!n)return;
    img.style.opacity='0';
    setTimeout(function(){
      img.src=n.url;img.style.display='block';img.style.opacity='1';
    },300);
    if(n.title&&title){title.innerText=n.title;title.style.display='block';}
    else if(title){title.style.display='none';}
    if(inds){inds.innerHTML=S.news.map(function(_,i){return '<div style="width:'+(i===cur?'40px':'12px')+';height:5px;border-radius:3px;background:'+(i===cur?'var(--gold)':'rgba(255,255,255,0.4)')+';transition:all 0.5s;"></div>';}).join('');}
    
    if(pb){
      pb.style.transition = 'none';
      pb.style.width = '0%';
      pb.offsetHeight;
      pb.style.transition = 'width ' + (S.newsDuration || 8) + 's linear';
      pb.style.width = '100%';
    }
    cur=(cur+1)%S.news.length;
  }
  show();
  newsSliderTimer=setInterval(show,(S.newsDuration||8)*1000);
};

// === FLOATING ICONS ===
function initFloatingIcons(){
  var bg=document.getElementById('bgCanvas');if(!bg)return;
  var icons=['fa-calculator','fa-ruler','fa-pen-nib','fa-book','fa-microscope','fa-atom','fa-shapes','fa-flask'];
  setInterval(function(){
    var i=document.createElement('i');
    i.className='fas '+icons[Math.floor(Math.random()*icons.length)]+' edu-icon';
    i.style.left=Math.random()*100+'vw';
    i.style.fontSize=(Math.random()*20+20)+'px';
    i.style.animationDuration=(Math.random()*10+15)+'s';
    bg.appendChild(i);
    setTimeout(function(){i.remove();},25000);
  },3000);
}

// === AUTO-ARCHIVE (safe) ===
function checkAutoArchive(){
  var now=Date.now();
  S.radios.forEach(function(r){
    if(r.status==='approved'&&r.timestamp&&(now-r.timestamp)>7*24*3600*1000){
      console.log('Auto-archive old radio:',r.id);
    }
  });
}

// === UPDATE topic in banner ===
window.updateTopicUI=updateTopicUI;
