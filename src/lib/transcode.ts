import { fetchFile } from "@ffmpeg/util";
import type { ConversionMode, EncodingAttempt, TranscodeResult } from "../types";
import {
  buildVideoFilter,
  getCompressionLadder,
  getOutputName,
  TELEGRAM_MAX_BYTES,
  validateInspection
} from "./presets";
import {
  clearRecentFFmpegLogs,
  getFFmpegRuntime,
  getRecentFFmpegLogs,
  recycleFFmpegRuntimeAfterJob,
  setActiveProgressHandler
} from "./ffmpegRuntime";
import { getTranslations, type Locale } from "./i18n";
import { inspectVideoBlob } from "./videoInspection";
import { transcodeWithCanvasRecorder } from "./canvasRecorder";

interface TranscodeOptions {
  onProgress?: (progress: number) => void;
  locale?: Locale;
}

interface AttemptResult {
  blob: Blob;
  outputName: string;
  sizeBytes: number;
  usedTransparentPadding: boolean;
}

export async function transcodeFile(
  file: File,
  mode: ConversionMode,
  options: TranscodeOptions = {}
): Promise<TranscodeResult> {
  try {
    return await transcodeFileInternal(file, mode, options);
  } finally {
    recycleFFmpegRuntimeAfterJob();
  }
}

async function transcodeFileInternal(
  file: File,
  mode: ConversionMode,
  options: TranscodeOptions = {}
): Promise<TranscodeResult> {
  const locale = options.locale ?? "en";
  const text = getTranslations(locale);
  let canvasError: unknown;
  if (canTryCanvasRecorder(file)) {
    try {
      return await transcodeWithCanvasRecorder(file, mode, options.onProgress, locale);
    } catch (error) {
      canvasError = error;
      // Fall through to FFmpeg for files the browser cannot decode or record.
    }
  }

  const ffmpeg = await getFFmpegRuntime();
  const inputName = `input-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const outputBaseName = getOutputName(file.name, mode);
  const attempts: EncodingAttempt[] = [];
  const warnings: string[] = [];
  let bestResult: AttemptResult | undefined;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  setActiveProgressHandler((progress) => options.onProgress?.(progress * 0.9));

  try {
    const ladder = getCompressionLadder(mode);

    for (const step of ladder) {
      const result = await runEncodingAttempt({
        inputName,
        outputName: `output-${crypto.randomUUID()}.webm`,
        mode,
        bitrateKbps: step.bitrateKbps,
        fps: step.fps,
        transparentPadding: true
      });

      let finalResult = result;
      let note = result?.usedTransparentPadding ? text.attempts.transparentPadding : text.attempts.blackPadding;

      if (!result && mode === "emoji") {
        finalResult = await runEncodingAttempt({
          inputName,
          outputName: `output-${crypto.randomUUID()}.webm`,
          mode,
          bitrateKbps: step.bitrateKbps,
          fps: step.fps,
          transparentPadding: false
        });
        note = text.attempts.transparentFallback;
      }

      if (!finalResult) {
        attempts.push({
          bitrateKbps: step.bitrateKbps,
          fps: step.fps,
          ok: false,
          note: text.attempts.encodingFailed
        });
        continue;
      }

      if (!bestResult || finalResult.sizeBytes < bestResult.sizeBytes) {
        bestResult = finalResult;
      }

      const ok = finalResult.sizeBytes <= TELEGRAM_MAX_BYTES;
      attempts.push({
        bitrateKbps: step.bitrateKbps,
        fps: step.fps,
        sizeBytes: finalResult.sizeBytes,
        ok,
        note
      });

      if (ok) {
        const output = await finishResult(finalResult.blob, outputBaseName, attempts, warnings, mode, locale);
        options.onProgress?.(1);
        return output;
      }
    }

    if (!bestResult) {
      const canvasMessage = canvasError instanceof Error ? text.errors.canvasPathFailed(canvasError.message) : "";
      const ffmpegLogs = getRecentFFmpegLogs();
      throw new Error(text.errors.allFfmpegAttemptsFailed(canvasMessage, ffmpegLogs));
    }

    warnings.push(text.warnings.keptSmallest);
    return await finishResult(bestResult.blob, outputBaseName, attempts, warnings, mode, locale);
  } finally {
    setActiveProgressHandler(undefined);
    await safeDelete(inputName);
  }
}

function canTryCanvasRecorder(file: File): boolean {
  return (
    file.type === "image/gif" ||
    file.type.startsWith("video/") ||
    /\.(gif|mp4|webm|mov|m4v)$/i.test(file.name)
  );
}

async function finishResult(
  blob: Blob,
  outputName: string,
  attempts: EncodingAttempt[],
  warnings: string[],
  mode: ConversionMode,
  locale: Locale = "en"
): Promise<TranscodeResult> {
  const text = getTranslations(locale);
  try {
    const inspection = await inspectVideoBlob(blob);
    warnings.push(...validateInspection(mode, inspection, blob.size, locale));
    return { blob, outputName, attempts, inspection, warnings };
  } catch {
    warnings.push(text.errors.outputMetadataReadFailed);
    return { blob, outputName, attempts, warnings };
  }
}

async function runEncodingAttempt({
  inputName,
  outputName,
  mode,
  bitrateKbps,
  fps,
  transparentPadding
}: {
  inputName: string;
  outputName: string;
  mode: ConversionMode;
  bitrateKbps: number;
  fps: number;
  transparentPadding: boolean;
}): Promise<AttemptResult | undefined> {
  const ffmpeg = await getFFmpegRuntime();
  const filter = buildVideoFilter(mode, transparentPadding);
  const args = [
    "-hide_banner",
    "-y",
    "-t",
    "3",
    "-i",
    inputName,
    "-map",
    "0:v:0",
    "-an",
    "-vf",
    `${filter},fps=${fps}`,
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    `${bitrateKbps}k`,
    "-deadline",
    "good",
    "-cpu-used",
    "4",
    "-row-mt",
    "1",
    "-pix_fmt",
    mode === "emoji" && transparentPadding ? "yuva420p" : "yuv420p",
    ...(mode === "emoji" && transparentPadding ? ["-auto-alt-ref", "0"] : []),
    outputName
  ];

  try {
    clearRecentFFmpegLogs();
    const result = await ffmpeg.exec(args);
    if (result !== 0) {
      return undefined;
    }
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([toBlobPart(data)], { type: "video/webm" });
    return {
      blob,
      outputName,
      sizeBytes: blob.size,
      usedTransparentPadding: transparentPadding
    };
  } catch {
    return undefined;
  } finally {
    await safeDelete(outputName);
  }
}

function toBlobPart(data: string | Uint8Array): BlobPart {
  if (typeof data === "string") {
    return data;
  }

  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

async function safeDelete(fileName: string): Promise<void> {
  try {
    const ffmpeg = await getFFmpegRuntime();
    await ffmpeg.deleteFile(fileName);
  } catch {
    // Ignore virtual filesystem cleanup failures.
  }
}
