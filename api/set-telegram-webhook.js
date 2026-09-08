/**
 * Vercel Serverless Function: GET/POST /api/set-telegram-webhook
 * Registers the Telegram bot webhook URL with Telegram API automatically.
 * Uses SITE_URL or host header.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is missing in environment variables' });
  }

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const siteUrl = process.env.SITE_URL || `${protocol}://${host}`;
  const webhookUrl = `${siteUrl}/api/telegram-webhook`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();

    if (tgData.ok) {
      return res.status(200).json({
        success: true,
        webhookUrl,
        telegramResponse: tgData,
        message: `✅ Webhook registered successfully 24/7 at: ${webhookUrl}`
      });
    } else {
      return res.status(500).json({
        success: false,
        webhookUrl,
        telegramResponse: tgData,
        error: 'Failed to set webhook'
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
