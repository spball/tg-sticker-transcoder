import { getFFmpegRuntime } from "./ffmpegRuntime";

export async function finalizeWebmContainer(blob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpegRuntime();
  const inputName = `mediarecorder-${crypto.randomUUID()}.webm`;
  const outputName = `final-${crypto.randomUUID()}.webm`;

  await ffmpeg.writeFile(inputName, new Uint8Array(await blob.arrayBuffer()));

  try {
    const result = await ffmpeg.exec([
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
      outputName
    ]);

    if (result !== 0) {
      throw new Error("WebM 容器整理失败");
    }

    const data = await ffmpeg.readFile(outputName);
    return new Blob([toBlobPart(data)], { type: "video/webm" });
  } finally {
    await safeDelete(inputName);
    await safeDelete(outputName);
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
