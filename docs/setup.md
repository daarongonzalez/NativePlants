# Setup

Everything here is a one-time account or provisioning step. The code is already
in the repo; these are the credentials and resources it needs.

## Prerequisites

- Node 22+
- pnpm 10 (`corepack enable`)
- A Cloudflare account on the Workers Paid plan
- A Neon project
- A Firebase project

## 1. Install and verify

```bash
pnpm install
pnpm check        # typecheck + tests
```

The engine tests run with no configuration. The database scoping suite skips
without a test database — see step 4.

## 2. Neon

1. Create a project. Create two branches: `main` (production) and `dev`.
2. Enable PostGIS on each: `CREATE EXTENSION IF NOT EXISTS postgis;`
3. Copy the **direct** connection string, not the pooled one. The pooled string
   is the one with `-pooler` in the host. Hyperdrive does the pooling, and
   doubling up causes problems.

## 3. Cloudflare

```bash
npx wrangler login

# Hyperdrive in front of Neon — DIRECT connection string
npx wrangler hyperdrive create nativeplants-db \
  --connection-string="postgresql://...neon.tech/nativeplants?sslmode=require"

# KV for Google's public keys, used by token verification
npx wrangler kv namespace create AUTH_KEYS

# R2 for plant photography
npx wrangler r2 bucket create nativeplants-media
```

Put the returned ids into `apps/api/wrangler.toml` where marked
`REPLACE_WITH_...`.

## 4. Migrations and the scoping suite

```bash
export DATABASE_URL="<neon dev direct url>"
pnpm db:generate      # writes SQL from the Drizzle schema
pnpm db:migrate
```

Then point the scoping suite at the same dev branch and run it:

```bash
export TEST_DATABASE_URL="$DATABASE_URL"
pnpm --filter @np/db test
```

**This suite skipping is not a pass.** A green CI run with no database
configured proves nothing about authorization. Configure it before M2 is
considered done.

## 5. Firebase

1. Enable Email/Password and Google sign-in.
2. Copy the project id into `apps/api/wrangler.toml` as `FIREBASE_PROJECT_ID`.
3. The web app needs the public client config; the API needs only the project
   id, since it verifies tokens against Google's published keys.

No service account key is needed anywhere. `firebase-admin` does not run on
Workers and we do not use it.

## 6. Run locally

```bash
pnpm --filter @np/api dev
curl http://localhost:8787/v1/health
```

## Secrets

`.dev.vars` and `.env` are gitignored. For deployed environments use
`wrangler secret put`, never `[vars]` in `wrangler.toml` — that file is
committed.
