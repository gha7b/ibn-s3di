/**
 * Vercel Serverless Function: POST /api/set-topic
 * Updates the weekly topic in Firebase Realtime DB via REST API.
 * Called by the Telegram bot when admin sends /set_topic
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  const { topic } = req.body || {};
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ success: false, error: 'topic is required' });
  }

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    const response = await fetch(`${DB_URL}/settings/topic.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topic.trim())
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ success: false, error: `Firebase error: ${err}` });
    }

    return res.status(200).json({
      success: true,
      topic: topic.trim(),
      message: 'تم تحديث موضوع اليوم بنجاح في Firebase وسيظهر على الموقع فوراً'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
