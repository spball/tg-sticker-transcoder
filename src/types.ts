export type ConversionMode = "sticker" | "emoji";

export type JobStatus =
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export interface EncodingAttempt {
  bitrateKbps: number;
  fps: number;
  sizeBytes?: number;
  ok: boolean;
  note: string;
}

export interface TranscodePreset {
  mode: ConversionMode;
  label: string;
  maxDurationSeconds: number;
  maxSizeBytes: number;
  maxFps: number;
  targetDescription: string;
}

export interface VideoInspection {
  width: number;
  height: number;
  durationSeconds: number;
}

export interface TranscodeResult {
  blob: Blob;
  outputName: string;
  attempts: EncodingAttempt[];
  inspection?: VideoInspection;
  warnings: string[];
}

export interface BatchJob {
  id: string;
  file: File;
  mode: ConversionMode;
  status: JobStatus;
  progress: number;
  sourceUrl: string;
  outputUrl?: string;
  outputBlob?: Blob;
  outputName?: string;
  attempts: EncodingAttempt[];
  warning?: string;
  error?: string;
  inspection?: VideoInspection;
}
