/**
 * One-time cleanup script: deletes ALL pending broadcasts from Firebase.
 * Run: node cleanup-now.js
 */
require('dotenv').config();

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://abns3di-default-rtdb.europe-west1.firebasedatabase.app';

async function cleanupNow() {
  console.log('🔍 جاري جلب الإذاعات من Firebase...');

  const res = await fetch(`${FIREBASE_DB_URL}/radios.json`);
  const data = await res.json();

  if (!data || typeof data !== 'object') {
    console.log('✅ لا توجد إذاعات في قاعدة البيانات.');
    return;
  }

  const allKeys = Object.keys(data);
  console.log(`📋 إجمالي الإذاعات الموجودة: ${allKeys.length}`);

  const pendingKeys = allKeys.filter(k => data[k].status === 'pending');
  console.log(`⏳ الإذاعات المعلقة (pending): ${pendingKeys.length}`);

  if (pendingKeys.length === 0) {
    console.log('✅ لا توجد إذاعات معلقة للحذف.');
    return;
  }

  for (const key of pendingKeys) {
    const r = data[key];
    console.log(`🗑️  حذف: ${key} | الموضوع: ${r.topic || '—'} | التاريخ: ${r.date || '—'}`);
    await fetch(`${FIREBASE_DB_URL}/radios/${key}.json`, { method: 'DELETE' });
  }

  console.log(`\n✅ تم حذف ${pendingKeys.length} إذاعة معلقة بنجاح.`);
}

cleanupNow().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
