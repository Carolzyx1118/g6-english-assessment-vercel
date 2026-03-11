# Vercel Deployment

## Build setup

- Framework preset: `Other`
- Build Command: `pnpm build:vercel`
- Output Directory: `public`
- Install Command: `pnpm install --frozen-lockfile`

`vercel.json` already wires SPA routes to `index.html`, while API traffic is handled by the Vercel function entrypoints in [`api/index.ts`](/Users/carol/Desktop/vercel 歐/g6-english-assessment-vercel/api/index.ts) and [`api/[...route].ts`](/Users/carol/Desktop/vercel 歐/g6-english-assessment-vercel/api/[...route].ts).

## Environment variables

Required:

- `JWT_SECRET`
- `INVITE_CODE`

Recommended for production persistence:

- `DATABASE_URL`

For this project, `DATABASE_URL` must be a Postgres/Neon connection string.

Required for uploads/assets on Vercel:

- `BLOB_READ_WRITE_TOKEN`

Alternative storage provider:

- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

Optional integrations:

- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `OWNER_OPEN_ID`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_FRONTEND_FORGE_API_KEY`

## Important constraints

- Without `DATABASE_URL`, local-auth users, manual papers, and test history fall back to files under `/tmp` on Vercel. That is not durable.
- Without `BLOB_READ_WRITE_TOKEN` or Forge storage credentials, uploads are blocked on Vercel by design.
- Large base64 uploads may still hit Vercel Function body limits. If you expect large PDFs or audio files, switch those flows to direct-to-storage uploads.
