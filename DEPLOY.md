# Fly.io Deployment — Step by Step

Two Fly apps:

| App                                 | Code             | Fly app name                          |
| ----------------------------------- | ---------------- | ------------------------------------- |
| NestJS API (backend)                | repo root        | `parent-report-generator-api`         |
| Next.js frontend (hero + form + UI) | `frontend/`      | `parent-report-generator-frontend`    |

The frontend talks to the backend server-to-server via a proxy route at
`/api/report`. The browser never sees the API key.

Run every step from the repo root unless noted.

---

## 0. One-time setup

```bash
brew install flyctl
fly auth login
```

Verify you are logged into the right account:

```bash
fly auth whoami
```

---

## 1. Deploy the backend (NestJS API)

### 1.1 Launch the app (first time only)

`fly.toml` already exists in the repo root. Use `--copy-config` so Fly
does not overwrite it.

```bash
fly launch \
  --no-deploy \
  --copy-config \
  --name parent-report-generator-api \
  --region iad
```

If Fly asks whether to tweak the settings, say **No** — the committed
`fly.toml` is correct.

### 1.2 Set runtime secrets

These are encrypted at rest on Fly, injected at runtime, and never land
on the machine's disk or in the image.

```bash
fly secrets set \
  OPENAI_API_KEY="sk-proj-...your-real-openai-key..." \
  OPENAI_API_URL="https://api.openai.com/v1/chat/completions" \
  API_SECRET_KEY="ac84c64bb48c411f4d4732b64928e2265f7ee9316cb4711b37a0f03ad3beadc1" \
  ALLOWED_ORIGIN="https://parent-report-generator-frontend.fly.dev" \
  -a parent-report-generator-api
```

Notes:

- `API_SECRET_KEY` is the shared secret between the frontend proxy and
  the backend guard. Keep the exact same value in both apps. The value
  above matches what is in your local `.env`; rotate it later with
  `openssl rand -hex 32` if you want a fresh one.
- `ALLOWED_ORIGIN` should be the frontend's public URL. If you add a
  custom domain later, update it:
  `fly secrets set ALLOWED_ORIGIN=https://your.domain -a parent-report-generator-api`

### 1.3 Deploy

```bash
fly deploy -a parent-report-generator-api
```

First deploy builds the Docker image on Fly's remote builder and rolls
out one machine. Subsequent deploys are ~30–60 s.

### 1.4 Verify

```bash
fly status -a parent-report-generator-api
curl https://parent-report-generator-api.fly.dev/api/health
# → {"status":"ok"}
```

End-to-end smoke test with the real key:

```bash
curl -sS -X POST https://parent-report-generator-api.fly.dev/api/report/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac84c64bb48c411f4d4732b64928e2265f7ee9316cb4711b37a0f03ad3beadc1" \
  -d '{"responses":[4,3,4,2,3,2,3,3,4,4,2,3,2,2,3,2,4,2,2,2,2,2,4,3]}' | jq
```

You should get `{"success":true, ...}` with all 5 report sections filled
in. If you get a 500, tail the logs:

```bash
fly logs -a parent-report-generator-api
```

---

## 2. Deploy the frontend (Next.js)

### 2.1 Launch the app (first time only)

```bash
cd frontend

fly launch \
  --no-deploy \
  --copy-config \
  --name parent-report-generator-frontend \
  --region iad
```

### 2.2 Set runtime secrets

```bash
fly secrets set \
  NEST_API_URL="https://parent-report-generator-api.fly.dev" \
  NEST_API_KEY="ac84c64bb48c411f4d4732b64928e2265f7ee9316cb4711b37a0f03ad3beadc1" \
  -a parent-report-generator-frontend
```

`NEST_API_KEY` **must be identical** to the backend's `API_SECRET_KEY`
or every request will return 401.

### 2.3 Deploy

```bash
fly deploy -a parent-report-generator-frontend
```

### 2.4 Verify

```bash
fly status -a parent-report-generator-frontend
open https://parent-report-generator-frontend.fly.dev
```

In the browser:

1. The hero renders ("A calm, clear plan when you need it most").
2. Click **Start the questionnaire** — scrolls to the form.
3. Click **Fill sample answers** (small link below the submit button)
   to pre-populate.
4. Click **Generate Action Plan** — within a few seconds the domain
   scores, top priorities, and 5 report sections should render.

If the browser shows *"Report generation failed"*, tail both logs:

```bash
fly logs -a parent-report-generator-frontend
fly logs -a parent-report-generator-api
```

Most common causes:

- `NEST_API_URL` or `NEST_API_KEY` not set on the frontend app.
- `API_SECRET_KEY` differs between the two apps.
- `OPENAI_API_KEY` on the backend is missing or invalid — the backend
  will log the upstream 401 from OpenAI.

---

## 3. Everyday operations

### Re-deploy after a code change

```bash
# Backend (from repo root)
fly deploy -a parent-report-generator-api

# Frontend (from frontend/)
cd frontend && fly deploy -a parent-report-generator-frontend
```

### Tail live logs

```bash
fly logs -a parent-report-generator-api
fly logs -a parent-report-generator-frontend
```

### Rotate the shared API secret

```bash
NEW_KEY=$(openssl rand -hex 32)
fly secrets set API_SECRET_KEY="$NEW_KEY" -a parent-report-generator-api
fly secrets set NEST_API_KEY="$NEW_KEY"   -a parent-report-generator-frontend
```

Fly restarts both machines automatically on secret changes.

### Update a single secret without restarting the whole list

```bash
fly secrets set OPENAI_API_KEY="sk-proj-new-value" \
  -a parent-report-generator-api
```

### Scale to always-on (disable cold starts)

Edit the relevant `fly.toml`:

```toml
[http_service]
  min_machines_running = 1
```

Then `fly deploy` again.

### Roll back the last release

```bash
fly releases -a parent-report-generator-api
fly releases rollback <version> -a parent-report-generator-api
```

### Destroy everything (careful)

```bash
fly apps destroy parent-report-generator-frontend
fly apps destroy parent-report-generator-api
```

---

## 4. Local parity check before a deploy

From the repo root:

```bash
# Backend
npm run build          # must succeed and produce dist/main.js
npm test               # all 23 Playwright tests must pass

# Frontend
cd frontend
npx next build         # must succeed and produce .next/standalone/server.js
```

If either build fails locally it will fail on Fly. Fix locally first.

---

## 5. Custom domain (optional, later)

Backend:

```bash
fly certs add api.yourdomain.com -a parent-report-generator-api
```

Frontend:

```bash
fly certs add yourdomain.com -a parent-report-generator-frontend
```

Add the DNS records Fly tells you to. Then update
`ALLOWED_ORIGIN` on the backend so CORS stays tight:

```bash
fly secrets set ALLOWED_ORIGIN="https://yourdomain.com" \
  -a parent-report-generator-api
```

And point the frontend at the new backend hostname:

```bash
fly secrets set NEST_API_URL="https://api.yourdomain.com" \
  -a parent-report-generator-frontend
```
