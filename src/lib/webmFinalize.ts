import { getFFmpegRuntime, getRecentFFmpegLogs } from "./ffmpegRuntime";

interface FinalizeOptions {
  bitrateKbps: number;
  fps: number;
}

export async function finalizeWebmContainer(blob: Blob, options: FinalizeOptions): Promise<Blob> {
  const ffmpeg = await getFFmpegRuntime();
  const inputName = `mediarecorder-${crypto.randomUUID()}.webm`;
  const remuxOutputName = `final-${crypto.randomUUID()}.webm`;
  const reencodeOutputName = `reencoded-${crypto.randomUUID()}.webm`;

  await ffmpeg.writeFile(inputName, new Uint8Array(await blob.arrayBuffer()));

  try {
    const remuxResult = await ffmpeg.exec([
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

    if (remuxResult === 0) {
      const data = await ffmpeg.readFile(remuxOutputName);
      return new Blob([toBlobPart(data)], { type: "video/webm" });
    }

    const reencodeResult = await ffmpeg.exec([
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

    if (reencodeResult !== 0) {
      throw new Error(`WebM 容器整理失败：${getRecentFFmpegLogs() || "FFmpeg 未返回详细日志"}`);
    }

    const data = await ffmpeg.readFile(reencodeOutputName);
    return new Blob([toBlobPart(data)], { type: "video/webm" });
  } finally {
    await safeDelete(inputName);
    await safeDelete(remuxOutputName);
    await safeDelete(reencodeOutputName);
  }
}

async function safeDelete(fileName: string): Promise<void> {
  try {
    const ffmpeg = await getFFmpegRuntime();
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
