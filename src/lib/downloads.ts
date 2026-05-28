import JSZip from "jszip";
import type { BatchJob } from "../types";

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadZip(jobs: BatchJob[]): Promise<void> {
  const zip = new JSZip();
  for (const job of jobs) {
    if (job.outputBlob && job.outputName) {
      zip.file(job.outputName, job.outputBlob);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "telegram-stickers-webm.zip");
}
