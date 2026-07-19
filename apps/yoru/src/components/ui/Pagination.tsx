import { cn } from "@/lib/utils";

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** 左侧文案,默认「第 x / y 页」 */
  label?: string;
  className?: string;
};

export function Pagination({ page, totalPages, onPage, label, className }: PaginationProps) {
  const pages = Math.max(1, totalPages);
  const cur = Math.min(Math.max(1, page), pages);
  return (
    <div className={cn("y-pagination", className)}>
      <span className="y-pagination__label">{label ?? `第 ${cur} / ${pages.toLocaleString()} 页`}</span>
      <button type="button" className="y-pagination__btn" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>
        ← 上一页
      </button>
      <button type="button" className="y-pagination__btn" disabled={cur >= pages} onClick={() => onPage(cur + 1)}>
        下一页 →
      </button>
    </div>
  );
}
