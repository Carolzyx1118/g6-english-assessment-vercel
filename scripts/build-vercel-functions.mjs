import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const generatedDir = path.join(projectRoot, "api", "_generated");

await fs.mkdir(generatedDir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, "server", "_core", "vercelRpcHandler.ts")],
  outfile: path.join(generatedDir, "rpc-handler.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "node20",
  sourcemap: false,
  logLevel: "info",
});
