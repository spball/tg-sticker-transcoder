import type { ConversionMode, EncodingAttempt, TranscodeResult } from "../types";
import {
  computeStickerDimensions,
  getCompressionLadder,
  getOutputName,
  TELEGRAM_MAX_BYTES,
  validateInspection
} from "./presets";
import { inspectVideoBlob } from "./videoInspection";
import { readGifInfo } from "./gif";
import { finalizeWebmContainer } from "./webmFinalize";

interface SourceInfo {
  width: number;
  height: number;
  durationMs: number;
  kind: "gif" | "video";
}

export async function transcodeWithCanvasRecorder(
  file: File,
  mode: ConversionMode,
  onProgress?: (progress: number) => void
): Promise<TranscodeResult> {
  if (!supportsVp9Recorder()) {
    throw new Error("当前浏览器不支持 VP9 MediaRecorder");
  }

  const sourceInfo = await inspectSource(file);
  const attempts: EncodingAttempt[] = [];
  let smallestBlob: Blob | undefined;

  for (const step of getCompressionLadder(mode)) {
    const recordedBlob = await recordAttempt(file, mode, sourceInfo, step.fps, step.bitrateKbps, onProgress);
    const blob = await finalizeWebmContainer(recordedBlob);
    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob;
    }
    const ok = blob.size <= TELEGRAM_MAX_BYTES;
    attempts.push({
      bitrateKbps: step.bitrateKbps,
      fps: step.fps,
      sizeBytes: blob.size,
      ok,
      note: "浏览器 Canvas VP9"
    });

    if (ok) {
      return finishCanvasResult(file, mode, blob, attempts);
    }
  }

  const finalBlob = smallestBlob ?? (await recordAttempt(file, mode, sourceInfo, 12, 45, onProgress));
  return finishCanvasResult(file, mode, finalBlob, attempts, ["未能压缩到 256 KB 以下，保留最后一次结果"]);
}

export function supportsVp9Recorder(): boolean {
  return getVp9MimeType() !== undefined;
}

async function finishCanvasResult(
  file: File,
  mode: ConversionMode,
  blob: Blob,
  attempts: EncodingAttempt[],
  initialWarnings: string[] = []
): Promise<TranscodeResult> {
  const warnings = [...initialWarnings];
  try {
    const inspection = await inspectVideoBlob(blob);
    warnings.push(...validateInspection(mode, inspection, blob.size));
    return {
      blob,
      outputName: getOutputName(file.name, mode),
      attempts,
      inspection,
      warnings
    };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "输出视频元数据读取失败");
    return {
      blob,
      outputName: getOutputName(file.name, mode),
      attempts,
      warnings
    };
  }
}

async function inspectSource(file: File): Promise<SourceInfo> {
  if (isGif(file)) {
    const info = await readGifInfo(file);
    return {
      width: info.width,
      height: info.height,
      durationMs: Math.min(3000, Math.max(120, info.durationMs)),
      kind: "gif"
    };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration * 1000 : 3000;
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationMs: Math.min(3000, Math.max(120, duration)),
        kind: "video"
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("浏览器无法解码该输入文件"));
    };
    video.src = url;
  });
}

async function recordAttempt(
  file: File,
  mode: ConversionMode,
  sourceInfo: SourceInfo,
  fps: number,
  bitrateKbps: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const target = mode === "emoji" ? { width: 100, height: 100 } : computeStickerDimensions(sourceInfo.width, sourceInfo.height);
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("无法创建 Canvas 渲染上下文");
  }

  if (sourceInfo.kind === "gif") {
    return recordGif(file, sourceInfo, canvas, context, fps, bitrateKbps, mode, onProgress);
  }

  return recordVideo(file, sourceInfo, canvas, context, fps, bitrateKbps, mode, onProgress);
}

function recordGif(
  file: File,
  sourceInfo: SourceInfo,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  fps: number,
  bitrateKbps: number,
  mode: ConversionMode,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      recordCanvas(canvas, fps, bitrateKbps, sourceInfo.durationMs, (elapsedMs) => {
        drawSource(context, image, sourceInfo.width, sourceInfo.height, canvas.width, canvas.height, mode);
        onProgress?.(Math.min(0.95, elapsedMs / sourceInfo.durationMs));
      })
        .then(resolve, reject)
        .finally(() => URL.revokeObjectURL(url));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("浏览器无法加载 GIF"));
    };
    image.src = url;
  });
}

function recordVideo(
  file: File,
  sourceInfo: SourceInfo,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  fps: number,
  bitrateKbps: number,
  mode: ConversionMode,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.oncanplay = () => {
      video.currentTime = 0;
      video
        .play()
        .then(() =>
          recordCanvas(canvas, fps, bitrateKbps, sourceInfo.durationMs, (elapsedMs) => {
            drawSource(context, video, sourceInfo.width, sourceInfo.height, canvas.width, canvas.height, mode);
            onProgress?.(Math.min(0.95, elapsedMs / sourceInfo.durationMs));
          })
        )
        .then(resolve, reject)
        .finally(() => {
          video.pause();
          URL.revokeObjectURL(url);
        });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("浏览器无法播放该输入文件"));
    };
    video.src = url;
  });
}

function recordCanvas(
  canvas: HTMLCanvasElement,
  fps: number,
  bitrateKbps: number,
  durationMs: number,
  drawFrame: (elapsedMs: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps);
    const mimeType = getVp9MimeType();
    if (!mimeType) {
      reject(new Error("当前浏览器不支持 VP9 MediaRecorder"));
      return;
    }
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrateKbps * 1000
    });
    const chunks: BlobPart[] = [];
    let start = 0;
    let frameTimer = 0;
    let stopTimer = 0;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = () => reject(new Error("浏览器 VP9 录制失败"));
    recorder.onstop = () => {
      cancelAnimationFrame(frameTimer);
      window.clearTimeout(stopTimer);
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: "video/webm" }));
    };

    const draw = (now: number) => {
      if (!start) {
        start = now;
      }
      const elapsed = now - start;
      drawFrame(elapsed);
      if (elapsed < durationMs) {
        frameTimer = requestAnimationFrame(draw);
      }
    };

    drawFrame(0);
    recorder.start(100);
    frameTimer = requestAnimationFrame(draw);
    stopTimer = window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, durationMs + 80);
  });
}

function drawSource(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: ConversionMode
): void {
  context.clearRect(0, 0, targetWidth, targetHeight);
  const scale = mode === "emoji" ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight) : targetWidth / sourceWidth;
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const x = Math.round((targetWidth - width) / 2);
  const y = Math.round((targetHeight - height) / 2);
  context.drawImage(source, x, y, width, height);
}

function isGif(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

function getVp9MimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  return ["video/webm;codecs=vp9", "video/webm; codecs=vp9"].find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType)
  );
}
