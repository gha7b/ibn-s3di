require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { GoogleGenAI } = require('@google/genai');

// ═══════════════════════════════════════════════════════
// AUTH CODES REGISTRY
// ═══════════════════════════════════════════════════════
const AUTH_CODES = {
  // 1ST GRADE AMBASSADORS
  '1101': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-1' },
  '1102': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-2' },
  '1103': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-3' },
  '1104': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-4' },
  '1105': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-5' },
  '1106': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-6' },

  // 2ND GRADE AMBASSADORS
  '2201': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-1' },
  '2202': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-2' },
  '2203': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-3' },
  '2204': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-4' },
  '2205': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-5' },
  '2206': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-6' },

  // 3RD GRADE AMBASSADORS
  '3301': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-1' },
  '3302': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-2' },
  '3303': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-3' },
  '3304': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-4' },
  '3305': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-5' },
  '3306': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-6' },

  // SUPERVISORS
  '9901': { role: 'supervisor', grade: 1, gradeName: 'أول ثانوي', gradeScope: 'المرحلة الأولى (أول ثانوي)' },
  '9902': { role: 'supervisor', grade: 2, gradeName: 'ثاني ثانوي', gradeScope: 'المرحلة الثانية (ثاني ثانوي)' },
  '9903': { role: 'supervisor', grade: 3, gradeName: 'ثالث ثانوي', gradeScope: 'المرحلة الثالثة (ثالث ثانوي)' }
};

function validateAuthCode(code, selectedRole) {
  if (!code || typeof code !== 'string') return null;
  const trimmedCode = code.trim();
  const entry = AUTH_CODES[trimmedCode];
  if (!entry) return null;
  if (selectedRole && entry.role !== selectedRole) return null;
  return entry;
}

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════
const {
  GEMINI_API_KEY,
  TELEGRAM_BOT_TOKEN,
  ADMIN_CHAT_ID,
  FIREBASE_DB_URL = 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app',
  SITE_URL = 'https://ibn-s3di.vercel.app'
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN and ADMIN_CHAT_ID must be in .env");
  process.exit(1);
}

// Initialize GoogleGenAI SDK (@google/genai)
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ═══════════════════════════════════════════════════════
// FIREBASE REST HELPERS
// ═══════════════════════════════════════════════════════
async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

async function fbSet(path, value) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
  return res.json();
}

async function fbUpdate(updates) {
  const res = await fetch(`${FIREBASE_DB_URL}/.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Firebase PATCH failed: ${res.status}`);
  return res.json();
}

async function fbDelete(path) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════
// USER AUTH & ROLE HELPERS
// ═══════════════════════════════════════════════════════
async function getUserProfile(chatId) {
  if (isAdmin(chatId)) {
    return {
      telegramId: String(chatId),
      role: 'admin',
      gradeName: 'إدارة المنصة',
      title: 'مدير النظام'
    };
  }
  try {
    const user = await fbGet(`users/${chatId}`);
    return (user && typeof user === 'object') ? user : null;
  } catch (e) {
    return null;
  }
}

async function findSupervisorForGrade(grade) {
  try {
    const allUsers = await fbGet('users');
    if (allUsers && typeof allUsers === 'object') {
      for (const uid of Object.keys(allUsers)) {
        const u = allUsers[uid];
        if (u.role === 'supervisor' && Number(u.grade) === Number(grade)) {
          return u.telegramId;
        }
      }
    }
  } catch (e) {
    // Fallback
  }
  return ADMIN_CHAT_ID;
}

// ═══════════════════════════════════════════════════════
// TOPIC & BROADCAST HELPERS
// ═══════════════════════════════════════════════════════
async function getWeeklyTopic() {
  try {
    const topic = await fbGet('settings/topic');
    return (typeof topic === 'string' && topic.trim()) ? topic.trim() : 'احترام المعلم والانضباط المدرسي';
  } catch (e) {
    return 'احترام المعلم والانضباط المدرسي';
  }
}

async function setWeeklyTopic(topic) {
  await fbSet('settings/topic', topic);
}

async function getResponsibleClass() {
  try {
    const schedule = await fbGet('schedule');
    if (!schedule || typeof schedule !== 'object') return null;

    const riyad = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
    const dayIndex = new Date(riyad).getDay();

    const dayEntry = schedule[dayIndex];
    if (dayEntry && dayEntry.class && dayEntry.class.trim()) {
      return dayEntry.class.trim();
    }
    return null;
  } catch (e) {
    console.warn('⚠️ Could not read schedule from Firebase:', e.message);
    return null;
  }
}

async function autoCleanupOldBroadcasts() {
  try {
    const allRadios = await fbGet('radios');
    if (!allRadios || typeof allRadios !== 'object') return;

    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const toDelete = [];

    Object.keys(allRadios).forEach(key => {
      const r = allRadios[key];
      if (r.status === 'pending' && r.timestamp && r.timestamp < cutoff24h) {
        toDelete.push(key);
      }
    });

    if (toDelete.length > 0) {
      for (const key of toDelete) {
        await fbDelete(`radios/${key}`);
        console.log(`🗑️ Auto-deleted old pending broadcast: ${key}`);
      }
    }
  } catch (e) {
    console.warn('⚠️ Auto-cleanup error:', e.message);
  }
}

async function saveBroadcastToFirebase(broadcastId, broadcastData, status) {
  const isApproved = status === 'approved';
  const dataToSave = {
    ...broadcastData,
    status,
    approved: isApproved
  };

  await fbSet(`radios/${broadcastId}`, dataToSave);

  if (isApproved) {
    const allRadios = await fbGet('radios');
    if (allRadios && typeof allRadios === 'object') {
      const resetUpdates = {};
      Object.keys(allRadios).forEach(key => {
        if (key !== broadcastId && allRadios[key].status === 'approved') {
          resetUpdates[`radios/${key}/status`] = 'pending';
          resetUpdates[`radios/${key}/approved`] = false;
        }
      });
      if (Object.keys(resetUpdates).length > 0) {
        await fbUpdate(resetUpdates);
      }
    }

    await fbSet('approvedBroadcast', { ...dataToSave, id: broadcastId });

    if (broadcastData.topic) {
      await fbSet('settings/topic', broadcastData.topic);
    }
  }
}

function buildBroadcastMessageText(topic, classLabel, dateStr, slides) {
  const icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
  let msgText = `📌 *الموضوع:* ${topic}\n`;
  msgText += `🏫 *الفصل المسؤول:* ${classLabel}\n`;
  msgText += `📅 *التاريخ:* ${dateStr}\n\n`;
  slides.forEach((sec, i) => {
    msgText += `${icons[i]} *${sec.title}:*\n${sec.content}\n\n`;
  });
  return msgText;
}

// ═══════════════════════════════════════════════════════
// TELEGRAM BOT
// ═══════════════════════════════════════════════════════
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

async function safeSendMessage(chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.warn(`⚠️ Telegram (Chat: ${chatId}):`, err.message);
  }
}

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// Commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUserProfile(chatId);

  if (user) {
    let userRoleDesc = '';
    if (user.role === 'admin') userRoleDesc = '👑 مدير النظام الرئيسي';
    else if (user.role === 'ambassador') userRoleDesc = `🎓 سفير فصل (${user.className}) — ${user.gradeName}`;
    else if (user.role === 'supervisor') userRoleDesc = `👔 مشرف ${user.gradeScope || user.gradeName}`;

    safeSendMessage(chatId,
      `👋 *أهلاً بك مجدداً في منصة الإذاعة المدرسية الذكية*\n` +
      `الصفة: ${userRoleDesc}\n\n` +
      `📋 *الأوامر المتاحة لك:*\n` +
      `- \`/generate\` — توليد إذاعة مدرسية ذكية عبر Gemini API\n` +
      (user.role === 'admin' || user.role === 'supervisor' ? `- \`/set_topic\` — تغيير موضوع/قيمة الأسبوع\n` : '') +
      `- \`/my_profile\` — عرض بيانات حسابك وصلاحياتك\n` +
      `- \`/cleanup\` — تنظيف الإذاعات المعلقة`,
      { parse_mode: 'Markdown' }
    );
  } else {
    safeSendMessage(chatId,
      `👋 *أهلاً بك في منصة الإذاعة المدرسية الذكية (ثانوية ابن سعدي)*\n\n` +
      `لتفعيل حسابك والبدء في الاستخدام، يرجى اختيار نوع التسجيل:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎓 تسجيل كـ سفير فصل", callback_data: "login_type:ambassador" }],
            [{ text: "👔 تسجيل كـ مشرف مرحلة", callback_data: "login_type:supervisor" }]
          ]
        }
      }
    );
  }
});

bot.onText(/\/my_profile/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUserProfile(chatId);
  if (!user) {
    return safeSendMessage(chatId, "⚠️ أنت غير مسجل بعد. أرسل /start لتسجيل الدخول.");
  }
  let profileMsg = `👤 *بيانات حسابك:*\n`;
  profileMsg += `🆔 *المعرف:* ${chatId}\n`;
  profileMsg += `🏷 *الدور:* ${user.role === 'admin' ? 'مدير عام' : user.role === 'ambassador' ? 'سفير فصل' : 'مشرف مرحلة'}\n`;
  if (user.className) profileMsg += `🏫 *الفصل:* ${user.className}\n`;
  if (user.gradeName) profileMsg += `📚 *المرحلة:* ${user.gradeName}\n`;
  safeSendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/set_topic/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUserProfile(chatId);
  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    return safeSendMessage(chatId, "⚠️ تغيير موضوع الأسبوع مخصص للمشرفين وإدارة المنصة فقط.");
  }
  await fbSet(`userState/${chatId}`, { step: 'WAITING_FOR_TOPIC' });
  safeSendMessage(chatId, "✏️ اكتب موضوع/قيمة الأسبوع الجديدة:");
});

bot.onText(/\/generate/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUserProfile(chatId);
  if (!user) {
    return safeSendMessage(chatId, "⚠️ عذراً، يجب عليك تسجيل الدخول أولاً باستخدام /start.");
  }
  safeSendMessage(chatId, `⏳ جاري توليد الإذاعة الذكية عبر Gemini API (5 فقرات) ${user.className ? `لفصل ${user.className}` : ''}...`);
  generateRadioBroadcast(user);
});

bot.onText(/\/cleanup/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUserProfile(chatId);
  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    return safeSendMessage(chatId, "⚠️ غير مصرح.");
  }
  safeSendMessage(chatId, "🗑️ جاري حذف الإذاعات المعلقة القديمة...");
  try {
    await autoCleanupOldBroadcasts();
    safeSendMessage(chatId, "✅ تم تنظيف قاعدة البيانات بنجاح.");
  } catch (e) {
    safeSendMessage(chatId, `❌ خطأ: ${e.message}`);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith('/')) return;

  const userState = await fbGet(`userState/${chatId}`);
  if (!userState || typeof userState !== 'object') return;

  // Code Registration
  if (userState.step === 'AWAITING_CODE') {
    const match = validateAuthCode(msg.text.trim(), userState.selectedRole);
    if (!match) {
      return safeSendMessage(chatId,
        `❌ *كود غير صحيح!*\n\n` +
        `الكود الإدخال (${msg.text.trim()}) غير صحيح أو لا يطابق الخيار المحدد.\n` +
        `يرجى التأكد وإعادة كتابة الكود المكون من 4 أرقام:`,
        { parse_mode: 'Markdown' }
      );
    }

    const userProfile = {
      telegramId: String(chatId),
      role: match.role,
      grade: match.grade,
      gradeName: match.gradeName,
      className: match.className || null,
      gradeScope: match.gradeScope || null,
      code: msg.text.trim(),
      registeredAt: Date.now()
    };

    await fbSet(`users/${chatId}`, userProfile);
    await fbDelete(`userState/${chatId}`);

    let welcomeText = '';
    if (match.role === 'ambassador') {
      welcomeText = `🎉 *تم تسجيلك بنجاح كـ سفير فصل (${match.className}) — ${match.gradeName}!*\n\n` +
        `يمكنك الآن إرسال الأمر /generate لتوليد إذاعة مدرسية جديدة مخصصة لفصلك.`;
    } else {
      welcomeText = `🎉 *تم تسجيلك بنجاح كـ مشرف ${match.gradeScope}!*\n\n` +
        `يمكنك الآن استلام وإشراف واعتماد إذاعات فصول مرحلتك الدراسية.`;
    }

    return safeSendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
  }

  // Supervisor Edit Note Entry
  if (userState.step === 'ENTER_EDIT_NOTE') {
    const { broadcastId, secIndex } = userState;
    const noteText = msg.text.trim();

    await fbDelete(`userState/${chatId}`);

    const broadcast = await fbGet(`radios/${broadcastId}`);
    if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
      return safeSendMessage(chatId, "❌ حدث خطأ: الإذاعة أو الفقرة غير موجودة.");
    }

    const secTitle = broadcast.slides[secIndex].title;
    const currentContent = broadcast.slides[secIndex].content;
    const ambassadorId = broadcast.ambassadorId || ADMIN_CHAT_ID;

    await fbSet(`userState/${ambassadorId}`, {
      step: 'AMBASSADOR_REVISING_SECTION',
      broadcastId,
      secIndex
    });

    await safeSendMessage(ambassadorId,
      `📌 *طلب تعديل فقرة من المشرف (فصل ${broadcast.class})*\n\n` +
      `الفقرة المطلوب تعديلها: *(${secTitle})*\n` +
      `📝 *ملاحظة المشرف:* "${noteText}"\n\n` +
      `📄 *النص الحالي للفقرة:*\n${currentContent}\n\n` +
      `✏️ *يرجى إرسال النص الجديد المعدل لهذه الفقرة الان:*`,
      { parse_mode: 'Markdown' }
    );

    return safeSendMessage(chatId, `✅ تم إرسال طلب التعديل إلى سفير الفصل بنجاح. ستصلك الإذاعة فور تعديلها.`);
  }

  // Ambassador Submitting Revised Section Text
  if (userState.step === 'AMBASSADOR_REVISING_SECTION') {
    const { broadcastId, secIndex } = userState;
    const newSectionText = msg.text.trim();

    await fbDelete(`userState/${chatId}`);

    const broadcast = await fbGet(`radios/${broadcastId}`);
    if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
      return safeSendMessage(chatId, "❌ حدث خطأ: الإذاعة غير موجودة.");
    }

    broadcast.slides[secIndex].content = newSectionText;
    await fbSet(`radios/${broadcastId}`, broadcast);

    await safeSendMessage(chatId, `✅ *تم تحديث الفقرة بنجاح، وإعادة الإذاعة للمشرف للمراجعة والاعتماد!*`, { parse_mode: 'Markdown' });

    const supervisorChatId = await findSupervisorForGrade(broadcast.grade || 1);
    const contentBody = buildBroadcastMessageText(broadcast.topic, broadcast.class, broadcast.date, broadcast.slides);

    const updatedSupervisorMsg = `🔄 *إذاعة معدلة بانتظار الاعتماد (فصل ${broadcast.class}):*\n\n` + contentBody;
    const inlineButtons = {
      inline_keyboard: [
        [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }],
        [{ text: "✏️ طلب تعديل فقرة", callback_data: `request_edit:${broadcastId}` }]
      ]
    };

    return safeSendMessage(supervisorChatId, updatedSupervisorMsg, {
      parse_mode: 'Markdown',
      reply_markup: inlineButtons
    });
  }

  // Topic Entry
  if (userState.step === 'WAITING_FOR_TOPIC') {
    const user = await getUserProfile(chatId);
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      const newTopic = msg.text.trim();
      await fbDelete(`userState/${chatId}`);

      try {
        await setWeeklyTopic(newTopic);
        safeSendMessage(chatId,
          `✅ تم تحديث موضوع الأسبوع بنجاح:\n"${newTopic}"\n\n` +
          `🌐 سيظهر على الموقع فوراً: ${SITE_URL}`
        );
      } catch (err) {
        safeSendMessage(chatId, `❌ حدث خطأ: ${err.message}`);
      }
    }
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data || '';

  if (data.startsWith('login_type:')) {
    const selectedRole = data.split('login_type:')[1];
    const roleTitle = selectedRole === 'ambassador' ? '🎓 سفير فصل' : '👔 مشرف مرحلة';

    await fbSet(`userState/${chatId}`, {
      step: 'AWAITING_CODE',
      selectedRole: selectedRole
    });

    bot.answerCallbackQuery(query.id, { text: `اخترت: ${roleTitle}` }).catch(() => {});
    return safeSendMessage(chatId,
      `🔑 *إدخال كود التفعيل:*\n\n` +
      `يرجى كتابة وإرسال كود التفعيل المكون من 4 أرقام المخصص لك كـ (${roleTitle}):`,
      { parse_mode: 'Markdown' }
    );
  }

  if (data.startsWith('approve_broadcast:')) {
    const user = await getUserProfile(chatId);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return bot.answerCallbackQuery(query.id, { text: "⚠️ هذه الخاصية مخصصة للمشرفين والإدارة فقط." }).catch(() => {});
    }

    const broadcastId = data.split('approve_broadcast:')[1];

    try {
      bot.answerCallbackQuery(query.id, { text: "⏳ جاري الاعتماد..." }).catch(() => {});

      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast) {
        return bot.answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" }).catch(() => {});
      }

      if (user.role === 'supervisor') {
        const broadcastGrade = Number(broadcast.grade || String(broadcast.class || '').slice(0, 1));
        if (Number(user.grade) !== broadcastGrade) {
          return safeSendMessage(chatId, `⚠️ يمكنك فقط اعتماد إذاعات مرحلتك الدراسية (المرحلة ${user.gradeName}).`);
        }
      }

      await saveBroadcastToFirebase(broadcastId, broadcast, 'approved');

      safeSendMessage(chatId,
        `🎉 *تم اعتماد ونشر الإذاعة على الموقع فوراً!*\n` +
        `📌 الموضوع: "${broadcast.topic}"\n` +
        `🏫 الفصل: "${broadcast.class || 'غير محدد'}"\n` +
        `🌐 الموقع: ${SITE_URL}`,
        { parse_mode: 'Markdown' }
      );

      if (broadcast.ambassadorId) {
        safeSendMessage(broadcast.ambassadorId,
          `🎉 *تم اعتماد إذاعة فصلك (${broadcast.class}) بنجاح ونشرها على الموقع الرسمي!*\n` +
          `🌐 يمكنك مشاهدتها الآن: ${SITE_URL}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: "❌ خطأ في الاعتماد" }).catch(() => {});
      safeSendMessage(chatId, `❌ خطأ في الاعتماد: ${err.message}`);
    }
  }

  if (data.startsWith('request_edit:')) {
    const user = await getUserProfile(chatId);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return bot.answerCallbackQuery(query.id, { text: "⚠️ هذه الخاصية مخصصة للمشرفين فقط." }).catch(() => {});
    }

    const broadcastId = data.split('request_edit:')[1];
    const broadcast = await fbGet(`radios/${broadcastId}`);
    if (!broadcast) {
      return bot.answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" }).catch(() => {});
    }

    bot.answerCallbackQuery(query.id, { text: "اختر الفقرة المراد تعديلها" }).catch(() => {});

    const sectionButtons = [
      [{ text: "1️⃣ 1. المقدمة والترحيب", callback_data: `edit_sec:${broadcastId}:0` }],
      [{ text: "2️⃣ 2. كلمة الصباح", callback_data: `edit_sec:${broadcastId}:1` }],
      [{ text: "3️⃣ 3. الحديث الشريف", callback_data: `edit_sec:${broadcastId}:2` }],
      [{ text: "4️⃣ 4. رسالة للطالب / توجيه", callback_data: `edit_sec:${broadcastId}:3` }],
      [{ text: "5️⃣ 5. الخاتمة", callback_data: `edit_sec:${broadcastId}:4` }]
    ];

    return safeSendMessage(chatId,
      `✏️ *اختر رقم الفقرة المطلوبة لتعديلها من قائمة الفقرات التالية:*`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: sectionButtons }
      }
    );
  }

  if (data.startsWith('edit_sec:')) {
    const parts = data.split(':');
    const broadcastId = parts[1];
    const secIndex = Number(parts[2]);

    const broadcast = await fbGet(`radios/${broadcastId}`);
    if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
      return bot.answerCallbackQuery(query.id, { text: "❌ الفقرة غير موجودة" }).catch(() => {});
    }

    const secTitle = broadcast.slides[secIndex].title;
    await fbSet(`userState/${chatId}`, {
      step: 'ENTER_EDIT_NOTE',
      broadcastId,
      secIndex
    });

    bot.answerCallbackQuery(query.id, { text: `اخترت: ${secTitle}` }).catch(() => {});

    return safeSendMessage(chatId,
      `📝 *أدخل ملاحظة التعديل:* \n\n` +
      `الفقرة المحددة: *(${secTitle})*\n` +
      `اكتب رسالة/ملاحظة بسيطة توضح للسفير المطلوب تعديله في هذه الفقرة:`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ═══════════════════════════════════════════════════════
// PURE GEMINI API GENERATION
// ═══════════════════════════════════════════════════════
async function generateRadioBroadcast(userProfile = null) {
  await autoCleanupOldBroadcasts();

  const topic = await getWeeklyTopic();
  const scheduleClass = await getResponsibleClass();

  const classLabel = userProfile?.className || scheduleClass || 'فصل غير محدد';
  const grade = userProfile?.grade || (classLabel.startsWith('1') ? 1 : classLabel.startsWith('2') ? 2 : 3);
  const dateStr = new Date().toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' });
  const broadcastId = 'radio_' + Date.now();

  const promptText = `قم بصياغة إذاعة مدرسية متكاملة لثانوية ابن سعدي عن موضوع: (${topic}). اكتب نصاً إبداعياً جديداً بالكامل لكل فقرة من الفقرات الخمس إجباريًا:
1. المقدمة والترحيب
2. كلمة الصباح
3. الحديث الشريف
4. رسالة للطالب / توجيه
5. الخاتمة

أرجع النتيجة حصراً وبدون أي مقدمات أو ماركداون إضافي بصيغة JSON التالية:
{"topic":"${topic}","sections":[{"title":"المقدمة والترحيب","content":"..."},{"title":"كلمة الصباح","content":"..."},{"title":"الحديث الشريف","content":"..."},{"title":"رسالة للطالب / توجيه","content":"..."},{"title":"الخاتمة","content":"..."}]}`;

  if (!ai) {
    const errorMsg = "فشل التوليد من Gemini API: GEMINI_API_KEY غير موجود في متغيرات البيئة (.env)";
    console.error(`❌ ${errorMsg}`);
    if (userProfile?.telegramId) {
      await safeSendMessage(userProfile.telegramId, `❌ ${errorMsg}`);
    }
    return;
  }

  const modelNames = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  let sections = null;
  let lastError = null;

  for (const mName of modelNames) {
    try {
      console.log(`🤖 Calling Gemini API via @google/genai SDK model: ${mName}...`);

      const response = await ai.models.generateContent({
        model: mName,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          temperature: 0.8
        }
      });

      const responseText = response.text;

      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length >= 5) {
          sections = parsed.sections.slice(0, 5);
          console.log(`✅ Gemini API generation succeeded using model: ${mName}`);
          break;
        }
      }
    } catch (err) {
      lastError = err;
      console.error(`❌ Gemini API Call Error (${mName}):`, err.message || err);
    }
  }

  if (!sections) {
    const apiErrDetail = lastError ? (lastError.message || JSON.stringify(lastError)) : "Unknown Error";
    const explicitErrorMsg = `فشل التوليد من Gemini API: [${apiErrDetail}]`;
    console.error(`❌ CRITICAL: ${explicitErrorMsg}`);
    if (userProfile?.telegramId) {
      await safeSendMessage(userProfile.telegramId, `❌ ${explicitErrorMsg}`);
    }
    return;
  }

  const slides = sections.map(sec => ({
    student: classLabel,
    title: sec.title,
    content: sec.content
  }));

  const ambassadorId = userProfile?.telegramId ? String(userProfile.telegramId) : String(ADMIN_CHAT_ID);

  const broadcastData = {
    ambassadorId,
    class: classLabel,
    grade: grade,
    date: dateStr,
    status: 'pending',
    approved: false,
    topic,
    slides,
    timestamp: Date.now()
  };

  await saveBroadcastToFirebase(broadcastId, broadcastData, 'pending');

  const contentBody = buildBroadcastMessageText(topic, classLabel, dateStr, slides);

  await safeSendMessage(ambassadorId,
    `🎙 *معاينة الإذاعة الخاصة بك (فصل ${classLabel}):*\n\n` +
    contentBody +
    `ℹ️ *ملاحظة:* تم إرسال هذه الإذاعة لمشرف المرحلة للمراجعة والاعتماد.`,
    { parse_mode: 'Markdown' }
  );

  const supervisorChatId = await findSupervisorForGrade(grade);

  const supervisorMsg = `🎙 *إذاعة جديدة بانتظار الاعتماد (فصل ${classLabel}):*\n\n` + contentBody;
  const inlineButtons = {
    inline_keyboard: [
      [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }],
      [{ text: "✏️ طلب تعديل فقرة", callback_data: `request_edit:${broadcastId}` }]
    ]
  };

  await safeSendMessage(supervisorChatId, supervisorMsg, {
    parse_mode: 'Markdown',
    reply_markup: inlineButtons
  });

  if (String(supervisorChatId) !== String(ADMIN_CHAT_ID)) {
    await safeSendMessage(ADMIN_CHAT_ID, `📢 *نسخة للإدارة:* ` + supervisorMsg, {
      parse_mode: 'Markdown',
      reply_markup: inlineButtons
    });
  }
}

cron.schedule('0 0 * * *', () => {
  console.log("🗑️ Cron: Auto-cleanup old pending broadcasts...");
  autoCleanupOldBroadcasts();
}, { timezone: "Asia/Riyadh" });

console.log("🤖 Telegram Bot started successfully with Full Broadcast Lifecycle & Section Editing.");
