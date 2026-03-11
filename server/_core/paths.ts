import path from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(metaUrl: string) {
  return path.dirname(fileURLToPath(metaUrl));
}
