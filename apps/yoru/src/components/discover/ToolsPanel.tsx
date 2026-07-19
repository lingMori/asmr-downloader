import { Chip, Sticker } from "@/components/ui";

export type DownloadScope = "page" | "selected";

export type ToolsPanelProps = {
  outputDir: string;
  onOutputDir: (v: string) => void;
  /** 本页可下载件数(排除在库/队列中) */
  pageCount: number;
  selectedCount: number;
  scope: DownloadScope;
  onScope: (s: DownloadScope) => void;
  onReview: () => void;
  onExport: (format: "csv" | "json") => void;
  exporting: boolean;
  exportDisabled: boolean;
};

/** 工具面板(dc.html:173-194):输出目录 / 下载范围 / 复核 / 导出 */
export function ToolsPanel({
  outputDir,
  onOutputDir,
  pageCount,
  selectedCount,
  scope,
  onScope,
  onReview,
  onExport,
  exporting,
  exportDisabled,
}: ToolsPanelProps) {
  return (
    <div className="y-disc-panel">
      <Sticker color="pink" section rotate={2}>
        结果操作 · つーる
      </Sticker>
      <div className="y-disc-tools">
        <div className="y-disc-tools__dir">
          <div className="y-disc-field__label">
            输出目录 <span className="y-disc-field__hint">留空使用设置中的存储路径</span>
          </div>
          <input
            className="y-disc-input y-disc-input--mono"
            value={outputDir}
            onChange={(e) => onOutputDir(e.target.value)}
            placeholder="/Volumes/ASMR/Library"
            aria-label="下载输出目录"
          />
        </div>
        <div>
          <div className="y-disc-field__label">下载范围</div>
          <div className="y-disc-opts y-disc-scope" role="radiogroup" aria-label="下载范围">
            <Chip active={scope === "page"} onClick={() => onScope("page")}>
              本页 {pageCount} 项
            </Chip>
            <Chip
              active={scope === "selected"}
              disabled={selectedCount === 0}
              onClick={() => onScope("selected")}
            >
              已选 {selectedCount} 项
            </Chip>
          </div>
        </div>
        <div className="y-disc-tools__actions">
          <button
            type="button"
            className="y-btn-primary y-disc-btn-sm"
            onClick={onReview}
            disabled={(scope === "page" ? pageCount : selectedCount) === 0}
          >
            ↓ 复核下载范围
          </button>
          <button
            type="button"
            className="y-btn-ghost y-disc-btn-sm"
            disabled={exportDisabled || exporting}
            onClick={() => onExport("csv")}
          >
            导出 CSV
          </button>
          <button
            type="button"
            className="y-btn-ghost y-disc-btn-sm"
            disabled={exportDisabled || exporting}
            onClick={() => onExport("json")}
          >
            导出 JSON
          </button>
        </div>
      </div>
    </div>
  );
}
