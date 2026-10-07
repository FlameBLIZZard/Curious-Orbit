// Money links and settings. DEMO VALUES for now: replace each one with the real thing, then set demo: false.
// While demo is true, buy buttons show a "switches on soon" notice instead of leaving the page,
// and signup forms say nothing was sent.
window.CO_CONFIG = {
  demo: true,
  siteUrl: 'https://curious-orbit.vercel.app',        // live Vercel address (switch to the custom domain once it works)
  instagram: 'https://www.instagram.com/curiousorbit.daily/',
  // Email list: forms post to /api/subscribe (api/subscribe.js -> beehiiv).
  // Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID in Vercel > Settings > Environment Variables, then set this to true.
  newsletterLive: false,
  // Product checkout links (Gumroad or Lemon Squeezy). Empty = "Join the waitlist" instead of a buy button.
  shop: {
    'quiz-pack': 'https://curiousorbit.gumroad.com/l/quiz-night-pack',   // DUMMY
    'wallpapers': 'https://curiousorbit.gumroad.com/l/orbit-wallpapers', // DUMMY
    'fact-cards': 'https://curiousorbit.gumroad.com/l/fact-cards',       // DUMMY
  },
  // Tip jar: UPI, so Indian payments only. The ID shows on the site, in a QR code and in a "pay with UPI app" link.
  // Empty id = the tip button shows a "switches on soon" notice.
  upi: { id: 'adityadevdotcom@upi', name: 'Curious Orbit', amounts: [29, 49, 99, 199] },
  sponsorEmail: 'hello@curiousorbit.com',              // DUMMY: shown for brand enquiries
};
