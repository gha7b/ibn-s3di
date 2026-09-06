/**
 * Vercel Serverless Function: POST /api/update-broadcast
 * Saves/updates a broadcast in Firebase Realtime DB.
 * Supports status: 'pending' | 'approved'
 * Called by the Telegram bot when generating or approving a broadcast.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  const { id, topic, status, slides, date, class: cls, timestamp } = req.body || {};
  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'id and status are required' });
  }

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    const broadcastData = {
      class: cls || 'ذكاء اصطناعي (Gemini Bot)',
      date: date || new Date().toLocaleDateString('ar-SA'),
      status: status,
      topic: topic || '',
      slides: slides || [],
      timestamp: timestamp || Date.now()
    };

    // Save to the radios collection (shared with frontend admin panel)
    const saveRes = await fetch(`${DB_URL}/radios/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(broadcastData)
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return res.status(500).json({ success: false, error: `Firebase error: ${err}` });
    }

    // If approved, also write to approvedBroadcast for quick front-end access
    if (status === 'approved') {
      // First, set all other radios back to pending
      const allRes = await fetch(`${DB_URL}/radios.json`);
      if (allRes.ok) {
        const allRadios = await allRes.json();
        if (allRadios && typeof allRadios === 'object') {
          const resetUpdates = {};
          Object.keys(allRadios).forEach(key => {
            if (key !== id && allRadios[key].status === 'approved') {
              resetUpdates[`/radios/${key}/status`] = 'pending';
            }
          });
          if (Object.keys(resetUpdates).length > 0) {
            await fetch(`${DB_URL}/.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resetUpdates)
            });
          }
        }
      }

      // Write the approved broadcast to a dedicated node for instant frontend access
      await fetch(`${DB_URL}/approvedBroadcast.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...broadcastData, id })
      });

      // Also update topic in settings from approved broadcast's topic
      if (topic) {
        await fetch(`${DB_URL}/settings/topic.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(topic)
        });
      }
    }

    return res.status(200).json({
      success: true,
      id,
      status,
      message: status === 'approved'
        ? 'تم اعتماد الإذاعة ونشرها على الموقع فوراً'
        : 'تم حفظ الإذاعة بانتظار الاعتماد'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
