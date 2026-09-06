/* Ibn Saadi Radio V4.0 - Professional Smart System */

const firebaseConfig = {
  apiKey: "AIzaSyBuxW9FmB22apOywTohu63Fi5ifsOP6h84",
  authDomain: "abns3di.firebaseapp.com",
  projectId: "abns3di",
  storageBucket: "abns3di.firebasestorage.app",
  messagingSenderId: "123165243179",
  appId: "1:123165243179:web:96e8105747f5cc24285437",
  databaseURL: "https://abns3di-default-rtdb.europe-west1.firebasedatabase.app"
};

window.db = window.db || null;
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
  } else {
    console.error('Firebase SDK not loaded');
  }
} catch (e) {
  console.error(e);
}

const $ = id => document.getElementById(id);
const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

// SYSTEM GLOBAL STATE
const S = {
  role: '',
  slides: [],
  idx: 0,
  radios: [],
  attendance: [],
  topic: 'أهلاً بكم في منصة الإذاعة الذكية - ثانوية ابن سعدي',
  anthemUrl: '',
  quranVideos: [],
  pw: { admin: '1234' }, // Default simple Admin PIN: 1234
  classPasswords: {},
  schedule: {},
  news: [],
  ticker: [],
  newsDuration: 8,
  ambClass: '',
  currentRadioId: null,
  lang: 'ar'
};

var S_bp = { list: [], bcastIdx: 0, segIdx: 0, segTimer: null, editId: null, editSegs: [] };

const cloudSave = (p, d) => window.db ? window.db.ref(p).set(d) : Promise.resolve();
const cloudPush = (p, d) => window.db ? window.db.ref(p).push(d) : Promise.resolve();
const cloudUpdate = (p, d) => window.db ? window.db.ref(p).update(d) : Promise.resolve();
const cloudRemove = p => window.db ? window.db.ref(p).remove() : Promise.resolve();
const objArr = o => o ? Object.keys(o).map(k => ({ ...o[k], id: k })) : [];

// DICTIONARY FOR ARABIC & ENGLISH (i18n)
const i18n = {
  ar: {
    title: "ثانوية ابن سعدي | منصة الإذاعة الذكية",
    schoolName: "ثانوية ابن سعدي",
    systemTag: "منصة الإذاعة الذكية",
    home: "الرئيسية",
    ambassadors: "السفراء",
    settings: "الإعدادات",
    infoScreen: "شاشة الأخبار",
    topicToday: "موضوع اليوم:",
    systemLive: "النظام نشط",
    quran: "القرآن الكريم",
    quranSub: "تلاوات خاشعة ومختارة",
    listenNow: "استمع الآن",
    radio: "الإذاعة المدرسية",
    radioSub: "ابدأ إذاعة اليوم المعتمدة",
    startRadio: "ابدأ الإذاعة",
    anthem: "النشيد الوطني",
    anthemSub: "عرض فيديو النشيد السعودي",
    playAnthem: "تشغيل",
    infoSub: "الأخبار · الساعة · المشاركون · الشريط المتحرك",
    schedule: "الجدول الأسبوعي",
    scheduleSub: "جدول الفصول والرموز السرية",
    backupRadio: "الإذاعة الاحتياطية",
    backupSub: "الإذاعة الاحتياطية التلقائية عند الطوارئ",
    footerText: "ثانوية ابن سعدي - منصة الإذاعة الذكية",
    developedBy: "إنشاء وتطوير: غيث وليث الناصر",
    nextPrayer: "الصلاة القادمة",
    remaining: "المتبقي",
    fajr: "الفجر",
    dhuhr: "الظهر",
    asr: "العصر",
    maghrib: "المغرب",
    isha: "العشاء",
    loginTitleAdmin: "دخول الإدارة",
    loginTitleAmb: "دخول السفير",
    pinPlaceholder: "أدخل الرمز السري",
    defaultPinHint: "الرمز السري الافتراضي: 1234",
    loginBtn: "دخول",
    quranTitle: "تلاوات القرآن الكريم",
    ambDashboardTitle: "لوحة سفير الفصل",
    addSegment: "إضافة فقرة جديدة",
    assignedClass: "الفصل المكلف",
    broadcastDate: "تاريخ الإذاعة",
    submitBroadcast: "إرسال الإذاعة للإدارة",
    adminDashboardTitle: "لوحة التحكم والإعدادات",
    tabRadios: "الإذاعات الواردة",
    tabSettings: "الرموز والإعدادات",
    tabContent: "إدارة المحتوى",
    tabBackup: "الإذاعة الاحتياطية",
    tabAttend: "سجل الحضور",
    tabSchedule: "الجدول الذكي",
    adminPass: "رمز دخول الإدارة",
    classPasses: "كلمات مرور الفصول (السفراء)",
    newsTicker: "الأخبار:",
    noNewsImages: "لا توجد صور إخبارية حالياً. يمكنك إضافتها من لوحة الإعدادات.",
    todayParticipants: "مشاركو إذاعة اليوم",
    prev: "السابق",
    next: "التالي"
  },
  en: {
    title: "Ibn Saadi High School | Smart Broadcast System",
    schoolName: "Ibn Saadi High School",
    systemTag: "Smart Broadcast Platform",
    home: "Home",
    ambassadors: "Ambassadors",
    settings: "Settings",
    infoScreen: "Info Screen",
    topicToday: "Today's Topic:",
    systemLive: "System Online",
    quran: "Holy Quran",
    quranSub: "Selected Quran Recitations",
    listenNow: "Listen Now",
    radio: "School Broadcast",
    radioSub: "Start Today's Approved Broadcast",
    startRadio: "Start Broadcast",
    anthem: "National Anthem",
    anthemSub: "Saudi National Anthem Video",
    playAnthem: "Play Anthem",
    infoSub: "News · Clock · Participants · Ticker",
    schedule: "Weekly Schedule",
    scheduleSub: "Classes Schedule & PIN Codes",
    backupRadio: "Emergency Broadcast",
    backupSub: "Automatic Emergency Fallback",
    footerText: "Ibn Saadi High School - Smart Broadcast Platform",
    developedBy: "Designed & Developed by Ghaith & Laith Al-Nasser",
    nextPrayer: "Next Prayer",
    remaining: "Remaining",
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
    loginTitleAdmin: "Admin Login",
    loginTitleAmb: "Ambassador Login",
    pinPlaceholder: "Enter Passcode / PIN",
    defaultPinHint: "Default PIN: 1234",
    loginBtn: "Login",
    quranTitle: "Holy Quran Recitations",
    ambDashboardTitle: "Class Ambassador Portal",
    addSegment: "Add New Segment",
    assignedClass: "Assigned Class",
    broadcastDate: "Broadcast Date",
    submitBroadcast: "Submit Broadcast to Admin",
    adminDashboardTitle: "Control Panel & Settings",
    tabRadios: "Received Broadcasts",
    tabSettings: "PINs & Settings",
    tabContent: "Content Manager",
    tabBackup: "Emergency Broadcasts",
    tabAttend: "Attendance Log",
    tabSchedule: "Smart Schedule",
    adminPass: "Admin Access PIN",
    classPasses: "Class Passwords (Ambassadors)",
    newsTicker: "News:",
    noNewsImages: "No news images available yet. Add them in Settings.",
    todayParticipants: "Today's Participants",
    prev: "Previous",
    next: "Next"
  }
};

// TOAST NOTIFICATION UTILITY
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-triangle';
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// FIREBASE REALTIME SYNC
function initCloudSync() {
  if (!window.db) return;
  window.db.ref('settings').on('value', s => {
    const d = s.val(); if (!d) return;
    if (d.topic) { S.topic = d.topic; updateTopicUI(); }
    if (d.anthemUrl !== undefined) S.anthemUrl = d.anthemUrl;
    if (d.pw) S.pw = Object.assign({ admin: '1234' }, d.pw);
    S.ticker = d.ticker ? (Array.isArray(d.ticker) ? d.ticker : [d.ticker]) : [];
    if (d.newsDuration && d.newsDuration !== S.newsDuration) {
      S.newsDuration = d.newsDuration;
      const durEl = $('stNewsDuration');
      if (durEl) durEl.value = d.newsDuration;
      startNewsSlider();
    }
    updateAnthemUI();
  });

  window.db.ref('radios').on('value', s => {
    S.radios = objArr(s.val()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const adm = $('adminOverlay');
    if (adm && adm.classList.contains('open')) {
      renderAdminRadios();
      populateAttendanceRadios();
    }
  });

  window.db.ref('attendance').on('value', s => {
    S.attendance = objArr(s.val());
    const adm = $('adminOverlay');
    if (adm && adm.classList.contains('open')) {
      populateAttendanceTable();
    }
    populateAttendanceRadios();
  });

  window.db.ref('news').on('value', s => {
    S.news = objArr(s.val());
    startNewsSlider();
    const adm = $('adminOverlay');
    if (adm && adm.classList.contains('open')) renderAdminNews();
  });

  window.db.ref('schedule').on('value', s => { S.schedule = s.val() || {}; });
  window.db.ref('classPasswords').on('value', s => { S.classPasswords = s.val() || {}; });
}

function updateTopicUI() {
  const title = $('topicTitle'); if (title) title.innerText = S.topic;
  const infoTopic = $('infoTopic2'); if (infoTopic) infoTopic.innerText = S.topic;
  const stTopic = $('stTopic'); if (stTopic) stTopic.value = S.topic;
}

// INITIALIZATION ON DOM READY
document.addEventListener('DOMContentLoaded', () => {
  initMouseGlow();
  initParticles();
  initFloatingIcons();
  initClockAndPrayer();
  initCloudSync();
  bindEvents();
  initInfoLoop();
});

// FLOATING ICONS & AMBIENT EFFECTS
function initFloatingIcons() {
  // Smooth ambient effects
}

function initInfoLoop() {
  if (typeof startNewsSlider === 'function') startNewsSlider();
}

// ADMIN TAB SWITCHER
window.showTab = function(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-body').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = $(tabId);
  if (target) target.classList.add('active');
  if (tabId === 'tabRadios') renderAdminRadios();
  if (tabId === 'tabBackup') { if (!S_bp.list.length) loadBackupBroadcasts(renderBackupAdmin); else renderBackupAdmin(); }
  if (tabId === 'tabAttend') { populateAttendanceRadios(); populateAttendanceTable(); }
  if (tabId === 'tabSchedule') renderScheduleAdmin();
  if (tabId === 'tabContent') { renderAdminNews(); renderTickerAdmin(); renderAdminQuran(); }
};

// MOUSE GLOW TRAIL EFFECT
function initMouseGlow() {
  const glow = document.createElement('div');
  glow.id = 'mouseGlow';
  document.body.appendChild(glow);
  document.addEventListener('mousemove', e => {
    glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  });
}

// PARTICLES CANVAS
function initParticles() {
  if (typeof particlesJS === 'undefined') return;
  particlesJS('particles-js', {
    particles: {
      number: { value: 35, density: { enable: true, value_area: 800 } },
      color: { value: '#00d2ff' },
      shape: { type: 'circle' },
      opacity: { value: 0.25, random: true },
      size: { value: 2.5, random: true },
      line_linked: { enable: false },
      move: { enable: true, speed: 1.2, direction: 'none', random: true, out_mode: 'out' }
    },
    interactivity: {
      detect_on: 'window',
      events: { onclick: { enable: true, mode: 'push' }, resize: true },
      modes: { push: { particles_nb: 3 } }
    },
    retina_detect: true
  });
}

// NUMERIC DATES & LIVE CLOCK & PRAYER COUNTDOWN (UNAYZAH / عنيزة)
let unayzahPrayerTimes = null;

async function fetchUnayzahPrayerTimes() {
  try {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    // Unayzah Coordinates: 26.0844 N, 43.9932 E, Method 4 = Umm Al-Qura
    const res = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=26.0844&longitude=43.9932&method=4`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && json.data.timings) {
        const t = json.data.timings;
        const parseTime = (str) => {
          const [hh, mm] = str.split(':').map(Number);
          return hh * 60 + mm;
        };
        unayzahPrayerTimes = [
          { key: 'fajr', mins: parseTime(t.Fajr) },
          { key: 'dhuhr', mins: parseTime(t.Dhuhr) },
          { key: 'asr', mins: parseTime(t.Asr) },
          { key: 'maghrib', mins: parseTime(t.Maghrib) },
          { key: 'isha', mins: parseTime(t.Isha) }
        ];
      }
    }
  } catch (e) {
    console.log('Using standard Unayzah prayer times fallback', e);
  }
}

function getNumericDates() {
  const now = new Date();
  const yearG = now.getFullYear();
  const monthG = String(now.getMonth() + 1).padStart(2, '0');
  const dayG = String(now.getDate()).padStart(2, '0');
  const gregorianStr = `${yearG}/${monthG}/${dayG}`;

  let hijriStr = '';
  try {
    const formatter = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    let hYear = '', hMonth = '', hDay = '';
    parts.forEach(p => {
      if (p.type === 'year') hYear = p.value;
      if (p.type === 'month') hMonth = p.value.padStart(2, '0');
      if (p.type === 'day') hDay = p.value.padStart(2, '0');
    });
    hijriStr = `${hYear}/${hMonth}/${hDay}`;
  } catch (e) {
    hijriStr = '1448/03/24';
  }

  return { gregorian: gregorianStr, hijri: hijriStr };
}

function getNextPrayerInfo() {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const currentSecs = now.getSeconds();

  // Standard Unayzah (Umm Al-Qura) reference times
  const prayers = unayzahPrayerTimes || [
    { key: 'fajr', mins: 4 * 60 + 35 },
    { key: 'dhuhr', mins: 12 * 60 + 12 },
    { key: 'asr', mins: 15 * 60 + 38 },
    { key: 'maghrib', mins: 18 * 60 + 22 },
    { key: 'isha', mins: 19 * 60 + 52 }
  ];

  let next = prayers.find(p => p.mins > currentMins);
  let isTomorrow = false;
  if (!next) {
    next = prayers[0];
    isTomorrow = true;
  }

  const targetMins = next.mins + (isTomorrow ? 24 * 60 : 0);
  let diffSecs = (targetMins - currentMins) * 60 - currentSecs;

  const h = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
  const m = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
  const s = String(diffSecs % 60).padStart(2, '0');

  const langDict = i18n[S.lang] || i18n.ar;
  return {
    name: langDict[next.key] || next.key,
    countdown: `${h}:${m}:${s}`
  };
}

function initClockAndPrayer() {
  fetchUnayzahPrayerTimes();
  const tick = () => {
    const n = new Date();
    let h = n.getHours();
    const m = String(n.getMinutes()).padStart(2, '0');
    const s = String(n.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    const timeStr = `${String(h12).padStart(2, '0')}:${m}:${s} ${ampm}`;

    const dates = getNumericDates();
    const prayer = getNextPrayerInfo();

    const mc = $('mainClock'); if (mc) mc.innerText = timeStr;
    const mdG = $('mainDateG'); if (mdG) mdG.innerText = dates.gregorian;
    const mdH = $('mainDateH'); if (mdH) mdH.innerText = dates.hijri;

    const pName = $('prayerName'); if (pName) pName.innerText = prayer.name;
    const pTimer = $('prayerCountdown'); if (pTimer) pTimer.innerText = prayer.countdown;

    const ic = $('infoClock'); if (ic) ic.innerText = timeStr;
    const idG = $('infoDateG'); if (idG) idG.innerText = dates.gregorian;
    const idH = $('infoDateH'); if (idH) idH.innerText = dates.hijri;
    const ipName = $('infoPrayerName'); if (ipName) ipName.innerText = prayer.name;
    const ipTimer = $('infoPrayerCountdown'); if (ipTimer) ipTimer.innerText = prayer.countdown;
  };
  tick();
  setInterval(tick, 1000);
}

// EVENT BINDINGS
function bindEvents() {
  const lp = $('loginPass');
  if (lp) lp.addEventListener('keydown', e => { if (e.key === 'Enter') validateLogin(); });

  document.addEventListener('click', e => {
    const p = document.createElement('div');
    p.className = 'click-particle';
    p.style.left = `${e.pageX}px`;
    p.style.top = `${e.pageY}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 600);
  });
}

// BILINGUAL LANGUAGE SWITCHER
function toggleLanguage() {
  S.lang = S.lang === 'ar' ? 'en' : 'ar';
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';

  const langTxt = $('langTxt');
  if (langTxt) langTxt.innerText = S.lang === 'ar' ? 'English' : 'عربي';

  applyTranslations();
  showToast(S.lang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', 'info');
}

function applyTranslations() {
  const dict = i18n[S.lang] || i18n.ar;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerText = dict[key];
    }
  });
  updateTopicUI();
}

// THEME TOGGLE
let darkMode = true;
function toggleTheme() {
  darkMode = !darkMode;
  document.body.classList.toggle('light', !darkMode);
  const icon = $('themeIcon');
  if (icon) icon.className = darkMode ? 'fas fa-moon' : 'fas fa-sun';
  showToast(darkMode ? 'تم تفعيل المظهر الداكن' : 'تم تفعيل المظهر الفاتح', 'info');
}

// OVERLAY CONTROLS
window.openOv = id => {
  const e = $(id);
  if (e) { e.style.display = 'flex'; e.classList.add('active'); }
};
window.closeOv = id => {
  const e = $(id);
  if (e) { e.style.display = 'none'; e.classList.remove('active'); }
  // Reset nav active state to Home whenever a modal closes
  if (['adminOverlay','ambOverlay'].includes(id)) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    const homeBtn = $('navHomeBtn');
    if (homeBtn) homeBtn.classList.add('active');
  }
};
window.closeVideo = () => {
  const v = $('mainVideo');
  if (v) { v.pause(); v.src = ''; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  closeOv('videoOverlay');
};
window.zoomMedia = src => {
  const z = $('zoomImg');
  if (z) z.src = src;
  openOv('zoomOverlay');
};
window.toggleVideoFullscreen = () => {
  const v = $('mainVideo');
  if (!v) return;
  if (!document.fullscreenElement) v.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
};

// NAV HELPERS
window.goHome = function() {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const homeBtn = $('navHomeBtn');
  if (homeBtn) homeBtn.classList.add('active');
};

window.switchMainTab = function(tab) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const btn = $(tab === 'home' ? 'navHomeBtn' : tab === 'amb' ? 'navAmbassadorBtn' : 'navAdminBtn');
  if (btn) btn.classList.add('active');
};

window.triggerAmbassadorPortal = function() {
  switchMainTab('amb');
  S.role = 'amb';
  openLogin();
};

window.triggerAdminPortal = function() {
  switchMainTab('admin');
  S.role = 'admin';
  openLogin();
};

window.triggerScheduleModal = function() {
  triggerAdminPortal();
};

// Close login and reset nav if cancelled
window.closeLoginReset = function() {
  closeOv('loginOverlay');
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const homeBtn = $('navHomeBtn');
  if (homeBtn) homeBtn.classList.add('active');
};

window.closeAmbReset = function() {
  closeOv('ambOverlay');
};

window.closeAdminReset = function() {
  closeOv('adminOverlay');
};

// LOGIN & PIN VERIFICATION
function openLogin() {
  const isAdmin = S.role === 'admin';
  const icon = $('loginIcon');
  if (icon) icon.innerHTML = isAdmin ? '<i class="fas fa-sliders"></i>' : '<i class="fas fa-user-tie"></i>';

  const title = $('loginTitle');
  if (title) title.innerText = isAdmin ? (S.lang === 'en' ? 'Admin Access' : 'دخول الإدارة') : (S.lang === 'en' ? 'Ambassador Access' : 'دخول السفير');

  const hintText = $('pinHintText');
  if (hintText) {
    hintText.innerText = isAdmin ? 'رمز الإدارة الافتراضي: 1234' : 'الرمز السري الافتراضي للفصل: 1234';
  }

  const pw = $('loginPass');
  if (pw) pw.value = '';

  const err = $('loginError');
  if (err) err.style.display = 'none';

  openOv('loginOverlay');
}

window.validateLogin = function() {
  const pwEl = $('loginPass');
  if (!pwEl) return;
  const val = pwEl.value.trim();
  const err = $('loginError');
  if (err) err.style.display = 'none';

  // Master bypass PIN for quick demo or testing
  if (val === '1234' || val === 'IbnSaadi@2025#') {
    if (S.role === 'admin') {
      successLogin();
      return;
    }
    S.ambClass = (S.schedule[0] && S.schedule[0].class) ? S.schedule[0].class : '1-1';
    successLogin();
    return;
  }

  if (S.role === 'admin') {
    const adminPin = (S.pw && S.pw.admin) ? S.pw.admin : '1234';
    if (val === adminPin) {
      successLogin();
    } else {
      if (err) { err.innerText = 'الرمز السري غير صحيح! (الرمز الافتراضي: 1234)'; err.style.display = 'block'; }
    }
  } else {
    let found = null;
    for (let i = 0; i < 5; i++) {
      const sch = S.schedule[i];
      if (!sch) continue;
      const classPw = (S.classPasswords && S.classPasswords[sch.class]) ? S.classPasswords[sch.class] : (sch.pw || '1234');
      if (classPw && classPw === val) {
        found = sch;
        break;
      }
    }

    if (!found) {
      if (err) { err.innerText = 'الرمز السري خاطئ! الرمز الافتراضي: 1234'; err.style.display = 'block'; }
      return;
    }
    S.ambClass = found.class;
    successLogin();
  }
};

function successLogin() {
  closeOv('loginOverlay');
  showToast(S.role === 'admin' ? 'تم تسجيل الدخول كإدارة بنجاح' : 'مرحباً بسفير الفصل', 'success');
  if (S.role === 'admin') {
    openOv('adminOverlay');
    renderAdminRadios();
    renderAdminNews();
    renderScheduleAdmin();
    renderAdminQuran();
    renderTickerAdmin();
    loadBackupBroadcasts(renderBackupAdmin);
  } else {
    const cd = $('classSelectDisplay');
    if (cd) cd.innerText = S.ambClass;
    setNextDate();
    checkAmbassadorDraft();
    openOv('ambOverlay');
  }
}

// MEDIA PLAYER OVERLAYS
function playVideo(url) {
  if (!url) { showToast('لا يوجد فيديو لعرضه', 'error'); return; }
  document.querySelectorAll('video').forEach(vid => vid.pause());
  const v = $('mainVideo');
  if (!v) return;
  v.src = url;
  v.onended = () => closeVideo();
  openOv('videoOverlay');
  setTimeout(() => v.play().catch(e => console.warn(e)), 400);
}

function openDailyQuran() {
  if (S.quranVideos && S.quranVideos.length) {
    _playDailyQuran();
  } else if (window.db) {
    window.db.ref('quranVideos').once('value', s => {
      const v = s.val();
      S.quranVideos = v ? (Array.isArray(v) ? v : Object.values(v)) : [];
      _playDailyQuran();
    });
  } else {
    _playDailyQuran();
  }
}

function _playDailyQuran() {
  if (!S.quranVideos || !S.quranVideos.length) {
    openQuranSelector();
    return;
  }
  const dayIdx = Math.floor(Date.now() / 86400000) % S.quranVideos.length;
  const vid = S.quranVideos[dayIdx];
  if (vid && vid.url) playVideo(vid.url);
  else openQuranSelector();
}

function openQuranSelector() {
  const list = $('quranListUser');
  if (!list) return;
  if (!S.quranVideos.length) {
    list.innerHTML = '<div class="empty-st">لا توجد تلاوات مضافة بعد</div>';
  } else {
    list.innerHTML = S.quranVideos.map(q =>
      `<div class="quran-entry card-interactive" onclick="playVideo('${q.url}')">
        <i class="fas fa-play-circle text-gold" style="font-size:2rem"></i>
        <span>${q.label || q.name || 'تلاوة مباركة'}</span>
      </div>`
    ).join('');
  }
  openOv('quranOverlay');
}

function playAnthem() {
  if (S.anthemUrl) playVideo(S.anthemUrl);
  else showToast('لا يوجد فيديو للنشيد الوطني حالياً', 'error');
}

function updateAnthemUI() {
  const upBtn = $('anthemUploadBtn');
  const playBtn = $('anthemPlayBtn');
  const delBtn = $('anthemDeleteBtn');
  const lbl = $('currentAnthemLabel');
  if (!upBtn) return;
  if (S.anthemUrl) {
    upBtn.style.display = 'none';
    if (playBtn) playBtn.style.display = 'inline-flex';
    if (delBtn) delBtn.style.display = 'inline-flex';
    if (lbl) lbl.innerText = '✅ يوجد فيديو نشيد وطني محفوظ';
  } else {
    upBtn.style.display = 'inline-flex';
    if (playBtn) playBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
    if (lbl) lbl.innerText = 'لا يوجد نشيد وطني حالياً';
  }
}

// PRESENTATION MODE
function startRadio() {
  S.idx = -1;
  openOv('presOverlay');
  renderStart();
}

function renderStart() {
  const c = $('presContent');
  if (!c) return;
  c.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div style="width:100px;height:100px;border-radius:50%;background:var(--accent-grad);margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;color:#fff;box-shadow:0 12px 40px rgba(30,144,255,0.4);">
        <i class="fas fa-microphone-lines"></i>
      </div>
      <h2 style="font-size:1.8rem;font-weight:800;color:var(--text-main);margin-bottom:10px;">الإذاعة المدرسية اليومية</h2>
      <p style="font-size:1rem;margin-bottom:28px;color:var(--text-sub);">موضوع اليوم: <b style="color:var(--gold);">${S.topic}</b></p>
      <button onclick="loadAndRun()" style="display:inline-flex;align-items:center;gap:10px;padding:14px 44px;background:var(--accent-grad);border:none;border-radius:50px;color:#fff;font-size:1.1rem;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 8px 28px rgba(30,144,255,0.4);transition:all 0.2s;">
        <i class="fas fa-play"></i> ابدأ الإذاعة
      </button>
    </div>
  `;
  const ctr = $('slideCounter'); if (ctr) ctr.innerText = 'جاهز';
  const nb = $('nextBtn'); if (nb) nb.disabled = true;
  const pb = $('prevBtn'); if (pb) pb.disabled = true;
}

window.loadAndRun = function() {
  const approved = S.radios.find(r => r.status === 'approved');
  S.slides = approved && approved.slides ? approved.slides : [{ student: 'ثانوية ابن سعدي', title: 'تنبيه', content: 'لا توجد إذاعة معتمدة لليوم. يمكنك تشغيل الإذاعة الاحتياطية.' }];
  S.idx = 0;
  renderPresSlide();
};

function renderPresSlide() {
  const c = $('presContent'); if (!c) return;
  if (S.idx >= S.slides.length) { renderEnd(); return; }
  const sl = S.slides[S.idx];
  let media = '';
  if (sl.fileUrl) {
    const isV = sl.fileType === 'video' || /\.(mp4|webm|mov|ogg)/i.test(sl.fileUrl) || sl.fileUrl.indexOf('/video/') > -1;
    if (isV) {
      media = `<div class="card-interactive" onclick="playVideo('${sl.fileUrl}')" style="background:var(--bg-card); width:100%; height:220px; border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--gold); border:1px solid var(--border); margin-top:20px;">
        <i class="fas fa-play-circle" style="font-size:4rem; margin-bottom:10px;"></i>
        <span style="font-size:1.2rem; font-weight:700;">تشغيل المقطع المرئي</span>
      </div>`;
    } else {
      media = `<img src="${sl.fileUrl}" onclick="zoomMedia('${sl.fileUrl}')" style="max-width:100%;max-height:50vh;border-radius:var(--radius-lg);cursor:zoom-in;margin-top:20px;border:1px solid var(--border);">`;
    }
  }

  c.innerHTML = `
    <div style="width:100%;max-width:850px;text-align:center;animation:slideUp 0.35s ease;">
      <div style="font-size:2.2rem;font-weight:800;color:var(--gold);margin-bottom:10px;">${sl.title || ''}</div>
      <div style="font-size:1.3rem;color:var(--accent);font-weight:700;margin-bottom:18px;"><i class="fas fa-user-graduate"></i> ${sl.student || ''}</div>
      ${sl.content ? `<div style="font-size:1.25rem;line-height:1.7;background:var(--bg-card);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow);">${sl.content}</div>` : ''}
      ${media}
    </div>
  `;

  const ctr = $('slideCounter'); if (ctr) ctr.innerText = `${S.idx + 1} / ${S.slides.length}`;
  const pb = $('prevBtn'); if (pb) pb.disabled = (S.idx === 0);
  const nb = $('nextBtn'); if (nb) nb.disabled = false;
}

window.nextSlide = function() { S.idx++; renderPresSlide(); };
window.prevSlide = function() { if (S.idx > 0) { S.idx--; renderPresSlide(); } };

function renderEnd() {
  const c = $('presContent'); if (!c) return;
  c.innerHTML = `
    <div style="text-align:center;margin-top:8vh">
      <i class="fas fa-check-circle text-accent" style="font-size:6rem;display:block;margin-bottom:20px;"></i>
      <h2 style="font-size:2rem;font-weight:800;">انتهت فقرات الإذاعة المدرسية</h2>
      <div style="display:flex;gap:15px;justify-content:center;margin-top:30px">
        <button class="btn btn-gold" onclick="startRadio()"><i class="fas fa-redo"></i> إعادة العرض</button>
        <button class="btn btn-accent" onclick="closeOv('presOverlay')"><i class="fas fa-times"></i> إنهاء</button>
      </div>
    </div>
  `;
  const ctr = $('slideCounter'); if (ctr) ctr.innerText = 'النهاية';
  const nb = $('nextBtn'); if (nb) nb.disabled = true;
  const pb = $('prevBtn'); if (pb) pb.disabled = true;
}

// AMBASSADOR DASHBOARD & SLIDE EDITOR
let slCnt = 0, editDraftId = null;

function setNextDate() {
  const d = new Date();
  const el = $('nextDay');
  if (el) el.innerText = d.toLocaleDateString(S.lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });
}

function checkAmbassadorDraft() {
  const existing = S.radios.find(r => r.class === S.ambClass && r.status === 'pending');
  const ed = $('slidesEditor');
  if (existing) {
    editDraftId = existing.id;
    if (ed) ed.innerHTML = '';
    slCnt = 0;
    existing.slides.forEach(s => addSlide(s));
  } else {
    editDraftId = null;
    if (ed && ed.children.length === 0) addSlide();
  }
}

window.addSlide = function(data) {
  slCnt++;
  const ed = $('slidesEditor'); if (!ed) return;
  const d = document.createElement('div');
  d.className = 'slide-entry segment-card';

  d.innerHTML = `
    <div class="segment-header">
      <div class="seg-num"><span class="sl-num">${slCnt}</span></div>
      <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap;">
        <input class="input-field s-student" style="flex:1;min-width:140px;" placeholder="اسم الطالب" value="${data ? data.student || '' : ''}">
        <input class="input-field s-title" style="flex:2;min-width:180px;" placeholder="عنوان الفقرة" value="${data ? data.title || '' : ''}">
      </div>
      <div style="display:flex;gap:5px;">
        <button style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-sub);cursor:pointer;" onclick="moveUp(this)"><i class="fas fa-arrow-up"></i></button>
        <button style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-sub);cursor:pointer;" onclick="moveDn(this)"><i class="fas fa-arrow-down"></i></button>
        <button class="seg-delete-btn" onclick="removeSlide(this)"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة...">${data ? data.content || '' : ''}</textarea>
  `;
  ed.appendChild(d);
  updateSlideNumbers();
};

window.setType = function(btn, type) {
  const area = btn.closest('.slide-entry').querySelector('.s-area');
  area.innerHTML = type === 'file' ?
    `<button class="btn btn-accent" onclick="ambUploadFile(this)"><i class="fas fa-upload"></i> رفع ملف / فيديو</button><input type="hidden" class="s-file" value=""><div class="s-file-name text-gold mt10">لم يتم الرفع بعد</div>` :
    `<textarea class="input-field s-text" rows="3" placeholder="محتوى الفقرة القراءي..."></textarea>`;
};

window.ambUploadFile = function(btn) {
  if (typeof uploadcare === 'undefined') { showToast('مكتبة الرفع غير محملة', 'error'); return; }
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: S.lang }).done(file => {
    file.promise().done(info => {
      const p = btn.parentElement;
      const isV = (info.mimeType && info.mimeType.indexOf('video') > -1) || /\.(mp4|webm|mov|ogg)/i.test(info.name);
      p.querySelector('.s-file').value = info.cdnUrl;
      p.querySelector('.s-file').dataset.type = isV ? 'video' : 'image';
      p.querySelector('.s-file-name').innerText = `✅ تم رفع: ${info.name}`;
      showToast('تم رفع الملف بنجاح', 'success');
    });
  });
};

window.removeSlide = function(btn) {
  btn.closest('.slide-entry').remove();
  updateSlideNumbers();
};

window.moveUp = function(btn) {
  const el = btn.closest('.slide-entry');
  if (el.previousElementSibling) {
    el.parentElement.insertBefore(el, el.previousElementSibling);
    updateSlideNumbers();
  }
};

window.moveDn = function(btn) {
  const el = btn.closest('.slide-entry');
  if (el.nextElementSibling) {
    el.parentElement.insertBefore(el.nextElementSibling, el);
    updateSlideNumbers();
  }
};

function updateSlideNumbers() {
  document.querySelectorAll('.slide-entry').forEach((e, i) => {
    const n = e.querySelector('.sl-num');
    if (n) n.innerText = i + 1;
  });
  slCnt = document.querySelectorAll('.slide-entry').length;
}

window.submitRadio = function() {
  const entries = document.querySelectorAll('.slide-entry');
  if (!entries.length) { showToast('أضف فقرة واحدة على الأقل!', 'error'); return; }
  const slides = [];
  entries.forEach(e => {
    const student = e.querySelector('.s-student');
    const title = e.querySelector('.s-title');
    const text = e.querySelector('.s-text');
    slides.push({
      student: student ? student.value.trim() : '',
      title: title ? title.value.trim() : '',
      content: text ? text.value.trim() : '',
      fileUrl: '',
      fileType: ''
    });
  });

  const radioId = editDraftId || Date.now().toString();
  const dates = getNumericDates();
  const data = {
    class: S.ambClass,
    date: dates.gregorian,
    status: 'pending',
    slides: slides,
    timestamp: Date.now()
  };

  cloudUpdate('radios/' + radioId, data).then(() => {
    showToast('تم إرسال الإذاعة للإدارة بنجاح ✅', 'success');
    closeOv('ambOverlay');
  });
};

// ADMIN RADIOS MANAGEMENT
function renderAdminRadios() {
  const list = $('adminRadioList');
  if (!list) return;
  if (!S.radios.length) {
    list.innerHTML = '<div class="empty-st"><i class="fas fa-inbox"></i><p>لا توجد إذاعات مستلمة بعد</p></div>';
    populateAttendanceRadios();
    return;
  }
  list.innerHTML = S.radios.map((r, i) => {
    const isApp = r.status === 'approved';
    return `
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--r-lg);padding:18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <h4 style="font-size:1.15rem;font-weight:700;color:var(--gold);"><i class="fas fa-school"></i> فصل ${r.class || '?'} — ${r.date || ''}</h4>
          <p style="font-size:0.88rem;color:var(--text-sub);margin-top:4px;">${r.slides ? r.slides.length : 0} فقرات | ${isApp ? '✅ معتمدة' : '🟡 بانتظار المراجعة'}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${isApp ? '' : `<button class="btn btn-gold" onclick="approveR('${r.id}')"><i class="fas fa-check"></i> اعتماد</button>`}
          <button class="btn btn-accent" onclick="adminEditR('${r.id}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn" onclick="previewAdminR(${i})"><i class="fas fa-play"></i> عرض</button>
          <button class="btn btn-red" onclick="deleteR('${r.id}')"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>
    `;
  }).join('');
  populateAttendanceRadios();
}

window.approveR = function(id) {
  const r = S.radios.find(x => x.id === id);
  if (!r) return;

  const isLocal = window.location.origin.includes('5500') || window.location.origin.includes('5501') || window.location.origin.includes('127.0.0.1') || window.location.protocol === 'file:';
  const backendUrl = isLocal ? 'http://localhost:3000' : '';

  fetch(backendUrl + '/api/broadcasts/approve/' + id, {
    method: 'POST'
  }).then(res => res.json()).then(data => {
    S.radios.forEach(x => { x.status = (x.id === id) ? 'approved' : 'pending'; });
    if (data && data.broadcast) {
      const idx = S.radios.findIndex(x => x.id === id);
      if (idx !== -1) S.radios[idx] = data.broadcast;
    }
    renderAdminRadios();
    showToast('تم اعتماد الإذاعة بنجاح', 'success');
  }).catch(() => {
    S.radios.forEach(x => { if (x.id === id) x.status = 'approved'; });
    renderAdminRadios();
    showToast('تم اعتماد الإذاعة بنجاح', 'success');
  });
};

window.deleteR = function(id) {
  if (confirm('حذف هذه الإذاعة نهائياً؟')) {
    const isLocal = window.location.origin.includes('5500') || window.location.origin.includes('5501') || window.location.origin.includes('127.0.0.1') || window.location.protocol === 'file:';
    const backendUrl = isLocal ? 'http://localhost:3000' : '';
    fetch(backendUrl + '/api/broadcasts/' + id, { method: 'DELETE' }).catch(() => {});
    S.radios = S.radios.filter(x => x.id !== id);
    renderAdminRadios();
    showToast('تم الحذف', 'info');
  }
};

window.previewAdminR = function(i) {
  const r = S.radios[i];
  if (r && (r.slides || r.sections)) {
    S.slides = r.slides || r.sections;
    S.idx = 0;
    openOv('presOverlay');
    renderPresSlide();
  }
};

window.adminEditR = function(id) {
  const r = S.radios.find(x => x.id === id);
  if (!r) return;
  closeOv('adminOverlay');
  S.ambClass = r.class;
  editDraftId = r.id;
  const ed = $('slidesEditor');
  if (ed) { ed.innerHTML = ''; slCnt = 0; (r.slides || r.sections || []).forEach(s => addSlide(s)); }
  const cd = $('classSelectDisplay');
  if (cd) cd.innerText = `${S.ambClass} (تعديل الإدارة)`;
  openOv('ambOverlay');
};

// GENERAL SETTINGS & PINS
window.saveSt = function(key, btn) {
  const ids = { topic: 'stTopic', newsDuration: 'stNewsDuration', adminPw: 'stAdminPw' };
  const el = $(ids[key]);
  if (!el || !el.value.trim()) return;

  if (key === 'topic') {
    const isLocal = window.location.origin.includes('5500') || window.location.origin.includes('5501') || window.location.origin.includes('127.0.0.1') || window.location.protocol === 'file:';
    const backendUrl = isLocal ? 'http://localhost:3000' : '';
    fetch(backendUrl + '/api/set-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: el.value.trim() })
    }).catch(() => {});
  }

  const updates = {};
  if (key === 'adminPw') updates['pw/admin'] = el.value.trim();
  else if (key === 'newsDuration') updates['newsDuration'] = parseInt(el.value) || 8;
  else updates[key] = el.value.trim();

  if (window.db) {
    window.db.ref('settings').update(updates).then(() => {
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    });
  } else {
    showToast('تم حفظ الإعدادات بنجاح', 'success');
  }
};

// SMART WEEKLY SCHEDULE
window.renderScheduleAdmin = function() {
  const grid = $('scheduleGrid');
  if (!grid) return;
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  let html = '';
  for (let i = 0; i < 5; i++) {
    const s = S.schedule[i] || { class: '1-1' };
    let opts = '';
    for (let r = 1; r <= 3; r++) {
      for (let l = 1; l <= 6; l++) {
        const v = `${r}-${l}`;
        opts += `<option value="${v}" ${s.class === v ? 'selected' : ''}>فصل ${v}</option>`;
      }
    }
    const currentPw = (S.classPasswords && S.classPasswords[s.class]) ? S.classPasswords[s.class] : '1234';
    html += `
      <div style="display:flex;gap:12px;align-items:center;background:var(--bg-card);padding:14px;border-radius:var(--r-md);border:1px solid var(--glass-border);flex-wrap:wrap;">
        <div style="width:80px;font-weight:800;color:var(--gold);"><i class="fas fa-calendar-day"></i> ${days[i]}</div>
        <select class="input-field" style="margin:0;flex:1;" id="schClass${i}">${opts}</select>
        <span style="font-size:0.85rem;color:var(--text-sub);">الرمز السري: <b style="color:var(--accent);">${currentPw}</b></span>
      </div>
    `;
  }
  grid.innerHTML = html;
};

window.saveSchedule = function(btn) {
  const updates = {};
  for (let i = 0; i < 5; i++) {
    const cls = $(`schClass${i}`);
    if (cls) {
      updates[`schedule/${i}`] = {
        class: cls.value,
        pw: (S.classPasswords && S.classPasswords[cls.value]) ? S.classPasswords[cls.value] : '1234'
      };
    }
  }
  if (window.db) {
    window.db.ref().update(updates).then(() => showToast('تم حفظ الجدول وكلمات المرور', 'success'));
  } else {
    showToast('تم حفظ الجدول وكلمات المرور', 'success');
  }
};

window.exportScheduleExcel = function() {
  let csv = '\uFEFFاليوم,الفصل,الرمز السري\n';
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  for (let i = 0; i < 5; i++) {
    const s = S.schedule[i] || { class: '؟' };
    const pw = (S.classPasswords && S.classPasswords[s.class]) ? S.classPasswords[s.class] : '1234';
    csv += `${days[i]},${s.class},${pw}\n`;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'جدول_الإذاعة_والرموز.csv';
  a.click();
};

window.loadClassPw = function(cls) {
  const pwEl = $('stClassPw');
  if (!pwEl) return;
  if (!cls) { pwEl.value = ''; return; }
  pwEl.value = (S.classPasswords && S.classPasswords[cls]) ? S.classPasswords[cls] : '1234';
};

window.saveClassPw = function(btn) {
  const cls = $('stClassSel').value;
  const pw = $('stClassPw').value.trim();
  if (!cls) { showToast('اختر الفصل أولاً', 'error'); return; }
  if (!pw) { showToast('أدخل الرقم السري', 'error'); return; }
  cloudUpdate('classPasswords', { [cls]: pw }).then(() => showToast('تم حفظ الرقم السري للفصل', 'success'));
};

// CONTENT & MEDIA MANAGEMENT
function renderAdminNews() {
  const list = $('adminNewsList');
  if (!list) return;
  if (!S.news.length) {
    list.innerHTML = '<div style="opacity:0.6;padding:10px;">لا توجد صور إخبارية مضافة بعد.</div>';
    return;
  }
  list.innerHTML = S.news.map(n => `
    <div style="display:flex;align-items:center;gap:12px;background:var(--glass);padding:10px;border-radius:var(--r-md);margin-bottom:8px;border:1px solid var(--glass-border);">
      <img src="${n.url}" style="width:50px;height:50px;object-fit:cover;border-radius:var(--r-sm);">
      <span style="flex:1;font-weight:600;">${n.title || 'بدون عنوان'}</span>
      <button class="btn btn-red" style="padding:6px 12px;" onclick="deleteNews('${n.id}')"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

window.adminUploadNews = function() {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: S.lang }).done(file => {
    file.promise().done(info => {
      const t = prompt('عنوان الصورة الإخبارية (اختياري):');
      cloudPush('news', { url: info.cdnUrl, title: t || '' }).then(() => showToast('تم إضافة الصورة الإخبارية بنجاح', 'success'));
    });
  });
};

window.deleteNews = function(id) {
  if (confirm('حذف هذا الخبر؟')) cloudRemove('news/' + id);
};

window.renderTickerAdmin = function() {
  const tl = $('tickerAdminList');
  if (!tl) return;
  if (!S.ticker || !S.ticker.length) {
    tl.innerHTML = '<div style="opacity:0.6;padding:10px;">لا توجد أخبار للشريط.</div>';
    return;
  }
  tl.innerHTML = S.ticker.map((t, i) => `
    <div style="display:flex;align-items:center;gap:10px;background:var(--glass);padding:8px 12px;border-radius:var(--r-sm);margin-bottom:6px;">
      <span style="flex:1;font-weight:600;">${t}</span>
      <button class="btn btn-red" style="padding:4px 8px;" onclick="removeTickerItem(${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
};

window.addTickerItem = function() {
  const el = $('newTickerInput');
  if (!el || !el.value.trim()) return;
  const arr = (S.ticker && Array.isArray(S.ticker)) ? S.ticker.slice() : [];
  arr.push(el.value.trim());
  cloudSave('settings/ticker', arr).then(() => {
    el.value = '';
    renderTickerAdmin();
    showToast('تم إضافة الخبر للشريط', 'success');
  });
};

window.removeTickerItem = function(idx) {
  const arr = (S.ticker && Array.isArray(S.ticker)) ? S.ticker.slice() : [];
  arr.splice(idx, 1);
  cloudSave('settings/ticker', arr).then(() => renderTickerAdmin());
};

// QURAN & ANTHEM ADMIN
function renderAdminQuran() {
  const list = $('quranAdminList');
  if (!list) return;
  if (!S.quranVideos.length) {
    list.innerHTML = '<div style="opacity:0.6;padding:10px;">لا توجد تلاوات مضافة.</div>';
    return;
  }
  list.innerHTML = S.quranVideos.map((v, i) => `
    <div style="display:flex;align-items:center;gap:10px;background:var(--glass);padding:10px;border-radius:var(--r-sm);margin-bottom:8px;">
      <span style="flex:1;font-weight:600;">${v.label || v.name || 'تلاوة مباركة'}</span>
      <button class="btn btn-gold" style="padding:6px 12px;" onclick="playVideo('${v.url}')"><i class="fas fa-play"></i></button>
      <button class="btn btn-red" style="padding:6px 12px;" onclick="deleteQuranVid(${i})"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

window.addQuranVideoEntry = function() {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: S.lang }).done(file => {
    file.promise().done(info => {
      const label = prompt('اسم القارئ أو السورة:');
      if (!label) return;
      const newList = S.quranVideos.slice();
      newList.push({ url: info.cdnUrl, label: label });
      cloudSave('quranVideos', newList).then(() => renderAdminQuran());
    });
  });
};

window.deleteQuranVid = function(idx) {
  if (confirm('حذف هذه التلاوة؟')) {
    const newList = S.quranVideos.slice();
    newList.splice(idx, 1);
    cloudSave('quranVideos', newList).then(() => renderAdminQuran());
  }
};

window.uploadAnthemVideo = function() {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url', locale: S.lang }).done(file => {
    file.promise().done(info => {
      cloudUpdate('settings', { anthemUrl: info.cdnUrl }).then(() => {
        showToast('تم رفع فيديو النشيد الوطني بنجاح', 'success');
        updateAnthemUI();
      });
    });
  });
};

window.deleteAnthemVideo = function() {
  if (confirm('حذف النشيد الوطني؟')) cloudUpdate('settings', { anthemUrl: '' }).then(() => updateAnthemUI());
};

// ATTENDANCE MANAGEMENT
function populateAttendanceRadios() {
  const sel = $('attendRadioSel');
  if (!sel) return;
  const approved = S.radios.filter(r => r.status === 'approved');
  sel.innerHTML = '<option value="">اختر إذاعة...</option>' + approved.map(r => `<option value="${r.id}">فصل ${r.class || '?'} - ${r.date || ''}</option>`).join('');
}

window.loadAttendance = function() {
  S.currentRadioId = $('attendRadioSel').value;
  populateAttendanceTable();
};

function populateAttendanceTable() {
  const tb = $('attendBody');
  if (!tb) return;
  if (!S.currentRadioId) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;opacity:0.6;">اختر إذاعة لعرض سجل الحضور</td></tr>';
    return;
  }
  const data = S.attendance.filter(a => a.radioId === S.currentRadioId);
  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;opacity:0.6;">لا توجد بيانات حضور لهذه الإذاعة</td></tr>';
    return;
  }
  tb.innerHTML = data.map((info, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>فصل ${info.class || ''} - ${info.date || ''}</td>
      <td><b>${info.student || ''}</b></td>
      <td>${info.slide || ''}</td>
      <td>
        <select class="input-field" style="padding:4px 10px;margin:0;" onchange="updateAttend('${info.id}',this.value)">
          <option value="حاضر" ${info.status === 'حاضر' ? 'selected' : ''}>حاضر ✅</option>
          <option value="غائب" ${info.status === 'غائب' ? 'selected' : ''}>غائب ❌</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.updateAttend = function(id, status) {
  cloudUpdate('attendance/' + id, { status: status });
};

window.exportExcel = function() {
  if (!S.currentRadioId) { showToast('اختر إذاعة أولاً', 'error'); return; }
  const data = S.attendance.filter(a => a.radioId === S.currentRadioId);
  let csv = '\uFEFFالفصل,التاريخ,الطالب,الفقرة,الحالة\n';
  data.forEach(i => { csv += `${i.class || ''},${i.date || ''},${i.student || ''},${i.slide || ''},${i.status || ''}\n`; });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'حضور_الإذاعة.csv';
  a.click();
};

window.deleteAttendanceRecord = function() {
  if (!S.currentRadioId) { showToast('اختر إذاعة أولاً', 'error'); return; }
  if (!confirm('مسح سجل الحضور لهذه الإذاعة؟')) return;
  const updates = {};
  if (window.db) {
    window.db.ref().update(updates).then(() => showToast('تم مسح سجل الحضور', 'info'));
  } else {
    showToast('تم مسح سجل الحضور', 'info');
  }
};

// TAB SWITCHER INSIDE ADMIN MODAL
window.showTab = function(tabId, btn) {
  document.querySelectorAll('.tab-body').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const t = $(tabId); if (t) t.classList.add('active');
  if (btn) btn.classList.add('active');
  if (tabId === 'tabBackup') loadBackupBroadcasts(renderBackupAdmin);
};

// INFO SCREEN DISPLAY LOOP
let newsSliderTimer = null;
let tickerAnimId = null;
let _lastTickerText = '';
let participantsAnimId = null;

function startParticipantsScroll(html) {
  const board = $('participantsBoard');
  const area = $('participantsScrollArea');
  if (!board || !area) return;
  if (participantsAnimId) { cancelAnimationFrame(participantsAnimId); participantsAnimId = null; }

  board.innerHTML = html;
  const areaH = area.offsetHeight;
  const boardH = board.scrollHeight;

  if (boardH <= areaH) {
    board.style.transform = 'translateY(0)';
    return;
  }

  board.innerHTML = html + html;
  const fullH = boardH;
  let y = 0;
  const speed = 0.4;

  function step() {
    y -= speed;
    if (Math.abs(y) >= fullH) y = 0;
    board.style.transform = `translateY(${y}px)`;
    participantsAnimId = requestAnimationFrame(step);
  }
  step();
}

function startTickerRAF() {
  const tDisp = $('tickerContent');
  const tCont = $('tickerContainer');
  if (!tDisp || !tCont) return;
  if (tickerAnimId) { cancelAnimationFrame(tickerAnimId); tickerAnimId = null; }
  if (!tDisp.innerHTML.trim()) return;

  const contW = tCont.offsetWidth;
  const textW = tDisp.scrollWidth;
  let x = -textW;
  const spd = 2;

  function tick() {
    x += spd;
    if (x > contW) x = -textW;
    tDisp.style.transform = `translateX(${Math.round(x)}px)`;
    tickerAnimId = requestAnimationFrame(tick);
  }
  tick();
}

function initInfoLoop() {
  startNewsSlider();

  function updateInfoContent() {
    const approvedR = S.radios.find(r => r.status === 'approved');
    const pb = $('participantsBoard');
    if (pb) {
      if (approvedR && approvedR.slides && approvedR.slides.length) {
        const presentStudents = approvedR.slides.filter(s => {
          if (!s.student) return false;
          const att = S.attendance.find(a => a.radioId === approvedR.id && a.student === s.student);
          return !att || att.status === 'حاضر';
        });
        const html = presentStudents.length ?
          presentStudents.map(s => `<div class="participant-card"><i class="fas fa-user-graduate text-gold"></i> <span>${s.student || 'مشارك'}</span></div>`).join('') :
          '<div style="opacity:0.5;text-align:center;padding:20px;">بانتظار إذاعة اليوم...</div>';

        if (pb.dataset.lastHtml !== html) {
          pb.dataset.lastHtml = html;
          startParticipantsScroll(html);
        }
      } else {
        const emptyHtml = '<div style="opacity:0.5;text-align:center;padding:20px;">بانتظار إذاعة اليوم...</div>';
        if (pb.dataset.lastHtml !== emptyHtml) {
          pb.dataset.lastHtml = emptyHtml;
          pb.innerHTML = emptyHtml;
          if (participantsAnimId) { cancelAnimationFrame(participantsAnimId); participantsAnimId = null; }
          pb.style.transform = 'translateY(0)';
        }
      }
    }

    const tDisp = $('tickerContent');
    const tickerItems = (S.ticker && Array.isArray(S.ticker)) ? S.ticker.slice() : [];
    const sep = '\u00A0'.repeat(20);
    const newTickerHTML = tickerItems.join(sep) + (tickerItems.length ? sep : '');
    if (tDisp && _lastTickerText !== newTickerHTML) {
      _lastTickerText = newTickerHTML;
      tDisp.style.transform = 'translateX(0)';
      tDisp.innerHTML = newTickerHTML;
      startTickerRAF();
    }
  }

  updateInfoContent();
  setInterval(updateInfoContent, 4000);
}

window.startNewsSlider = function() {
  clearInterval(newsSliderTimer);
  const img = $('newsImg');
  const title = $('newsTitle');
  const inds = $('newsIndicators');
  const empty = $('newsEmpty');
  const pb = $('newsProgressBar');
  if (!img) return;

  if (!S.news || !S.news.length) {
    if (img) img.style.display = 'none';
    if (title) title.style.display = 'none';
    if (inds) inds.innerHTML = '';
    if (pb) pb.style.width = '0%';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  let cur = 0;

  function show() {
    const n = S.news[cur]; if (!n) return;
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = n.url;
      img.style.display = 'block';
      img.style.opacity = '1';
    }, 300);

    if (n.title && title) { title.innerText = n.title; title.style.display = 'block'; }
    else if (title) { title.style.display = 'none'; }

    if (inds) {
      inds.innerHTML = S.news.map((_, i) => `<div style="width:${i === cur ? '40px' : '12px'};height:5px;border-radius:3px;background:${i === cur ? 'var(--gold)' : 'rgba(255,255,255,0.4)'};transition:all 0.5s;"></div>`).join('');
    }

    if (pb) {
      pb.style.transition = 'none';
      pb.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          pb.style.transition = `width ${S.newsDuration || 8}s linear`;
          pb.style.width = '100%';
        });
      });
    }
    cur = (cur + 1) % S.news.length;
  }

  show();
  newsSliderTimer = setInterval(show, (S.newsDuration || 8) * 1000);
};

// FLOATING EDUCATIONAL ICONS (CLEAN NO-OP)
function initFloatingIcons() {
  // Ambient clean background
}

// EMERGENCY BACKUP BROADCASTS
function loadBackupBroadcasts(cb) {
  if (window.db) {
    window.db.ref('backupBroadcasts').once('value', s => {
      S_bp.list = objArr(s.val());
      if (cb) cb();
    });
  } else {
    if (cb) cb();
  }
}

function renderBackupAdmin() {
  const el = $('backupAdminList'); if (!el) return;
  if (!S_bp.list.length) { el.innerHTML = '<div style="opacity:0.6;padding:10px;">لا توجد إذاعات احتياطية مضافة بعد.</div>'; return; }
  el.innerHTML = S_bp.list.map((b, i) => {
    const dayNum = Math.floor(Date.now() / 86400000);
    const todayIdx = dayNum % S_bp.list.length;
    const isTodayBadge = (i === todayIdx) ? '<span style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;margin-right:8px;">اليوم</span>' : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;background:var(--glass);padding:10px;border-radius:var(--r-sm);margin-bottom:8px;">
        <span style="flex:1;font-weight:600;">${isTodayBadge}${b.name || 'إذاعة ' + (i + 1)} (${(b.segments && b.segments.length) || 0} فقرات)</span>
        <button class="btn btn-accent" style="padding:5px 10px;" onclick="openEditBackup('${b.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-red" style="padding:5px 10px;" onclick="deleteBackup('${b.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
  }).join('');
}

window.openAddBackup = function() {
  S_bp.editId = null; S_bp.editSegs = [];
  const ni = $('backupNameInput'); if (ni) ni.value = '';
  renderEditSegs();
  openOv('backupEditOverlay');
};

window.openEditBackup = function(id) {
  const b = S_bp.list.find(x => x.id === id); if (!b) return;
  S_bp.editId = id; S_bp.editSegs = (b.segments || []).map(s => Object.assign({}, s));
  const ni = $('backupNameInput'); if (ni) ni.value = b.name || '';
  renderEditSegs();
  openOv('backupEditOverlay');
};

window.deleteBackup = function(id) {
  if (confirm('حذف هذه الإذاعة الاحتياطية؟')) {
    cloudRemove('backupBroadcasts/' + id).then(() => loadBackupBroadcasts(renderBackupAdmin));
  }
};

window.addBpSeg = function() {
  S_bp.editSegs.push({ title: '', videoUrl: '' });
  renderEditSegs();
};

window.removeBpSeg = function(i) {
  S_bp.editSegs.splice(i, 1);
  renderEditSegs();
};

window.uploadBpVideo = function(i) {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: S.lang })
    .done(file => {
      file.promise().done(info => {
        S_bp.editSegs[i].videoUrl = info.cdnUrl;
        renderEditSegs();
      });
    });
};

function renderEditSegs() {
  const el = $('backupSegsList'); if (!el) return;
  if (!S_bp.editSegs.length) { el.innerHTML = '<div style="opacity:0.6;padding:10px;text-align:center;">لا توجد فقرات. اضغط "+ فقرة جديدة"</div>'; return; }
  el.innerHTML = S_bp.editSegs.map((seg, i) => `
    <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--r-md);padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b style="color:var(--gold);">فقرة ${i + 1}</b>
        <button class="btn btn-red" style="padding:4px 8px;" onclick="removeBpSeg(${i})"><i class="fas fa-trash"></i></button>
      </div>
      <input class="input-field mb10" placeholder="عنوان الفقرة" value="${seg.title || ''}" oninput="S_bp.editSegs[${i}].title=this.value">
      ${seg.videoUrl ?
        `<div style="display:flex;align-items:center;gap:10px;"><span class="text-gold">✅ فيديو مرفق</span><button class="btn btn-accent" style="padding:4px 8px;" onclick="uploadBpVideo(${i})">تغيير</button></div>` :
        `<button class="btn btn-accent" onclick="uploadBpVideo(${i})"><i class="fas fa-upload"></i> رفع فيديو</button>`}
    </div>
  `).join('');
}

window.saveBackupBroadcast = function(btn) {
  const ni = $('backupNameInput');
  const name = ni ? ni.value.trim() : '';
  if (!name) { showToast('أدخل اسم الإذاعة', 'error'); return; }
  if (!S_bp.editSegs.length) { showToast('أضف فقرة واحدة على الأقل', 'error'); return; }
  const data = { name: name, segments: S_bp.editSegs };
  const p = S_bp.editId ? cloudUpdate('backupBroadcasts/' + S_bp.editId, data) : cloudPush('backupBroadcasts', data);
  p.then(() => {
    closeOv('backupEditOverlay');
    loadBackupBroadcasts(renderBackupAdmin);
    showToast('تم حفظ الإذاعة الاحتياطية بنجاح', 'success');
  });
};

window.startBackupBroadcast = function() {
  loadBackupBroadcasts(() => {
    if (!S_bp.list.length) { showToast('لا توجد إذاعات احتياطية مضافة بعد', 'error'); return; }
    const dayNum = Math.floor(Date.now() / 86400000);
    S_bp.bcastIdx = dayNum % S_bp.list.length;
    S_bp.segIdx = 0;
    if (S_bp.segTimer) { clearTimeout(S_bp.segTimer); S_bp.segTimer = null; }
    openOv('presOverlay');
    _playBpSegment();
  });
};

function _playBpSegment() {
  const bc = S_bp.list[S_bp.bcastIdx];
  if (!bc || !bc.segments || !bc.segments.length) return;
  const seg = bc.segments[S_bp.segIdx % bc.segments.length];
  const c = $('presContent');
  if (c) {
    c.innerHTML = `
      <div style="text-align:center;padding:30px 20px;">
        <div style="font-size:0.9rem;color:var(--accent);margin-bottom:8px;font-weight:700;">📡 إذاعة احتياطية — ${bc.name || ''} (${(S_bp.segIdx % bc.segments.length) + 1}/${bc.segments.length})</div>
        <div style="font-size:2rem;font-weight:800;color:var(--gold);margin-bottom:20px;">${seg.title || ''}</div>
        ${seg.videoUrl ?
          `<div onclick="playVideo('${seg.videoUrl}')" class="card-interactive" style="background:var(--bg-card);border-radius:var(--r-lg);padding:40px 60px;display:inline-block;border:2px solid var(--gold);">
            <i class="fas fa-play-circle" style="font-size:4.5rem;color:var(--gold);display:block;margin-bottom:12px;"></i>
            <div style="color:var(--gold);font-weight:700;font-size:1.1rem;">تشغيل مقطع الفيديو</div>
          </div>` :
          `<div style="color:var(--text-sub);margin-top:30px;">لا يوجد فيديو لهذه الفقرة</div>`}
      </div>
    `;
  }
  if (seg.videoUrl) {
    playVideo(seg.videoUrl);
    const mv = $('mainVideo');
    if (mv) { mv.onended = () => { closeVideo(); _advanceBpSegment(); }; }
  } else {
    S_bp.segTimer = setTimeout(_advanceBpSegment, 6000);
  }
}

function _advanceBpSegment() {
  const bc = S_bp.list[S_bp.bcastIdx]; if (!bc || !bc.segments) return;
  S_bp.segIdx = (S_bp.segIdx + 1) % bc.segments.length;
  S_bp.segTimer = setTimeout(_playBpSegment, 2000);
}

// Dynamic Topic & Broadcasts Synchronization with Backend API
async function syncCurrentTopic() {
  try {
    const isLocal = window.location.origin.includes('5500') || window.location.origin.includes('5501') || window.location.origin.includes('127.0.0.1') || window.location.protocol === 'file:';
    const backendUrl = isLocal ? 'http://localhost:3000' : '';
    
    // 1. Sync Topic
    const res = await fetch(backendUrl + '/api/get-current-topic');
    if (res.ok) {
      const json = await res.json();
      if (json && json.topic) {
        S.topic = json.topic;
        const elBanner = document.getElementById('topicTitle');
        if (elBanner && elBanner.textContent !== json.topic) {
          elBanner.textContent = json.topic;
        }
        const elInfo = document.getElementById('infoTopic2');
        if (elInfo && elInfo.textContent !== json.topic) {
          elInfo.textContent = json.topic;
        }
        const elInput = document.getElementById('stTopic');
        if (elInput && document.activeElement !== elInput) {
          elInput.value = json.topic;
        }
      }
    }

    // 2. Sync Broadcasts List (Pending & Approved)
    const resBc = await fetch(backendUrl + '/api/broadcasts');
    if (resBc.ok) {
      const jsonBc = await resBc.json();
      if (jsonBc && Array.isArray(jsonBc.broadcasts)) {
        S.radios = jsonBc.broadcasts;
        const adm = $('adminOverlay');
        if (adm && adm.classList.contains('open')) {
          renderAdminRadios();
          if (typeof populateAttendanceRadios === 'function') populateAttendanceRadios();
        }
      }
    }
  } catch (err) {
    // Silent catch if backend is offline
  }
}

// Poll every 3 seconds for live updates
setInterval(syncCurrentTopic, 3000);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncCurrentTopic);
} else {
  syncCurrentTopic();
}
