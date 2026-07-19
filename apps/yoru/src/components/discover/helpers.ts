import type { DiscoverFacet, DiscoverWorkSummary, TrackNode } from "@/lib/api";
import type { CoverColor } from "@/components/ui";

/* ─────────────────────────────────────────────────────────────
   发现页纯逻辑:URL search 状态、筛选组合、导出查询、facet 兜底
   ───────────────────────────────────────────────────────────── */

export const DISCOVER_ORDERS = [
  { id: "dl_count", label: "下载量" },
  { id: "release", label: "发售时间" },
  { id: "rate_average_2dp", label: "评分" },
  { id: "review_count", label: "评论数" },
  { id: "price", label: "价格" },
] as const;

export type DiscoverOrder = (typeof DISCOVER_ORDERS)[number]["id"];

/** 后端 page_size 上限 48(计划 §1) */
export const DISCOVER_PAGE_SIZES = [12, 24, 48] as const;

export type DiscoverUrlState = {
  q: string;
  tags: string[];
  circle: string;
  va: string;
  subtitle: boolean;
  order: DiscoverOrder;
  sort: "asc" | "desc";
  pageSize: number;
  page: number;
  /** 选中详情的作品 RJ(桌面侧栏 / 移动全屏浮层共用) */
  work?: string;
};

export const DEFAULT_DISCOVER_URL: DiscoverUrlState = {
  q: "",
  tags: [],
  circle: "",
  va: "",
  subtitle: false,
  order: "dl_count",
  sort: "desc",
  pageSize: 24,
  page: 1,
  work: undefined,
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

/** 逗号/换行分隔多值(原型 dc.html:622 splitTags,兼容中文逗号) */
export function splitTags(raw: string): string[] {
  return raw
    .split(/[,，\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function asOrder(v: unknown): DiscoverOrder {
  const s = asString(v);
  return (DISCOVER_ORDERS.find((o) => o.id === s)?.id ?? "dl_count") as DiscoverOrder;
}

function asPageSize(v: unknown): number {
  const n = Number(asString(v));
  return (DISCOVER_PAGE_SIZES as readonly number[]).includes(n) ? n : 24;
}

function asPage(v: unknown): number {
  const n = Math.floor(Number(asString(v)));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** useSearch({strict:false}) 的原始 search → 规范状态(刷新/分享保持) */
export function parseDiscoverSearch(raw: Record<string, unknown>): DiscoverUrlState {
  return {
    q: asString(raw.q).trim(),
    tags: splitTags(asString(raw.tags)),
    circle: asString(raw.circle).trim(),
    va: asString(raw.va).trim(),
    subtitle: raw.subtitle === "1" || raw.subtitle === 1 || raw.subtitle === true,
    order: asOrder(raw.order),
    sort: asString(raw.sort) === "asc" ? "asc" : "desc",
    pageSize: asPageSize(raw.page_size),
    page: asPage(raw.page),
    work: asString(raw.work).trim() || undefined,
  };
}

/** 规范状态 → URL search(默认值省略,保持 URL 干净) */
export function toDiscoverSearch(state: DiscoverUrlState): Record<string, unknown> {
  return {
    ...(state.q ? { q: state.q } : {}),
    ...(state.tags.length ? { tags: state.tags.join(",") } : {}),
    ...(state.circle ? { circle: state.circle } : {}),
    ...(state.va ? { va: state.va } : {}),
    ...(state.subtitle ? { subtitle: "1" } : {}),
    ...(state.order !== DEFAULT_DISCOVER_URL.order ? { order: state.order } : {}),
    ...(state.sort !== DEFAULT_DISCOVER_URL.sort ? { sort: state.sort } : {}),
    ...(state.pageSize !== DEFAULT_DISCOVER_URL.pageSize
      ? { page_size: String(state.pageSize) }
      : {}),
    ...(state.page > 1 ? { page: String(state.page) } : {}),
    ...(state.work ? { work: state.work } : {}),
  };
}

/** 高级语法模式:查询里含 $(原型 dc.html:625 legacy 判定) */
export function isAdvancedQuery(q: string): boolean {
  return q.includes("$");
}

/**
 * 导出/入队的组合查询(任务约定):q 原样 + 非空 tags/circle/va 逐个拼
 * `$tag:x$ $circle:y$ $va:z$`(asmr.one 高级查询语法)。
 */
export function buildExportQuery(state: DiscoverUrlState): string {
  const parts: string[] = [];
  if (state.q) parts.push(state.q);
  for (const tag of state.tags) parts.push(`$tag:${tag}$`);
  if (state.circle) parts.push(`$circle:${state.circle}$`);
  if (state.va) parts.push(`$va:${state.va}$`);
  return parts.join(" ").trim();
}

/** searchWorks(高级模式)无 facets 时按本页 items 客户端聚合(旧 Discover.tsx 同款) */
export function buildFacetsFromItems(items: DiscoverWorkSummary[]): {
  tags: DiscoverFacet[];
  circles: DiscoverFacet[];
  vas: DiscoverFacet[];
} {
  return {
    tags: buildFacetList(items.flatMap((w) => w.tags), 12),
    circles: buildFacetList(items.map((w) => w.circle), 8),
    vas: buildFacetList(items.flatMap((w) => w.vas), 8),
  };
}

function buildFacetList(values: string[], limit: number): DiscoverFacet[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = raw.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.count === b.count ? a.value.localeCompare(b.value) : b.count - a.count))
    .slice(0, limit);
}

/** 无封面时按 source_id 稳定取 4 色占位之一 */
export function coverColorFor(id: string): CoverColor {
  const colors: CoverColor[] = ["lav", "rose", "blue", "plum"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

/** track id → 文件大小(后端 Track.size;TS TrackNode 未声明,走宽松读取) */
export function trackSizeMap(nodes: TrackNode[]): Map<string, number> {
  const map = new Map<string, number>();
  const visit = (n: TrackNode) => {
    const size = (n as TrackNode & { size?: unknown }).size;
    if (n.id && typeof size === "number" && size > 0) map.set(n.id, size);
    n.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return map;
}

/** 字节 → 人类可读(详情音轨行的「大小」列) */
export function formatSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** 触发浏览器下载(exportSearch 的 blob 已带 filename) */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
