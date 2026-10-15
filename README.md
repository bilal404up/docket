# Docket

A demo of an AI document intake tool for a fictional wholesale bakery. Cafés send orders as PDFs, emails, phone photos and spreadsheet exports. Docket reads each one, matches items to the catalog, flags anything doubtful with a reason, and sends approved orders to the bake sheet and a signed webhook.

Demo with invented data. The AI reads each sample once, and that saved reading is replayed through the same live checks.

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. In the Supabase SQL editor, run `supabase/migrations/0001_docket.sql`.
4. In Supabase, open Authentication, then Sign In / Providers, and turn on Allow anonymous sign-ins.
5. `npm run dev`, then open http://localhost:3000 and choose Open the demo.

## Tests

- `npm test` runs the decision engine tests on the ten samples. No network needed.
- `npm run typecheck` checks types.

## Optional

- Live reading: set `OPENAI_API_KEY` and `DOCKET_LIVE_READING=on`. Limits are in `lib/limits.ts`.
- Refresh the saved readings: `npm run pre-read`.
- Cloudflare Turnstile on "Open the demo": set both Turnstile keys.
- Nightly cleanup: set `CRON_SECRET`. `vercel.json` runs it at 03:00.

## Notes

- The bakery, cafés, products and documents are invented.
- The photo sample is an SVG stand-in for a phone photo.
- Each visitor gets a private sandbox that clears after 24 hours.
