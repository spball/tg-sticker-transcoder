import { describe, expect, it } from "vitest";
import {
  buildVideoFilter,
  computeStickerDimensions,
  getCompressionLadder,
  getOutputName,
  sanitizeFileName,
  TELEGRAM_MAX_BYTES,
  validateInspection
} from "./presets";
import { parseGifInfo } from "./gif";

describe("preset helpers", () => {
  it("creates a stable compression ladder under 30 fps", () => {
    const ladder = getCompressionLadder("sticker");

    expect(ladder[0].bitrateKbps).toBeGreaterThan(ladder.at(-1)?.bitrateKbps ?? 0);
    expect(ladder.every((step) => step.fps <= 30)).toBe(true);
    expect(ladder.some((step) => step.fps === 12)).toBe(true);
  });

  it("raises bitrate for short sources to use more of the 256 KB budget", () => {
    const longSticker = getCompressionLadder("sticker", 3000);
    const shortSticker = getCompressionLadder("sticker", 650);

    expect(shortSticker[0].bitrateKbps).toBeGreaterThan(longSticker[0].bitrateKbps * 3);
    expect(shortSticker[0].bitrateKbps).toBeLessThanOrEqual(5200);
  });

  it("calculates sticker dimensions with one exact 512px side", () => {
    expect(computeStickerDimensions(1920, 1080)).toEqual({ width: 512, height: 288 });
    expect(computeStickerDimensions(720, 1280)).toEqual({ width: 288, height: 512 });
    expect(computeStickerDimensions(800, 800)).toEqual({ width: 512, height: 512 });
  });

  it("sanitizes output names", () => {
    expect(sanitizeFileName("My Sticker 01!!.mp4")).toBe("My-Sticker-01");
    expect(sanitizeFileName("猫猫 动图!!.gif")).toBe("猫猫-动图");
    expect(getOutputName("猫猫.gif", "emoji")).toBe("猫猫-emoji.webm");
  });

  it("builds mode-specific filters", () => {
    expect(buildVideoFilter("sticker", true)).toContain("512");
    expect(buildVideoFilter("emoji", true)).toContain("pad=100:100");
    expect(buildVideoFilter("emoji", false)).toContain("color=black");
  });

  it("validates telegram constraints", () => {
    expect(
      validateInspection("emoji", { width: 100, height: 100, durationSeconds: 2.9 }, TELEGRAM_MAX_BYTES)
    ).toEqual([]);

    expect(
      validateInspection("sticker", { width: 511, height: 512, durationSeconds: 3.3 }, TELEGRAM_MAX_BYTES + 1, "zh")
    ).toEqual(expect.arrayContaining(["时长超过 3 秒"]));
  });

  it("parses GIF metadata needed by the canvas recorder", () => {
    const bytes = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00,
      0x21, 0xf9, 0x04, 0x00, 0x05, 0x00, 0x00, 0x00,
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00,
      0x3b
    ]);

    expect(parseGifInfo(bytes)).toEqual({
      width: 2,
      height: 3,
      durationMs: 50,
      frames: 1
    });
  });
});
