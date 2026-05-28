export interface GifInfo {
  width: number;
  height: number;
  durationMs: number;
  frames: number;
}

export async function readGifInfo(file: File): Promise<GifInfo> {
  const data = new Uint8Array(await file.arrayBuffer());
  return parseGifInfo(data);
}

export function parseGifInfo(data: Uint8Array): GifInfo {
  const signature = decodeAscii(data.slice(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a") {
    throw new Error("不是有效 GIF 文件");
  }

  const width = readUint16(data, 6);
  const height = readUint16(data, 8);
  let offset = 13;
  let pendingDelay = 0;
  let durationMs = 0;
  let frames = 0;

  if (data[10] & 0x80) {
    offset += 3 * 2 ** ((data[10] & 0x07) + 1);
  }

  while (offset < data.length) {
    const introducer = data[offset++];

    if (introducer === 0x3b) {
      break;
    }

    if (introducer === 0x21) {
      const label = data[offset++];
      if (label === 0xf9) {
        const blockSize = data[offset++];
        if (blockSize === 4) {
          pendingDelay = readUint16(data, offset + 1) * 10;
        }
        offset += blockSize;
        if (data[offset] === 0) {
          offset += 1;
        }
      } else {
        offset = skipSubBlocks(data, offset);
      }
      continue;
    }

    if (introducer === 0x2c) {
      frames += 1;
      durationMs += pendingDelay || 100;
      pendingDelay = 0;
      const packed = data[offset + 8];
      offset += 9;
      if (packed & 0x80) {
        offset += 3 * 2 ** ((packed & 0x07) + 1);
      }
      offset += 1;
      offset = skipSubBlocks(data, offset);
      continue;
    }

    throw new Error("GIF 数据结构异常");
  }

  return {
    width,
    height,
    durationMs: durationMs || 1000,
    frames
  };
}

function skipSubBlocks(data: Uint8Array, offset: number): number {
  while (offset < data.length) {
    const size = data[offset++];
    if (size === 0) {
      return offset;
    }
    offset += size;
  }
  return offset;
}

function readUint16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function decodeAscii(data: Uint8Array): string {
  return String.fromCharCode(...data);
}
