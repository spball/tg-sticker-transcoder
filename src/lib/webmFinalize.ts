import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  clearRecentFFmpegLogs,
  getFFmpegRuntime,
  getRecentFFmpegLogs,
  restartFFmpegRuntime
} from "./ffmpegRuntime";
import { getTranslations, type Locale } from "./i18n";

interface FinalizeOptions {
  bitrateKbps: number;
  fps: number;
  locale?: Locale;
}

export async function finalizeWebmContainer(blob: Blob, options: FinalizeOptions): Promise<Blob> {
  const text = getTranslations(options.locale ?? "en");
  try {
    return await finalizeWebmContainerOnce(blob, options);
  } catch (error) {
    const firstError = error instanceof Error ? error.message : text.errors.unknown;
    restartFFmpegRuntime();

    try {
      return await finalizeWebmContainerOnce(blob, options);
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : text.errors.unknown;
      throw new Error(text.errors.webmRetryFailed(retryMessage, firstError));
    }
  }
}

async function finalizeWebmContainerOnce(blob: Blob, options: FinalizeOptions): Promise<Blob> {
  const text = getTranslations(options.locale ?? "en");
  const ffmpeg = await getFFmpegRuntime();
  const inputName = `mediarecorder-${crypto.randomUUID()}.webm`;
  const remuxOutputName = `final-${crypto.randomUUID()}.webm`;
  const reencodeOutputName = `reencoded-${crypto.randomUUID()}.webm`;

  await ffmpeg.writeFile(inputName, new Uint8Array(await blob.arrayBuffer()));

  try {
    clearRecentFFmpegLogs();
    let remuxResult = -1;
    let remuxFailure = "";
    try {
      remuxResult = await ffmpeg.exec([
        "-hide_banner",
        "-y",
        "-i",
        inputName,
        "-map",
        "0:v:0",
        "-an",
        "-c:v",
        "copy",
        "-f",
        "webm",
        remuxOutputName
      ]);
      remuxFailure = getRecentFFmpegLogs();
    } catch (error) {
      remuxFailure = error instanceof Error ? error.message : String(error);
    }

    if (remuxResult === 0) {
      const data = await ffmpeg.readFile(remuxOutputName);
      return new Blob([toBlobPart(data)], { type: "video/webm" });
    }

    clearRecentFFmpegLogs();
    let reencodeResult = -1;
    let reencodeFailure = "";
    try {
      reencodeResult = await ffmpeg.exec([
        "-hide_banner",
        "-y",
        "-i",
        inputName,
        "-map",
        "0:v:0",
        "-an",
        "-vf",
        `fps=${options.fps}`,
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        `${options.bitrateKbps}k`,
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-pix_fmt",
        "yuv420p",
        "-f",
        "webm",
        reencodeOutputName
      ]);
      reencodeFailure = getRecentFFmpegLogs();
    } catch (error) {
      reencodeFailure = error instanceof Error ? error.message : String(error);
    }

    if (reencodeResult !== 0) {
      throw new Error(
        text.errors.webmFinalizeFailed(reencodeFailure || remuxFailure || text.errors.ffmpegNoDetailedLogs)
      );
    }

    const data = await ffmpeg.readFile(reencodeOutputName);
    return new Blob([toBlobPart(data)], { type: "video/webm" });
  } finally {
    await safeDelete(ffmpeg, inputName);
    await safeDelete(ffmpeg, remuxOutputName);
    await safeDelete(ffmpeg, reencodeOutputName);
  }
}

async function safeDelete(ffmpeg: FFmpeg, fileName: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(fileName);
  } catch {
    // Ignore virtual filesystem cleanup failures.
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
