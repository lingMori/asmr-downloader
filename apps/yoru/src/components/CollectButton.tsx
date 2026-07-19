import { toCollectionInput } from "@/lib/api";
import { useToggleCollection } from "@/hooks/useCollections";
import { cn } from "@/lib/utils";

export type CollectButtonProps = {
  /** 作品摘要(用于收藏快照,字段同 toCollectionInput 入参) */
  work: Parameters<typeof toCollectionInput>[0];
  /** 当前是否已收藏(来自 works/status 的 collected 或 collections map) */
  collected: boolean;
  size?: "sm";
  className?: string;
};

/**
 * 收藏(入库)♡ 切换钮。收藏即入库:不下载文件,
 * 作品出现在媒体库「收藏作品」区,可在线串流;下载仅是离线可选。
 */
export function CollectButton({ work, collected, size, className }: CollectButtonProps) {
  const toggle = useToggleCollection();
  return (
    <span
      role="button"
      aria-pressed={collected}
      aria-label={collected ? "取消收藏" : "收藏"}
      title={collected ? "取消收藏" : "收藏入库"}
      className={cn(
        "y-collect-btn",
        collected && "is-on",
        size === "sm" && "y-collect-btn--sm",
        toggle.isPending && "is-pending",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (!toggle.isPending) toggle.mutate({ work, collected });
      }}
    >
      {collected ? "♥" : "♡"}
    </span>
  );
}
