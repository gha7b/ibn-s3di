require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

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
// TOPIC MANAGEMENT
// ═══════════════════════════════════════════════════════
async function getWeeklyTopic() {
  try {
    const topic = await fbGet('settings/topic');
    return topic || 'احترام المعلم والانضباط المدرسي';
  } catch (e) {
    return 'احترام المعلم والانضباط المدرسي';
  }
}

async function setWeeklyTopic(topic) {
  await fbSet('settings/topic', topic);
  try {
    await fetch(`${SITE_URL}/api/set-topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
  } catch (e) {
    // Vercel fallback
  }
}

// ═══════════════════════════════════════════════════════
// RESPONSIBLE CLASS — reads from Firebase schedule/{dayIndex}
// ═══════════════════════════════════════════════════════
async function getResponsibleClass() {
  try {
    const schedule = await fbGet('schedule');
    if (!schedule || typeof schedule !== 'object') return null;

    const riyad = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
    const dayIndex = new Date(riyad).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

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

// ═══════════════════════════════════════════════════════
// AUTO-CLEANUP: Delete pending broadcasts older than 24h
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
// BROADCAST MANAGEMENT
// ═══════════════════════════════════════════════════════
async function saveBroadcastToFirebase(broadcastId, broadcastData, status) {
  await fbSet(`radios/${broadcastId}`, { ...broadcastData, status });

  if (status === 'approved') {
    const allRadios = await fbGet('radios');
    if (allRadios && typeof allRadios === 'object') {
      const resetUpdates = {};
      Object.keys(allRadios).forEach(key => {
        if (key !== broadcastId && allRadios[key].status === 'approved') {
          resetUpdates[`radios/${key}/status`] = 'pending';
        }
      });
      if (Object.keys(resetUpdates).length > 0) {
        await fbUpdate(resetUpdates);
      }
    }

    await fbSet('approvedBroadcast', { ...broadcastData, id: broadcastId, status: 'approved' });

    if (broadcastData.topic) {
      await fbSet('settings/topic', broadcastData.topic);
    }
  }

  // Notify Vercel API Route
  try {
    await fetch(`${SITE_URL}/api/update-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: broadcastId, ...broadcastData, status })
    });
  } catch (e) {
    // Vercel fallback
  }
}

// ═══════════════════════════════════════════════════════
// TELEGRAM BOT
// ═══════════════════════════════════════════════════════
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const userState = {};

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
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  safeSendMessage(chatId,
    "👋 *أهلاً بك في منصة الإذاعة المدرسية الذكية (ثانوية ابن سعدي)*\n\n" +
    "الأوامر المتاحة:\n" +
    "- `/set_topic` — تغيير موضوع/قيمة الأسبوع\n" +
    "- `/generate` — توليد إذاعة جديدة مبتكرة وإرسالها للاعتماد\n" +
    "- `/cleanup` — حذف الإذاعات المعلقة القديمة يدوياً",
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/set_topic/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return safeSendMessage(chatId, "⚠️ غير مصرح.");
  userState[chatId] = 'WAITING_FOR_TOPIC';
  safeSendMessage(chatId, "✏️ اكتب موضوع/قيمة الأسبوع الجديدة:");
});

bot.onText(/\/generate/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return safeSendMessage(chatId, "⚠️ غير مصرح.");
  safeSendMessage(chatId, "⏳ جاري توليد الإذاعة الذكية عبر الذكاء الاصطناعي...");
  generateRadioBroadcast();
});

bot.onText(/\/cleanup/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return safeSendMessage(chatId, "⚠️ غير مصرح.");
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

  if (userState[chatId] === 'WAITING_FOR_TOPIC' && isAdmin(chatId)) {
    const newTopic = msg.text.trim();
    delete userState[chatId];

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
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (!isAdmin(chatId)) {
    return bot.answerCallbackQuery(query.id, { text: "⚠️ غير مصرح" }).catch(() => {});
  }

  if (query.data.startsWith('approve_broadcast:')) {
    const broadcastId = query.data.split('approve_broadcast:')[1];

    try {
      bot.answerCallbackQuery(query.id, { text: "⏳ جاري الاعتماد..." }).catch(() => {});

      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast) {
        return bot.answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" }).catch(() => {});
      }

      await saveBroadcastToFirebase(broadcastId, broadcast, 'approved');

      safeSendMessage(chatId,
        `🎉 *تم اعتماد ونشر الإذاعة على الموقع فوراً!*\n` +
        `📌 الموضوع: "${broadcast.topic}"\n` +
        `🏫 الفصل: "${broadcast.class || 'غير محدد'}"\n` +
        `🌐 الموقع: ${SITE_URL}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: "❌ خطأ في الاعتماد" }).catch(() => {});
      safeSendMessage(chatId, `❌ خطأ في الاعتماد: ${err.message}`);
    }
  }
});

// ═══════════════════════════════════════════════════════
// DYNAMIC GENERATION VIA GEMINI & BACKUP GENERATOR
// ═══════════════════════════════════════════════════════
const { generateDynamicBroadcastSections } = require('./dynamic-generator');

async function generateRadioBroadcast() {
  await autoCleanupOldBroadcasts();

  const topic = await getWeeklyTopic();
  const responsibleClass = await getResponsibleClass();
  const dateStr = new Date().toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' });
  const broadcastId = 'radio_' + Date.now();

  const prompt = `أنت خبير إعداد إذاعات مدرسية تربوية لثانوية ابن سعدي.
قم بكتابة إذاعة مدرسية إبداعية ومبتكرة بالكامل ومخصصة تحديداً لموضوع: "${topic}".

تعليمات صياغة الفقرات الخمس:
1. المقدمة والترحيب: مقدمة بلاغية ملهمة ومبتكرة تشيد بأهمية موضوع اليوم بلا عبارات قالبية مكررة.
2. كلمة الصباح: كلمة تربوية عميقة تشرح أثر موضوع اليوم في حياة الطالب والمجتمع المدرسي.
3. حديث شريف: حديث نبوي شريف صحيح وموثق صراحة بالراوي والمصدر (مثل: رواه البخاري / رواه مسلم / رواه الترمذي).
4. رسالة للطلاب / شعر: أبيات شعرية عربية فصيحة وموزونة تخدم الموضوع مباشرة.
5. الخاتمة: خاتمة راقية تدعو بالتوفيق لطلاب معلمي ثانوية ابن سعدي.

أرجع JSON فقط حصراً بالصيغة التالية بدون أي نص خاري أو ماركداون:
{"topic":"${topic}","sections":[{"title":"المقدمة والترحيب","content":"..."},{"title":"كلمة الصباح","content":"..."},{"title":"حديث شريف","content":"..."},{"title":"رسالة للطلاب / شعر","content":"..."},{"title":"الخاتمة","content":"..."}]}`;

  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  ];

  let sections = null;
  for (const url of endpoints) {
    const modelName = url.split('/models/')[1].split(':')[0];
    try {
      console.log(`🤖 Sending request to Gemini API model: ${modelName}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error(`❌ Gemini API Error (${modelName}):`, JSON.stringify(data.error || data));
        continue;
      }

      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          sections = parsed.sections;
          console.log(`✅ Gemini API successfully generated broadcast using ${modelName}`);
          break;
        }
      }
    } catch (e) {
      console.error(`❌ Network / Exception on Gemini API (${modelName}):`, e.message);
    }
  }

  if (!sections) {
    console.error("❌ ERROR: Failed to generate broadcast from all Gemini API endpoints. Please check GEMINI_API_KEY quota or network connection.");
    sections = [
      { title: "المقدمة والترحيب", content: `بسم الله الرحمن الرحيم. يطيب لنا في ثانوية ابن سعدي تقديم الإذاعة المدرسية حول: ${topic}` },
      { title: "كلمة الصباح", content: `تعد قيمة ${topic} ركيزة أساسية في بناء بيئتنا المدرسية والتعليمية.` },
      { title: "حديث شريف", content: `عن أبي هريرة رضي الله عنه أن رسول الله ﷺ قال: «إنَّما بُعِثْتُ لأُتَمِّمَ صَالِحَ الأخْلَاقِ» (رواه أحمد).` },
      { title: "رسالة للطلاب / شعر", content: `قُم لِلمُعَلِّمِ وَوَفِّهِ التَبجيلا ... كادَ المُعَلِّمُ أَن يَكونَ رَسولا` },
      { title: "الخاتمة", content: `نسأل الله التوفيق والنجاح لجميع الطلاب والكادر التعليمي.` }
    ];
  }

  // Never use "Gemini" or "AI"
  const classLabel = responsibleClass || 'فصل غير محدد';

  const slides = sections.map(sec => ({
    student: classLabel,
    title: sec.title,
    content: sec.content
  }));

  const broadcastData = {
    class: classLabel,
    date: dateStr,
    status: 'pending',
    topic,
    slides,
    timestamp: Date.now()
  };

  await saveBroadcastToFirebase(broadcastId, broadcastData, 'pending');

  const icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
  let msgText = `🎙 *إذاعة جديدة — بانتظار الاعتماد*\n`;
  msgText += `📌 *الموضوع:* ${topic}\n`;
  msgText += `🏫 *الفصل المسؤول:* ${classLabel}\n`;
  msgText += `📅 *التاريخ:* ${dateStr}\n\n`;
  sections.forEach((sec, i) => {
    msgText += `${icons[i]} *${sec.title}:*\n${sec.content}\n\n`;
  });

  await safeSendMessage(ADMIN_CHAT_ID, msgText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }]
      ]
    }
  });
}

// Cron Jobs
cron.schedule('0 7 * * 0-4', () => {
  console.log("⏰ Cron: Generating daily broadcast...");
  generateRadioBroadcast();
}, { timezone: "Asia/Riyadh" });

cron.schedule('0 0 * * *', () => {
  console.log("🗑️ Cron: Auto-cleanup old pending broadcasts...");
  autoCleanupOldBroadcasts();
}, { timezone: "Asia/Riyadh" });

console.log("🤖 Telegram Bot started successfully.");
