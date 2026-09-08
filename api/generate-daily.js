/**
 * Vercel Serverless Function: GET/POST /api/generate-daily
 * Note: Automated cron generation has been permanently disabled per system requirements.
 * Broadcast generation is strictly on-demand by registered Ambassadors and Supervisors.
 */
export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    message: "Automated daily generation is permanently disabled. Broadcast generation is triggered manually by registered Ambassadors."
  });
}
