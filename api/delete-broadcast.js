/**
 * Vercel Serverless Function: DELETE /api/delete-broadcast
 * Deletes a broadcast from Firebase Realtime DB by ID.
 * Handled via DELETE or POST method.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id || req.body?.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Broadcast id is required' });
  }

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

  try {
    // 1. Delete from radios collection
    const delRes = await fetch(`${DB_URL}/radios/${id}.json`, { method: 'DELETE' });
    if (!delRes.ok) {
      const err = await delRes.text();
      return res.status(500).json({ success: false, error: `Firebase DELETE error: ${err}` });
    }

    // 2. If this was the approved broadcast, also remove approvedBroadcast node
    const appRes = await fetch(`${DB_URL}/approvedBroadcast.json`);
    const appBc = await appRes.json();
    if (appBc && appBc.id === id) {
      await fetch(`${DB_URL}/approvedBroadcast.json`, { method: 'DELETE' });
    }

    return res.status(200).json({
      success: true,
      id,
      message: 'تم حذف الإذاعة بنجاح من قاعدة البيانات'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
