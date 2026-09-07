/**
 * Vercel Serverless Function: GET /api/get-current-topic
 * Reads settings/topic (Single Source of Truth) and approvedBroadcast from Firebase.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    const [topicRes, broadcastRes] = await Promise.all([
      fetch(`${DB_URL}/settings/topic.json`),
      fetch(`${DB_URL}/approvedBroadcast.json`)
    ]);

    const topicData = await topicRes.json();
    const approvedBroadcast = await broadcastRes.json();

    const topic = (typeof topicData === 'string' && topicData.trim())
      ? topicData.trim()
      : (approvedBroadcast?.topic || 'احترام المعلم والانضباط المدرسي');

    return res.status(200).json({
      success: true,
      topic,
      approvedBroadcast: approvedBroadcast || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
