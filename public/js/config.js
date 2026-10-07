// Money links and settings. DEMO VALUES for now: replace each one with the real thing, then set demo: false.
// While demo is true, buy/tip buttons show a "switches on soon" notice instead of leaving the page,
// and signup forms say nothing was sent.
window.CO_CONFIG = {
  demo: true,
  siteUrl: 'https://curiousorbit.vercel.app',          // DUMMY: the real Vercel or custom domain
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
  tipUrl: 'https://ko-fi.com/curiousorbit',            // DUMMY: Ko-fi or Buy Me a Coffee page
  sponsorEmail: 'hello@curiousorbit.com',              // DUMMY: shown for brand enquiries
};
