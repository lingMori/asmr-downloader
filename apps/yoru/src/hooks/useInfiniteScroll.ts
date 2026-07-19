import { useEffect, useRef } from "react";

/**
 * 无限滚动哨兵:哨兵元素进入可视区时触发 onHit。
 * 配合 useInfiniteQuery 使用:onHit 里做 fetchNextPage(调用方自行
 * 用 hasNextPage && !isFetchingNextPage 做闸)。root=null(视口),
 * 对壳内滚动容器同样有效;rootMargin 提前 240px 触发,滚动更顺滑。
 */
export function useInfiniteScroll<T extends HTMLElement>(options: {
  enabled: boolean;
  onHit: () => void;
}) {
  const { enabled, onHit } = options;
  const sentinelRef = useRef<T | null>(null);
  const onHitRef = useRef(onHit);
  useEffect(() => {
    onHitRef.current = onHit;
  }, [onHit]);

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onHitRef.current();
        }
      },
      { root: null, rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
