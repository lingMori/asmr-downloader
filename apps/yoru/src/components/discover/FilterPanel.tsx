import { Chip, Sticker, Toggle } from "@/components/ui";
import {
  DISCOVER_ORDERS,
  DISCOVER_PAGE_SIZES,
  splitTags,
  type DiscoverUrlState,
} from "./helpers";
import { useUrlTextParam } from "./hooks";

export type FilterPanelProps = {
  state: DiscoverUrlState;
  onChange: (patch: Partial<DiscoverUrlState>) => void;
};

/** 筛选面板(dc.html:120-170):标签/仅字幕 · 社团/声优 · 排序/顺序/每页 */
export function FilterPanel({ state, onChange }: FilterPanelProps) {
  const [tagsText, setTagsText] = useUrlTextParam(state.tags.join(", "), (v) =>
    onChange({ tags: splitTags(v) }),
  );
  const [circleText, setCircleText] = useUrlTextParam(state.circle, (v) =>
    onChange({ circle: v }),
  );
  const [vaText, setVaText] = useUrlTextParam(state.va, (v) => onChange({ va: v }));

  return (
    <div className="y-disc-panel">
      <Sticker color="lav" section>
        筛选条件 · しぼりこみ
      </Sticker>
      <div className="y-disc-panel__grid">
        <div className="y-disc-panel__col">
          <div>
            <div className="y-disc-field__label">
              标签 <span className="y-disc-field__hint">逗号分隔多个值</span>
            </div>
            <input
              className="y-disc-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="例如: 耳语, 催眠, 治愈"
              aria-label="标签筛选"
            />
            {state.tags.length > 0 && (
              <div className="y-disc-tagchips" style={{ marginTop: 7 }}>
                {state.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="y-disc-tagchip"
                    onClick={() =>
                      onChange({ tags: state.tags.filter((t) => t !== tag) })
                    }
                  >
                    #{tag} ×
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="y-disc-subtoggle">
            <Toggle
              checked={state.subtitle}
              onChange={(checked) => onChange({ subtitle: checked })}
              label="仅字幕作品"
            />
            仅字幕作品
          </label>
        </div>

        <div className="y-disc-panel__col">
          <div>
            <div className="y-disc-field__label">社团</div>
            <input
              className="y-disc-input"
              value={circleText}
              onChange={(e) => setCircleText(e.target.value)}
              placeholder="例如: 雨音シアター"
              aria-label="社团筛选"
            />
          </div>
          <div>
            <div className="y-disc-field__label">声优</div>
            <input
              className="y-disc-input"
              value={vaText}
              onChange={(e) => setVaText(e.target.value)}
              placeholder="例如: 篝火ほたる"
              aria-label="声优筛选"
            />
          </div>
        </div>

        <div className="y-disc-panel__col">
          <div>
            <div className="y-disc-field__label">排序字段</div>
            <div className="y-disc-opts">
              {DISCOVER_ORDERS.map((o) => (
                <Chip
                  key={o.id}
                  active={state.order === o.id}
                  onClick={() => onChange({ order: o.id })}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="y-disc-optsrow">
            <div>
              <div className="y-disc-field__label">顺序</div>
              <div className="y-disc-opts">
                {(
                  [
                    { id: "desc", label: "降序" },
                    { id: "asc", label: "升序" },
                  ] as const
                ).map((o) => (
                  <Chip
                    key={o.id}
                    active={state.sort === o.id}
                    onClick={() => onChange({ sort: o.id })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="y-disc-field__label">每页数量</div>
              <div className="y-disc-opts">
                {DISCOVER_PAGE_SIZES.map((n) => (
                  <Chip
                    key={n}
                    active={state.pageSize === n}
                    onClick={() => onChange({ pageSize: n })}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
