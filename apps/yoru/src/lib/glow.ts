/**
 * 封面主色 → 环境光晕色板(纯函数,无 DOM 依赖,可单测)。
 * 三层:computeGlowColor(canvas 像素 → 主色)/ glowPalette(主色 → 4 色板)/
 * hashGlowColor(取色失败时的稳定散列回退,同一作品恒同色)。
 */

/** RGBA 扁平像素 → 主色 hsl():饱和度加权平均,亮度钳制到夜间可读区间 */
export function computeGlowColor(pixels: ArrayLike<number>): string | null {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let wSum = 0;
  const count = Math.floor(pixels.length / 4);
  for (let i = 0; i < count; i += 1) {
    const alpha = pixels[i * 4 + 3] / 255;
    if (alpha < 0.5) continue;
    const r = pixels[i * 4] / 255;
    const g = pixels[i * 4 + 1] / 255;
    const b = pixels[i * 4 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const saturation =
      max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
    // 高饱和像素权重高,灰像素保留基础权重(封面常有大量暗部)
    const weight = (0.25 + saturation) * alpha;
    rSum += r * weight;
    gSum += g * weight;
    bSum += b * weight;
    wSum += weight;
  }
  if (wSum === 0) return null;
  const [h, s, l] = rgbToHsl(rSum / wSum, gSum / wSum, bSum / wSum);
  // 饱和度兜底 25%(死灰也要有夜色),亮度钳制 32–68%(不死黑不惨白)
  const sat = clamp(Math.round(s * 100), 25, 85);
  const lig = clamp(Math.round(l * 100), 32, 68);
  return `hsl(${Math.round(h)} ${sat}% ${lig}%)`;
}

/** 主色 → MeshGradient 4 色板:深处过渡 + 主色 + 两侧色相偏移 */
export function glowPalette(base: string): string[] {
  const parsed = parseHsl(base);
  const h = parsed?.[0] ?? 262;
  const s = parsed?.[1] ?? 55;
  const l = (v: number) => clamp(Math.round(v), 18, 72);
  return [
    `hsl(${h} ${s}% ${l(24)}%)`,
    `hsl(${h} ${s}% ${l(48)}%)`,
    `hsl(${(h + 28) % 360} ${Math.max(22, s - 8)}% ${l(58)}%)`,
    `hsl(${(h + 332) % 360} ${Math.max(22, s - 4)}% ${l(40)}%)`,
  ];
}

const FALLBACK_HUES: ReadonlyArray<readonly [number, number, number]> = [
  [262, 55, 55], // lav 紫
  [330, 52, 60], // 粉
  [212, 52, 55], // 蓝
  [160, 40, 45], // 绿
];

/** 散列回退色(封面取色失败/无封面时;与占位封面同思路的稳定 4 色) */
export function hashGlowColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const [h, s, l] = FALLBACK_HUES[Math.abs(hash) % FALLBACK_HUES.length];
  return `hsl(${h} ${s}% ${l}%)`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** "hsl(262 55% 48%)" → [262, 55, 48];解析不了返回 null */
export function parseHsl(input: string): [number, number, number] | null {
  const match = /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/.exec(input);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return [h, s, l];
}
