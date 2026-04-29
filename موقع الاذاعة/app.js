/* ============================
   app.js - Ibn Saadi Radio V3.1 - CLOUD EDITION
   Complete Logic Layer with Firebase Sync
   ============================ */

// ══════════════════ FIREBASE CONFIG ══════════════════
const firebaseConfig = {
    apiKey: "AIzaSyBuxW9FmB22apOywTohu63Fi5ifsOP6h84",
    authDomain: "abns3di.firebaseapp.com",
    projectId: "abns3di",
    storageBucket: "abns3di.firebasestorage.app",
    messagingSenderId: "123165243179",
    appId: "1:123165243179:web:96e8105747f5cc24285437",
    databaseURL: "https://abns3di-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const $ = id => document.getElementById(id.replace('#', ''));
const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

// ─── STATE ───
const S = {
  role: '', slides: [], idx: 0,
  gallery: [], folders: ['عام', 'إذاعة', 'فعاليات'], currentFolder: 'عام',
  galTimer: null, galIdx: 0, slideDuration: 5,
  bellVol: 0.5,
  radios: [],
  attendance: [],
  topic: 'أهلاً بكم في ثانوية ابن سعدي',
  wisdoms: ['العلم يبني بيوتاً لا عماد لها والجهل يهدم بيت العز والكرم'],
  wisdomDuration: 10,
  currentWisdomIdx: 0,
  anthemUrl: '',
  quranVideos: [],
  activeRadio: null,
  activeGallery: [],
  pw: { admin: '12345678', amb: '12345678' }
};

// ─── CLOUD SYNC HELPERS ───
const cloudSave = (path, data) => db.ref(path).set(data);
const cloudPush = (path, data) => db.ref(path).push(data);
const cloudUpdate = (path, data) => db.ref(path).update(data);
const cloudRemove = (path) => db.ref(path).remove();

// ─── REALTIME LISTENERS ───
function initCloudSync() {
  db.ref('settings').on('value', snap => {
    const data = snap.val();
    if (data) {
      if (data.topic) { S.topic = data.topic; updateTopicUI(); }
      if (data.wisdoms) S.wisdoms = data.wisdoms;
      if (data.wisdomDuration) S.wisdomDuration = data.wisdomDuration;
      if (data.anthemUrl) S.anthemUrl = data.anthemUrl;
      if (data.pw) S.pw = data.pw;
    }
  });

  db.ref('radios').on('value', snap => {
    const val = snap.val();
    S.radios = val ? Object.keys(val).map(k => ({ ...val[k], id: k })) : [];
    renderAdminRadios();
    checkAutoArchive(); 
    loadAndRun(); 
  });

  db.ref('gallery').on('value', snap => {
    const val = snap.val();
    S.gallery = val ? Object.keys(val).map(k => ({ ...val[k], id: k })) : [];
    renderGalleryGridUser();
    renderGalleryGridAdmin();
  });

  db.ref('folders').on('value', snap => {
    S.folders = snap.val() || ['عام', 'إذاعة', 'فعاليات'];
    renderFoldersAdmin();
    renderFoldersUser();
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
}

function updateTopicUI() {
  const t = $('infoTopic2'); if (t) t.innerText = 'موضوع اليوم: ' + S.topic;
  const t2 = $('stTopic'); if (t2) t2.value = S.topic;
}

// ─── START ───
window.onload = () => {
  initParticles();
  initClock();
  initCloudSync(); // This replaces loadLocalRadios and loadSettings
  bindAll();
  buildClasses();
  initInfoScreenLoop();
};

function initParticles() {
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 60, density: { enable: true, value_area: 800 } },
        color: { value: "#ffffff" },
        shape: { type: "circle" },
        opacity: { value: 0.3, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.2, width: 1 },
        move: { enable: true, speed: 2, direction: "none", random: true, out_mode: "out" }
      },
      interactivity: {
        detect_on: "canvas",
        events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: true, mode: "push" }, resize: true },
        modes: { grab: { distance: 140, line_linked: { opacity: 0.8 } }, push: { particles_nb: 3 } }
      },
      retina_detect: true
    });
  }
}

// ─── CLOCK (12 Hour Format) ───
function initClock() {
  const tick = () => {
    const n = new Date();
    let h = n.getHours();
    const m = n.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12;
    h = h ? h : 12; // 0 should be 12

    const t = h + ':' + m + ' ' + ampm;
    const d = n.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const mc = $('mainClock'); if (mc) mc.innerText = t;
    const md = $('mainDate'); if (md) md.innerText = d;
    const ic = $('infoClock'); if (ic) ic.innerText = t;
    const id2 = $('infoDate2'); if (id2) id2.innerText = d;
  };
  tick();
  setInterval(tick, 1000);
}

function loadLocalRadios() {
  try {
    const local = JSON.parse(localStorage.getItem('radios') || '[]');
    S.radios = [...local].reverse();
  } catch (e) {
    S.radios = [];
  }
}

// ─── SOUND ───
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

// ─── OVERLAY ───
window.openOv = (id) => { const el = $(id); if (el) { el.classList.add('open'); clickSound(); } };
window.closeOv = (id) => { const el = $(id); if (el) { el.classList.remove('open'); clickSound(); } };
window.closeVideo = () => { const v = $('mainVideo'); if (v) { v.pause(); v.src = ''; } closeOv('videoOverlay'); if(document.fullscreenElement) document.exitFullscreen(); };

window.toggleVideoFullscreen = () => {
  const v = $('mainVideo');
  if(!v) return;
  if(!document.fullscreenElement) v.parentElement.requestFullscreen().catch(e => {});
  else document.exitFullscreen();
};

window.toggleFullscreenGallery = () => {
  const el = $('slideshowOverlay');
  if(!document.fullscreenElement) el.requestFullscreen().catch(e => {});
  else document.exitFullscreen();
};

// ─── BIND EVENTS ───
function bindAll() {
  on('radioCard', startRadio);
  on('quranCard', openQuranSelector);
  on('anthemCard', playAnthem);
  on('infoTrigger', () => openOv('infoOverlay'));
  on('galleryTrigger', () => openUserGallery());

  on('adminBtn', () => { S.role = 'admin'; openLogin(); });
  on('ambassadorBtn', () => { S.role = 'amb'; openLogin(); });
  on('themeBtn', toggleTheme);

  const lp = $('loginPass');
  if (lp) lp.addEventListener('keydown', e => { if (e.key === 'Enter') validateLogin(); });
}

// ─── THEME ───
let dark = true;
function toggleTheme() {
  dark = !dark;
  document.body.classList.toggle('light', !dark);
  const ti = $('themeIcon');
  if (ti) ti.className = dark ? 'fas fa-moon' : 'fas fa-sun';
  clickSound();
}

// ─── LOGIN ───
function openLogin() {
  const isA = S.role === 'admin';
  const icon = $('loginIcon'); if (icon) icon.innerHTML = isA ? '<i class="fas fa-gear"></i>' : '<i class="fas fa-user-tie"></i>';
  const title = $('loginTitle'); if (title) title.innerText = isA ? 'دخول الإدارة' : 'دخول السفراء';
  const pw = $('loginPass'); if (pw) pw.value = '';
  const err = $('loginError'); if (err) err.style.display = 'none';
  openOv('loginOverlay');
}

window.validateLogin = () => {
  const pw = $('loginPass'); if (!pw) return;
  const val = pw.value.trim();
  const correct = S.role === 'admin'
    ? (localStorage.getItem('adminPw') || S.pw.admin)
    : (localStorage.getItem('ambPw') || S.pw.amb);
  if (val === correct) {
    closeOv('loginOverlay'); bellSound();
    if (S.role === 'admin') {
      openOv('adminOverlay');
      loadAdminRadios();
      renderWisdoms();
      renderAdminQuran();
      renderFoldersAdmin();
      renderGalleryGridAdmin();
    } else {
      buildClasses();
      setNextDate();
      checkAmbassadorDraft();
      openOv('ambOverlay');
    }
  } else {
    const err = $('loginError'); if (err) err.style.display = 'block';
    beep(200, 0.3, 0.5);
  }
};

// ─── MEDIA ───
function playVideo(url) {
  if (!url) { alert("لم يتم رفع فيديو من قبل الإدارة"); return; }
  const v = $('mainVideo'); if (!v) return;
  v.src = url;
  v.onended = () => closeVideo();
  openOv('videoOverlay');
  v.play().catch(() => { });
}

// ─── QURAN ───
function openQuranSelector() {
  const list = $('quranListUser'); if (!list) return;
  if (!S.quranVideos.length) {
    list.innerHTML = '<div class="empty-st">لا توجد فيديوهات قرآن، الرجاء من الإدارة إضافتها.</div>';
  } else {
    list.innerHTML = S.quranVideos.map(q =>
      '<div class="quran-entry" onclick="playQuranVideo(\'' + q.url + '\')">' +
      '<i class="fas fa-play-circle"></i>' +
      '<span>' + q.name + '</span>' +
      '</div>'
    ).join('');
  }
  openOv('quranOverlay');
}

window.playQuranVideo = (url) => {
  closeOv('quranOverlay');
  playVideo(url);
}

window.addQuranVideoEntry = () => {
  if (typeof uploadcare === 'undefined') { alert('Uploadcare not loaded'); return; }
  uploadcare.openDialog(null, {
    publicKey: 'f1118bb7ce070c9d80d1',
    tabs: 'file url',
    locale: 'ar'
  }).done(file => {
    file.promise().done(info => {
      const name = prompt("ما هو اسم القارئ أو السورة؟", "تلاوة جديدة");
      if (name) {
        S.quranVideos.push({ name: name, url: info.cdnUrl, id: Date.now() });
        localStorage.setItem('quranVideos', JSON.stringify(S.quranVideos));
        renderAdminQuran();
      }
    });
  });
};

window.deleteQuranVideo = (id) => {
  S.quranVideos = S.quranVideos.filter(q => q.id !== id);
  localStorage.setItem('quranVideos', JSON.stringify(S.quranVideos));
  renderAdminQuran();
};

function renderAdminQuran() {
  const list = $('quranAdminList'); if (!list) return;
  if (!S.quranVideos.length) {
    list.innerHTML = '<div style="opacity:0.6;padding:10px">لم يتم إضافة تلاوات بعد.</div>';
    return;
  }
  list.innerHTML = S.quranVideos.map(q => 
    '<div class="wisdom-item">' +
      '<span>' + q.name + '</span>' +
      '<div style="display:flex;gap:5px">' +
        '<button class="btn btn-gold" style="padding:5px 10px;border-radius:10px" onclick="playQuranVideo(\'' + q.url + '\')"><i class="fas fa-play"></i></button>' +
        '<button class="btn btn-red" style="padding:5px 10px;border-radius:10px" onclick="deleteQuranVideo(' + q.id + ')"><i class="fas fa-trash"></i></button>' +
      '</div>' +
    '</div>'
  ).join('');
}

// ─── ANTHEM ───
window.uploadAnthemVideo = () => {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, {
    publicKey: 'f1118bb7ce070c9d80d1',
    tabs: 'file url',
    locale: 'ar'
  }).done(file => {
    file.promise().done(info => {
      localStorage.setItem('anthemUrl', info.cdnUrl);
      const lbl = $('currentAnthemLabel');
      if (lbl) lbl.innerText = "تم حفظ النشيد الجديد بنجاح!";
    });
  });
}

window.deleteAnthemVideo = () => {
  if (!confirm('هل تريد مسح النشيد الوطني الحالي؟')) return;
  localStorage.removeItem('anthemUrl');
  const lbl = $('currentAnthemLabel');
  if (lbl) lbl.innerText = "تم إزالة النشيد الوطني بنجاح.";
}

function playAnthem() {
  const url = localStorage.getItem('anthemUrl');
  playVideo(url);
}

// ─── GALLERY (USER VIEW) ───
function openUserGallery() {
  renderFoldersUser();
  renderGalleryGridUser();
  openOv('galleryOverlay');
}

function renderFoldersUser() {
  const f = localStorage.getItem('folders');
  if (f) S.folders = JSON.parse(f);
  const ft = $('folderTabs'); if (!ft) return;
  ft.innerHTML = S.folders.map(fol =>
    '<div class="folder-tab ' + (S.currentFolder === fol ? 'active' : '') + '" onclick="selectFolderUser(\'' + fol + '\')">' + fol + '</div>'
  ).join('');
}

window.selectFolderUser = (fol) => {
  S.currentFolder = fol;
  renderFoldersUser();
  renderGalleryGridUser();
};

function renderGalleryGridUser() {
  const g = localStorage.getItem('gallery');
  if (g) S.gallery = JSON.parse(g);
  const grid = $('galleryGrid'); if (!grid) return;
  grid.innerHTML = '';
  const filtered = S.gallery.filter(x => x.folder === S.currentFolder);
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;opacity:0.5">لا توجد صور في هذا المجلد</div>';
    return;
  }
  filtered.forEach(item => {
    const d = document.createElement('div');
    d.className = 'gal-item';
    d.innerHTML = 
      '<img src="' + item.src + '" onclick="toggleSelectGal(\'' + item.id + '\', this)">' +
      '<div class="gal-label">' + item.name.slice(0, 15) + '</div>' +
      '<input type="checkbox" class="chk" value="' + item.id + '" onclick="event.stopPropagation()">';
    grid.appendChild(d);
  });
}

// ─── GALLERY (ADMIN) ───
window.createFolder = () => {
  if (S.role !== 'admin') return;
  const name = prompt('اسم المجلد الجديد:');
  if (name && !S.folders.includes(name)) {
    S.folders.push(name);
    cloudSave('folders', S.folders).then(() => {
      alert('تم إنشاء المجلد بنجاح');
    });
  }
};

window.deleteFolder = () => {
  if (S.role !== 'admin') return;
  if (S.currentFolder === 'عام') { alert('لا يمكن حذف المجلد العام!'); return; }
  if (confirm('هل أنت متأكد من حذف المجلد "' + S.currentFolder + '" بجميع صوره؟')) {
    const newGal = S.gallery.filter(x => x.folder !== S.currentFolder);
    const newFolders = S.folders.filter(f => f !== S.currentFolder);
    
    const updates = {};
    updates['gallery'] = newGal;
    updates['folders'] = newFolders;
    
    db.ref().update(updates).then(() => {
      S.currentFolder = 'عام';
      alert('تم حذف المجلد بنجاح');
    });
  }
}

function renderFoldersAdmin() {
  const f = localStorage.getItem('folders');
  if (f) S.folders = JSON.parse(f);
  const ft = $('adminFolderTabs'); if (!ft) return;
  ft.innerHTML = S.folders.map(fol =>
    '<div class="folder-tab ' + (S.currentFolder === fol ? 'active' : '') + '" onclick="selectFolderAdmin(\'' + fol + '\')">' + fol + '</div>'
  ).join('');
}

window.selectFolderAdmin = (fol) => {
  S.currentFolder = fol;
  renderFoldersAdmin();
  renderGalleryGridAdmin();
};

window.adminUploadGallery = () => {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, {
    publicKey: 'f1118bb7ce070c9d80d1',
    multiple: true,
    tabs: 'file url camera',
    locale: 'ar'
  }).done(result => {
    // result is a fileGroup
    Promise.all(result.files().map(f => f.promise())).then(infos => {
      const updates = {};
      infos.forEach(info => {
        const id = db.ref('gallery').push().key;
        updates[`gallery/${id}`] = { src: info.cdnUrl, name: info.name || 'صورة', folder: S.currentFolder };
      });
      db.ref().update(updates).then(() => {
        alert('تم رفع الصور بنجاح!');
      });
    }).catch(e => {
      alert('حدث خطأ أثناء الرفع، يرجى المحاولة مرة أخرى.');
    });
  });
};

function renderGalleryGridAdmin() {
  const g = localStorage.getItem('gallery');
  if (g) S.gallery = JSON.parse(g);
  const grid = $('adminGalleryGrid'); if (!grid) return;
  grid.innerHTML = '';
  const filtered = S.gallery.filter(x => x.folder === S.currentFolder);
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;opacity:0.5">لا توجد صور في هذا المجلد</div>';
    return;
  }
  filtered.forEach(item => {
    const d = document.createElement('div');
    d.className = 'gal-item';
    d.innerHTML =
      '<img src="' + item.src + '" onclick="toggleSelectGal(\'' + item.id + '\', this)">' +
      '<div class="gal-label">' + item.name.slice(0, 15) + '</div>' +
      '<input type="checkbox" class="chk" value="' + item.id + '" onclick="event.stopPropagation()">';
    grid.appendChild(d);
  });
}

window.toggleSelectGal = (id, imgEl) => {
  const chk = imgEl.parentElement.querySelector('.chk');
  chk.checked = !chk.checked;
  if (chk.checked) imgEl.parentElement.classList.add('selected');
  else imgEl.parentElement.classList.remove('selected');
};

window.deleteSelectedImages = () => {
  const chks = document.querySelectorAll('#adminGalleryGrid .chk:checked');
  if (!chks.length) return;
  if (!confirm('حذف الصور المحددة؟')) return;
  const ids = Array.from(chks).map(c => c.value);
  const updates = {};
  ids.forEach(id => {
    updates[`gallery/${id}`] = null;
  });
  db.ref().update(updates).then(() => {
    alert('تم حذف الصور المحددة');
  });
};

window.saveDuration = (val) => {
  const d = parseInt(val) || 5;
  cloudSave('settings/galDuration', d).then(() => {
    alert('تم تحديث مدة العرض');
  });
}

// ─── SLIDESHOW ───
window.startSlideshow = (isAdminPreview = false) => {
  const filtered = S.gallery.filter(x => x.folder === S.currentFolder);
  let targets = [];

  if (isAdminPreview) {
    const chks = document.querySelectorAll('#adminGalleryGrid .chk:checked');
    if (chks.length) {
      const ids = Array.from(chks).map(c => c.value);
      targets = S.gallery.filter(x => ids.includes(x.id.toString()));
    } else {
      targets = filtered;
    }
  } else {
    const chks = document.querySelectorAll('#galleryGrid .chk:checked');
    if (chks.length) {
      const ids = Array.from(chks).map(c => c.value);
      targets = S.gallery.filter(x => ids.includes(x.id.toString()));
    } else {
      targets = filtered;
    }
  }

  if (!targets.length) { alert('لا توجد صور للعرض'); return; }

  S.slideDuration = parseInt(localStorage.getItem('galDuration')) || 5;
  S.galIdx = 0;
  S.activeGallery = targets;

  showSlideFrame();
  openOv('slideshowOverlay');
  
  // Auto fullscreen
  if(!document.fullscreenElement) {
    $('slideshowOverlay').requestFullscreen().catch(e => {});
  }

  clearInterval(S.galTimer);
  S.galTimer = setInterval(() => {
    ssNext();
  }, S.slideDuration * 1000);
};

function showSlideFrame() {
  const item = S.activeGallery[S.galIdx];
  const img = $('slideshowImg'); if (img) img.src = item.src;
  const ctr = $('ssCounter'); if (ctr) ctr.innerText = (S.galIdx + 1) + ' / ' + S.activeGallery.length;

  const bar = $('ssBar');
  if (bar) {
    bar.style.animation = 'none';
    bar.offsetHeight;
    bar.style.animation = 'progressAnim ' + S.slideDuration + 's linear';
  }
}

window.ssNext = () => {
  if (S.galIdx < S.activeGallery.length - 1) {
    S.galIdx++;
    showSlideFrame();
  } else {
    // Loop
    S.galIdx = 0;
    showSlideFrame();
  }
};
window.ssPrev = () => {
  if (S.galIdx > 0) {
    S.galIdx--;
    showSlideFrame();
  }
};
window.stopSlideshow = () => {
  clearInterval(S.galTimer);
  S.galTimer = null;
  closeOv('slideshowOverlay');
};


// ─── RADIO PRESENTATION ───
function startRadio() {
  S.idx = -1; openOv('presOverlay'); renderStart();
}

function renderStart() {
  const c = $('presContent'); if (!c) return;
  const t = localStorage.getItem('topic') || 'لم يتم تحديد موضوع';
  c.innerHTML = '<div style="animation:fadeInOv .5s;text-align:center;margin-top:10vh">' +
    '<i class="fas fa-microphone-lines" style="font-size:8rem;color:var(--gold);display:block;margin-bottom:25px"></i>' +
    '<div class="ps-student">الإذاعة المدرسية</div>' +
    '<div class="ps-title" style="margin-top:10px">موضوع اليوم: ' + t + '</div>' +
    '<button class="btn btn-gold" style="margin-top:35px;padding:16px 55px;font-size:1.2rem" onclick="loadAndRun()">' +
    '<i class="fas fa-play"></i> بدء البث' +
    '</button></div>';
  const ctr = $('slideCounter'); if (ctr) ctr.innerText = 'الاستعداد';
  const nb = $('nextBtn'); if (nb) nb.disabled = true;
  const pb = $('prevBtn'); if (pb) pb.disabled = true;
}

window.loadAndRun = async () => {
  const c = $('presContent'); if (c) c.innerHTML = '<div class="ps-student" style="color:var(--gold);margin-top:20vh">جاري التحميل...</div>';
  
  const now = new Date();
  const hours = now.getHours();
  const todayStr = now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  let approved = S.radios.find(r => r.status === 'approved');
  
  if (approved && hours >= 14 && approved.date === todayStr) {
    S.slides = [{ student: 'النظام الذكي', title: 'انتهت إذاعة اليوم', content: 'تم أرشفة إذاعة اليوم تلقائياً في تمام الساعة 2 ظهراً. بانتظار إذاعة اليوم القادم.' }];
  } else if (approved) {
    S.slides = approved.slides || [];
  } else {
    S.slides = [{ student: 'ثانوية ابن سعدي', title: 'تنبيه', content: 'لا توجد إذاعة معتمدة لليوم.' }];
  }
  S.idx = 0; renderPresSlide();
};

function checkAutoArchive() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  if (now.getHours() >= 14) {
    const approved = S.radios.find(r => r.status === 'approved' && r.date === todayStr);
    if (approved) {
      // Just update UI flag, data stays for records
      console.log('Smart Protocol: Radio Archived');
    }
  }
}

function renderPresSlide() {
  const c = $('presContent'); if (!c) return;
  if (S.idx >= S.slides.length) { renderEnd(); return; }
  const sl = S.slides[S.idx];
  let media = '';
  if (sl.fileUrl) {
    const isV = /\.(mp4|webm|mov|ogg)$/i.test(sl.fileUrl) || sl.fileUrl.includes('video');
    media = isV
      ? '<video src="' + sl.fileUrl + '" controls autoplay></video>'
      : '<img src="' + sl.fileUrl + '" onclick="zoomMedia(this.src)">' +
      '<button class="zoom-icon" onclick="zoomMedia(\'' + sl.fileUrl + '\')"><i class="fas fa-search-plus"></i> تكبير</button>';
  }

  c.innerHTML = '<div class="pres-slide" style="width:100%;max-width:900px;text-align:center;animation:fadeOv 0.4s">' +
    '<div class="ps-title">' + (sl.title || '') + '</div>' +
    '<div class="ps-student">' + (sl.student || '') + '</div>' +
    (sl.content ? '<div class="ps-text">' + sl.content + '</div>' : '') +
    (media ? '<div class="ps-media">' + media + '</div>' : '') +
    '</div>';

  const ctr = $('slideCounter'); if (ctr) ctr.innerText = (S.idx + 1) + ' / ' + S.slides.length;
  const pb = $('prevBtn'); if (pb) pb.disabled = (S.idx === 0);
  const nb = $('nextBtn'); if (nb) nb.disabled = false;
  bellSound();
}

window.zoomMedia = (src) => {
  $('zoomImg').src = src;
  openOv('zoomOverlay');
}

window.nextSlide = () => { S.idx++; renderPresSlide(); };
window.prevSlide = () => { if (S.idx > 0) { S.idx--; renderPresSlide(); } };

function renderEnd() {
  const c = $('presContent'); if (!c) return;
  c.innerHTML = '<div style="animation:fadeInOv .5s;text-align:center;margin-top:10vh">' +
    '<i class="fas fa-check-circle" style="font-size:7rem;color:var(--accent);display:block;margin-bottom:25px"></i>' +
    '<div class="ps-student">انتهت الإذاعة</div>' +
    '<div class="ps-title" style="margin-top:10px">شكراً لحسن استماعكم — ثانوية ابن سعدي</div>' +
    '<div style="display:flex;gap:15px;justify-content:center;margin-top:35px">' +
    '<button class="btn btn-gold" onclick="startRadio()"><i class="fas fa-redo"></i> إعادة العرض</button>' +
    '<button class="btn" style="background:#555" onclick="closeOv(\'presOverlay\')"><i class="fas fa-times"></i> خروج</button>' +
    '</div></div>';
  const ctr = $('slideCounter'); if (ctr) ctr.innerText = 'النهاية';
  const pb = $('prevBtn'); if (pb) pb.disabled = true;
  const nb = $('nextBtn'); if (nb) nb.disabled = true;
  bellSound();
}

// ─── AMBASSADOR ───
let slCnt = 0;
let editDraftId = null;

window.addSlide = (data = null) => {
  slCnt++;
  const ed = $('slidesEditor'); if (!ed) return;
  const d = document.createElement('div');
  d.className = 'slide-entry'; d.dataset.id = slCnt;

  const isFileActive = (data && data.fileUrl) ? 'active' : '';
  const isTextActive = (!data || !data.fileUrl) ? 'active' : '';
  const studentVal = data ? data.student : '';
  const titleVal = data ? data.title : '';
  const fileVal = (data && data.fileUrl) ? data.fileUrl : '';
  const textVal = data ? data.content : '';

  let areaHtml = '';
  if (data && data.fileUrl) {
    areaHtml = '<button class="btn btn-accent s-file-btn" style="width:100%;justify-content:center" onclick="ambUploadFile(this)"><i class="fas fa-upload"></i> تغيير الملف المرفوع</button>' +
      '<input type="hidden" class="s-file" value="' + fileVal + '">' +
      '<div class="s-file-name" style="margin-top:5px;font-size:0.85rem;color:var(--gold)">تم إرفاق ملف سابقاً</div>';
  } else {
    areaHtml = '<textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة (إلزامي)" required>' + textVal + '</textarea>';
  }

  d.innerHTML = '<div class="se-head">' +
    '<h4><i class="fas fa-list-ol"></i> فقرة <span class="sl-num">' + slCnt + '</span></h4>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn btn-accent" title="لأعلى" onclick="moveUp(this)"><i class="fas fa-arrow-up"></i></button>' +
    '<button class="btn btn-accent" title="لأسفل" onclick="moveDn(this)"><i class="fas fa-arrow-down"></i></button>' +
    '<button class="btn btn-red" onclick="removeSlide(this)"><i class="fas fa-trash"></i></button>' +
    '</div>' +
    '</div>' +
    '<div class="se-fields">' +
    '<input class="input-field s-student" placeholder="اسم الطالب (إلزامي)" required value="' + studentVal + '">' +
    '<input class="input-field s-title" placeholder="عنوان الفقرة (إلزامي)" required value="' + titleVal + '">' +
    '</div>' +
    '<div class="se-types">' +
    '<button class="type-btn ' + isTextActive + '" onclick="setType(this,\'text\')">نص مكتوب</button>' +
    '<button class="type-btn ' + isFileActive + '" onclick="setType(this,\'file\')">فيديو / صورة</button>' +
    '</div>' +
    '<div class="s-area">' + areaHtml + '</div>';

  ed.appendChild(d);

  clickSound();
  updateSlideNumbers();
};

window.ambUploadFile = (btn) => {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, {
    publicKey: 'f1118bb7ce070c9d80d1',
    tabs: 'file url camera',
    locale: 'ar'
  }).done(file => {
    const p = btn.parentElement;
    p.querySelector('.s-file-name').innerText = "جاري معالجة الملف...";
    file.promise().done(info => {
      p.querySelector('.s-file').value = info.cdnUrl;
      p.querySelector('.s-file-name').innerText = "تم إرفاق: " + info.name;
    }).fail(() => {
      p.querySelector('.s-file-name').innerText = "فشل الرفع!";
    });
  });
};

window.checkAmbassadorDraft = () => {
  loadLocalRadios();
  const classVal = $('classSelect')?.value;
  if (!classVal) return;

  const existing = S.radios.find(r => r.class === classVal && r.status === 'pending');
  const ed = $('slidesEditor');
  if (existing) {
    editDraftId = existing.id;
    $('ambSubmitBtnTxt').innerText = "تحديث الإذاعة المرسلة للإدارة";
    ed.innerHTML = '';
    slCnt = 0;
    existing.slides.forEach(sl => addSlide(sl));
  } else {
    editDraftId = null;
    $('ambSubmitBtnTxt').innerText = "إرسال الإذاعة للإدارة";
    if (ed && ed.children.length === 0) addSlide();
  }
};

window.removeSlide = (btn) => {
  btn.closest('.slide-entry').remove();
  updateSlideNumbers();
};

function updateSlideNumbers() {
  const entries = document.querySelectorAll('.slide-entry');
  entries.forEach((e, i) => {
    const numEl = e.querySelector('.sl-num');
    if (numEl) numEl.innerText = i + 1;
  });
  slCnt = entries.length;
}

window.setType = (btn, type) => {
  const entry = btn.closest('.slide-entry');
  entry.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const area = entry.querySelector('.s-area');
  if (type === 'file') {
    area.innerHTML = '<button class="btn btn-accent s-file-btn" style="width:100%;justify-content:center" onclick="ambUploadFile(this)"><i class="fas fa-upload"></i> اختر ملف عبر Uploadcare</button>' +
      '<input type="hidden" class="s-file" value="">' +
      '<div class="s-file-name" style="margin-top:5px;font-size:0.85rem;color:var(--gold)">لم يتم إرفاق ملف</div>';
  } else {
    area.innerHTML = '<textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة (إلزامي)" required></textarea>';
  }
};

window.moveUp = btn => {
  const el = btn.closest('.slide-entry');
  if (el.previousElementSibling) { el.parentElement.insertBefore(el, el.previousElementSibling); updateSlideNumbers(); }
};
window.moveDn = btn => {
  const el = btn.closest('.slide-entry');
  if (el.nextElementSibling) { el.parentElement.insertBefore(el.nextElementSibling, el); updateSlideNumbers(); }
};

function buildClasses() {
  const sel = $('classSelect'); if (!sel || sel.options.length) return;
  for (let l = 1; l <= 3; l++) for (let r = 1; r <= 6; r++) {
    const o = document.createElement('option');
    o.value = r + '-' + l; o.text = 'فصل ' + r + '-' + l; sel.appendChild(o);
  }
}

function setNextDate() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const el = $('nextDay');
  if (el) el.innerText = d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

window.submitRadio = async () => {
  const entries = document.querySelectorAll('.slide-entry');
  if (!entries.length) { alert('أضف فقرة واحدة على الأقل!'); return; }

  const slides = [];
  let valid = true;

  entries.forEach((e, i) => {
    const student = e.querySelector('.s-student')?.value.trim() || '';
    const title = e.querySelector('.s-title')?.value.trim() || '';
    const content = e.querySelector('.s-text')?.value.trim() || '';
    const fileUrl = e.querySelector('.s-file')?.value || '';

    if (!student || !title || (!content && !fileUrl)) valid = false;

    slides.push({ order: i + 1, student, title, content, fileUrl });
  });

  if (!valid) { alert('الرجاء تعبئة جميع الحقول الإلزامية (اسم الطالب، العنوان، والمحتوى أو الملف)'); return; }

  const classVal = $('classSelect')?.value || '';
  const dateVal = $('nextDay')?.innerText || '';

  const payload = {
    class: classVal,
    date: dateVal,
    slides,
    status: 'pending',
    timestamp: new Date().toISOString()
  };

  try {
    if (editDraftId) {
      await cloudSave('radios/' + editDraftId, payload);
    } else {
      await cloudPush('radios', payload);
    }
    bellSound(); alert(editDraftId ? '✅ تم تحديث الإذاعة بنجاح!' : '✅ تم إرسال الإذاعة بنجاح!');
    closeOv('ambOverlay');
    const ed = $('slidesEditor'); if (ed) ed.innerHTML = ''; slCnt = 0;
  } catch (e) {
    alert('حدث خطأ أثناء الإرسال للسحابة. يرجى التأكد من الإنترنت.');
  }
};
  } catch (e) { alert('خطأ في الحفظ المحلي. ربما حجم الملفات كبير جداً.'); }
};

// ─── ADMIN ───
window.showTab = (tabId, btn) => {
  document.querySelectorAll('.tab-body').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tab = $(tabId); if (tab) tab.classList.add('active');
  btn.classList.add('active'); clickSound();

  if (tabId === 'tabAttend') populateAttendanceTable();
};

async function loadAdminRadios() {
  loadLocalRadios();
  const list = $('adminRadioList'); if (!list) return;

  if (!S.radios.length) {
    list.innerHTML = '<div class="empty-st"><i class="fas fa-inbox"></i><p>لا توجد إذاعات بعد</p></div>';
    return;
  }

  list.innerHTML = S.radios.map((r, i) => {
    const cls = r.class || 'فصل غير محدد';
    const dt = r.date || '';
    const slLen = r.slides ? r.slides.length : 0;
    const stat = r.status === 'pending' ? '🟡 بانتظار المراجعة' : '✅ معتمدة';
    const rid = r.id;
    return '<div class="radio-entry">' +
      '<div><h4>' + cls + ' — ' + dt + '</h4>' +
      '<p>' + slLen + ' فقرة | ' + stat + '</p></div>' +
      '<div class="re-btns">' +
      '<button class="btn btn-gold" onclick="approveR(\'' + rid + '\')"><i class="fas fa-check"></i> اعتماد</button>' +
      '<button class="btn" onclick="previewAdminR(' + i + ')"><i class="fas fa-play"></i> عرض</button>' +
      '<button class="btn btn-red" onclick="deleteR(\'' + rid + '\')"><i class="fas fa-trash"></i> حذف</button>' +
      '</div>' +
      '</div>';
  }).join('');

  populateAttendanceRadios();
}

window.approveR = (id) => {
  const r = S.radios.find(r => r.id === id);
  if (!r) return;

  // Clear previous approvals
  const updates = {};
  S.radios.forEach(x => {
    if (x.status === 'approved') updates[`radios/${x.id}/status`] = 'pending';
  });

  updates[`radios/${id}/status`] = 'approved';
  
  // Update attendance
  r.slides.forEach(sl => {
    const attId = id + '_' + sl.student.replace(/\s+/g, '_');
    updates[`attendance/${attId}`] = {
      student: sl.student,
      slide: sl.title,
      status: 'حاضر',
      class: r.class,
      date: r.date,
      radioId: id
    };
  });

  db.ref().update(updates).then(() => {
    alert('✅ تم اعتماد الإذاعة والمزامنة مع شاشة العرض!');
  });
};

window.previewAdminR = i => {
  const r = S.radios[i];
  if (r && r.slides) { S.slides = r.slides; S.idx = 0; openOv('presOverlay'); renderPresSlide(); }
};

window.deleteR = (id) => {
  if (!id) return;
  if (!confirm('حذف هذه الإذاعة نهائياً من السحابة؟')) return;
  cloudRemove('radios/' + id).then(() => {
    alert('تم الحذف بنجاح');
  });
};

window.saveSt = key => {
  const ids = { topic: 'stTopic', ambPw: 'stAmbPw', adminPw: 'stAdminPw', wisdomDuration: 'stWisdomDuration' };
  const el = $(ids[key]); if (!el) return;
  const val = el.value.trim(); if (!val) return;

  const updates = {};
  if (key === 'ambPw' || key === 'adminPw') updates[`pw/${key === 'ambPw' ? 'amb' : 'admin'}`] = val;
  else if (key === 'wisdomDuration') updates[key] = parseInt(val) || 10;
  else updates[key] = val;

  db.ref('settings').update(updates).then(() => {
    alert('✅ تم الحفظ في السحابة وتحديث جميع الأجهزة');
  });
};

function loadSettings() {
  const g = (k, d) => localStorage.getItem(k) || d;

  const topic = g('topic', 'أهلاً بكم في ثانوية ابن سعدي');
  const tt = $('topicText'); if (tt) tt.innerText = 'موضوع اليوم: ' + topic;
  const it2 = $('infoTopic2'); if (it2) it2.innerText = 'موضوع اليوم: ' + topic;

  const w = g('wisdoms');
  S.wisdoms = w ? JSON.parse(w) : ['العلم يبني بيوتاً لا عماد لها والجهل يهدم بيت العز والكرم'];

  const qv = g('quranVideos');
  S.quranVideos = qv ? JSON.parse(qv) : [];

  S.pw.amb = g('ambPw', 'sfir100');
  S.pw.admin = g('adminPw', 'Admin000');

  const att = g('attendance');
  if (att) S.attendance = JSON.parse(att);

  const fields = { stTopic: topic, stAmbPw: S.pw.amb, stAdminPw: S.pw.admin, stWisdomDuration: S.wisdomDuration };
  Object.entries(fields).forEach(([id, v]) => { const el = $(id); if (el) el.value = v; });

  const sd = g('galDuration');
  if (sd) {
    const sdel = $('slideDuration');
    if (sdel) sdel.value = sd;
    S.slideDuration = parseInt(sd);
  }
  
  const wd = g('wisdomDuration');
  if (wd) S.wisdomDuration = parseInt(wd);
}

// ─── WISDOMS ───
window.addWisdom = () => {
  const el = $('newWisdom');
  if (el && el.value.trim()) {
    S.wisdoms.push(el.value.trim());
    cloudSave('settings/wisdoms', S.wisdoms).then(() => {
      el.value = '';
    });
  }
};

window.removeWisdom = (idx) => {
  S.wisdoms.splice(idx, 1);
  if (S.wisdoms.length === 0) S.wisdoms = ['أضف حكمة جديدة'];
  cloudSave('settings/wisdoms', S.wisdoms);
};

function renderWisdoms() {
  const wl = $('wisdomList'); if (!wl) return;
  wl.innerHTML = S.wisdoms.map((w, i) =>
    '<div class="wisdom-item">' +
    '<span>' + w + '</span>' +
    '<button class="btn btn-red" style="padding:5px 10px;border-radius:10px" onclick="removeWisdom(' + i + ')"><i class="fas fa-times"></i></button>' +
    '</div>'
  ).join('');
}

// ─── INFO SCREEN LOOP ───
function initInfoScreenLoop() {
  const wDisp = $('wisdomDisplay');
  const tDisp = $('tickerContent');

  if (wDisp) {
    wDisp.innerText = S.wisdoms[S.currentWisdomIdx] || '';
    const rotateWisdom = () => {
      wDisp.style.opacity = 0;
      setTimeout(() => {
        S.currentWisdomIdx = (S.currentWisdomIdx + 1) % S.wisdoms.length;
        wDisp.innerText = S.wisdoms[S.currentWisdomIdx];
        wDisp.style.opacity = 1;
      }, 500);
      setTimeout(rotateWisdom, S.wisdomDuration * 1000);
    };
    setTimeout(rotateWisdom, S.wisdomDuration * 1000);
  }

  // Ticker updater
  setInterval(() => {
    const approved = S.radios.find(r => r.status === 'approved');
    if (approved && approved.slides && tDisp) {
      const names = approved.slides.map(s => s.student).filter(x => x).join(' ✦ ');
      tDisp.innerText = names ? 'المشاركين في إذاعة اليوم: ' + names : 'لا يوجد مشاركين';
    } else if (tDisp) {
      tDisp.innerText = 'ثانوية ابن سعدي ترحب بكم';
    }
  }, 10000);
}

// ─── ATTENDANCE ───
function populateAttendanceRadios() {
  const sel = $('attendRadioSel'); if (!sel) return;
  // Only show approved radios in attendance
  const approvedOnes = S.radios.filter(r => r.status === 'approved');
  sel.innerHTML = '<option value="">اختر إذاعة...</option>' +
    approvedOnes.map(r => '<option value="' + r.id + '">' + r.class + ' - ' + r.date + '</option>').join('');
}

window.loadAttendance = () => {
  const id = $('attendRadioSel').value;
  S.currentRadioId = id;
  populateAttendanceTable();
};

function populateAttendanceTable() {
  const tb = $('attendBody'); if (!tb) return;
  if (!S.currentRadioId || !S.attendance[S.currentRadioId]) {
    tb.innerHTML = '<tr><td colspan="5" class="empty-st">الرجاء اختيار إذاعة معتمدة</td></tr>';
    return;
  }

  const data = S.attendance[S.currentRadioId];
  let i = 1;
  tb.innerHTML = Object.entries(data).map(([student, info]) => {
    const rowId = 'row-' + i;
    const html = '<tr>' +
      '<td>' + (i++) + '</td>' +
      '<td>' + (info.class || '') + ' <br> ' + (info.date || '') + '</td>' +
      '<td>' + student + '</td>' +
      '<td><div class="attend-text-cell" onclick="toggleRowText(\'' + rowId + '\')">' + info.slide + '</div>' +
      '<div id="' + rowId + '" class="attend-text-expanded" style="display:none">' + (info.content || 'لا يوجد نص') + '</div></td>' +
      '<td>' +
      '<select class="input-sm" onchange="updateAttend(\'' + student + '\', this.value)" style="' + (info.status === 'غائب' ? 'color:var(--red)' : 'color:var(--accent)') + '">' +
      '<option value="حاضر" ' + (info.status === 'حاضر' ? 'selected' : '') + '>حاضر</option>' +
      '<option value="غائب" ' + (info.status === 'غائب' ? 'selected' : '') + '>غائب</option>' +
      '</select>' +
      '</td>' +
      '</tr>';
    return html;
  }).join('');
}

window.toggleRowText = (id) => {
  const el = $(id);
  if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
};

window.editR = (id) => {
  const r = S.radios.find(x => x.id.toString() === id.toString());
  if (!r) return;
  S.role = 'amb'; // Reuse ambassador UI
  buildClasses();
  setNextDate();
  
  editDraftId = r.id;
  $('classSelect').value = r.class;
  $('nextDay').innerText = r.date;
  
  const ed = $('slidesEditor');
  ed.innerHTML = '';
  slCnt = 0;
  r.slides.forEach(sl => addSlide(sl));
  
  openOv('ambOverlay');
  $('ambSubmitBtnTxt').innerText = "تحديث الإذاعة (إدارة)";
};

window.updateAttend = (student, status) => {
  if (S.currentRadioId) {
    const attId = S.currentRadioId + '_' + student.replace(/\s+/g, '_');
    cloudUpdate(`attendance/${attId}`, { status });
  }
};

window.exportExcel = () => {
  if (!S.currentRadioId || !S.attendance[S.currentRadioId]) {
    alert("لا توجد بيانات للتصدير"); return;
  }
  const data = S.attendance[S.currentRadioId];
  const rows = [["الفصل", "التاريخ", "الطالب", "الفقرة", "الحالة"]];
  Object.entries(data).forEach(([s, i]) => rows.push([i.class, i.date, s, i.slide, i.status]));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الحضور");
  XLSX.writeFile(wb, "attendance_report.xlsx");
};

window.deleteAttendanceRecord = () => {
  if (!S.currentRadioId) {
    alert("الرجاء اختيار إذاعة أولاً من القائمة المنسدلة"); return;
  }
  if (!confirm('هل أنت متأكد من مسح جميع سجلات الحضور لهذه الإذاعة؟')) return;
  
  const updates = {};
  S.attendance.forEach(att => {
    if (att.radioId === S.currentRadioId) updates[`attendance/${att.id}`] = null;
  });
  
  db.ref().update(updates).then(() => {
    alert('تم مسح سجل الحضور لهذه الإذاعة.');
  });
};
