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
      class: cls || 'فصل غير محدد',   // Never use Gemini/AI as class name
      date: date || new Date().toLocaleDateString('ar-SA'),
      status: status,
      topic: topic || '',
      slides: slides || [],
      timestamp: timestamp || Date.now()
    };

    // Save to the radios collection
    const saveRes = await fetch(`${DB_URL}/radios/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(broadcastData)
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return res.status(500).json({ success: false, error: `Firebase error: ${err}` });
    }

    // If approved: clear previous approvedBroadcast and set the new one
    if (status === 'approved') {
      // 1. Reset all other approved broadcasts back to pending
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

      // 2. Overwrite approvedBroadcast node — frontend reads this for immediate display
      await fetch(`${DB_URL}/approvedBroadcast.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...broadcastData, id })
      });

      // 3. Update settings/topic to match approved broadcast topic
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
