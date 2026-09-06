require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const DATA_FILE = path.join(__dirname, 'data.json');

// --- Helper Data Management ---
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial = {
        weeklyTopic: "احترام المعلم والانضباط المدرسي",
        draftBroadcast: null,
        approvedBroadcast: null,
        broadcasts: []
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.broadcasts)) parsed.broadcasts = [];
    return parsed;
  } catch (err) {
    console.error("Error reading data.json:", err);
    return {
      weeklyTopic: "احترام المعلم والانضباط المدرسي",
      draftBroadcast: null,
      approvedBroadcast: null,
      broadcasts: []
    };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error saving data.json:", err);
  }
}

// --- Environment Variables ---
const { GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID, PORT = 3000 } = process.env;

if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN and ADMIN_CHAT_ID must be defined in .env file!");
}

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- Telegram Bot Setup ---
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const userState = {};

console.log("🤖 Telegram Bot initialized...");

// Safe message sending helper
async function safeSendMessage(chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.warn(`⚠️ Telegram SendMessage Warning (Chat: ${chatId}):`, err.message);
    if (err.message.includes('chat not found')) {
      console.warn("📌 ملاحظة مهمة: يرجى فتح البوت في التليجرام والضغط على /start لكي تتمكن من استقبال الرسائل تلقائياً.");
    }
  }
}

// Command /start handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  safeSendMessage(chatId, "👋 **أهلاً بك في منصة الإذاعة المدرسية الذكية (ثانوية ابن سعدي)**\n\nالأوامر المتاحة لمدير النظام:\n- `/set_topic` : تغيير موضوع/قيمة الأسبوع.\n- `/generate` : توليد إذاعة جديدة وإرسالها بانتظار الاعتماد.", { parse_mode: 'Markdown' });
});

// Command /set_topic handler
bot.onText(/\/set_topic/, (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    return safeSendMessage(chatId, "⚠️ غير مصرح لك بتنفيذ هذا الأمر.");
  }
  userState[chatId] = 'WAITING_FOR_TOPIC';
  safeSendMessage(chatId, "اكتب موضوع/قيمة الأسبوع الجديدة.");
});

// Command /generate handler (manual generation trigger)
bot.onText(/\/generate/, (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    return safeSendMessage(chatId, "⚠️ غير مصرح لك بتنفيذ هذا الأمر.");
  }
  safeSendMessage(chatId, "⏳ جاري توليد الإذاعة بواسطة Gemini وإضافتها إلى قائمة الإذاعات بانتظار الاعتماد...");
  generateRadioBroadcast();
});

// Text listener for state handling
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && !msg.text.startsWith('/') && userState[chatId] === 'WAITING_FOR_TOPIC') {
    if (String(chatId) !== String(ADMIN_CHAT_ID)) return;
    
    const newTopic = msg.text.trim();
    const data = readData();
    data.weeklyTopic = newTopic;
    saveData(data);

    delete userState[chatId];
    safeSendMessage(chatId, `✅ تم تحديث موضوع اليوم وقيمة الأسبوع بنجاح:\n"${newTopic}"\nتم تحديث الواجهة الرئيسية وشاشة الإعدادات في الموقع تلقائياً.`);
  }
});

// Inline Keyboard Callback Query handler (Approval)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    return bot.answerCallbackQuery(query.id, { text: "⚠️ غير مصرح لك بهذا الاجراء" }).catch(() => {});
  }

  if (query.data.startsWith('approve_broadcast:')) {
    const broadcastId = query.data.split('approve_broadcast:')[1];
    const data = readData();
    const target = data.broadcasts.find(b => String(b.id) === String(broadcastId));

    if (!target) {
      return bot.answerCallbackQuery(query.id, { text: "❌ الإذاعة غير موجودة" }).catch(() => {});
    }

    // Update status to approved for target, pending for others
    data.broadcasts.forEach(b => {
      b.status = (String(b.id) === String(broadcastId)) ? 'approved' : 'pending';
    });

    data.approvedBroadcast = target;
    saveData(data);

    bot.answerCallbackQuery(query.id, { text: "✅ تم الاعتماد ونشر الإذاعة على الموقع!" }).catch(() => {});
    safeSendMessage(chatId, `🎉 **تم اعتماد ونشر الإذاعة بنجاح!**\nموضوع الإذاعة: "${target.topic}"\nالإذاعة معروضة الآن على شاشة الموقع الرئيسية وتطبيق الإذاعة.`);
  }
});

// --- Smart Fallback Generator ---
function generateFallbackSections(topic) {
  return [
    {
      title: "المقدمة والترحيب",
      content: `بسم الله الرحمن الرحيم، والصلاة والسلام على أشرف الأنبياء والمرسلين. يسعدنا في ثانوية ابن سعدي أن نقدم لكم إذاعتنا المدرسية لهذا اليوم حول قيمة: (${topic}).`
    },
    {
      title: "كلمة الصباح",
      content: `إن الالتزام بقيمة (${topic}) هو الركيزة الأساسية لبناء مجتمع مدرسي واعي ومتميز، وحرصنا عليها يعكس أخلاقنا العالية وطموحنا نحو النجاح.`
    },
    {
      title: "حديث شريف",
      content: `عن أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ، أَنَّ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: «إنَّما بُعِثْتُ لأُتَمِّمَ صَالِحَ الأخْلَاقِ» (حديث صحيح).`
    },
    {
      title: "رسالة للطلاب / شعر",
      content: `قُم لِلمُعَلِّمِ وَوَفِّهِ التَبجيلا ... كادَ المُعَلِّمُ أَن يَكونَ رَسولا\nأَعَلِمتَ أَشرَفَ أَو أَجَلَّ مِنَ الَّذي ... يَبني وَيُنشِئُ أَنفُساً وَعُقولا`
    },
    {
      title: "الخاتمة",
      content: `وفي ختام إذاعتنا المدرسية، نسأل الله أن يوفقنا جميعاً لنكون قدوة في أخلاقنا ودراستنا. كان معكم فريق الإذاعة المدرسية بثانوية ابن سعدي، والسلام عليكم ورحمة الله وبركاته.`
    }
  ];
}

// --- Gemini Generation Logic ---
async function generateRadioBroadcast() {
  const data = readData();
  const topic = data.weeklyTopic || "احترام المعلم والانضباط المدرسي";
  const dateStr = new Date().toLocaleDateString('ar-SA');
  const broadcastId = 'radio_' + Date.now();

  const prompt = `أنت مسؤول عن إعداد إذاعة مدرسية لثانوية ابن سعدي.
المطلوب إنشاء إذاعة مدرسية كاملة حول الموضوع التالي فقط: "${topic}".

الشروط والتعليمات الصارمة:
1. الإذاعة تكون مكوّنة دائماً من 5 فقرات أساسية فقط بالترتيب التالي:
   - الفقرة الأولى: المقدمة والترحيب
   - الفقرة الثانية: كلمة الصباح
   - الفقرة الثالثة: حديث شريف (يجب أن يكون حديثاً صحيحاً وموثوقاً من المصادر الرسمية)
   - الفقرة الرابعة: رسالة للطلاب أو أبيات شعرية (إذا تم تضمين أبيات شعرية يجب أن تكون أبياتاً شعرية عربية حقيقية ومشهورة ومكتوبة سابقاً وليست من ابتكار الذكاء الاصطناعي)
   - الفقرة الخامسة: الخاتمة
2. طول كل فقرة: تتراوح بين سطر واحد إلى 4 أسطر كحد أقصى لكل فقرة.
3. الالتزام التام والكامل بموضوع الأسبوع المعتمد ("${topic}") دون الخروج عنه.

قم بإرجاع النتيجة بصيغة JSON حصرية بالهيكل التالي فقط دون أي مقدمات أو شرح خارج الـ JSON:
{
  "topic": "${topic}",
  "sections": [
    { "title": "المقدمة والترحيب", "content": "..." },
    { "title": "كلمة الصباح", "content": "..." },
    { "title": "حديث شريف", "content": "..." },
    { "title": "رسالة للطلاب / شعر", "content": "..." },
    { "title": "الخاتمة", "content": "..." }
  ]
}`;

  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`
  ];

  let resultSections = null;

  for (const url of endpoints) {
    const modelName = url.split('/models/')[1].split(':')[0];
    try {
      console.log(`🤖 Requesting Gemini API (${modelName})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });

      const resData = await response.json();
      if (resData.candidates && resData.candidates[0] && resData.candidates[0].content) {
        const text = resData.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          resultSections = parsed.sections;
          console.log(`✅ Gemini API succeeded with model: ${modelName}`);
          break;
        }
      }
    } catch (e) {
      console.warn(`Model ${modelName} fetch notice:`, e.message);
    }
  }

  // Fallback if API fails or quota exceeded
  if (!resultSections) {
    console.log("ℹ️ Using intelligent fallback sections based on weekly topic.");
    resultSections = generateFallbackSections(topic);
  }

  // Convert sections into slides structure for site player & admin dashboard
  const slides = resultSections.map(sec => ({
    student: 'الذكاء الاصطناعي (Gemini)',
    title: sec.title,
    content: sec.content
  }));

  const radioRecord = {
    id: broadcastId,
    class: 'ذكاء اصطناعي (Gemini Bot)',
    date: dateStr,
    status: 'pending',
    topic: topic,
    slides: slides,
    timestamp: Date.now()
  };

  // Add to database broadcasts array
  data.broadcasts.unshift(radioRecord);
  data.draftBroadcast = radioRecord;
  saveData(data);

  // Format Telegram Message
  let telegramMsg = `🎙 **إذاعة جديدة بانتظار الاعتماد (Pending)**\n📌 **موضوع الأسبوع:** ${topic}\n📅 **تاريخ الإذاعة:** ${dateStr}\n\n`;

  const sectionIcons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
  resultSections.forEach((sec, idx) => {
    telegramMsg += `${sectionIcons[idx] || "🔹"} **${sec.title}:**\n${sec.content}\n\n`;
  });

  // Send to Admin with Approval Button
  await safeSendMessage(ADMIN_CHAT_ID, telegramMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ اعتماد ونشر الإذاعة", callback_data: `approve_broadcast:${broadcastId}` }]
      ]
    }
  });

  console.log(`✅ Broadcast record created (id: ${broadcastId}, status: pending) and saved to database.`);
}

// --- Cron Job Scheduling ---
// Sun - Thu at 16:00 (4:00 PM) Riyadh Time
cron.schedule('0 16 * * 0-4', () => {
  console.log("⏰ Running scheduled Cron Job: Generating daily radio broadcast...");
  generateRadioBroadcast();
}, {
  timezone: "Asia/Riyadh"
});

// --- API Endpoints for Frontend & Database Webhooks ---

// 1. Topic Endpoints
app.get('/api/get-current-topic', (req, res) => {
  const data = readData();
  const approvedTopic = data.approvedBroadcast ? data.approvedBroadcast.topic : data.weeklyTopic;
  res.json({
    success: true,
    topic: approvedTopic,
    weeklyTopic: data.weeklyTopic,
    approvedBroadcast: data.approvedBroadcast
  });
});

app.get('/api/topic', (req, res) => {
  const data = readData();
  res.json({ success: true, topic: data.weeklyTopic });
});

app.post('/api/set-topic', (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: "Topic is required" });
  
  const data = readData();
  data.weeklyTopic = topic;
  saveData(data);

  res.json({ success: true, topic: data.weeklyTopic, message: "تم تحديث موضوع اليوم بنجاح" });
});

// 2. Broadcasts Management Endpoints (Pending & Approved)
app.get('/api/broadcasts', (req, res) => {
  const data = readData();
  res.json({ success: true, broadcasts: data.broadcasts || [] });
});

app.get('/api/broadcasts/pending', (req, res) => {
  const data = readData();
  const pendingList = (data.broadcasts || []).filter(b => b.status === 'pending');
  res.json({ success: true, broadcasts: pendingList });
});

app.get('/api/broadcast/approved', (req, res) => {
  const data = readData();
  const approved = (data.broadcasts || []).find(b => b.status === 'approved') || data.approvedBroadcast;
  res.json({ success: true, data: approved });
});

app.post('/api/broadcasts/approve/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const target = (data.broadcasts || []).find(b => String(b.id) === String(id));
  
  if (!target) {
    return res.status(404).json({ success: false, error: "Broadcast not found" });
  }

  data.broadcasts.forEach(b => {
    b.status = (String(b.id) === String(id)) ? 'approved' : 'pending';
  });

  target.status = 'approved';
  data.approvedBroadcast = target;
  saveData(data);

  res.json({ success: true, message: "تم اعتماد الإذاعة بنجاح وتحديث الواجهة الرئيسية", broadcast: target });
});

app.delete('/api/broadcasts/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  data.broadcasts = (data.broadcasts || []).filter(b => String(b.id) !== String(id));
  saveData(data);
  res.json({ success: true, message: "تم حذف الإذاعة بنجاح" });
});

app.post('/api/generate', async (req, res) => {
  try {
    await generateRadioBroadcast();
    res.json({ success: true, message: "تم إطلاق مهمة التوليد بنجاح." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("⚡ Executing immediate test run to send first broadcast to Telegram...");
  setTimeout(() => {
    generateRadioBroadcast();
  }, 2000);
});
