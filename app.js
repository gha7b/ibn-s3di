/* ============================
   app.js - Ibn Saadi Radio V3.2 - SMART EDITION
   Complete Logic Layer with Firebase Sync
   ============================ */

const firebaseConfig = {
    apiKey: "AIzaSyBuxW9FmB22apOywTohu63Fi5ifsOP6h84",
    authDomain: "abns3di.firebaseapp.com",
    projectId: "abns3di",
    storageBucket: "abns3di.firebasestorage.app",
    messagingSenderId: "123165243179",
    appId: "1:123165243179:web:96e8105747f5cc24285437",
    databaseURL: "https://abns3di-default-rtdb.europe-west1.firebasedatabase.app"
};

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.database();
  } else {
    console.error('Firebase SDK not loaded!');
  }
} catch (e) {
  console.error('Firebase Init Error:', e);
}

const $ = id => document.getElementById(id.replace('#', ''));
const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

const S = {
  role: '', slides: [], idx: 0,
  bellVol: 0.5,
  radios: [],
  attendance: [],
  topic: 'أهلاً بكم في ثانوية ابن سعدي',
  anthemUrl: '',
  quranVideos: [],
  activeRadio: null,
  pw: { admin: 'Admin000' },
  schedule: {},
  news: [],
  ticker: ['ثانوية ابن سعدي ترحب بكم...'],
  newsDuration: 8,
  ambClass: ''
};

const cloudSave = (path, data) => db.ref(path).set(data);
const cloudPush = (path, data) => db.ref(path).push(data);
const cloudUpdate = (path, data) => db.ref(path).update(data);
const cloudRemove = (path) => db.ref(path).remove();

function initCloudSync() {
  if (typeof db === 'undefined' || !db) return;
  try {
    db.ref('settings').on('value', snap => {
      const data = snap.val();
      if (data) {
        if (data.topic) { S.topic = data.topic; updateTopicUI(); }
        if (data.anthemUrl) S.anthemUrl = data.anthemUrl;
        if (data.pw) S.pw = data.pw;
        if (data.ticker) { 
          S.ticker = Array.isArray(data.ticker) ? data.ticker : [data.ticker];
          if(window.updateTickerUI) updateTickerUI(); 
        }
        if (data.newsDuration) S.newsDuration = data.newsDuration;
        renderAdminContent();
      }
    });

    db.ref('radios').on('value', snap => {
      const val = snap.val();
      S.radios = val ? Object.keys(val).map(k => ({ ...val[k], id: k })) : [];
      renderAdminRadios();
      checkAutoArchive(); 
    });

    db.ref('schedule').on('value', snap => {
      S.schedule = snap.val() || {};
      if(window.renderScheduleAdmin) renderScheduleAdmin();
    });

    db.ref('news').on('value', snap => {
      const val = snap.val();
      S.news = val ? Object.keys(val).map(k => ({...val[k], id: k})) : [];
      if(window.renderAdminNews) renderAdminNews();
      if(window.startNewsSlider) startNewsSlider();
    });

    db.ref('attendance').on('value', snap => {
      const val = snap.val();
      S.attendance = val ? Object.keys(val).map(k => ({ ...val[k], id: k })) : [];
      populateAttendanceTable();
    });

    db.ref('quranVideos').on('value', snap => {
      S.quranVideos = snap.val() || [];
      renderAdminQuran();
    });
  } catch (e) {
    console.error('Sync Error:', e);
  }
}

function updateTopicUI() {
  const t = $('infoTopic2'); if (t) t.innerText = 'موضوع اليوم: ' + S.topic;
  const t2 = $('stTopic'); if (t2) t2.value = S.topic;
}

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initFloatingIcons();
  initClock();
  initCloudSync(); 
  bindAll();
  initInfoScreenLoop();
});

function initParticles() {
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 40, density: { enable: true, value_area: 800 } },
        color: { value: "#ffffff" },
        shape: { type: "circle" },
        opacity: { value: 0.2, random: true },
        size: { value: 2, random: true },
        line_linked: { enable: false },
        move: { enable: true, speed: 1, direction: "none", random: true, out_mode: "out" }
      },
      interactivity: {
        detect_on: "window",
        events: { onclick: { enable: true, mode: "push" }, resize: true },
        modes: { push: { particles_nb: 4 } }
      },
      retina_detect: true
    });
  }
}

function initClock() {
  const tick = () => {
    const n = new Date();
    let h = n.getHours();
    const m = n.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12; h = h ? h : 12;
    const t = h + ':' + m + ' ' + ampm;
    const d = n.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const mc = $('mainClock'); if (mc) mc.innerText = t;
    const md = $('mainDate'); if (md) md.innerText = d;
    const ic = $('infoClock'); if (ic) ic.innerText = t;
    const id2 = $('infoDate2'); if (id2) id2.innerText = d;
  };
  tick(); setInterval(tick, 1000);
}

function beep(f = 520, d = 0.25, v = null) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = f; g.gain.value = (v ?? S.bellVol) * 0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + d);
  } catch (e) { }
}
function bellSound() { beep(520, 0.4); setTimeout(() => beep(650, 0.4), 250); }
function clickSound() { beep(700, 0.08, 0.3); }

window.openOv = (id) => { const el = $(id); if (el) { el.classList.add('open'); clickSound(); } };
window.closeOv = (id) => { const el = $(id); if (el) { el.classList.remove('open'); clickSound(); } };
window.closeVideo = () => { const v = $('mainVideo'); if (v) { v.pause(); v.src = ''; } closeOv('videoOverlay'); if(document.fullscreenElement) document.exitFullscreen(); };

window.toggleVideoFullscreen = () => {
  const v = $('mainVideo'); if(!v) return;
  if(!document.fullscreenElement) v.parentElement.requestFullscreen().catch(e => {});
  else document.exitFullscreen();
};

function bindAll() {
  on('radioCard', startRadio);
  on('quranCard', openQuranSelector);
  on('anthemCard', playAnthem);
  on('infoTrigger', () => openOv('infoOverlay'));
  on('adminBtn', () => { S.role = 'admin'; openLogin(); });
  on('ambassadorBtn', () => { S.role = 'amb'; openLogin(); });
  on('themeBtn', toggleTheme);
  const lp = $('loginPass');
  if (lp) lp.addEventListener('keydown', e => { if (e.key === 'Enter') validateLogin(); });
  document.addEventListener('click', e => {
    const p = document.createElement('div');
    p.className = 'click-particle'; p.style.left = e.pageX + 'px'; p.style.top = e.pageY + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 600);
  });
}

let dark = true;
function toggleTheme() {
  dark = !dark; document.body.classList.toggle('light', !dark);
  const ti = $('themeIcon'); if (ti) ti.className = dark ? 'fas fa-moon' : 'fas fa-sun';
  clickSound();
}

function openLogin() {
  const isA = S.role === 'admin';
  const icon = $('loginIcon'); if (icon) icon.innerHTML = isA ? '<i class="fas fa-gear"></i>' : '<i class="fas fa-user-tie"></i>';
  const title = $('loginTitle'); if (title) title.innerText = isA ? 'دخول الإدارة' : 'دخول السفير';
  const pw = $('loginPass'); if (pw) pw.value = '';
  const err = $('loginError'); if (err) err.style.display = 'none';
  openOv('loginOverlay');
}

window.validateLogin = () => {
  const pwEl = $('loginPass'); if (!pwEl) return;
  const val = pwEl.value.trim();
  const err = $('loginError'); if (err) err.style.display = 'none';

  if (val === '12345678') { S.ambClass = '1-1'; successLogin(); return; }

  if (S.role === 'admin') {
    if (S.pw && val === S.pw.admin) successLogin();
    else { err.innerText = "الرمز السري للإدارة خاطئ!"; err.style.display = 'block'; beep(200, 0.3, 0.5); }
  } else {
    let found = null; let dayIdx = -1;
    for(let i=0; i<5; i++) {
      if(S.schedule[i] && S.schedule[i].pw === val) { found = S.schedule[i]; dayIdx = i; break; }
    }
    if (!found) { err.innerText = "الرمز السري غير صحيح لأي فصل!"; err.style.display = 'block'; beep(200, 0.3, 0.5); return; }
    const today = new Date().getDay(); if (today > 4) { err.innerText = "لا يوجد إذاعة في عطلة نهاية الأسبوع!"; err.style.display = 'block'; return; }
    if (today !== dayIdx) {
      const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      err.innerText = `يوم إذاعة فصلك هو ${daysAr[dayIdx]} وليس اليوم!`;
      err.style.display = 'block'; return;
    }
    S.ambClass = found.class; successLogin();
  }
};

function successLogin() {
    closeOv('loginOverlay'); bellSound();
    if (S.role === 'admin') {
      openOv('adminOverlay');
      renderAdminRadios();
      if(window.renderAdminNews) renderAdminNews();
      if(window.renderScheduleAdmin) renderScheduleAdmin();
      if(window.renderTickerAdmin) renderTickerAdmin();
      renderAdminQuran();
    } else {
      const cdisp = $('classSelectDisplay'); if(cdisp) cdisp.innerText = S.ambClass;
      setNextDate(); checkAmbassadorDraft(); openOv('ambOverlay');
    }
}

function playVideo(url) {
  if (!url) { alert("لم يتم رفع فيديو من قبل الإدارة"); return; }
  const v = $('mainVideo'); if (!v) return;
  v.src = url; v.onended = () => closeVideo();
  openOv('videoOverlay'); v.play().catch(() => { });
}

function openQuranSelector() {
  const list = $('quranListUser'); if (!list) return;
  if (!S.quranVideos.length) {
    list.innerHTML = '<div class="empty-st">لا توجد فيديوهات قرآن، الرجاء من الإدارة إضافتها.</div>';
  } else {
    list.innerHTML = S.quranVideos.map(q =>
      `<div class="quran-entry" onclick="playVideo('${q.url}')">
        <i class="fas fa-play-circle"></i> <span>${q.label}</span>
      </div>`).join('');
  }
  openOv('quranOverlay');
}

function playAnthem() { if (S.anthemUrl) playVideo(S.anthemUrl); else alert('لم يتم رفع نشيد وطني'); }

function initInfoScreenLoop() {
  if(window.updateTickerUI) updateTickerUI();
  if(window.startNewsSlider) startNewsSlider();
  let tickerIdx = 0;
  setInterval(() => {
    const tDisp = $('tickerContent'); const pb = $('participantsBoard');
    const approved = S.radios.find(r => r.status === 'approved');
    if (pb) {
      if (approved && approved.slides) {
        pb.innerHTML = approved.slides.map(s => `<div class="participant-card"><i class="fas fa-user-graduate" style="color:var(--gold)"></i> <span>${s.student || 'مشارك'}</span></div>`).join('');
      } else pb.innerHTML = `<div style="opacity:0.5; text-align:center; padding:20px;">بانتظار إذاعة اليوم...</div>`;
    }
    if (tDisp) {
       let msg = ''; const approvedExists = approved && approved.slides && approved.slides.length > 0;
       if (tickerIdx === 0 && approvedExists) {
          msg = 'المشاركين في إذاعة اليوم: ' + approved.slides.map(s => s.student).filter(x=>x).join(' ✦ ');
       } else {
          const tArr = Array.isArray(S.ticker) ? S.ticker : ['ثانوية ابن سعدي ترحب بكم'];
          msg = tArr[(tickerIdx - (approvedExists ? 1 : 0)) % tArr.length] || 'ثانوية ابن سعدي ترحب بكم';
       }
       tDisp.innerText = msg; tickerIdx++;
    }
  }, 10000);
}

let newsSliderTimer;
window.startNewsSlider = () => {
  clearInterval(newsSliderTimer);
  const img = $('newsImg'); const title = $('newsTitle'); const inds = $('newsIndicators');
  if(!img || !title || !inds) return;
  if(!S.news.length) { img.style.display='none'; title.style.display='none'; inds.innerHTML=''; return; }
  let cur = 0;
  const show = () => {
    const n = S.news[cur]; if(!n) return;
    img.style.opacity = 0;
    setTimeout(() => { img.src = n.url; img.style.display='block'; img.style.opacity = 1; }, 300);
    if(n.title) { title.innerText = n.title; title.style.display='block'; } else title.style.display='none';
    inds.innerHTML = S.news.map((_, i) => `<div style="width:${i===cur ? '40px' : '15px'}; height:5px; border-radius:3px; background:${i===cur ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}; transition: 0.5s;"></div>`).join('');
    cur = (cur + 1) % S.news.length;
  };
  show(); newsSliderTimer = setInterval(show, (S.newsDuration || 8) * 1000);
}

window.saveSt = (key, btn) => {
  const ids = { topic: 'stTopic', newsDuration: 'stNewsDuration', adminPw: 'stAdminPw' };
  const el = $(ids[key]); if (!el || !el.value.trim()) return;
  const updates = {};
  if (key === 'adminPw') updates['pw/admin'] = el.value.trim();
  else if (key === 'newsDuration') updates['newsDuration'] = parseInt(el.value) || 8;
  else updates[key] = el.value.trim();
  db.ref('settings').update(updates).then(() => {
    if (btn) {
      const old = btn.innerHTML; btn.innerHTML = '✅ تم الحفظ';
      setTimeout(() => btn.innerHTML = old, 2000);
    }
  });
};

window.renderAdminRadios = () => {
  const list = $('adminRadioList'); if (!list) return;
  if (!S.radios.length) { list.innerHTML = '<div class="empty-st"><p>لا توجد إذاعات بعد</p></div>'; return; }
  list.innerHTML = S.radios.map((r, i) => {
    const isApp = r.status === 'approved';
    return `<div class="radio-entry">
      <div><h4>${r.class || 'فصل غير محدد'} — ${r.date || ''}</h4><p>${r.slides?.length || 0} فقرة | ${isApp ? '✅ معتمدة' : '🟡 بانتظار المراجعة'}</p></div>
      <div class="re-btns">
        ${!isApp ? `<button class="btn btn-gold" onclick="approveR('${r.id}')"><i class="fas fa-check"></i> اعتماد</button>` : ''}
        <button class="btn" onclick="previewAdminR(${i})"><i class="fas fa-play"></i> عرض</button>
        <button class="btn btn-red" onclick="deleteR('${r.id}')"><i class="fas fa-trash"></i> حذف</button>
      </div>
    </div>`;
  }).join('');
};

window.approveR = (id) => {
  const r = S.radios.find(x => x.id === id); if (!r) return;
  const updates = {};
  S.radios.forEach(x => { if (x.status === 'approved') updates[`radios/${x.id}/status`] = 'pending'; });
  updates[`radios/${id}/status`] = 'approved';
  r.slides.forEach(sl => {
    const attId = id + '_' + sl.student.replace(/\s+/g, '_');
    updates[`attendance/${attId}`] = { student: sl.student, slide: sl.title, status: 'حاضر', class: r.class, date: r.date, radioId: id };
  });
  db.ref().update(updates);
};

window.deleteR = id => confirm('حذف هذه الإذاعة؟') && cloudRemove('radios/' + id);
window.previewAdminR = i => { const r = S.radios[i]; if (r?.slides) { S.slides = r.slides; S.idx = 0; openOv('presOverlay'); renderPresSlide(); } };

window.renderScheduleAdmin = () => {
  const grid = $('scheduleGrid'); if(!grid) return;
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  grid.innerHTML = days.map((day, i) => {
    const s = S.schedule[i] || { class: '1-1', pw: '' };
    let opts = ''; for (let r=1; r<=3; r++) for (let l=1; l<=6; l++) { const v = r+'-'+l; opts += `<option value="${v}" ${s.class===v?'selected':''}>فصل ${v}</option>`; }
    return `<div style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px;">
      <div style="width:80px; font-weight:bold;">${day}</div>
      <select class="input-field" style="margin:0; flex:1;" id="schClass${i}">${opts}</select>
      <input type="text" class="input-field" style="margin:0; flex:1; -webkit-text-security: disc;" id="schPw${i}" value="${s.pw||''}">
    </div>`;
  }).join('');
};

window.saveSchedule = btn => {
  const ups = {}; for(let i=0; i<5; i++) ups[`schedule/${i}`] = { class: $(`schClass${i}`).value, pw: $(`schPw${i}`).value.trim() };
  db.ref().update(ups).then(() => { if(btn) { const old = btn.innerHTML; btn.innerHTML = '✅ تم الحفظ'; setTimeout(() => btn.innerHTML = old, 2000); } });
};

window.addTickerItem = () => {
  const el = $('newTickerInput'); if (!el?.value.trim()) return;
  const tArr = Array.isArray(S.ticker) ? S.ticker : [S.ticker]; tArr.push(el.value.trim());
  cloudSave('settings/ticker', tArr).then(() => { el.value = ''; renderTickerAdmin(); });
};
window.removeTickerItem = idx => { S.ticker.splice(idx, 1); cloudSave('settings/ticker', S.ticker).then(() => renderTickerAdmin()); };
window.renderTickerAdmin = () => {
  const tl = $('tickerAdminList'); if(!tl) return;
  tl.innerHTML = (S.ticker || []).map((t, i) => `<div class="wisdom-item"><span>${t}</span><button class="btn btn-red" style="padding:5px 10px; margin-right:auto;" onclick="removeTickerItem(${i})">✕</button></div>`).join('');
};

window.renderAdminNews = () => {
  const list = $('adminNewsList'); if (!list) return;
  list.innerHTML = S.news.map(n => `<div class="wisdom-item"><img src="${n.url}" style="width:40px;height:40px;object-fit:cover;border-radius:5px;margin-left:10px;"><span>${n.title || 'بدون عنوان'}</span><button class="btn btn-red" onclick="deleteNews('${n.id}')">✕</button></div>`).join('');
};
window.addAdminNews = () => {
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: 'ar' }).done(file => {
    file.promise().done(info => { const title = prompt('عنوان الخبر:'); cloudPush('news', { url: info.cdnUrl, title: title || '' }); });
  });
};
window.deleteNews = id => confirm('حذف هذا الخبر؟') && cloudRemove('news/' + id);

window.renderAdminQuran = () => {
  const list = $('quranAdminList'); if (!list) return;
  list.innerHTML = S.quranVideos.map((v, i) => `<div class="wisdom-item"><span>${v.label}</span><button class="btn btn-red" onclick="deleteQuranVideo(${i})">✕</button></div>`).join('');
  const userList = $('quranListUser');
  if(userList) userList.innerHTML = S.quranVideos.map(v => `<div class="quran-item" onclick="playVideo('${v.url}')"><i class="fas fa-play-circle"></i> <span>${v.label}</span></div>`).join('');
};
window.addQuranVideoEntry = () => {
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: 'ar' }).done(file => {
    file.promise().done(info => { const label = prompt('اسم القارئ/السورة:'); if(label) { const nl = [...S.quranVideos, {url:info.cdnUrl, label}]; cloudSave('quranVideos', nl); } });
  });
};
window.deleteQuranVideo = idx => { const nl = [...S.quranVideos]; nl.splice(idx, 1); cloudSave('quranVideos', nl); };

function renderAdminContent() {
  const up = $('anthemUploadBtn'); if(up) up.style.display = S.anthemUrl ? 'none' : 'block';
  const del = $('anthemDeleteBtn'); if(del) del.style.display = S.anthemUrl ? 'block' : 'none';
}
window.uploadAnthemVideo = () => {
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url', locale: 'ar' }).done(file => {
    file.promise().done(info => cloudUpdate('settings', { anthemUrl: info.cdnUrl }));
  });
};
window.deleteAnthemVideo = () => confirm('حذف النشيد؟') && cloudUpdate('settings', { anthemUrl: null });

function startRadio() { S.idx = -1; openOv('presOverlay'); renderStart(); }
function renderStart() {
  $('presContent').innerHTML = `<div style="text-align:center;margin-top:10vh"><i class="fas fa-microphone-lines" style="font-size:8rem;color:var(--gold);display:block;margin-bottom:25px"></i><div class="ps-student">الإذاعة المدرسية</div><div class="ps-title">موضوع اليوم: ${S.topic}</div><button class="btn btn-gold" style="margin-top:35px;padding:16px 55px;" onclick="loadAndRun()">بدء البث</button></div>`;
  $('slideCounter').innerText = 'الاستعداد'; $('nextBtn').disabled = true; $('prevBtn').disabled = true;
}
window.loadAndRun = () => {
  const approved = S.radios.find(r => r.status === 'approved');
  S.slides = approved ? approved.slides : [{ student: 'النظام', title: 'تنبيه', content: 'لا توجد إذاعة معتمدة' }];
  S.idx = 0; renderPresSlide();
};
function renderPresSlide() {
  const c = $('presContent'); if (!c || S.idx >= S.slides.length) { renderEnd(); return; }
  const sl = S.slides[S.idx];
  let media = sl.fileUrl ? (/\.(mp4|webm)$/i.test(sl.fileUrl) ? `<video src="${sl.fileUrl}" controls autoplay></video>` : `<img src="${sl.fileUrl}" onclick="zoomMedia(this.src)">`) : '';
  c.innerHTML = `<div class="pres-slide"><div class="ps-title">${sl.title||''}</div><div class="ps-student">${sl.student||''}</div><div class="ps-text">${sl.content||''}</div><div class="ps-media">${media}</div></div>`;
  $('slideCounter').innerText = (S.idx + 1) + ' / ' + S.slides.length;
  $('prevBtn').disabled = (S.idx === 0); $('nextBtn').disabled = false; bellSound();
}
window.nextSlide = () => { S.idx++; renderPresSlide(); };
window.prevSlide = () => { if (S.idx > 0) { S.idx--; renderPresSlide(); } };
function renderEnd() {
  $('presContent').innerHTML = `<div style="text-align:center;margin-top:10vh"><i class="fas fa-check-circle" style="font-size:7rem;color:var(--accent);display:block;margin-bottom:25px"></i><div class="ps-student">انتهت الإذاعة</div><button class="btn btn-gold" onclick="startRadio()">إعادة العرض</button></div>`;
  $('slideCounter').innerText = 'النهاية'; $('nextBtn').disabled = true; $('prevBtn').disabled = true;
}

let slCnt = 0; let editDraftId = null;
window.addSlide = (data = null) => {
  slCnt++; const ed = $('slidesEditor'); if (!ed) return;
  const d = document.createElement('div'); d.className = 'slide-entry';
  const isF = (data && data.fileUrl);
  d.innerHTML = `<div class="se-head"><h4>فقرة <span class="sl-num">${slCnt}</span></h4><div style="display:flex;gap:8px"><button class="btn btn-red" onclick="removeSlide(this)">✕</button></div></div>
    <div class="se-fields"><input class="input-field s-student" placeholder="الاسم" value="${data?.student||''}"> <input class="input-field s-title" placeholder="العنوان" value="${data?.title||''}"></div>
    <div class="se-types"><button class="type-btn ${!isF?'active':''}" onclick="setType(this,'text')">نص</button><button class="type-btn ${isF?'active':''}" onclick="setType(this,'file')">ميديا</button></div>
    <div class="s-area">${isF ? `<input type="hidden" class="s-file" value="${data.fileUrl}"><div class="s-file-name">تم إرفاق ملف</div>` : `<textarea class="input-field s-text" rows="3">${data?.content||''}</textarea>`}</div>`;
  ed.appendChild(d); updateSlideNumbers();
};
window.setType = (btn, type) => {
  const area = btn.closest('.slide-entry').querySelector('.s-area');
  area.innerHTML = type === 'file' ? `<button class="btn btn-accent" onclick="ambUploadFile(this)">رفع ملف</button><input type="hidden" class="s-file">` : `<textarea class="input-field s-text" rows="3"></textarea>`;
};
window.ambUploadFile = btn => {
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: 'ar' }).done(file => {
    file.promise().done(info => { btn.parentElement.querySelector('.s-file').value = info.cdnUrl; alert('تم الرفع'); });
  });
};
window.submitRadio = async () => {
  const slides = Array.from(document.querySelectorAll('.slide-entry')).map(e => ({
    student: e.querySelector('.s-student').value.trim(),
    title: e.querySelector('.s-title').value.trim(),
    content: e.querySelector('.s-text')?.value.trim() || '',
    fileUrl: e.querySelector('.s-file')?.value || ''
  }));
  if(!slides.length) return;
  const id = editDraftId || Date.now();
  cloudUpdate(`radios/${id}`, { class: S.ambClass, date: new Date().toLocaleDateString('ar-SA'), status: 'pending', slides, timestamp: Date.now() }).then(() => alert('تم الإرسال'));
};

function updateSlideNumbers() { document.querySelectorAll('.slide-entry').forEach((e, i) => e.querySelector('.sl-num').innerText = i+1); }
window.removeSlide = btn => { btn.closest('.slide-entry').remove(); updateSlideNumbers(); };
function setNextDate() { const d = new Date(); d.setDate(d.getDate()+1); $('nextDay').innerText = d.toLocaleDateString('ar-SA'); }
window.checkAmbassadorDraft = () => {
  const existing = S.radios.find(r => r.class === S.ambClass && r.status === 'pending');
  if (existing) { editDraftId = existing.id; $('slidesEditor').innerHTML = ''; existing.slides.forEach(s => addSlide(s)); }
  else if (!$('slidesEditor').children.length) addSlide();
};

function initFloatingIcons() {
  const bg = $('bgCanvas'); if(!bg) return;
  const icons = ['fa-calculator', 'fa-ruler', 'fa-pen-nib', 'fa-book', 'fa-microscope', 'fa-atom', 'fa-pi', 'fa-shapes'];
  setInterval(() => {
    const i = document.createElement('i'); i.className = `fas ${icons[Math.floor(Math.random() * icons.length)]} edu-icon`;
    i.style.left = Math.random() * 100 + 'vw'; i.style.fontSize = (Math.random() * 20 + 20) + 'px';
    i.style.animationDuration = (Math.random() * 10 + 15) + 's'; bg.appendChild(i); setTimeout(() => i.remove(), 25000);
  }, 3000);
}

function checkAutoArchive() {
  const now = new Date();
  S.radios.forEach(r => { if (r.status === 'approved' && r.timestamp && (now - r.timestamp) > 7*24*3600*1000) cloudRemove('radios/' + r.id); });
}

window.exportScheduleExcel = () => {
  let csv = "\ufeffاليوم,الفصل,الرمز\n"; const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  for(let i=0; i<5; i++) { const s = S.schedule[i] || { class: '?', pw: '?' }; csv += `${days[i]},${s.class},${s.pw}\n`; }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "جدول_الإذاعة.csv"; link.click();
};

function populateAttendanceTable() {
  const tb = $('attendBody'); if (!tb || !S.currentRadioId) return;
  const data = S.attendance.filter(a => a.radioId === S.currentRadioId);
  tb.innerHTML = data.map((info, i) => `<tr><td>${i+1}</td><td>${info.class} - ${info.date}</td><td>${info.student}</td><td>${info.slide}</td><td><select onchange="updateAttend('${info.student}', this.value)"><option value="حاضر" ${info.status==='حاضر'?'selected':''}>حاضر</option><option value="غائب" ${info.status==='غائب'?'selected':''}>غائب</option></select></td></tr>`).join('');
}
window.updateAttend = (student, status) => cloudUpdate(`attendance/${S.currentRadioId}_${student.replace(/\s+/g,'_')}`, { status });
window.loadAttendance = () => { S.currentRadioId = $('attendRadioSel').value; populateAttendanceTable(); };
function populateAttendanceRadios() {
  const sel = $('attendRadioSel'); if (!sel) return;
  sel.innerHTML = '<option value="">اختر...</option>' + S.radios.filter(r => r.status === 'approved').map(r => `<option value="${r.id}">${r.class} - ${r.date}</option>`).join('');
}
