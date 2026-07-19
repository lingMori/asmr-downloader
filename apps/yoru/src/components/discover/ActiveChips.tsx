import { formatCount } from "@/lib/format";
import { DISCOVER_ORDERS, DEFAULT_DISCOVER_URL, type DiscoverUrlState } from "./helpers";

export type ActiveChipsProps = {
  state: DiscoverUrlState;
  /** 高级语法模式下只显示「语法」chip,其余条件不生效(原型 dc.html:682) */
  advanced: boolean;
  total: number;
  selectedCount: number;
  onChange: (patch: Partial<DiscoverUrlState>) => void;
};

type ChipDef = { key: string; label: string; remove: () => void };

/** 激活条件 chips 行(dc.html:112-118 + renderVals 680-689) */
export function ActiveChips({ state, advanced, total, selectedCount, onChange }: ActiveChipsProps) {
  const chips: ChipDef[] = [];
  if (state.q) {
    chips.push({
      key: "q",
      label: `${advanced ? "语法" : "关键词"}: ${state.q}`,
      remove: () => onChange({ q: "" }),
    });
  }
  if (!advanced) {
    for (const tag of state.tags) {
      chips.push({
        key: `tag:${tag}`,
        label: `标签: ${tag}`,
        remove: () => onChange({ tags: state.tags.filter((t) => t !== tag) }),
      });
    }
    if (state.circle) {
      chips.push({
        key: "circle",
        label: `社团: ${state.circle}`,
        remove: () => onChange({ circle: "" }),
      });
    }
    if (state.va) {
      chips.push({ key: "va", label: `声优: ${state.va}`, remove: () => onChange({ va: "" }) });
    }
    if (state.subtitle) {
      chips.push({
        key: "subtitle",
        label: "仅字幕作品",
        remove: () => onChange({ subtitle: false }),
      });
    }
    if (state.order !== DEFAULT_DISCOVER_URL.order) {
      const orderLabel = DISCOVER_ORDERS.find((o) => o.id === state.order)?.label ?? state.order;
      chips.push({
        key: "order",
        label: `排序: ${orderLabel}`,
        remove: () => onChange({ order: DEFAULT_DISCOVER_URL.order }),
      });
    }
    if (state.pageSize !== DEFAULT_DISCOVER_URL.pageSize) {
      chips.push({
        key: "pageSize",
        label: `每页: ${state.pageSize}`,
        remove: () => onChange({ pageSize: DEFAULT_DISCOVER_URL.pageSize }),
      });
    }
  }

  return (
    <div className="y-disc-chips">
      {chips.length === 0 && (
        <span className="y-disc-chip y-disc-chip--empty">
          还没有激活筛选条件 — 条件实时应用到结果
        </span>
      )}
      {chips.map((c) => (
        <button key={c.key} type="button" className="y-disc-chip" onClick={c.remove}>
          {c.label} ×
        </button>
      ))}
      <span className="y-disc-stat">
        共 {formatCount(total)} 条结果 · 已选 {selectedCount} 件
      </span>
    </div>
  );
}
