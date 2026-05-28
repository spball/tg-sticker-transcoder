import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | undefined;
let loadPromise: Promise<FFmpeg> | undefined;
let activeProgress: ((progress: number) => void) | undefined;
let wasmBlobUrl: string | undefined;

interface WasmManifest {
  totalSize: number;
  parts: Array<{
    file: string;
    size: number;
  }>;
}

export async function getFFmpegRuntime(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) {
    return ffmpeg;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = loadRuntime();
  return loadPromise;
}

export function setActiveProgressHandler(handler: ((progress: number) => void) | undefined): void {
  activeProgress = handler;
}

export function terminateFFmpegRuntime(): void {
  if (ffmpeg?.loaded) {
    ffmpeg.terminate();
  }
  if (wasmBlobUrl) {
    URL.revokeObjectURL(wasmBlobUrl);
  }
  ffmpeg = undefined;
  loadPromise = undefined;
  activeProgress = undefined;
  wasmBlobUrl = undefined;
}

async function loadRuntime(): Promise<FFmpeg> {
  const instance = new FFmpeg();
  instance.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) {
      activeProgress?.(Math.max(0, Math.min(0.98, progress)));
    }
  });

  const coreBaseUrl = new URL(`${import.meta.env.BASE_URL}ffmpeg-core/`, window.location.origin);
  const wasmURL = await getChunkedWasmUrl(coreBaseUrl);
  await instance.load({
    coreURL: new URL("ffmpeg-core.js", coreBaseUrl).toString(),
    wasmURL
  });

  ffmpeg = instance;
  return instance;
}

async function getChunkedWasmUrl(coreBaseUrl: URL): Promise<string> {
  if (wasmBlobUrl) {
    return wasmBlobUrl;
  }

  const manifestResponse = await fetch(new URL("ffmpeg-core.wasm.json", coreBaseUrl));
  if (!manifestResponse.ok) {
    throw new Error("无法加载 FFmpeg WASM 分片清单");
  }

  const manifest = (await manifestResponse.json()) as WasmManifest;
  const chunks = await Promise.all(
    manifest.parts.map(async (part) => {
      const response = await fetch(new URL(part.file, coreBaseUrl));
      if (!response.ok) {
        throw new Error(`无法加载 FFmpeg WASM 分片：${part.file}`);
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== part.size) {
        throw new Error(`FFmpeg WASM 分片大小异常：${part.file}`);
      }
      return new Uint8Array(buffer);
    })
  );

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (totalSize !== manifest.totalSize) {
    throw new Error("FFmpeg WASM 分片合并大小异常");
  }

  const wasm = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    wasm.set(chunk, offset);
    offset += chunk.byteLength;
  }

  wasmBlobUrl = URL.createObjectURL(new Blob([wasm.buffer], { type: "application/wasm" }));
  return wasmBlobUrl;
}
