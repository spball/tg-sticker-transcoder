interface DecodedGifFrame {
  image: ImageBitmap;
  durationMs: number;
}

export interface DecodedGifAnimation {
  frames: DecodedGifFrame[];
  durationMs: number;
}

interface BrowserImageDecoder {
  tracks: {
    ready: Promise<void>;
    selectedTrack?: {
      frameCount?: number;
    };
  };
  decode(options: { frameIndex: number }): Promise<{
    image: {
      duration?: number;
      close?: () => void;
    } & ImageBitmapSource;
  }>;
  close?: () => void;
}

interface BrowserImageDecoderConstructor {
  new (init: { data: BufferSource | ReadableStream<Uint8Array>; type: string }): BrowserImageDecoder;
}

export async function decodeGifAnimation(file: File): Promise<DecodedGifAnimation | undefined> {
  const Decoder = (globalThis as { ImageDecoder?: BrowserImageDecoderConstructor }).ImageDecoder;
  if (!Decoder || !globalThis.createImageBitmap) {
    return undefined;
  }

  const decoder = new Decoder({
    data: await file.arrayBuffer(),
    type: "image/gif"
  });

  try {
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (frameCount < 2) {
      return undefined;
    }

    const frames: DecodedGifFrame[] = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const { image } = await decoder.decode({ frameIndex });
      const bitmap = await createImageBitmap(image);
      const durationMs = Math.max(20, Math.round((image.duration ?? 100_000) / 1000));
      image.close?.();
      frames.push({ image: bitmap, durationMs });
    }

    return {
      frames,
      durationMs: frames.reduce((sum, frame) => sum + frame.durationMs, 0)
    };
  } finally {
    decoder.close?.();
  }
}

export function closeGifAnimation(animation: DecodedGifAnimation): void {
  for (const frame of animation.frames) {
    frame.image.close();
  }
}

export function getGifFrameAt(animation: DecodedGifAnimation, elapsedMs: number): ImageBitmap {
  const boundedElapsed = Math.max(0, Math.min(elapsedMs, animation.durationMs - 1));
  let cursor = 0;

  for (const frame of animation.frames) {
    cursor += frame.durationMs;
    if (boundedElapsed < cursor) {
      return frame.image;
    }
  }

  return animation.frames[animation.frames.length - 1].image;
}
