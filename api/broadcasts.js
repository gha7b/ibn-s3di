/**
 * Vercel Serverless Function: GET /api/broadcasts
 * Returns all broadcasts from Firebase with optional ?status=pending|approved filter
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';
  const statusFilter = req.query?.status;

  try {
    const response = await fetch(`${DB_URL}/radios.json`);
    const data = await response.json();

    let broadcasts = data && typeof data === 'object'
      ? Object.keys(data).map(k => ({ ...data[k], id: k })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : [];

    if (statusFilter) {
      broadcasts = broadcasts.filter(b => b.status === statusFilter);
    }

    return res.status(200).json({ success: true, broadcasts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
