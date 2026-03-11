import path from "node:path";

const VERCEL_TMP_ROOT = path.join("/tmp", "g6-english-assessment");

export function isVercelRuntime() {
  return Boolean(
    process.env.VERCEL === "1" ||
      process.env.VERCEL_URL ||
      process.env.VERCEL_REGION ||
      process.env.NOW_REGION
  );
}

export function getWritableDataRoot() {
  if (isVercelRuntime()) {
    return VERCEL_TMP_ROOT;
  }

  return path.resolve(import.meta.dirname, "..", "..", "tmp");
}

export function getWritableDataPath(...segments: string[]) {
  return path.join(getWritableDataRoot(), ...segments);
}
