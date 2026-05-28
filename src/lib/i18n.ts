import type { ConversionMode } from "../types";

export type Locale = "en" | "zh";

export const TRANSLATIONS = {
  en: {
    app: {
      brand: "Telegram Sticker Transcoder",
      eyebrow: "VP9 · WEBM · 256 KB",
      heroTitle: "Telegram Sticker Transcoder",
      heroBody: "Batch convert GIF, MP4, MOV, and WEBM files into Telegram-ready WebM stickers or video emoji.",
      constraintsLabel: "Telegram constraints"
    },
    stats: {
      stickerSide: "Sticker long side",
      emojiCanvas: "Emoji canvas",
      duration: "Max duration",
      size: "Size limit"
    },
    modes: {
      heading: "Output Mode",
      stickerDescription: "One side is 512px, the other is 512px or less",
      emojiDescription: "Exactly 100 x 100px",
      stickerSubtitle: "One side 512px",
      emojiSubtitle: "100 x 100px"
    },
    rules: {
      vp9Label: "VP9 WebM",
      vp9Value: "Audio removed",
      fpsLabel: "Up to 30 FPS",
      fpsValue: "Auto downshift",
      sizeLabel: "Target size"
    },
    upload: {
      title: "Drop files here or click to choose",
      currentMode: (label: string) => `New files use: ${label}`
    },
    queue: {
      eyebrow: "Batch Queue",
      title: "Conversion Queue",
      empty: "Queue is empty"
    },
    actions: {
      start: "Start",
      pause: "Pause",
      cancel: "Cancel",
      zip: "ZIP",
      clearFinished: "Clear finished items",
      download: "Download",
      remove: "Remove"
    },
    table: {
      file: "File",
      mode: "Mode",
      status: "Status",
      output: "Output",
      preview: "Preview",
      actions: "Actions"
    },
    status: {
      queued: "Pending",
      processing: (progress: number) => `${progress}%`,
      done: "Done",
      failed: "Failed",
      cancelled: "Cancelled"
    },
    output: {
      pending: "Waiting to process",
      separator: "; "
    },
    attempts: {
      canvasVp9: "Browser Canvas VP9",
      transparentPadding: "transparent padding",
      blackPadding: "black padding",
      transparentFallback: "transparent padding failed; used black padding",
      encodingFailed: "encoding failed"
    },
    warnings: {
      keptLast: "Could not compress below 256 KB; kept the last result",
      keptSmallest: "Could not compress below 256 KB; kept the smallest result"
    },
    validation: {
      fileTooLarge: (size: string) => `File size ${size} exceeds 256 KB`,
      durationTooLong: "Duration exceeds 3 seconds",
      emojiDimensions: (width: number, height: number) =>
        `Emoji size is ${width} x ${height}; it must be 100 x 100`,
      stickerDimensions: (width: number, height: number) =>
        `Sticker size is ${width} x ${height}; one side must be exactly 512px`
    },
    errors: {
      transcodeFailed: "Transcoding failed",
      noVp9Recorder: "This browser does not support VP9 MediaRecorder",
      outputMetadataReadFailed: "Could not read output video metadata",
      browserCannotDecode: "The browser cannot decode this input file",
      canvasContextFailed: "Could not create a Canvas rendering context",
      gifFrameDecodeUnsupported: "This browser cannot decode GIF frames",
      gifLoadFailed: "The browser cannot load this GIF",
      videoPlayFailed: "The browser cannot play this input file",
      vp9RecordFailed: "Browser VP9 recording failed",
      unknown: "Unknown error",
      ffmpegNoDetailedLogs: "FFmpeg did not return detailed logs",
      canvasPathFailed: (message: string) => `Browser recording path failed: ${message}; `,
      allFfmpegAttemptsFailed: (prefix: string, logs: string) =>
        `${prefix}All FFmpeg encoding attempts failed${logs ? `: ${logs}` : ""}`,
      webmFinalizeFailed: (details: string) => `WebM container finalization failed: ${details}`,
      webmRetryFailed: (retryMessage: string, firstError: string) =>
        `${retryMessage}; restarted FFmpeg and retried once. First error: ${firstError}`,
      ffmpegManifestLoadFailed: "Could not load the FFmpeg WASM chunk manifest",
      ffmpegChunkLoadFailed: (file: string) => `Could not load FFmpeg WASM chunk: ${file}`,
      ffmpegChunkSizeMismatch: (file: string) => `FFmpeg WASM chunk size mismatch: ${file}`,
      ffmpegWasmMergeMismatch: "Merged FFmpeg WASM chunk size mismatch",
      invalidGif: "Not a valid GIF file",
      malformedGif: "Malformed GIF data"
    }
  },
  zh: {
    app: {
      brand: "Telegram Sticker Transcoder",
      eyebrow: "VP9 · WEBM · 256 KB",
      heroTitle: "Telegram 贴纸转码工具",
      heroBody: "批量把 GIF、MP4、MOV、WEBM 转成 Telegram 贴纸或视频 emoji 可上传的 WebM 文件。",
      constraintsLabel: "Telegram 约束"
    },
    stats: {
      stickerSide: "Sticker 长边",
      emojiCanvas: "Emoji 画布",
      duration: "最长时长",
      size: "文件上限"
    },
    modes: {
      heading: "输出模式",
      stickerDescription: "一边 512px，另一边不超过 512px",
      emojiDescription: "精确 100 x 100px",
      stickerSubtitle: "一边 512px",
      emojiSubtitle: "100 x 100px"
    },
    rules: {
      vp9Label: "VP9 WebM",
      vp9Value: "自动移除音频",
      fpsLabel: "最高 30 FPS",
      fpsValue: "超限自动降档",
      sizeLabel: "目标体积"
    },
    upload: {
      title: "拖入文件或点击选择",
      currentMode: (label: string) => `当前新文件模式：${label}`
    },
    queue: {
      eyebrow: "Batch Queue",
      title: "转码队列",
      empty: "队列为空"
    },
    actions: {
      start: "开始",
      pause: "暂停",
      cancel: "取消",
      zip: "ZIP",
      clearFinished: "清理完成项",
      download: "下载",
      remove: "移除"
    },
    table: {
      file: "文件",
      mode: "模式",
      status: "状态",
      output: "输出",
      preview: "预览",
      actions: "操作"
    },
    status: {
      queued: "等待",
      processing: (progress: number) => `${progress}%`,
      done: "完成",
      failed: "失败",
      cancelled: "已取消"
    },
    output: {
      pending: "等待处理",
      separator: "；"
    },
    attempts: {
      canvasVp9: "浏览器 Canvas VP9",
      transparentPadding: "透明留边",
      blackPadding: "黑色留边",
      transparentFallback: "透明留边失败，已回退黑色留边",
      encodingFailed: "编码失败"
    },
    warnings: {
      keptLast: "未能压缩到 256 KB 以下，保留最后一次结果",
      keptSmallest: "未能压缩到 256 KB 以下，保留体积最小的结果"
    },
    validation: {
      fileTooLarge: (size: string) => `文件大小 ${size} 超过 256 KB`,
      durationTooLong: "时长超过 3 秒",
      emojiDimensions: (width: number, height: number) =>
        `Emoji 尺寸为 ${width} x ${height}，需要 100 x 100`,
      stickerDimensions: (width: number, height: number) =>
        `Sticker 尺寸为 ${width} x ${height}，需要一边正好 512px`
    },
    errors: {
      transcodeFailed: "转码失败",
      noVp9Recorder: "当前浏览器不支持 VP9 MediaRecorder",
      outputMetadataReadFailed: "输出视频元数据读取失败",
      browserCannotDecode: "浏览器无法解码该输入文件",
      canvasContextFailed: "无法创建 Canvas 渲染上下文",
      gifFrameDecodeUnsupported: "当前浏览器无法逐帧解码 GIF",
      gifLoadFailed: "浏览器无法加载 GIF",
      videoPlayFailed: "浏览器无法播放该输入文件",
      vp9RecordFailed: "浏览器 VP9 录制失败",
      unknown: "未知错误",
      ffmpegNoDetailedLogs: "FFmpeg 未返回详细日志",
      canvasPathFailed: (message: string) => `浏览器录制路径失败：${message}；`,
      allFfmpegAttemptsFailed: (prefix: string, logs: string) =>
        `${prefix}所有 FFmpeg 编码尝试均失败${logs ? `：${logs}` : ""}`,
      webmFinalizeFailed: (details: string) => `WebM 容器整理失败：${details}`,
      webmRetryFailed: (retryMessage: string, firstError: string) =>
        `${retryMessage}；已重启 FFmpeg 后重试一次，首次错误：${firstError}`,
      ffmpegManifestLoadFailed: "无法加载 FFmpeg WASM 分片清单",
      ffmpegChunkLoadFailed: (file: string) => `无法加载 FFmpeg WASM 分片：${file}`,
      ffmpegChunkSizeMismatch: (file: string) => `FFmpeg WASM 分片大小异常：${file}`,
      ffmpegWasmMergeMismatch: "FFmpeg WASM 分片合并大小异常",
      invalidGif: "不是有效 GIF 文件",
      malformedGif: "GIF 数据结构异常"
    }
  }
};

export type Translations = typeof TRANSLATIONS.en;

export function detectLocale(languages?: readonly string[]): Locale {
  const languageList =
    languages ??
    (typeof navigator === "undefined"
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean));

  return languageList.some((language) => language.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

export function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale];
}

export function getModeDescription(mode: ConversionMode, locale: Locale): string {
  const text = getTranslations(locale);
  return mode === "sticker" ? text.modes.stickerDescription : text.modes.emojiDescription;
}
