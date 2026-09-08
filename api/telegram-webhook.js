import { GoogleGenAI } from '@google/genai';
import { validateAuthCode } from './auth-codes.js';

// ═══════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES — validated at startup
// ═══════════════════════════════════════════════════════
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';
const SITE_URL = process.env.SITE_URL || 'https://ibn-s3di.vercel.app';

console.log('[WEBHOOK] ENV check — BOT_TOKEN:', TELEGRAM_BOT_TOKEN ? '✅ set' : '❌ MISSING');
console.log('[WEBHOOK] ENV check — ADMIN_CHAT_ID:', ADMIN_CHAT_ID ? '✅ set' : '❌ MISSING');
console.log('[WEBHOOK] ENV check — GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ set' : '❌ MISSING');
console.log('[WEBHOOK] ENV check — FIREBASE_DB_URL:', FIREBASE_DB_URL);

// Initialize GoogleGenAI SDK
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ═══════════════════════════════════════════════════════
// TELEGRAM API HELPERS
// ═══════════════════════════════════════════════════════
async function tgSend(chatId, text, options = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'Markdown', ...options };
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) console.error('[WEBHOOK] sendMessage failed:', JSON.stringify(json));
    return json;
  } catch (err) {
    console.error('[WEBHOOK] tgSend error:', err.message);
  }
}

async function tgAnswer(callbackQueryId, text = '') {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text })
    });
  } catch (err) {
    console.error('[WEBHOOK] tgAnswer error:', err.message);
  }
}

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// ═══════════════════════════════════════════════════════
// FIREBASE REST HELPERS
// ═══════════════════════════════════════════════════════
async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed [${path}]: ${res.status}`);
  return res.json();
}

async function fbSet(path, value) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Firebase SET failed [${path}]: ${res.status}`);
  return res.json();
}

async function fbPatch(updates) {
  const res = await fetch(`${FIREBASE_DB_URL}/.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Firebase PATCH failed: ${res.status}`);
  return res.json();
}

async function fbDel(path) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════
// USER PROFILE & SUPER ADMIN HELPERS
// ═══════════════════════════════════════════════════════
async function getUserProfile(chatId) {
  if (isAdmin(chatId)) {
    return { telegramId: String(chatId), role: 'admin', isSuperAdmin: true, gradeName: 'إدارة المنصة' };
  }
  try {
    const user = await fbGet(`users/${chatId}`);
    if (user && typeof user === 'object' && user.role) {
      if (user.role === 'admin') user.isSuperAdmin = true;
      return user;
    }
    return null;
  } catch (e) {
    console.error('[WEBHOOK] getUserProfile error:', e.message);
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
    console.error('[WEBHOOK] findSupervisorForGrade error:', e.message);
  }
  return ADMIN_CHAT_ID;
}

async function getAllSuperAdminIds() {
  const superAdminIds = new Set();
  if (ADMIN_CHAT_ID) superAdminIds.add(String(ADMIN_CHAT_ID));
  try {
    const allUsers = await fbGet('users');
    if (allUsers && typeof allUsers === 'object') {
      for (const uid of Object.keys(allUsers)) {
        const u = allUsers[uid];
        if (u.role === 'admin' || u.isSuperAdmin) {
          superAdminIds.add(String(u.telegramId || uid));
        }
      }
    }
  } catch (e) {
    console.error('[WEBHOOK] getAllSuperAdminIds error:', e.message);
  }
  return Array.from(superAdminIds);
}

// ═══════════════════════════════════════════════════════
// BROADCAST HELPERS
// ═══════════════════════════════════════════════════════
async function getWeeklyTopic() {
  try {
    const topic = await fbGet('settings/topic');
    return (typeof topic === 'string' && topic.trim()) ? topic.trim() : 'احترام المعلم والانضباط المدرسي';
  } catch (e) {
    return 'احترام المعلم والانضباط المدرسي';
  }
}

async function approveBroadcast(broadcastId, broadcastData) {
  const data = { ...broadcastData, status: 'approved', approved: true };
  await fbSet(`radios/${broadcastId}`, data);
  // Reset other approved
  const allRadios = await fbGet('radios');
  if (allRadios && typeof allRadios === 'object') {
    const resets = {};
    Object.keys(allRadios).forEach(k => {
      if (k !== broadcastId && allRadios[k].status === 'approved') {
        resets[`radios/${k}/status`] = 'pending';
        resets[`radios/${k}/approved`] = false;
      }
    });
    if (Object.keys(resets).length > 0) await fbPatch(resets);
  }
  await fbSet('approvedBroadcast', { ...data, id: broadcastId });

  // Sync attendance records automatically into Firebase
  if (data.slides && Array.isArray(data.slides)) {
    const attUpdates = {};
    data.slides.forEach((s, idx) => {
      const attId = `${broadcastId}_${idx}`;
      attUpdates[`attendance/${attId}`] = {
        id: attId,
        radioId: broadcastId,
        class: data.class || '',
        date: data.date || '',
        student: s.student || 'طالب مشارك',
        substituteStudent: '',
        slide: s.title || `فقرة ${idx + 1}`,
        status: 'حاضر',
        updatedAt: Date.now()
      };
    });
    await fbPatch(attUpdates);
  }

  if (broadcastData.topic) await fbSet('settings/topic', broadcastData.topic);
}

function formatBroadcast(topic, classLabel, dateStr, slides) {
  const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  let msg = `📌 *الموضوع:* ${topic}\n🏫 *الفصل:* ${classLabel}\n📅 *التاريخ:* ${dateStr}\n\n`;
  slides.forEach((s, i) => {
    msg += `${icons[i]} *${s.title}:*\n👨‍🎓 *الطالب المشارك:* ${s.student || 'غير محدد'}\n${s.content}\n\n`;
  });
  return msg;
}

async function sendBroadcastToSupervisors(broadcastId, broadcastData) {
  const { topic, class: classLabel, grade, date: dateStr, slides, ambassadorId } = broadcastData;
  const contentBody = formatBroadcast(topic, classLabel, dateStr, slides);
  const supervisorId = await findSupervisorForGrade(grade);
  const buttons = {
    inline_keyboard: [
      [{ text: '✅ اعتماد ونشر الإذاعة', callback_data: `approve_broadcast:${broadcastId}` }],
      [{ text: '✏️ طلب تعديل فقرة', callback_data: `request_edit:${broadcastId}` }],
      [{ text: '👨‍🎓 تعديل أسماء المشاركين', callback_data: `edit_students:${broadcastId}` }]
    ]
  };

  const supervisorMsg = `🎙 *إذاعة جديدة بانتظار الاعتماد (فصل ${classLabel}):*\n\n` + contentBody;
  await tgSend(supervisorId, supervisorMsg, { reply_markup: buttons });

  // Send Super Admin copies to all Super Admins except supervisorId if already sent
  const superAdminIds = await getAllSuperAdminIds();
  for (const sId of superAdminIds) {
    if (String(sId) !== String(supervisorId) && String(sId) !== String(ambassadorId)) {
      await tgSend(sId, `👑 *[نسخة المشرف العام]*\n` + supervisorMsg, { reply_markup: buttons });
    }
  }
}

// ═══════════════════════════════════════════════════════
// GEMINI BROADCAST GENERATION
// ═══════════════════════════════════════════════════════
export async function generateRadioBroadcast(userProfile) {
  const topic = await getWeeklyTopic();
  const classLabel = userProfile?.className || 'فصل غير محدد';
  const grade = userProfile?.grade || 1;
  const ambassadorId = userProfile?.telegramId ? String(userProfile.telegramId) : String(ADMIN_CHAT_ID);
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
    await tgSend(ambassadorId, `❌ فشل التوليد: GEMINI_API_KEY غير موجود في متغيرات البيئة.`);
    return;
  }

  const modelNames = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  let sections = null;
  let lastError = null;

  for (const mName of modelNames) {
    try {
      console.log(`[WEBHOOK] Calling Gemini model: ${mName}`);
      const response = await ai.models.generateContent({
        model: mName,
        contents: promptText,
        config: { responseMimeType: 'application/json', temperature: 0.8 }
      });
      const parsed = JSON.parse(response.text);
      if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length >= 5) {
        sections = parsed.sections.slice(0, 5);
        console.log(`[WEBHOOK] Gemini generation succeeded: ${mName}`);
        break;
      }
    } catch (err) {
      lastError = err;
      console.error(`[WEBHOOK] Gemini error (${mName}):`, err.message);
    }
  }

  if (!sections) {
    await tgSend(ambassadorId, `❌ فشل التوليد من Gemini API: ${lastError?.message || 'Unknown Error'}`);
    return;
  }

  const slides = sections.map(sec => ({ student: 'بانتظار إدخال الاسم', title: sec.title, content: sec.content }));
  const broadcastData = {
    ambassadorId, class: classLabel, grade, date: dateStr,
    status: 'pending', approved: false, topic, slides, timestamp: Date.now()
  };

  await fbSet(`radios/${broadcastId}`, broadcastData);

  // Set Ambassador State to enter student names step-by-step
  await fbSet(`userState/${ambassadorId}`, { step: 'ENTER_STUDENT_NAMES', broadcastId, secIndex: 0, slides });

  const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  await tgSend(ambassadorId,
    `✨ *[الخطوة 1 من 3]: تم توليد النص الذكي بنجاح (5 فقرات)!*\n\n` +
    `👨‍🎓 *[الخطوة 2 من 3]: تسجيل أسماء الطلاب المشاركين (فقرة 1 من 5):*\n` +
    `أرسل اسم الطالب المشارك لفقرة:\n*${icons[0]} ${slides[0].title}*`
  );
}

// ═══════════════════════════════════════════════════════
// PROCESS UPDATE (all logic here)
// ═══════════════════════════════════════════════════════
async function processUpdate(update) {
  console.log('[WEBHOOK] Processing update type:', Object.keys(update).filter(k => k !== 'update_id').join(', '));

  // ── CALLBACK QUERIES ──
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = String(query.message?.chat?.id);
    const data = query.data || '';
    console.log(`[WEBHOOK] callback_query from ${chatId}: ${data}`);

    if (data.startsWith('login_type:')) {
      const selectedRole = data.split('login_type:')[1];
      const roleTitle = selectedRole === 'ambassador' ? '🎓 سفير فصل' : '👔 مشرف مرحلة';
      await fbSet(`userState/${chatId}`, { step: 'AWAITING_CODE', selectedRole });
      await tgAnswer(query.id, `اخترت: ${roleTitle}`);
      await tgSend(chatId, `🔑 *إدخال كود التفعيل:*\n\nأرسل كود التفعيل المخصص لك:`);
      return;
    }

    if (data.startsWith('approve_broadcast:')) {
      const user = await getUserProfile(chatId);
      if (!user || (user.role !== 'admin' && user.role !== 'supervisor' && !user.isSuperAdmin)) {
        await tgAnswer(query.id, '⚠️ مخصص للمشرفين والإدارة فقط.');
        return;
      }
      const broadcastId = data.replace('approve_broadcast:', '');
      await tgAnswer(query.id, '⏳ جاري الاعتماد...');
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast) { await tgSend(chatId, '❌ الإذاعة غير موجودة.'); return; }

      const isSuperAdminUser = user.role === 'admin' || user.isSuperAdmin;
      if (!isSuperAdminUser && Number(user.grade) !== Number(broadcast.grade)) {
        await tgSend(chatId, `⚠️ يمكنك فقط اعتماد إذاعات مرحلتك (${user.gradeName}).`);
        return;
      }

      await approveBroadcast(broadcastId, broadcast);
      await tgSend(chatId, `🎉 *تم اعتماد الإذاعة ونشرها فوراً!*\n📌 الموضوع: "${broadcast.topic}"\n🏫 الفصل: "${broadcast.class}"\n🌐 ${SITE_URL}`);

      if (broadcast.ambassadorId) {
        await tgSend(broadcast.ambassadorId, `🎉 *تم اعتماد إذاعة فصلك (${broadcast.class}) ونشرها على الموقع!*\n🌐 ${SITE_URL}`);
      }

      const superAdminIds = await getAllSuperAdminIds();
      for (const sId of superAdminIds) {
        if (String(sId) !== String(chatId) && String(sId) !== String(broadcast.ambassadorId)) {
          await tgSend(sId, `📢 *[مراقبة المشرف العام]:* تم اعتماد إذاعة فصل (${broadcast.class}) بنجاح.`);
        }
      }
      return;
    }

    if (data.startsWith('request_edit:')) {
      const user = await getUserProfile(chatId);
      if (!user || (user.role !== 'admin' && user.role !== 'supervisor' && !user.isSuperAdmin)) {
        await tgAnswer(query.id, '⚠️ مخصص للمشرفين والإدارة فقط.');
        return;
      }
      const broadcastId = data.replace('request_edit:', '');
      await tgAnswer(query.id, 'اختر الفقرة للتعديل');
      await tgSend(chatId, `✏️ *اختر رقم الفقرة المطلوب تعديلها:*`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '1️⃣ المقدمة والترحيب', callback_data: `edit_sec:${broadcastId}:0` }],
            [{ text: '2️⃣ كلمة الصباح', callback_data: `edit_sec:${broadcastId}:1` }],
            [{ text: '3️⃣ الحديث الشريف', callback_data: `edit_sec:${broadcastId}:2` }],
            [{ text: '4️⃣ رسالة للطالب / توجيه', callback_data: `edit_sec:${broadcastId}:3` }],
            [{ text: '5️⃣ الخاتمة', callback_data: `edit_sec:${broadcastId}:4` }]
          ]
        }
      });
      return;
    }

    if (data.startsWith('edit_students:')) {
      const broadcastId = data.replace('edit_students:', '');
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast) { await tgAnswer(query.id, '❌ الإذاعة غير موجودة.'); return; }
      await fbSet(`userState/${chatId}`, { step: 'ENTER_STUDENT_NAMES', broadcastId, secIndex: 0, slides: broadcast.slides });
      await tgAnswer(query.id, 'إعادة أدخال أسماء الطلاب');
      await tgSend(chatId,
        `👨‍🎓 *تعديل أسماء الطلاب المشاركين (فقرة 1 من 5):*\n` +
        `أرسل اسم الطالب المشارك لفقرة: *1️⃣ ${broadcast.slides[0].title}*`
      );
      return;
    }

    if (data.startsWith('edit_sec:')) {
      const parts = data.split(':');
      const broadcastId = parts[1];
      const secIndex = Number(parts[2]);
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast?.slides?.[secIndex]) { await tgAnswer(query.id, '❌ الفقرة غير موجودة.'); return; }
      const secTitle = broadcast.slides[secIndex].title;
      await fbSet(`userState/${chatId}`, { step: 'ENTER_EDIT_NOTE', broadcastId, secIndex });
      await tgAnswer(query.id, `اخترت: ${secTitle}`);
      await tgSend(chatId, `📝 *اكتب ملاحظة التعديل للسفير:*\n\nالفقرة: *(${secTitle})*`);
      return;
    }

    return;
  }

  // ── TEXT MESSAGES ──
  if (update.message) {
    const msg = update.message;
    const chatId = String(msg.chat?.id);
    const text = (msg.text || '').trim();

    if (!text) return;
    console.log(`[WEBHOOK] Message from ${chatId}: ${text.slice(0, 80)}`);

    const user = await getUserProfile(chatId);
    const userState = await fbGet(`userState/${chatId}`).catch(() => null);

    // ── STATE: ENTER_STUDENT_NAMES (STEP BY STEP) ──
    if (userState?.step === 'ENTER_STUDENT_NAMES') {
      const { broadcastId, secIndex, slides } = userState;
      slides[secIndex].student = text;

      const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

      if (secIndex < 4) {
        const nextIdx = secIndex + 1;
        await fbSet(`userState/${chatId}`, { step: 'ENTER_STUDENT_NAMES', broadcastId, secIndex: nextIdx, slides });
        await tgSend(chatId,
          `✅ تم حفظ (${text}) لـ *${slides[secIndex].title}*\n\n` +
          `👨‍🎓 *[الخطوة 2 من 3]: أدخل اسم الطالب لفقرة (${nextIdx + 1} من 5):*\n` +
          `*${icons[nextIdx]} ${slides[nextIdx].title}*`
        );
        return;
      } else {
        // All 5 student names collected
        await fbDel(`userState/${chatId}`);
        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (broadcast) {
          broadcast.slides = slides;
          await fbSet(`radios/${broadcastId}`, broadcast);

          const contentBody = formatBroadcast(broadcast.topic, broadcast.class, broadcast.date, slides);
          await tgSend(chatId,
            `🎉 *[الخطوة 3 من 3]: تم تسجيل جميع الطلاب المشاركين بنجاح!*\n\n` +
            `🎙 *معاينة إذاعة فصلك (${broadcast.class}):*\n\n` + contentBody +
            `🚀 *تم الإرسال التلقائي لمشرف المرحلة للمراجعة والاعتماد.*`
          );

          // Forward to supervisors with approval buttons
          await sendBroadcastToSupervisors(broadcastId, broadcast);
        }
        return;
      }
    }

    // ── STATE: AWAITING CODE ──
    if (userState?.step === 'AWAITING_CODE') {
      const match = validateAuthCode(text, userState.selectedRole);
      if (!match) {
        await tgSend(chatId, `❌ *الكود غير صحيح!*\nيرجى إدخال كود التفعيل الصحيح:`);
        return;
      }

      const isSuper = match.role === 'admin' || match.isSuperAdmin;
      const profile = {
        telegramId: chatId, role: match.role, isSuperAdmin: isSuper || false,
        grade: match.grade || null, gradeName: match.gradeName,
        className: match.className || null, gradeScope: match.gradeScope || null,
        code: text, registeredAt: Date.now()
      };
      await fbSet(`users/${chatId}`, profile);
      await fbDel(`userState/${chatId}`);

      const welcome = isSuper
        ? `👑 *تم تسجيلك كـ المشرف العام (Super Admin)!*\n\nستصلك نسخة من جميع الإذاعات والتعديلات لجميع المراحل والفصول.`
        : match.role === 'ambassador'
        ? `🎉 *تم تسجيلك كـ سفير فصل (${match.className}) — ${match.gradeName}!*\n\nأرسل /generate لتوليد إذاعة جديدة لفصلك.`
        : `🎉 *تم تسجيلك كـ مشرف ${match.gradeScope}!*`;

      await tgSend(chatId, welcome);
      return;
    }

    // ── STATE: SUPERVISOR ENTERING EDIT NOTE ──
    if (userState?.step === 'ENTER_EDIT_NOTE') {
      const { broadcastId, secIndex } = userState;
      await fbDel(`userState/${chatId}`);
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast?.slides?.[secIndex]) { await tgSend(chatId, '❌ الإذاعة غير موجودة.'); return; }
      const secTitle = broadcast.slides[secIndex].title;
      const currentContent = broadcast.slides[secIndex].content;
      const ambassadorId = broadcast.ambassadorId || ADMIN_CHAT_ID;
      await fbSet(`userState/${ambassadorId}`, { step: 'AMBASSADOR_REVISING_SECTION', broadcastId, secIndex });
      await tgSend(ambassadorId,
        `📌 *طلب تعديل فقرة من المشرف (فصل ${broadcast.class})*\n\n` +
        `الفقرة: *(${secTitle})*\n📝 *ملاحظة المشرف:* "${text}"\n\n📄 *النص الحالي:*\n${currentContent}\n\n✏️ *أرسل النص الجديد المعدل الآن:*`
      );
      await tgSend(chatId, '✅ تم إرسال طلب التعديل للسفير. ستصلك الإذاعة المعدلة فوراً.');
      return;
    }

    // ── STATE: AMBASSADOR REVISING SECTION ──
    if (userState?.step === 'AMBASSADOR_REVISING_SECTION') {
      const { broadcastId, secIndex } = userState;
      await fbDel(`userState/${chatId}`);
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast?.slides?.[secIndex]) { await tgSend(chatId, '❌ الإذاعة غير موجودة.'); return; }
      broadcast.slides[secIndex].content = text;
      await fbSet(`radios/${broadcastId}`, broadcast);
      await tgSend(chatId, '✅ *تم تحديث الفقرة وإعادة الإذاعة للمشرف للاعتماد!*');
      await sendBroadcastToSupervisors(broadcastId, broadcast);
      return;
    }

    // ── STATE: WAITING FOR TOPIC ──
    if (userState?.step === 'WAITING_FOR_TOPIC') {
      if (user && (user.role === 'admin' || user.role === 'supervisor' || user.isSuperAdmin)) {
        await fbDel(`userState/${chatId}`);
        await fbSet('settings/topic', text);
        await tgSend(chatId, `✅ تم تحديث موضوع الأسبوع:\n"${text}"\n\n🌐 ${SITE_URL}`);
      }
      return;
    }

    // ── COMMANDS ──
    if (text === '/start') {
      if (user) {
        let roleDesc = user.isSuperAdmin || user.role === 'admin' ? '👑 المشرف العام (Super Admin)' :
          user.role === 'ambassador' ? `🎓 سفير فصل (${user.className}) — ${user.gradeName}` :
          `👔 مشرف ${user.gradeScope || user.gradeName}`;
        await tgSend(chatId,
          `👋 *أهلاً بك مجدداً!*\nالصفة: ${roleDesc}\n\n` +
          `📋 *الأوامر:*\n` +
          `- /generate — توليد إذاعة ذكية\n` +
          (user.role !== 'ambassador' ? `- /set_topic — تغيير موضوع الأسبوع\n` : '') +
          `- /my_profile — بيانات حسابك\n- /cleanup — تنظيف الإذاعات المعلقة`
        );
      } else {
        await tgSend(chatId,
          `👋 *أهلاً بك في منصة الإذاعة المدرسية الذكية (ثانوية ابن سعدي)*\n\nاختر نوع التسجيل للبدء:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎓 تسجيل كـ سفير فصل', callback_data: 'login_type:ambassador' }],
                [{ text: '👔 تسجيل كـ مشرف مرحلة', callback_data: 'login_type:supervisor' }]
              ]
            }
          }
        );
      }
      return;
    }

    if (text === '/my_profile') {
      if (!user) { await tgSend(chatId, '⚠️ أنت غير مسجل. أرسل /start أولاً.'); return; }
      await tgSend(chatId,
        `👤 *بيانات حسابك:*\n🆔 ${chatId}\n` +
        `🏷 الصفة: ${user.isSuperAdmin || user.role === 'admin' ? 'المشرف العام (Super Admin)' : user.role === 'ambassador' ? 'سفير فصل' : 'مشرف مرحلة'}\n` +
        (user.className ? `🏫 الفصل: ${user.className}\n` : '') +
        (user.gradeName ? `📚 المرحلة: ${user.gradeName}\n` : '') +
        (user.code ? `🔑 كود التفعيل: ${user.code}\n` : '')
      );
      return;
    }

    if (!user) {
      await tgSend(chatId, `⚠️ *يجب تسجيل الدخول أولاً.*\nأرسل /start ثم أدخل كود التفعيل.`);
      return;
    }

    if (text === '/generate') {
      await tgSend(chatId, `⏳ جاري توليد الإذاعة الذكية (5 فقرات)${user.className ? ` لفصل ${user.className}` : ''}...`);
      generateRadioBroadcast(user).catch(e => {
        console.error('[WEBHOOK] generateRadioBroadcast error:', e);
        tgSend(chatId, `❌ خطأ في التوليد: ${e.message}`);
      });
      return;
    }

    if (text === '/set_topic') {
      if (user.role === 'ambassador' && !user.isSuperAdmin) { await tgSend(chatId, '⚠️ مخصص للمشرفين والإدارة فقط.'); return; }
      await fbSet(`userState/${chatId}`, { step: 'WAITING_FOR_TOPIC' });
      await tgSend(chatId, '✏️ اكتب موضوع/قيمة الأسبوع الجديدة:');
      return;
    }

    if (text === '/cleanup') {
      if (user.role === 'ambassador' && !user.isSuperAdmin) { await tgSend(chatId, '⚠️ غير مصرح.'); return; }
      try {
        const allRadios = await fbGet('radios');
        if (!allRadios) { await tgSend(chatId, '✅ لا توجد إذاعات معلقة.'); return; }
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        let deleted = 0;
        for (const [k, r] of Object.entries(allRadios)) {
          if (r.status === 'pending' && r.timestamp < cutoff) { await fbDel(`radios/${k}`); deleted++; }
        }
        await tgSend(chatId, `✅ تم حذف ${deleted} إذاعة معلقة قديمة.`);
      } catch (e) {
        await tgSend(chatId, `❌ خطأ: ${e.message}`);
      }
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER — Returns 200 IMMEDIATELY, processes async
// ═══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.status(200).json({ ok: true });

  if (req.method === 'GET') return;
  if (req.method !== 'POST') return;

  const update = req.body;
  if (!update || typeof update !== 'object') {
    console.error('[WEBHOOK] Invalid update body received');
    return;
  }

  processUpdate(update).catch(err => {
    console.error('[WEBHOOK] Unhandled processUpdate error:', err);
  });
}
