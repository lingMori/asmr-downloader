import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type WorkStatus } from "@/lib/api";
import { keys } from "@/lib/keys";

export type WorksStatusResult = ReturnType<typeof useWorksStatus>;

/**
 * 批量查询一组远端作品(source_id / RJ 号)在本地侧的状态:
 * none / queued / downloading / downloaded / in_library / failed ...
 * 返回 map 便于按 source_id 直接取;ids 为空时不发请求。
 */
export function useWorksStatus(sourceIds: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(sourceIds.map((s) => s?.trim()).filter(Boolean) as string[])).sort(),
    [sourceIds],
  );
  const query = useQuery({
    queryKey: keys.worksStatus(ids),
    queryFn: () => apiClient.getWorkStatuses(ids),
    enabled: ids.length > 0,
    staleTime: 15_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, WorkStatus>();
    for (const item of query.data?.items ?? []) m.set(item.source_id, item);
    return m;
  }, [query.data]);
  return { ...query, map };
}

/** 该状态是否视为"不可再下载"(已在库 / 已在队列) */
export function isWorkUnavailable(status?: WorkStatus): boolean {
  if (!status) return false;
  return status.state === "in_library" || status.state === "queued" || status.state === "downloading" || status.state === "downloaded";
}
