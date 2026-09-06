/**
 * Vercel Serverless Function: GET /api/get-current-topic
 * Reads weeklyTopic and approvedBroadcast from Firebase Realtime DB via REST API.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    const [settingsRes, broadcastRes] = await Promise.all([
      fetch(`${DB_URL}/settings/topic.json`),
      fetch(`${DB_URL}/approvedBroadcast.json`)
    ]);

    const weeklyTopic = await settingsRes.json();
    const approvedBroadcast = await broadcastRes.json();

    const currentTopic = (approvedBroadcast && approvedBroadcast.topic)
      ? approvedBroadcast.topic
      : (weeklyTopic || 'احترام المعلم والانضباط المدرسي');

    return res.status(200).json({
      success: true,
      topic: currentTopic,
      weeklyTopic: weeklyTopic || 'احترام المعلم والانضباط المدرسي',
      approvedBroadcast: approvedBroadcast || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
