import { GoogleGenAI } from '@google/genai';
import { validateAuthCode } from './auth-codes.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';
const SITE_URL = process.env.SITE_URL || 'https://ibn-s3di.vercel.app';

// Initialize GoogleGenAI SDK
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ═══════════════════════════════════════════════════════
// TELEGRAM API HELPERS (Serverless native fetch)
// ═══════════════════════════════════════════════════════
async function safeSendMessage(chatId, text, options = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        ...options
      })
    });
    return await res.json();
  } catch (err) {
    console.warn(`⚠️ Telegram Send Message Error (Chat: ${chatId}):`, err.message);
  }
}

async function answerCallbackQuery(callbackQueryId, options = {}) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...options
      })
    });
  } catch (err) {
    console.warn(`⚠️ Answer Callback Error:`, err.message);
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
    // Fallback to ADMIN_CHAT_ID
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
// GEMINI BROADCAST GENERATION
// ═══════════════════════════════════════════════════════
export async function generateRadioBroadcast(userProfile = null) {
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
    const errorMsg = "فشل التوليد من Gemini API: GEMINI_API_KEY غير موجود في متغيرات البيئة";
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
      console.log(`🤖 Calling Gemini API model: ${mName}...`);

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
      console.error(`❌ Gemini API Error (${mName}):`, err.message || err);
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

  // 1. Send Preview to Ambassador
  await safeSendMessage(ambassadorId,
    `🎙 *معاينة الإذاعة الخاصة بك (فصل ${classLabel}):*\n\n` +
    contentBody +
    `ℹ️ *ملاحظة:* تم إرسال هذه الإذاعة لمشرف المرحلة للمراجعة والاعتماد.`,
    { parse_mode: 'Markdown' }
  );

  // 2. Find Grade Supervisor and send for review
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

  // If supervisor is different from Admin, notify Admin as well
  if (String(supervisorChatId) !== String(ADMIN_CHAT_ID)) {
    await safeSendMessage(ADMIN_CHAT_ID, `📢 *نسخة للإدارة:* ` + supervisorMsg, {
      parse_mode: 'Markdown',
      reply_markup: inlineButtons
    });
  }

  return broadcastData;
}

// ═══════════════════════════════════════════════════════
// VERCEL SERVERLESS HANDLER (POST /api/telegram-webhook)
// ═══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, message: 'Telegram Webhook Endpoint active 24/7' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const update = req.body;
  if (!update || typeof update !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid update body' });
  }

  try {
    // 1. Handle Inline Keyboard Callback Queries
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const data = query.data || '';

      // LOGIN SELECTION CALLBACK
      if (data.startsWith('login_type:')) {
        const selectedRole = data.split('login_type:')[1];
        const roleTitle = selectedRole === 'ambassador' ? '🎓 سفير فصل' : '👔 مشرف مرحلة';

        await fbSet(`userState/${chatId}`, {
          step: 'AWAITING_CODE',
          selectedRole: selectedRole
        });

        await answerCallbackQuery(query.id, { text: `اخترت: ${roleTitle}` });

        await safeSendMessage(chatId,
          `🔑 *إدخال كود التفعيل:*\n\n` +
          `يرجى كتابة وإرسال كود التفعيل المكون من 4 أرقام المخصص لك كـ (${roleTitle}):`,
          { parse_mode: 'Markdown' }
        );

        return res.status(200).json({ success: true });
      }

      // BROADCAST APPROVAL CALLBACK
      if (data.startsWith('approve_broadcast:')) {
        const user = await getUserProfile(chatId);
        if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
          await answerCallbackQuery(query.id, { text: "⚠️ هذه الخاصية مخصصة للمشرفين والإدارة فقط." });
          return res.status(200).json({ success: true });
        }

        const broadcastId = data.split('approve_broadcast:')[1];
        await answerCallbackQuery(query.id, { text: "⏳ جاري الاعتماد..." });

        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (!broadcast) {
          await answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" });
          return res.status(200).json({ success: true });
        }

        if (user.role === 'supervisor') {
          const broadcastGrade = Number(broadcast.grade || String(broadcast.class || '').slice(0, 1));
          if (Number(user.grade) !== broadcastGrade) {
            await safeSendMessage(chatId, `⚠️ يمكنك فقط اعتماد إذاعات مرحلتك الدراسية (المرحلة ${user.gradeName}).`);
            return res.status(200).json({ success: true });
          }
        }

        await saveBroadcastToFirebase(broadcastId, broadcast, 'approved');

        await safeSendMessage(chatId,
          `🎉 *تم اعتماد ونشر الإذاعة على الموقع فوراً!*\n` +
          `📌 الموضوع: "${broadcast.topic}"\n` +
          `🏫 الفصل: "${broadcast.class || 'غير محدد'}"\n` +
          `🌐 الموقع: ${SITE_URL}`,
          { parse_mode: 'Markdown' }
        );

        // Notify Ambassador of Approval
        if (broadcast.ambassadorId) {
          await safeSendMessage(broadcast.ambassadorId,
            `🎉 *تم اعتماد إذاعة فصلك (${broadcast.class}) بنجاح ونشرها على الموقع الرسمي!*\n` +
            `🌐 يمكنك مشاهدتها الآن: ${SITE_URL}`,
            { parse_mode: 'Markdown' }
          );
        }

        return res.status(200).json({ success: true });
      }

      // REQUEST EDIT SECTION CALLBACK (Supervisor clicks 'طلب تعديل فقرة')
      if (data.startsWith('request_edit:')) {
        const user = await getUserProfile(chatId);
        if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
          await answerCallbackQuery(query.id, { text: "⚠️ هذه الخاصية مخصصة للمشرفين فقط." });
          return res.status(200).json({ success: true });
        }

        const broadcastId = data.split('request_edit:')[1];
        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (!broadcast) {
          await answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" });
          return res.status(200).json({ success: true });
        }

        await answerCallbackQuery(query.id, { text: "اختر الفقرة المراد تعديلها" });

        const sectionButtons = [
          [{ text: "1️⃣ 1. المقدمة والترحيب", callback_data: `edit_sec:${broadcastId}:0` }],
          [{ text: "2️⃣ 2. كلمة الصباح", callback_data: `edit_sec:${broadcastId}:1` }],
          [{ text: "3️⃣ 3. الحديث الشريف", callback_data: `edit_sec:${broadcastId}:2` }],
          [{ text: "4️⃣ 4. رسالة للطالب / توجيه", callback_data: `edit_sec:${broadcastId}:3` }],
          [{ text: "5️⃣ 5. الخاتمة", callback_data: `edit_sec:${broadcastId}:4` }]
        ];

        await safeSendMessage(chatId,
          `✏️ *اختر رقم الفقرة المطلوبة لتعديلها من قائمة الفقرات التالية:*`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: sectionButtons }
          }
        );

        return res.status(200).json({ success: true });
      }

      // SELECT SECTION FOR EDIT CALLBACK
      if (data.startsWith('edit_sec:')) {
        const parts = data.split(':');
        const broadcastId = parts[1];
        const secIndex = Number(parts[2]);

        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
          await answerCallbackQuery(query.id, { text: "❌ الفقرة غير موجودة" });
          return res.status(200).json({ success: true });
        }

        const secTitle = broadcast.slides[secIndex].title;
        await fbSet(`userState/${chatId}`, {
          step: 'ENTER_EDIT_NOTE',
          broadcastId,
          secIndex
        });

        await answerCallbackQuery(query.id, { text: `اخترت: ${secTitle}` });

        await safeSendMessage(chatId,
          `📝 *أدخل ملاحظة التعديل:* \n\n` +
          `الفقرة المحددة: *(${secTitle})*\n` +
          `اكتب رسالة/ملاحظة بسيطة توضح للسفير المطلوب تعديله في هذه الفقرة:`,
          { parse_mode: 'Markdown' }
        );

        return res.status(200).json({ success: true });
      }

      return res.status(200).json({ success: true });
    }

    // 2. Handle Text Messages
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text ? msg.text.trim() : '';

      if (!text) return res.status(200).json({ success: true });

      const user = await getUserProfile(chatId);
      const userState = await fbGet(`userState/${chatId}`);

      // STATE 1: Code Registration
      if (userState && typeof userState === 'object' && userState.step === 'AWAITING_CODE') {
        const match = validateAuthCode(text, userState.selectedRole);

        if (!match) {
          await safeSendMessage(chatId,
            `❌ *كود غير صحيح!*\n\n` +
            `الكود الإدخال (${text}) غير صحيح أو لا يطابق الخيار المحدد.\n` +
            `يرجى التأكد وإعادة كتابة الكود المكون من 4 أرقام:`,
            { parse_mode: 'Markdown' }
          );
          return res.status(200).json({ success: true });
        }

        const userProfile = {
          telegramId: String(chatId),
          role: match.role,
          grade: match.grade,
          gradeName: match.gradeName,
          className: match.className || null,
          gradeScope: match.gradeScope || null,
          code: text,
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

        await safeSendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
        return res.status(200).json({ success: true });
      }

      // STATE 2: Supervisor Entering Edit Note
      if (userState && typeof userState === 'object' && userState.step === 'ENTER_EDIT_NOTE') {
        const { broadcastId, secIndex } = userState;
        const noteText = text;

        await fbDelete(`userState/${chatId}`);

        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
          await safeSendMessage(chatId, "❌ حدث خطأ: الإذاعة أو الفقرة غير موجودة.");
          return res.status(200).json({ success: true });
        }

        const secTitle = broadcast.slides[secIndex].title;
        const currentContent = broadcast.slides[secIndex].content;
        const ambassadorId = broadcast.ambassadorId || ADMIN_CHAT_ID;

        // Set Ambassador state to wait for section revision text
        await fbSet(`userState/${ambassadorId}`, {
          step: 'AMBASSADOR_REVISING_SECTION',
          broadcastId,
          secIndex
        });

        // Send alert to Ambassador
        await safeSendMessage(ambassadorId,
          `📌 *طلب تعديل فقرة من المشرف (فصل ${broadcast.class})*\n\n` +
          `الفقرة المطلوب تعديلها: *(${secTitle})*\n` +
          `📝 *ملاحظة المشرف:* "${noteText}"\n\n` +
          `📄 *النص الحالي للفقرة:*\n${currentContent}\n\n` +
          `✏️ *يرجى إرسال النص الجديد المعدل لهذه الفقرة الان:*`,
          { parse_mode: 'Markdown' }
        );

        await safeSendMessage(chatId, `✅ تم إرسال طلب التعديل إلى سفير الفصل بنجاح. ستصلك الإذاعة فور تعديلها.`);
        return res.status(200).json({ success: true });
      }

      // STATE 3: Ambassador Submitting Revised Section Text
      if (userState && typeof userState === 'object' && userState.step === 'AMBASSADOR_REVISING_SECTION') {
        const { broadcastId, secIndex } = userState;
        const newSectionText = text;

        await fbDelete(`userState/${chatId}`);

        const broadcast = await fbGet(`radios/${broadcastId}`);
        if (!broadcast || !broadcast.slides || !broadcast.slides[secIndex]) {
          await safeSendMessage(chatId, "❌ حدث خطأ: الإذاعة غير موجودة.");
          return res.status(200).json({ success: true });
        }

        // Update the section content in broadcast slides
        broadcast.slides[secIndex].content = newSectionText;
        await fbSet(`radios/${broadcastId}`, broadcast);

        await safeSendMessage(chatId, `✅ *تم تحديث الفقرة بنجاح، وإعادة الإذاعة للمشرف للمراجعة والاعتماد!*`, { parse_mode: 'Markdown' });

        // Resend updated broadcast to Supervisor
        const supervisorChatId = await findSupervisorForGrade(broadcast.grade || 1);
        const contentBody = buildBroadcastMessageText(broadcast.topic, broadcast.class, broadcast.date, broadcast.slides);

        const updatedSupervisorMsg = `🔄 *إذاعة معدلة بانتظار الاعتماد (فصل ${broadcast.class}):*\n\n` + contentBody;
        const inlineButtons = {
          inline_keyboard: [
            [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }],
            [{ text: "✏️ طلب تعديل فقرة", callback_data: `request_edit:${broadcastId}` }]
          ]
        };

        await safeSendMessage(supervisorChatId, updatedSupervisorMsg, {
          parse_mode: 'Markdown',
          reply_markup: inlineButtons
        });

        return res.status(200).json({ success: true });
      }

      // /start Command Flow
      if (text === '/start') {
        if (user) {
          let userRoleDesc = '';
          if (user.role === 'admin') userRoleDesc = '👑 مدير النظام الرئيسي';
          else if (user.role === 'ambassador') userRoleDesc = `🎓 سفير فصل (${user.className}) — ${user.gradeName}`;
          else if (user.role === 'supervisor') userRoleDesc = `👔 مشرف ${user.gradeScope || user.gradeName}`;

          await safeSendMessage(chatId,
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
          await safeSendMessage(chatId,
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
        return res.status(200).json({ success: true });
      }

      // Profile View Command
      if (text === '/my_profile') {
        if (!user) {
          await safeSendMessage(chatId, "⚠️ أنت غير مسجل بعد. أرسل /start لتسجيل الدخول.");
          return res.status(200).json({ success: true });
        }
        let profileMsg = `👤 *بيانات حسابك:*\n`;
        profileMsg += `🆔 *المعرف:* ${chatId}\n`;
        profileMsg += `🏷 *الدور:* ${user.role === 'admin' ? 'مدير عام' : user.role === 'ambassador' ? 'سفير فصل' : 'مشرف مرحلة'}\n`;
        if (user.className) profileMsg += `🏫 *الفصل:* ${user.className}\n`;
        if (user.gradeName) profileMsg += `📚 *المرحلة:* ${user.gradeName}\n`;
        await safeSendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
        return res.status(200).json({ success: true });
      }

      // Guard: Check registration for all protected commands
      if (!user) {
        await safeSendMessage(chatId,
          `⚠️ *عذراً، يجب عليك تسجيل الدخول أولاً.*\n` +
          `أرسل الأمر /start ثم أدخل كود التفعيل المكون من 4 أرقام المخصص لك.`,
          { parse_mode: 'Markdown' }
        );
        return res.status(200).json({ success: true });
      }

      // /generate Command
      if (text === '/generate') {
        await safeSendMessage(chatId, `⏳ جاري توليد الإذاعة الذكية عبر Gemini API (5 فقرات) ${user.className ? `لفصل ${user.className}` : ''}...`);
        await generateRadioBroadcast(user);
        return res.status(200).json({ success: true });
      }

      // /set_topic Command
      if (text === '/set_topic') {
        if (user.role !== 'admin' && user.role !== 'supervisor') {
          await safeSendMessage(chatId, "⚠️ تغيير موضوع الأسبوع مخصص للمشرفين وإدارة المنصة فقط.");
          return res.status(200).json({ success: true });
        }
        await fbSet(`userState/${chatId}`, { step: 'WAITING_FOR_TOPIC' });
        await safeSendMessage(chatId, "✏️ اكتب موضوع/قيمة الأسبوع الجديدة:");
        return res.status(200).json({ success: true });
      }

      // /cleanup Command
      if (text === '/cleanup') {
        if (user.role !== 'admin' && user.role !== 'supervisor') {
          await safeSendMessage(chatId, "⚠️ غير مصرح.");
          return res.status(200).json({ success: true });
        }
        await safeSendMessage(chatId, "🗑️ جاري حذف الإذاعات المعلقة القديمة...");
        try {
          await autoCleanupOldBroadcasts();
          await safeSendMessage(chatId, "✅ تم تنظيف قاعدة البيانات بنجاح.");
        } catch (e) {
          await safeSendMessage(chatId, `❌ خطأ: ${e.message}`);
        }
        return res.status(200).json({ success: true });
      }

      // Text input when waiting for new topic
      if (!text.startsWith('/')) {
        if (userState && typeof userState === 'object' && userState.step === 'WAITING_FOR_TOPIC') {
          if (user.role === 'admin' || user.role === 'supervisor') {
            await fbDelete(`userState/${chatId}`);
            try {
              await setWeeklyTopic(text);
              await safeSendMessage(chatId,
                `✅ تم تحديث موضوع الأسبوع بنجاح:\n"${text}"\n\n` +
                `🌐 سيظهر على الموقع فوراً: ${SITE_URL}`
              );
            } catch (err) {
              await safeSendMessage(chatId, `❌ حدث خطأ: ${err.message}`);
            }
          }
        }
        return res.status(200).json({ success: true });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Webhook Execution Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
