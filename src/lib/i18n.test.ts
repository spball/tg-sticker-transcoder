import { describe, expect, it } from "vitest";
import { detectLocale } from "./i18n";

describe("i18n locale detection", () => {
  it("defaults to English when no Chinese browser language is present", () => {
    expect(detectLocale([])).toBe("en");
    expect(detectLocale(["en-US", "fr-FR"])).toBe("en");
  });

  it("uses Chinese when any browser language is Chinese", () => {
    expect(detectLocale(["zh-CN", "en-US"])).toBe("zh");
    expect(detectLocale(["en-US", "zh-Hant-TW"])).toBe("zh");
  });
});
