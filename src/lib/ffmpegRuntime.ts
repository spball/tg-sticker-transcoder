import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | undefined;
let loadPromise: Promise<FFmpeg> | undefined;
let activeProgress: ((progress: number) => void) | undefined;

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
  ffmpeg = undefined;
  loadPromise = undefined;
  activeProgress = undefined;
}

async function loadRuntime(): Promise<FFmpeg> {
  const instance = new FFmpeg();
  instance.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) {
      activeProgress?.(Math.max(0, Math.min(0.98, progress)));
    }
  });

  const coreBaseUrl = new URL(`${import.meta.env.BASE_URL}ffmpeg-core/`, window.location.origin);
  await instance.load({
    coreURL: new URL("ffmpeg-core.js", coreBaseUrl).toString(),
    wasmURL: new URL("ffmpeg-core.wasm", coreBaseUrl).toString()
  });

  ffmpeg = instance;
  return instance;
}
