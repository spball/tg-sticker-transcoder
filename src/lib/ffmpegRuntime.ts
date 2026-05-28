import { FFmpeg } from "@ffmpeg/ffmpeg";
import { detectLocale, getTranslations } from "./i18n";

let ffmpeg: FFmpeg | undefined;
let loadPromise: Promise<FFmpeg> | undefined;
let activeProgress: ((progress: number) => void) | undefined;
let wasmBlobUrl: string | undefined;
let recentLogs: string[] = [];
let completedFFmpegJobs = 0;
const FFMPEG_ASSET_VERSION = "esm-core-20260528";
const FFMPEG_JOB_RECYCLE_INTERVAL = 25;

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

  loadPromise = loadRuntime().catch((error) => {
    ffmpeg = undefined;
    loadPromise = undefined;
    if (wasmBlobUrl) {
      URL.revokeObjectURL(wasmBlobUrl);
      wasmBlobUrl = undefined;
    }
    throw error;
  });
  return loadPromise;
}

export function setActiveProgressHandler(handler: ((progress: number) => void) | undefined): void {
  activeProgress = handler;
}

export function terminateFFmpegRuntime(options: { keepWasmBlob?: boolean } = {}): void {
  if (ffmpeg?.loaded) {
    ffmpeg.terminate();
  }
  if (wasmBlobUrl && !options.keepWasmBlob) {
    URL.revokeObjectURL(wasmBlobUrl);
    wasmBlobUrl = undefined;
  }
  ffmpeg = undefined;
  loadPromise = undefined;
  activeProgress = undefined;
  recentLogs = [];
  completedFFmpegJobs = 0;
}

async function loadRuntime(): Promise<FFmpeg> {
  const instance = new FFmpeg();
  instance.on("log", ({ message }) => {
    recentLogs = [...recentLogs.slice(-19), message];
  });
  instance.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) {
      activeProgress?.(Math.max(0, Math.min(0.98, progress)));
    }
  });

  const coreBaseUrl = new URL(`${import.meta.env.BASE_URL}ffmpeg-core/`, window.location.origin);
  const wasmURL = await getChunkedWasmUrl(coreBaseUrl);
  await instance.load({
    coreURL: versionedAssetUrl("ffmpeg-core.js", coreBaseUrl).toString(),
    wasmURL
  });

  ffmpeg = instance;
  return instance;
}

export function getRecentFFmpegLogs(): string {
  return recentLogs.slice(-8).join(" | ");
}

export function clearRecentFFmpegLogs(): void {
  recentLogs = [];
}

export function recycleFFmpegRuntimeAfterJob(): void {
  if (!ffmpeg?.loaded) {
    return;
  }

  completedFFmpegJobs += 1;
  if (completedFFmpegJobs >= FFMPEG_JOB_RECYCLE_INTERVAL) {
    terminateFFmpegRuntime({ keepWasmBlob: true });
  }
}

export function restartFFmpegRuntime(): void {
  terminateFFmpegRuntime({ keepWasmBlob: true });
}

async function getChunkedWasmUrl(coreBaseUrl: URL): Promise<string> {
  if (wasmBlobUrl) {
    return wasmBlobUrl;
  }

  const manifestResponse = await fetch(versionedAssetUrl("ffmpeg-core.wasm.json", coreBaseUrl));
  if (!manifestResponse.ok) {
    throw new Error(getRuntimeText().errors.ffmpegManifestLoadFailed);
  }

  const manifest = (await manifestResponse.json()) as WasmManifest;
  const chunks = await Promise.all(
    manifest.parts.map(async (part) => {
      const response = await fetch(versionedAssetUrl(part.file, coreBaseUrl));
      if (!response.ok) {
        throw new Error(getRuntimeText().errors.ffmpegChunkLoadFailed(part.file));
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== part.size) {
        throw new Error(getRuntimeText().errors.ffmpegChunkSizeMismatch(part.file));
      }
      return new Uint8Array(buffer);
    })
  );

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (totalSize !== manifest.totalSize) {
    throw new Error(getRuntimeText().errors.ffmpegWasmMergeMismatch);
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

function getRuntimeText() {
  return getTranslations(detectLocale());
}

function versionedAssetUrl(path: string, baseUrl: URL): URL {
  const url = new URL(path, baseUrl);
  url.searchParams.set("v", FFMPEG_ASSET_VERSION);
  return url;
}
