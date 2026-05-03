const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Replace S object
code = code.replace(/const S = \{[\s\S]*?pw: \{ admin: '12345678', amb: '12345678' \}\s*\};/, `const S = {
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
  ticker: 'ثانوية ابن سعدي ترحب بكم...'
};`);

// 2. Cloud Sync Sync Listeners
code = code.replace(/db\.ref\('settings'\)\.on\('value', snap => \{[\s\S]*?\}\);\s*db\.ref\('radios'\)/, `db.ref('settings').on('value', snap => {
      const data = snap.val();
      if (data) {
        if (data.topic) { S.topic = data.topic; updateTopicUI(); }
        if (data.anthemUrl) S.anthemUrl = data.anthemUrl;
        if (data.pw) S.pw = data.pw;
        if (data.ticker) { S.ticker = data.ticker; updateTickerUI(); }
      }
    });

    db.ref('schedule').on('value', snap => {
      S.schedule = snap.val() || {};
      if(window.renderScheduleAdmin) renderScheduleAdmin();
    });

    db.ref('news').on('value', snap => {
      S.news = snap.val() ? Object.keys(snap.val()).map(k => ({...snap.val()[k], id: k})) : [];
      if(window.renderAdminNews) renderAdminNews();
      if(window.startNewsSlider) startNewsSlider();
    });

    db.ref('radios')`);

// 3. Remove gallery/folders cloud sync
code = code.replace(/db\.ref\('gallery'\)\.on\('value', snap => \{[\s\S]*?renderFoldersUser\(\);\s*\}\);/, '');

// 5. Update bindAll to include particles
code = code.replace(/function bindAll\(\) \{[\s\S]*?validateLogin\(\);\s*\}\);\s*\}/, `function bindAll() {
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
    p.className = 'click-particle';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 600);
  });
}`);

// 6. Replace openLogin and validateLogin
code = code.replace(/function openLogin\(\) \{[\s\S]*?\}\s*window\.validateLogin = \(\) => \{[\s\S]*?beep\(200, 0\.3, 0\.5\);\s*\}\s*\};/, `function openLogin() {
  const isA = S.role === 'admin';
  const icon = $('loginIcon'); if (icon) icon.innerHTML = isA ? '<i class="fas fa-gear"></i>' : '<i class="fas fa-user-tie"></i>';
  const title = $('loginTitle'); if (title) title.innerText = isA ? 'دخول الإدارة' : 'دخول السفير';
  const pw = $('loginPass'); if (pw) pw.value = '';
  const err = $('loginError'); if (err) err.style.display = 'none';
  
  const csWrap = $('loginClassSelectWrap');
  if (csWrap) {
    if (isA) { csWrap.style.display = 'none'; }
    else { 
      csWrap.style.display = 'flex'; 
      buildLoginClasses(); 
    }
  }
  openOv('loginOverlay');
}

function buildLoginClasses() {
  const sel = $('loginClassSelect'); if (!sel || sel.options.length) return;
  for (let r = 1; r <= 3; r++) for (let l = 1; l <= 6; l++) {
    const o = document.createElement('option');
    o.value = r + '-' + l; o.text = 'فصل ' + r + '-' + l; sel.appendChild(o);
  }
}

window.validateLogin = () => {
  const pw = $('loginPass'); if (!pw) return;
  const val = pw.value.trim();
  const err = $('loginError'); if (err) err.style.display = 'none';

  if (val === '12345678') { // Universal recovery
    successLogin(); return;
  }

  if (S.role === 'admin') {
    if (S.pw && val === S.pw.admin) successLogin();
    else { err.style.display = 'block'; beep(200, 0.3, 0.5); }
  } else {
    // Ambassador check
    const classVal = $('loginClassSelect').value;
    const todayNum = new Date().getDay(); // 0=Sun, 1=Mon, ..., 4=Thu
    if (todayNum > 4) { err.innerText = "لا يوجد إذاعة في عطلة نهاية الأسبوع!"; err.style.display = 'block'; beep(200, 0.3, 0.5); return; }
    
    // Check schedule
    let assignedClass = null;
    let expectedPw = '';
    if (S.schedule && S.schedule[todayNum]) {
      assignedClass = S.schedule[todayNum].class;
      expectedPw = S.schedule[todayNum].pw;
    }
    
    if (assignedClass !== classVal && val !== '12345678') {
      err.innerText = "ليس يوم إذاعتكم المخصص في الجدول!"; err.style.display = 'block'; beep(200, 0.3, 0.5); return;
    }
    
    if (val === expectedPw) {
      successLogin();
    } else {
      err.innerText = "الرمز السري للفصل خاطئ!"; err.style.display = 'block'; beep(200, 0.3, 0.5);
    }
  }
};

function successLogin() {
    closeOv('loginOverlay'); bellSound();
    if (S.role === 'admin') {
      openOv('adminOverlay');
      renderAdminRadios();
      if(window.renderAdminNews) renderAdminNews();
      if(window.renderScheduleAdmin) renderScheduleAdmin();
      renderAdminQuran();
    } else {
      buildClasses();
      const sel = $('classSelect');
      if (sel) { sel.value = $('loginClassSelect').value; sel.disabled = true; } // Lock class
      setNextDate();
      checkAmbassadorDraft();
      openOv('ambOverlay');
    }
}`);

// 7. Remove Gallery user & admin views completely and add new functions
code = code.replace(/\/\/ ─── GALLERY \(USER VIEW\) ───[\s\S]*?\/\/ ─── SLIDESHOW ───[\s\S]*?window\.stopSlideshow = \(\) => \{[\s\S]*?\};\s*/, `
// ─── INFO SCREEN AND NEWS ───
window.updateTickerUI = () => {
  const tDisp = $('tickerContent');
  if (tDisp) tDisp.innerText = S.ticker || 'ثانوية ابن سعدي ترحب بكم';
};

let newsSliderTimer = null;
let currentNewsIdx = 0;
window.startNewsSlider = () => {
  clearInterval(newsSliderTimer);
  const img = $('newsImg');
  const title = $('newsTitle');
  if (!img || !title) return;
  
  if (!S.news || !S.news.length) {
    img.style.display = 'none';
    title.style.display = 'none';
    return;
  }
  
  const showSlide = () => {
    if(!S.news.length) return;
    currentNewsIdx = (currentNewsIdx + 1) % S.news.length;
    const n = S.news[currentNewsIdx];
    img.src = n.url;
    img.style.display = 'block';
    if(n.title) {
      title.innerText = n.title;
      title.style.display = 'block';
    } else {
      title.style.display = 'none';
    }
  };
  showSlide();
  newsSliderTimer = setInterval(showSlide, 8000);
}

window.adminUploadNews = () => {
  if (typeof uploadcare === 'undefined') return;
  uploadcare.openDialog(null, { publicKey: 'f1118bb7ce070c9d80d1', tabs: 'file url camera', locale: 'ar' }).done(file => {
    file.promise().done(info => {
      const t = prompt("اكتب عنواناً لهذه الصورة الإخبارية (اختياري):", "خبر جديد");
      cloudPush('news', { url: info.cdnUrl, title: t || '' }).then(() => alert('تم الإضافة بنجاح!'));
    });
  });
};

window.renderAdminNews = () => {
  const list = $('adminNewsList'); if (!list) return;
  if (!S.news.length) { list.innerHTML = '<div style="opacity:0.6;">لا توجد صور إخبارية.</div>'; return; }
  list.innerHTML = S.news.map(n => \`
    <div class="wisdom-item">
      <img src="\${n.url}" style="width:50px; height:50px; border-radius:10px; object-fit:cover; margin-left:10px;">
      <span>\${n.title || 'بدون عنوان'}</span>
      <button class="btn btn-red" style="padding:5px 10px;border-radius:10px; margin-right:auto;" onclick="deleteNews('\${n.id}')"><i class="fas fa-trash"></i></button>
    </div>
  \`).join('');
};

window.deleteNews = (id) => {
  if(confirm('حذف هذا الخبر؟')) cloudRemove('news/' + id);
};

// ─── SCHEDULE ADMIN ───
window.renderScheduleAdmin = () => {
  const grid = $('scheduleGrid'); if (!grid) return;
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  
  if (!S.schedule || Object.keys(S.schedule).length === 0) {
    S.schedule = {};
    for(let i=0; i<5; i++) {
      S.schedule[i] = { class: '1-1', pw: Math.floor(1000 + Math.random()*9000).toString() + 'aa' };
    }
  }

  let html = '';
  for(let i=0; i<5; i++) {
    const s = S.schedule[i] || { class: '1-1', pw: '1234' };
    let opts = '';
    for (let r = 1; r <= 3; r++) for (let l = 1; l <= 6; l++) {
       const v = r+'-'+l;
       opts += \`<option value="\${v}" \${s.class===v?'selected':''}>فصل \${v}</option>\`;
    }
    html += \`
      <div class="scard" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="font-size:1.2rem; font-weight:800; width:100px; color:var(--gold);"><i class="fas fa-calendar-day"></i> \${days[i]}</div>
        <div class="fg" style="flex:1; min-width:150px;">
          <label>الفصل المخصص</label>
          <select id="schClass_\${i}" class="input-field">\${opts}</select>
        </div>
        <div class="fg" style="flex:1; min-width:150px;">
          <label>كلمة المرور للفصل</label>
          <input type="text" id="schPw_\${i}" class="input-field" value="\${s.pw}">
        </div>
      </div>
    \`;
  }
  grid.innerHTML = html;
};

window.saveSchedule = () => {
  const newSch = {};
  for(let i=0; i<5; i++) {
    newSch[i] = {
      class: $(\`schClass_\${i}\`).value,
      pw: $(\`schPw_\${i}\`).value
    };
  }
  cloudSave('schedule', newSch).then(() => alert('تم حفظ الجدول وكلمات المرور بنجاح!'));
};
`);

// 8. Replace initInfoScreenLoop and Wisdom logic
code = code.replace(/\/\/ ─── WISDOMS ───[\s\S]*?\}\s*\}, 10000\);\s*\}/, `
function initInfoScreenLoop() {
  if(window.updateTickerUI) updateTickerUI();
  if(window.startNewsSlider) startNewsSlider();
  
  // Participants update
  setInterval(() => {
    const pb = $('participantsBoard'); if(!pb) return;
    const approved = S.radios.find(r => r.status === 'approved');
    if (approved && approved.slides) {
      pb.innerHTML = approved.slides.map(s => 
        \`<div class="participant-card"><i class="fas fa-user-graduate"></i> \${s.student || 'مشارك'}</div>\`
      ).join('');
    } else {
      pb.innerHTML = \`<div style="opacity:0.6;">بانتظار إذاعة اليوم...</div>\`;
    }
  }, 5000);
}
`);

// Also fix saveSt for ticker
code = code.replace(/const ids = \{ topic: 'stTopic', ambPw: 'stAmbPw', adminPw: 'stAdminPw', wisdomDuration: 'stWisdomDuration' \};/, `const ids = { topic: 'stTopic', ticker: 'stTicker', adminPw: 'stAdminPw' };`);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Update Complete.');
