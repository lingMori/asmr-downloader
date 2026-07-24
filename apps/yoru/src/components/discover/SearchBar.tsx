import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { isAdvancedQuery } from "./helpers";
import { useUrlTextParam } from "./hooks";

export type SearchBarProps = {
  /** URL 中已提交的 q */
  q: string;
  onCommitQ: (q: string) => void;
  showFilters: boolean;
  showTools: boolean;
  onToggleFilters: () => void;
  onToggleTools: () => void;
  onReset: () => void;
};

/** 搜索栏(dc.html:103-111):输入 + 模式徽章 + 筛选/工具/重置 */
export function SearchBar({
  q,
  onCommitQ,
  showFilters,
  showTools,
  onToggleFilters,
  onToggleTools,
  onReset,
}: SearchBarProps) {
  const [text, setText] = useUrlTextParam(q, onCommitQ, 400);
  const advanced = isAdvancedQuery(text);

  return (
    <div className="y-disc-searchbar">
      <span className="y-disc-searchbar__icon" aria-hidden="true" />
      <input
        className="y-disc-searchbar__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="关键词、RJ 号,或直接贴 $ 高级查询表达式"
        aria-label="搜索关键词或高级查询表达式"
      />
      <span className={cn("y-disc-mode", !advanced && "y-disc-mode--cond-on")}>条件搜索</span>
      <span className={cn("y-disc-mode", advanced && "y-disc-mode--dsl-on")}>高级语法 $</span>
      <button
        type="button"
        className={cn("y-disc-barbtn", showFilters && "is-on")}
        aria-expanded={showFilters}
        onClick={onToggleFilters}
      >
        筛选 {showFilters ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
      </button>
      <button
        type="button"
        className={cn("y-disc-barbtn", showTools && "is-on")}
        aria-expanded={showTools}
        onClick={onToggleTools}
      >
        工具 {showTools ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
      </button>
      <button type="button" className="y-disc-barbtn" onClick={onReset}>
        重置
      </button>
    </div>
  );
}
