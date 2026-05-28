import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const coreEntry = require.resolve("@ffmpeg/core");
const coreDir = dirname(coreEntry);
const outputDir = join(process.cwd(), "public", "ffmpeg-core");
const chunkSize = 20 * 1024 * 1024;

if (!existsSync(coreDir)) {
  throw new Error(`Cannot find @ffmpeg/core distribution at ${coreDir}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

copyFileSync(join(coreDir, "ffmpeg-core.js"), join(outputDir, "ffmpeg-core.js"));

const wasmBuffer = readFileSync(join(coreDir, "ffmpeg-core.wasm"));
const parts = [];

for (let offset = 0; offset < wasmBuffer.byteLength; offset += chunkSize) {
  const index = parts.length;
  const fileName = `ffmpeg-core.wasm.part-${String(index).padStart(3, "0")}`;
  const chunk = wasmBuffer.subarray(offset, Math.min(offset + chunkSize, wasmBuffer.byteLength));
  writeFileSync(join(outputDir, fileName), chunk);
  parts.push({
    file: fileName,
    size: chunk.byteLength
  });
}

writeFileSync(
  join(outputDir, "ffmpeg-core.wasm.json"),
  `${JSON.stringify(
    {
      originalFile: "ffmpeg-core.wasm",
      totalSize: wasmBuffer.byteLength,
      parts
    },
    null,
    2
  )}\n`
);

const requiredFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm.json"];
for (const fileName of requiredFiles) {
  if (!existsSync(join(outputDir, fileName))) {
    throw new Error(`Missing ${fileName} after copying @ffmpeg/core assets`);
  }
}

console.log(`Copied FFmpeg core assets to ${outputDir} (${parts.length} WASM chunks)`);
