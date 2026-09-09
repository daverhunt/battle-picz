# Battle Picz

Animated web prototype recovered from the production Vercel deployment on 3 September 2026.

## Development

The app is a static site. Open `index.html` directly or serve the directory with any static web server.

Run the browser-client unit tests with `npm test`.
Run the live two-player Supabase smoke test with `npm run test:backend`.

## Deployment

Vercel deploys the production site from the `main` branch. Pushes to `main` should create a new production deployment automatically.

## Backend

Supabase database changes are versioned in `supabase/migrations`. Database tests live in
`supabase/tests/database` and are intended to run with `supabase test db`.

The browser/mobile client must use only the Supabase publishable key. Secret or
service-role keys belong in server-side Vercel environment variables and must never be
committed to this repository.

`supabase-config.js` contains the public project URL and a placeholder for the browser-safe
publishable key. Multiplayer stays disabled until that key is supplied.
