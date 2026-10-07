// Vercel serverless function: adds an email to the beehiiv newsletter.
// Needs env vars BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID (Vercel > Settings > Environment Variables).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { email, source } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  const key = process.env.BEEHIIV_API_KEY, pub = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pub) return res.status(503).json({ error: 'Signups are not switched on yet.' });
  const r = await fetch(`https://api.beehiiv.com/v2/publications/${pub}/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, reactivate_existing: true, send_welcome_email: true,
      utm_source: 'website', utm_medium: String(source || 'site').slice(0, 40) }),
  });
  if (!r.ok) return res.status(502).json({ error: 'The newsletter service did not accept that. Try again in a minute.' });
  return res.status(200).json({ ok: true });
}
