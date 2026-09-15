# Battle Picz

Animated web prototype recovered from the production Vercel deployment on 3 September 2026.

## Development

The app is a static site. Open `index.html` directly or serve the directory with any static web server.

Run the browser-client unit tests with `npm test`.
Run the live two-player Supabase smoke test with `npm run test:backend`.

## Deployment

The GitHub repository is connected to the Vercel project `battle-picz-game`.
Every push to `main` creates a production deployment at https://battle-picz-game.vercel.app/.

## Backend

Supabase database changes are versioned in `supabase/migrations`. Database tests live in
`supabase/tests/database` and are intended to run with `supabase test db`.

Each opponent pairing is one UTC weekly battle. Players alternate choosing categories
and can complete as many numbered rounds as they like until Monday 00:00 UTC. A round
pays 3 coins for a win, 2 for a draw, and 1 for a loss. At rollover, each weekly battle
is decided by rounds won; the weekly reward is 10 participation coins plus 5 for every
battle won. Reward ledgers make both payouts safe to retry without duplicate coins.

The browser/mobile client must use only the Supabase publishable key. Secret or
service-role keys belong in server-side Vercel environment variables and must never be
committed to this repository.

`supabase-config.js` contains the public project URL and a placeholder for the browser-safe
publishable key. Multiplayer stays disabled until that key is supplied.
