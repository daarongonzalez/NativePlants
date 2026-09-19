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

## 2. Neon — already provisioned

| | |
|---|---|
| Project | `NativePlants` / `cool-term-95598834` |
| Region | `aws-us-east-2` |
| Postgres | 18.6 |
| Branches | `production` (default), `dev` |
| Dev branch id | `br-winter-flower-ae0lr1gs` |

PostGIS is enabled and the initial migration is applied **on `dev` only**.
Production is still empty — apply the migration there as a deliberate step,
not as a side effect.

Copy the **direct** connection string, not the pooled one: the pooled host
contains `-pooler`. Hyperdrive does the pooling and doubling up causes
problems. The pooled string is the right one for local tests and scripts,
which connect with `pg` directly.

> **Credential note.** The `dev` branch connection string was read during the
> M3 build and is therefore in that session's transcript. Nothing was committed
> and the credential is for the dev branch only, but rotating the
> `neondb_owner` password is cheap if you would rather not rely on that.

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
