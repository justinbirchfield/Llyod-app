# Lloyd

One question box, one answer.

## What's here
- Home-screen web app: answer area, text box, send. Voice = keyboard dictation.
- Password login with a signed 30-day cookie; every page and API route is locked
- `/api/ask`: one system prompt, a tool loop, and every question/answer logged
- Short-term context: the last 8 exchanges from the past 12 hours ride along, so follow-ups work
- `search_history` tool: "what did I say about XYZ" searches the full log
- Log auto-purges anything older than 12 months (daily job in Supabase)

## Adding a capability
Add a tool definition and a case in `lib/tools.ts`. The ask route picks it up automatically.

## Still to build
1. Passkey login (replaces the password)
2. Agenda tool (Herald logic)
3. Email tool (reuse Steward's Graph auth)
4. AgencyZoom lookups, then writes behind an approval badge
5. Memory store for durable non-client facts (doesn't purge)

## Setup
1. Create a Supabase project (free tier is fine).
2. SQL Editor: paste `supabase/schema.sql`, run it.
3. Push this folder to a private GitHub repo, import it in Vercel.
4. Add the env vars from `.env.example` in Vercel project settings.
5. On Android: open the URL in Chrome, log in, menu (⋮) → Install app.

## Run locally
```
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
