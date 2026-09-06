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
  return res.json();
}

async function fbSet(path, value) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return res.json();
}

async function fbUpdate(updates) {
  const res = await fetch(`${FIREBASE_DB_URL}/.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════
// TOPIC MANAGEMENT
// ═══════════════════════════════════════════════════════
async function getWeeklyTopic() {
  const topic = await fbGet('settings/topic');
  return topic || 'احترام المعلم والانضباط المدرسي';
}

async function setWeeklyTopic(topic) {
  await fbSet('settings/topic', topic);
  // Also notify Vercel API for frontend caching
  try {
    await fetch(`${SITE_URL}/api/set-topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
  } catch (e) {
    // Silent - Firebase already updated
  }
}

// ═══════════════════════════════════════════════════════
// BROADCAST MANAGEMENT - Firebase as source of truth
// ═══════════════════════════════════════════════════════
async function saveBroadcastToFirebase(broadcastId, broadcastData, status) {
  await fbSet(`radios/${broadcastId}`, { ...broadcastData, status });

  if (status === 'approved') {
    // Reset all other approved broadcasts to pending
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

    // Write to approvedBroadcast node
    await fbSet('approvedBroadcast', { ...broadcastData, id: broadcastId, status: 'approved' });

    // Update topic from the approved broadcast
    if (broadcastData.topic) {
      await fbSet('settings/topic', broadcastData.topic);
    }
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
    if (err.message.includes('chat not found')) {
      console.warn("📌 افتح البوت في تليجرام واضغط /start أولاً.");
    }
  }
}

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  safeSendMessage(chatId,
    "👋 **أهلاً بك في منصة الإذاعة المدرسية الذكية (ثانوية ابن سعدي)**\n\n" +
    "الأوامر المتاحة:\n" +
    "- `/set_topic` — تغيير موضوع/قيمة الأسبوع\n" +
    "- `/generate` — توليد إذاعة جديدة وإرسالها للاعتماد",
    { parse_mode: 'Markdown' }
  );
});

// /set_topic
bot.onText(/\/set_topic/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return safeSendMessage(chatId, "⚠️ غير مصرح.");
  userState[chatId] = 'WAITING_FOR_TOPIC';
  safeSendMessage(chatId, "اكتب موضوع/قيمة الأسبوع الجديدة.");
});

// /generate
bot.onText(/\/generate/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return safeSendMessage(chatId, "⚠️ غير مصرح.");
  safeSendMessage(chatId, "⏳ جاري التوليد...");
  generateRadioBroadcast();
});

// Text handler for waiting states
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith('/')) return;

  if (userState[chatId] === 'WAITING_FOR_TOPIC' && isAdmin(chatId)) {
    const newTopic = msg.text.trim();
    delete userState[chatId];

    try {
      await setWeeklyTopic(newTopic);
      safeSendMessage(chatId,
        `✅ تم تحديث موضوع الأسبوع بنجاح في Firebase:\n"${newTopic}"\n\n` +
        `🌐 سيظهر على الموقع فوراً: ${SITE_URL}`
      );
    } catch (err) {
      safeSendMessage(chatId, `❌ حدث خطأ: ${err.message}`);
    }
  }
});

// Inline button callback (approve)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (!isAdmin(chatId)) {
    return bot.answerCallbackQuery(query.id, { text: "⚠️ غير مصرح" }).catch(() => {});
  }

  if (query.data.startsWith('approve_broadcast:')) {
    const broadcastId = query.data.split('approve_broadcast:')[1];

    try {
      const broadcast = await fbGet(`radios/${broadcastId}`);
      if (!broadcast) {
        return bot.answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" }).catch(() => {});
      }

      await saveBroadcastToFirebase(broadcastId, broadcast, 'approved');
      bot.answerCallbackQuery(query.id, { text: "✅ تم الاعتماد والنشر!" }).catch(() => {});
      safeSendMessage(chatId,
        `🎉 **تم اعتماد ونشر الإذاعة على الموقع فوراً!**\n` +
        `📌 الموضوع: "${broadcast.topic}"\n` +
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
// SMART FALLBACK BROADCAST GENERATOR
// ═══════════════════════════════════════════════════════
function generateFallbackSections(topic) {
  return [
    { title: "المقدمة والترحيب", content: `بسم الله الرحمن الرحيم. يسعدنا في ثانوية ابن سعدي تقديم إذاعتنا المدرسية لهذا اليوم حول قيمة: (${topic}).` },
    { title: "كلمة الصباح", content: `إن الالتزام بقيمة (${topic}) هو الركيزة الأساسية لبناء مجتمع مدرسي واعٍ ومتميز.` },
    { title: "حديث شريف", content: `عن أبي هريرة رضي الله عنه أن رسول الله ﷺ قال: «إنَّما بُعِثْتُ لأُتَمِّمَ صَالِحَ الأخْلَاقِ».` },
    { title: "رسالة للطلاب / شعر", content: `قُم لِلمُعَلِّمِ وَوَفِّهِ التَبجيلا ... كادَ المُعَلِّمُ أَن يَكونَ رَسولا` },
    { title: "الخاتمة", content: `نسأل الله أن يوفقنا جميعاً. كان معكم فريق الإذاعة المدرسية بثانوية ابن سعدي. والسلام عليكم ورحمة الله.` }
  ];
}

// ═══════════════════════════════════════════════════════
// GEMINI BROADCAST GENERATION
// ═══════════════════════════════════════════════════════
async function generateRadioBroadcast() {
  const topic = await getWeeklyTopic();
  const dateStr = new Date().toLocaleDateString('ar-SA');
  const broadcastId = 'radio_' + Date.now();

  const prompt = `أنت مسؤول عن إعداد إذاعة مدرسية لثانوية ابن سعدي.
اكتب إذاعة مدرسية حول: "${topic}".

شروط صارمة:
1. 5 فقرات فقط بالترتيب: مقدمة وترحيب، كلمة الصباح، حديث شريف صحيح، رسالة للطلاب أو أبيات شعرية عربية حقيقية، الخاتمة.
2. كل فقرة من 1 إلى 4 أسطر فقط.
3. الالتزام التام بموضوع: "${topic}".

أرجع JSON فقط بهذا الشكل بدون أي نص خارجه:
{"topic":"${topic}","sections":[{"title":"المقدمة والترحيب","content":"..."},{"title":"كلمة الصباح","content":"..."},{"title":"حديث شريف","content":"..."},{"title":"رسالة للطلاب / شعر","content":"..."},{"title":"الخاتمة","content":"..."}]}`;

  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`
  ];

  let sections = null;
  for (const url of endpoints) {
    const modelName = url.split('/models/')[1].split(':')[0];
    try {
      console.log(`🤖 Trying ${modelName}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      if (data?.candidates?.[0]?.content) {
        const text = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          sections = parsed.sections;
          console.log(`✅ Gemini succeeded: ${modelName}`);
          break;
        }
      }
    } catch (e) {
      console.warn(`⚠️ ${modelName}:`, e.message);
    }
  }

  if (!sections) {
    console.log("ℹ️ Using fallback sections.");
    sections = generateFallbackSections(topic);
  }

  const slides = sections.map(sec => ({
    student: 'الذكاء الاصطناعي (Gemini)',
    title: sec.title,
    content: sec.content
  }));

  const broadcastData = {
    class: 'ذكاء اصطناعي (Gemini Bot)',
    date: dateStr,
    status: 'pending',
    topic,
    slides,
    timestamp: Date.now()
  };

  // Save to Firebase with status: pending
  await saveBroadcastToFirebase(broadcastId, broadcastData, 'pending');
  console.log(`✅ Saved to Firebase (radios/${broadcastId}) with status: pending`);

  // Format Telegram message
  const icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
  let msg = `🎙 *إذاعة جديدة — بانتظار الاعتماد*\n📌 *الموضوع:* ${topic}\n📅 *التاريخ:* ${dateStr}\n\n`;
  sections.forEach((sec, i) => {
    msg += `${icons[i]} *${sec.title}:*\n${sec.content}\n\n`;
  });

  await safeSendMessage(ADMIN_CHAT_ID, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }]
      ]
    }
  });
}

// ═══════════════════════════════════════════════════════
// CRON: Daily Sunday-Thursday at 4:00 PM Riyadh time
// ═══════════════════════════════════════════════════════
cron.schedule('0 16 * * 0-4', () => {
  console.log("⏰ Cron: Generating daily broadcast...");
  generateRadioBroadcast();
}, { timezone: "Asia/Riyadh" });

// ═══════════════════════════════════════════════════════
// STARTUP — Immediate test run
// ═══════════════════════════════════════════════════════
console.log("🤖 Telegram Bot started...");
console.log(`🔥 Firebase DB: ${FIREBASE_DB_URL}`);
console.log(`🌐 Vercel Site: ${SITE_URL}`);
console.log("⚡ Running immediate test broadcast in 2 seconds...");
setTimeout(() => generateRadioBroadcast(), 2000);
