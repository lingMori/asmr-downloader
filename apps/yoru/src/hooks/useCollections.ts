import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  apiClient,
  toCollectionInput,
  type Collection,
  type CollectionInput,
} from "@/lib/api";
import { keys } from "@/lib/keys";

const PAGE_SIZE = 48;
const MAX_ITEMS = 500;

/**
 * 拉取全部收藏(收藏即入库)。收藏是用户策展内容,量级小,
 * 分页循环拉全(上限 500),返回 items + 按 source_id 索引的 map。
 */
export function useCollections() {
  const query = useQuery({
    queryKey: keys.collections.all,
    queryFn: async () => {
      const items: Collection[] = [];
      let page = 1;
      let total = Infinity;
      while (items.length < total && items.length < MAX_ITEMS) {
        const data = await apiClient.getCollections({ page, pageSize: PAGE_SIZE });
        items.push(...data.items);
        total = data.total;
        if (data.items.length < PAGE_SIZE) break;
        page += 1;
      }
      return items;
    },
    staleTime: 30_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, Collection>();
    for (const item of query.data ?? []) m.set(item.source_id, item);
    return m;
  }, [query.data]);
  return { ...query, items: query.data ?? [], map };
}

/**
 * 收藏/取消收藏切换。入参为作品摘要(能拿到多少给多少,toCollectionInput 兜底)。
 * 成功后失效 collections 与 works-status(collected 标记随之刷新)。
 */
export function useToggleCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { work: Parameters<typeof toCollectionInput>[0]; collected: boolean }) => {
      if (vars.collected) {
        await apiClient.removeCollection(vars.work.source_id);
        return { collected: false };
      }
      await apiClient.addCollection(toCollectionInput(vars.work));
      return { collected: true };
    },
    onSuccess: (result, vars) => {
      toast.success(result.collected ? `已收藏 · ${vars.work.title.slice(0, 24)}` : "已取消收藏");
      queryClient.invalidateQueries({ queryKey: keys.collections.all });
      queryClient.invalidateQueries({ queryKey: ["works-status"] });
    },
    onError: (err) => {
      toast.error(`收藏操作失败:${err instanceof Error ? err.message : "未知错误"}`);
    },
  });
}
