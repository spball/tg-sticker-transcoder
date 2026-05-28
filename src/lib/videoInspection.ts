import type { VideoInspection } from "../types";
import { detectLocale, getTranslations } from "./i18n";

export function inspectVideoBlob(blob: Blob): Promise<VideoInspection> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const inspection: VideoInspection = {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : 0
      };
      cleanup();
      resolve(inspection);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error(getTranslations(detectLocale()).errors.outputMetadataReadFailed));
    };
    video.src = url;
  });
}
