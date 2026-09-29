# Fund X-Ray

A weekly X-ray of where your money sits and which sectors it is leaving. Personal use first, friends later.
Data and analytics only, not investment advice.

```
web/      Next.js app: (public)/welcome = signed-out home, (app)/* = signed-in pages; (paper design, day and night themes)
api/      FastAPI service: health now; Google-token checks, Kite login and holdings on later days
engine/   Plain Python package with all the calculations; no UI code
supabase/ Database migrations (Day 3)
```

## Day 1 status

| Item | State |
| --- | --- |
| Repo layout (`web/`, `api/`, `engine/`) | Done |
| Paper colour tokens, day and night | Done: `web/src/app/globals.css` |
| Newsreader + Source Sans 3, tabular figures, type scale 12–56 px | Done |
| Masthead, text navigation, phone tab bar, day/night switch | Done |
| `/health` endpoint and "API connected" dot | Done |
| Token review page | Done: open `/ui` |
| Signed-out home page | Done: open `/welcome` (Day 3 sends signed-out visitors here) |
| Kite Connect app, Supabase project, GitHub repo, Vercel | **You** (steps below) |

## Accounts to set up (about 45 minutes)

1. **Kite Connect.** At developers.kite.trade, create an app. Redirect URL: `http://localhost:8000/kite/callback`.
   Subscribe to the paid plan (₹500/month) for historical prices. Keep the API key and secret for Day 4.
2. **Supabase.** New project, region **Mumbai (ap-south-1)**. Under Authentication → Providers, enable Google
   (needs an OAuth client from Google Cloud Console). Keep the project URL, service-role key and JWT secret for Day 3.
3. **GitHub.** Create an empty repo and push this folder:
   ```bash
   git init && git add . && git commit -m "Day 1: skeleton, paper theme, masthead"
   git branch -M main
   git remote add origin git@github.com:<you>/fund-xray.git
   git push -u origin main
   ```
4. **Vercel.** Import the repo, set **Root Directory** to `web`, add the environment variable
   `NEXT_PUBLIC_API_URL` (use `http://localhost:8000` until the API is deployed on Day 7).

## Run it locally

Web (Node 20 or newer):

```bash
cd web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

API (Python 3.11 or newer), in a second terminal:

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r api/requirements.txt
cd api
cp .env.example .env
uvicorn app.main:app --reload --port 8000          # http://localhost:8000/health
```

Tests:

```bash
pytest -q engine/tests
cd api && pytest -q
```

## Day 1 is done when

- [ ] The app opens on a Vercel preview in the paper look
- [ ] Switching Day / Night in the masthead changes every colour, and the choice survives a reload
- [ ] The footer shows "API connected" when the API is running locally
- [ ] `/ui` shows every colour and type size correctly in both themes
- [ ] The phone view (390 px) shows the bottom tab bar instead of the masthead links

## Design rules

- Colours only through tokens (`bg-paper`, `text-ink-3`, `border-rule`, `text-gain`, `bg-q-weakening` …).
  Add new colours to both themes in `globals.css`, never inline.
- Numbers get the `figures` class (tabular, lining).
- Every screen leads with one plain sentence about the user's money, then the figures that back it.
- Rules, not boxes; boxed panels only for asides.
- Design canvas: https://claude.ai/artifact/QVH43diVc3WmBf2FcqHt5v

## Secrets

Real values live only in `web/.env.local` and `api/.env` (both git-ignored) and in Vercel / your API host.
