import { describe, expect, it } from "vitest";
import { computeGlowColor, glowPalette, hashGlowColor, parseHsl } from "./glow";

/** 造 RGBA 扁平像素数组 */
function pixels(colors: Array<[number, number, number]>, alpha = 255): number[] {
  const out: number[] = [];
  for (const [r, g, b] of colors) out.push(r, g, b, alpha);
  return out;
}

describe("computeGlowColor(像素 → 主色)", () => {
  it("纯色像素 → 同色;亮度钳制在 32–68% 区间", () => {
    const c = computeGlowColor(pixels([[200, 60, 120]]));
    expect(c).not.toBeNull();
    const [h, s, l] = parseHsl(c!)!;
    expect(h).toBeGreaterThan(320);
    expect(s).toBeGreaterThanOrEqual(25);
    expect(l).toBeGreaterThanOrEqual(32);
    expect(l).toBeLessThanOrEqual(68);
  });

  it("高饱和像素权重大于灰像素", () => {
    // 大量中灰 + 少量纯红 → 主色应偏红而非灰
    const mixed = pixels([
      ...Array.from({ length: 90 }, (): [number, number, number] => [120, 120, 120]),
      ...Array.from({ length: 10 }, (): [number, number, number] => [230, 30, 30]),
    ]);
    const [, s] = parseHsl(computeGlowColor(mixed)!)!;
    expect(s).toBeGreaterThanOrEqual(25);
  });

  it("近黑像素亮度被钳到 32%,死灰像素饱和度兜底 25%", () => {
    const dark = computeGlowColor(pixels([[8, 8, 12]]));
    expect(parseHsl(dark!)![2]).toBe(32);
    const gray = computeGlowColor(pixels([[100, 100, 100]]));
    expect(parseHsl(gray!)![1]).toBe(25);
  });

  it("全透明/空像素 → null", () => {
    expect(computeGlowColor(pixels([[10, 20, 30]], 0))).toBeNull();
    expect(computeGlowColor([])).toBeNull();
  });
});

describe("glowPalette(主色 → 4 色板)", () => {
  it("返回 4 个合法 hsl,首尾同族、中间带色相偏移", () => {
    const palette = glowPalette("hsl(262 55% 48%)");
    expect(palette).toHaveLength(4);
    for (const c of palette) expect(parseHsl(c)).not.toBeNull();
    expect(parseHsl(palette[0])![0]).toBe(262);
    expect(parseHsl(palette[1])![0]).toBe(262);
    expect(parseHsl(palette[2])![0]).toBe(290);
    expect(parseHsl(palette[3])![0]).toBe(234);
  });

  it("非法输入回退到 lav 紫色族", () => {
    expect(parseHsl(glowPalette("not-a-color")[0])![0]).toBe(262);
  });
});

describe("hashGlowColor(散列回退)", () => {
  it("同一 seed 恒同色;不同 seed 可能不同色;颜色合法", () => {
    expect(hashGlowColor("RJ001")).toBe(hashGlowColor("RJ001"));
    expect(parseHsl(hashGlowColor("RJ001"))).not.toBeNull();
    const distinct = new Set(
      ["RJ001", "RJ002", "RJ003", "RJ004", "RJ005"].map((id) => hashGlowColor(id)),
    );
    expect(distinct.size).toBeGreaterThan(1);
  });
});
