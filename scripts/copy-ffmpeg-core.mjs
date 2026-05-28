import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const coreEntry = require.resolve("@ffmpeg/core");
const coreDir = dirname(coreEntry);
const outputDir = join(process.cwd(), "public", "ffmpeg-core");

if (!existsSync(coreDir)) {
  throw new Error(`Cannot find @ffmpeg/core distribution at ${coreDir}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const fileName of readdirSync(coreDir)) {
  if (fileName.startsWith("ffmpeg-core.")) {
    copyFileSync(join(coreDir, fileName), join(outputDir, fileName));
  }
}

const requiredFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm"];
for (const fileName of requiredFiles) {
  if (!existsSync(join(outputDir, fileName))) {
    throw new Error(`Missing ${fileName} after copying @ffmpeg/core assets`);
  }
}

console.log(`Copied FFmpeg core assets to ${outputDir}`);
