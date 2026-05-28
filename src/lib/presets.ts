import type {
  ConversionMode,
  EncodingAttempt,
  TranscodePreset,
  VideoInspection
} from "../types";
import { getTranslations, type Locale } from "./i18n";

export const TELEGRAM_MAX_BYTES = 256 * 1024;
export const TELEGRAM_MAX_DURATION_SECONDS = 3;

export const PRESETS: Record<ConversionMode, TranscodePreset> = {
  sticker: {
    mode: "sticker",
    label: "Sticker",
    maxDurationSeconds: TELEGRAM_MAX_DURATION_SECONDS,
    maxSizeBytes: TELEGRAM_MAX_BYTES,
    maxFps: 30,
    targetDescription: "One side is 512px, the other is 512px or less"
  },
  emoji: {
    mode: "emoji",
    label: "Emoji",
    maxDurationSeconds: TELEGRAM_MAX_DURATION_SECONDS,
    maxSizeBytes: TELEGRAM_MAX_BYTES,
    maxFps: 30,
    targetDescription: "Exactly 100 x 100px"
  }
};

export interface CompressionStep {
  bitrateKbps: number;
  fps: number;
}

export interface StickerDimensions {
  width: number;
  height: number;
}

export function getCompressionLadder(
  mode: ConversionMode,
  durationMs = TELEGRAM_MAX_DURATION_SECONDS * 1000
): CompressionStep[] {
  const durationSeconds = Math.max(0.12, Math.min(TELEGRAM_MAX_DURATION_SECONDS, durationMs / 1000));
  const targetKbps = (TELEGRAM_MAX_BYTES * 8 * 0.94) / durationSeconds / 1000;
  const minBitrate = mode === "emoji" ? 45 : 120;
  const maxBitrate = mode === "emoji" ? 1800 : 5200;
  const baseBitrate = clampBitrate(targetKbps, minBitrate, maxBitrate);

  return uniqueCompressionSteps([
    { bitrateKbps: clampBitrate(baseBitrate * 1.44, minBitrate, maxBitrate), fps: 30 },
    { bitrateKbps: clampBitrate(baseBitrate * 1.16, minBitrate, maxBitrate), fps: 30 },
    { bitrateKbps: baseBitrate, fps: 30 },
    { bitrateKbps: clampBitrate(baseBitrate * 0.84, minBitrate, maxBitrate), fps: 30 },
    { bitrateKbps: clampBitrate(baseBitrate * 0.68, minBitrate, maxBitrate), fps: 24 },
    { bitrateKbps: clampBitrate(baseBitrate * 0.52, minBitrate, maxBitrate), fps: 20 },
    { bitrateKbps: clampBitrate(baseBitrate * 0.38, minBitrate, maxBitrate), fps: 15 },
    { bitrateKbps: clampBitrate(baseBitrate * 0.26, minBitrate, maxBitrate), fps: 12 },
    { bitrateKbps: minBitrate, fps: 12 }
  ]);
}

export function computeStickerDimensions(width: number, height: number): StickerDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Video dimensions must be positive numbers");
  }

  if (width >= height) {
    return {
      width: 512,
      height: clampEven(Math.round((height / width) * 512))
    };
  }

  return {
    width: clampEven(Math.round((width / height) * 512)),
    height: 512
  };
}

export function sanitizeFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const safe = withoutExtension
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return safe || "telegram-sticker";
}

export function getOutputName(fileName: string, mode: ConversionMode): string {
  return `${sanitizeFileName(fileName)}-${mode}.webm`;
}

export function buildVideoFilter(mode: ConversionMode, transparentPadding: boolean): string {
  if (mode === "emoji") {
    const color = transparentPadding ? "0x00000000" : "black";
    return [
      "scale=w='if(gte(iw,ih),100,max(2,trunc(iw*100/ih/2)*2))':h='if(gte(iw,ih),max(2,trunc(ih*100/iw/2)*2),100)'",
      `pad=100:100:(ow-iw)/2:(oh-ih)/2:color=${color}`
    ].join(",");
  }

  return "scale=w='if(gte(iw,ih),512,max(2,trunc(iw*512/ih/2)*2))':h='if(gte(iw,ih),max(2,trunc(ih*512/iw/2)*2),512)'";
}

export function validateInspection(
  mode: ConversionMode,
  inspection: VideoInspection,
  sizeBytes: number,
  locale: Locale = "en"
): string[] {
  const messages: string[] = [];
  const text = getTranslations(locale);

  if (sizeBytes > TELEGRAM_MAX_BYTES) {
    messages.push(text.validation.fileTooLarge(formatBytes(sizeBytes)));
  }

  if (inspection.durationSeconds > TELEGRAM_MAX_DURATION_SECONDS + 0.12) {
    messages.push(text.validation.durationTooLong);
  }

  if (mode === "emoji") {
    if (inspection.width !== 100 || inspection.height !== 100) {
      messages.push(text.validation.emojiDimensions(inspection.width, inspection.height));
    }
    return messages;
  }

  const maxSide = Math.max(inspection.width, inspection.height);
  const minSide = Math.min(inspection.width, inspection.height);
  if (maxSide !== 512 || minSide > 512) {
    messages.push(text.validation.stickerDimensions(inspection.width, inspection.height));
  }

  return messages;
}

export function summarizeAttempts(attempts: EncodingAttempt[]): string {
  return attempts
    .map((attempt) => {
      const size = attempt.sizeBytes ? `, ${formatBytes(attempt.sizeBytes)}` : "";
      return `${attempt.bitrateKbps}kbps/${attempt.fps}fps${size}`;
    })
    .join(" -> ");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function clampEven(value: number): number {
  const rounded = Math.max(2, Math.min(512, value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function clampBitrate(value: number, minBitrate: number, maxBitrate: number): number {
  const rounded = value >= 1000 ? Math.round(value / 50) * 50 : Math.round(value / 10) * 10;
  return Math.max(minBitrate, Math.min(maxBitrate, rounded));
}

function uniqueCompressionSteps(steps: CompressionStep[]): CompressionStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.bitrateKbps}:${step.fps}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
