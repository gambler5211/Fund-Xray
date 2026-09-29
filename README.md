# Fund X-Ray

A weekly X-ray of where your money sits and which sectors it is leaving. Personal use first, friends later.
Data and analytics only, not investment advice.

```
web/      Next.js app: (public)/welcome = signed-out home, (app)/* = signed-in pages; (paper design, day and night themes)
api/      FastAPI service: /health, Supabase token checks (/me); Kite login and holdings on later days
engine/   Plain Python package with all the calculations; no UI code
supabase/ Database migrations (run in the Supabase SQL Editor)
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

## Day 3: Google sign-in and the database

What's built: Google sign-in (`/login`), signed-out visitors redirected to `/login`, sign-out from the
account menu, the Settings page, the API checking the Supabase token on every private route (`/me`
first), and the first database migration with row-level security.

One-time setup:

1. **Run the migration.** Supabase → SQL Editor → paste `supabase/migrations/20260930000000_day3_users_settings.sql`
   → Run. It creates `users`, `settings`, `kite_tokens`, `holdings_snapshot`, a trigger that makes your
   settings row on first sign-in, and `delete_my_account()`. Safe to run twice.
2. **Redirect URLs.** Supabase → Authentication → URL Configuration. Site URL
   `https://fund-xray-theta.vercel.app`; Redirect URLs `https://fund-xray-theta.vercel.app/**`,
   `http://localhost:3000/**`, and `https://*-<your-vercel-team>.vercel.app/**` for preview builds.
3. **Web keys.** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase →
   Project settings → API Keys → publishable key) to `web/.env.local` and to Vercel (Production and
   Preview), then redeploy.
4. **API.** Redeploy with `bash scripts/deploy-api.sh`; it now sets `SUPABASE_URL` on Cloud Run. The API
   needs no secret to check tokens: it uses Supabase's public signing keys.

Check: sign in, change the index target in Settings, reload and see it kept; Settings → Account shows
"The API recognises you"; a second Google account sees only its own settings.

## Day 4: Connect Kite

How it works: the web app sends you to Zerodha's own login page; Zerodha sends you back to the web
app's `/kite/callback` with a one-time request token; the web app hands it to the API, which swaps
it for an access token using the API secret, encrypts it (Fernet, key only on Cloud Run) and saves
it through Supabase *as you*, so row-level security still applies and the API needs no Supabase
secret key. The token stops working at 6 AM IST; the masthead then shows **Reconnect**.

A random `state` value in a short-lived cookie must come back from Zerodha unchanged, so a login
link started by someone else can't attach their Zerodha account to yours.

One-time setup:

1. **Kite app Redirect URL** (developers.kite.trade → your app): `https://fund-xray-theta.vercel.app/kite/callback`
   (the web app, not the API).
2. **Cloud Run** variables: `KITE_API_KEY`; secrets `KITE_API_SECRET` and `TOKEN_ENCRYPTION_KEY`
   (44-character Fernet key) from Secret Manager, readable by the Cloud Run service account.
3. **GitHub repository variable** `SUPABASE_PUBLISHABLE_KEY` (the same public key Vercel has); the
   deploy workflow passes it to Cloud Run.
4. The migration `20260930010000_day4_kite_token_functions.sql` applies itself on merge to `main`.

API: `GET /kite/login-url`, `POST /kite/session`, `GET /kite/status`, `GET /kite/profile`,
`DELETE /kite/session`. All need a signed-in user.

## Day 5: Holdings and the Portfolio page

`POST /holdings/refresh` pulls holdings and positions from Kite, adds company names from Kite's
instruments list, and hands everything to `engine.build_snapshot`, which works out invested,
value, today's change, total return and weights with exact decimal arithmetic. The API saves the
result through `save_holdings_snapshot` (one snapshot per day, as you). The pull runs right after
connecting and on **Refresh**. Nothing is a fixed list: exits drop out, new buys appear.
Quantities include T1 shares, as Kite Console does; shares bought today show under Positions.

Check: totals on Portfolio match Kite Console to the rupee, and the page reads well at 390 px.

## Day 6: Sectors and index history (from NSE)

Data comes from NSE's own published files, free, no extra login:

- **Sectors:** NSE's index constituent lists (`ind_niftytotalmarket_list.csv` etc.) give each
  company's industry at NSE's sector level ("Capital Goods", "Power", ...). Held stocks outside
  those lists (smaller companies, recent listings) are then looked up one by one on NSE's quote
  page, which gives all four levels; ETFs are marked "ETFs & funds". Anything left shows
  **Unmapped**; click it to pick a sector (saved per user in `sector_overrides`).
- **Index history:** one file per trading day, `ind_close_all_DDMMYYYY.csv`, with every index's
  close (plus P/E, P/B, dividend yield). Market holidays have no file.

These downloads run as GitHub Actions jobs (`.github/workflows/nse-data.yml`, scripts in `jobs/`)
because they write shared reference data with the Supabase **secret** key, which lives only in
GitHub secrets.

One-time setup:

1. Supabase → Project settings → API Keys → create a **secret key** (`sb_secret_...`); add it as
   the GitHub repository **secret** `SUPABASE_SECRET_KEY`.
2. Actions → NSE data → Run workflow → `probe`. It downloads a recent and a 3-year-old file and
   the sector list, writes nothing, and says whether NSE lets GitHub's servers through.
3. Run `sectors`, then `backfill` (about 15 minutes for 3 years; safe to re-run, it skips days
   already saved).

The 25 tracked indices are in `tracked_indices` (migration `20260930030000`), keyed by NSE's
index name.

## Day 7: Nightly market data

`.github/workflows/nightly.yml` runs `jobs/nightly.py` at **7:10 PM IST, Monday to Friday**. It
adds the day's closes for the 25 tracked indices from NSE's daily file. It looks back 10 days, so a
late file or a missed night is filled in by the next run. Each run (and each `sectors` and
`backfill` run) writes one row to `job_runs`; the app footer reads it:

> Holdings from Kite, 30 Sept, 3:42 PM · Market data to 30 Sept close

The market part turns ochre when the last run is more than 4 days old, and red when it failed.
A failed scheduled run also emails you (GitHub's default). To run it by hand:
Actions → Nightly → Run workflow.

Holdings are **not** refreshed at night: Kite's token ends at 6 AM daily and a new one needs your
Zerodha login, so holdings update when you press Refresh.

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

Data jobs (write to the real database, so they need the Supabase secret key):

```bash
pip install -r jobs/requirements.txt
cd jobs
SUPABASE_SECRET_KEY=sb_secret_... python nightly.py        # or import_sectors.py, backfill_index_prices.py --days 10
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

Nothing secret is in git. Real values live here:

| Value | Where it lives | Used by |
| --- | --- | --- |
| Supabase URL, publishable key | `web/.env.local`, Vercel env vars, GitHub variable `SUPABASE_PUBLISHABLE_KEY`, Cloud Run env | Web app and API (safe to expose; row-level security guards the data) |
| Supabase secret key (`sb_secret_...`) | GitHub secret `SUPABASE_SECRET_KEY` only | The NSE data jobs, which write shared reference data |
| Kite API key | Cloud Run env `KITE_API_KEY`, `api/.env` | API |
| Kite API secret | Secret Manager `KITE_API_SECRET`, `api/.env` | API |
| Token encryption key | Secret Manager `TOKEN_ENCRYPTION_KEY`, `api/.env` | API: encrypts each user's Kite token before it is stored |
| Google deploy access | No key: Workload Identity Federation (`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` variables) | Deploy API workflow |

`web/.env.local` and `api/.env` are git-ignored.

### Rotate the token encryption key

Kite tokens last only until 6 AM, so rotating costs nothing more than one reconnect. Tokens
encrypted with the old key simply fail to decrypt, and the app asks for a reconnect.

In Cloud Shell:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" \
  | tr -d '\n' | gcloud secrets versions add TOKEN_ENCRYPTION_KEY --data-file=- --project fund-xray
gcloud run services update fund-xray-api --region asia-south1 --project fund-xray \
  --update-secrets TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest
gcloud secrets versions list TOKEN_ENCRYPTION_KEY --project fund-xray   # then disable the old version:
gcloud secrets versions disable <old-version> --secret TOKEN_ENCRYPTION_KEY --project fund-xray
```

The key must be 44 characters (`tr -d '\n'` stops a trailing newline sneaking in). Reconnect
Zerodha afterwards. Rotate it if it may have leaked; there's no need to on a schedule.

### Rotate the Supabase secret key

Supabase → Project settings → API Keys → create a new secret key, update the GitHub secret
`SUPABASE_SECRET_KEY`, run Actions → Nightly once to check, then delete the old key in Supabase.

## Deploy the API (Google Cloud Run, Mumbai)

The API runs on Cloud Run in `asia-south1` (project `fund-xray`). It sleeps when idle, so it is free at our size;
the first request after a quiet spell takes 1–3 seconds.

In the Google Cloud console, open **Cloud Shell** (the `>_` icon, top right), then:

```bash
git clone https://github.com/gambler5211/Fund-Xray.git && cd Fund-Xray
bash scripts/deploy-api.sh setup      # first time only
```

After that, deploy with `git pull && bash scripts/deploy-api.sh`. Once the Vercel address is known:

```bash
WEB_ORIGIN="https://<your-app>.vercel.app,http://localhost:3000" bash scripts/deploy-api.sh
```

The script prints the API address; put it in Vercel as `NEXT_PUBLIC_API_URL` and redeploy the web app.
Set a ₹100/month budget alert under Billing → Budgets & alerts.

## CI/CD: what deploys itself

| Part | Deploys when | How |
| --- | --- | --- |
| Web app | Any push to `main` (previews for `dev` and PRs) | Vercel, from its GitHub connection |
| Database | A new file in `supabase/migrations/` lands on `main` | Supabase GitHub integration |
| API | A change under `api/` or `engine/` lands on `main` | `.github/workflows/deploy-api.yml` |
| Checks | Every PR and push to `main` | `.github/workflows/ci.yml`: web lint + build, Python tests |

The API workflow runs the tests, builds the image, deploys to Cloud Run, then checks `/health`
answers and `/me` refuses a missing sign-in. It signs in to Google with Workload Identity
Federation, so no Google key is stored in GitHub, and only this repo's `main` branch is trusted.

One-time setup (Cloud Shell, about 2 minutes):

```bash
cd Fund-Xray && git pull
bash scripts/setup-github-deploy.sh
```

Add the two values it prints as GitHub repository **variables** (Settings → Secrets and
variables → Actions → Variables): `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA`. Then run
Actions → Deploy API → Run workflow once. `scripts/deploy-api.sh` still works for a manual deploy.
