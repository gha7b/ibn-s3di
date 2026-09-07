/**
 * Vercel Serverless Function: POST /api/cleanup-broadcasts
 * Deletes pending broadcasts older than 24 hours from Firebase.
 * Can be called by a cron job or manually.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    const response = await fetch(`${DB_URL}/radios.json`);
    const data = await response.json();

    if (!data || typeof data !== 'object') {
      return res.status(200).json({ success: true, deleted: 0, message: 'No broadcasts found' });
    }

    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const deleted = [];

    for (const [key, radio] of Object.entries(data)) {
      if (radio.status === 'pending' && radio.timestamp && radio.timestamp < cutoff24h) {
        await fetch(`${DB_URL}/radios/${key}.json`, { method: 'DELETE' });
        deleted.push(key);
      }
    }

    return res.status(200).json({
      success: true,
      deleted: deleted.length,
      deletedIds: deleted,
      message: deleted.length > 0
        ? `تم حذف ${deleted.length} إذاعة قديمة معلقة`
        : 'لا توجد إذاعات قديمة للحذف'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
