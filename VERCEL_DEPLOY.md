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

Recommended for AI grading and report generation:

- `OPENAI_API_KEY`

Optional OpenAI overrides:

- `OPENAI_BASE_URL`
- `OPENAI_CHAT_MODEL`
- `OPENAI_TRANSCRIPTION_MODEL`

Example `INVITE_CODE` value:

- `ENGVOC2026=english+vocabulary,MATH2026=math,TEACHER2026=english+math+vocabulary`

Recommended for production persistence:

- `DATABASE_URL`

For this project, `DATABASE_URL` must be a Postgres/Neon connection string.

Required for uploads/assets on Vercel:

- `BLOB_READ_WRITE_TOKEN`

Legacy Manus/Forge AI + storage alternative:

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
- Without `OPENAI_API_KEY` or `BUILT_IN_FORGE_API_KEY`, reading/writing AI grading and report generation fall back to manual-review mode.
- Without `BLOB_READ_WRITE_TOKEN` or Forge storage credentials, uploads are blocked on Vercel by design.
- Speaking AI on Vercel still needs working upload storage because the transcription flow first fetches the uploaded audio by URL.
- Large base64 uploads may still hit Vercel Function body limits. If you expect large PDFs or audio files, switch those flows to direct-to-storage uploads.
