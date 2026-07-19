import type { TaskListQuery } from "./api";

/**
 * react-query 查询键集中定义。后续所有 Phase 的 useQuery/useMutation
 * 必须用这里的 factory,禁止散落手写字面量(失效/补丁全靠前缀匹配)。
 *
 * 前缀约定:
 * - ["tasks"] 前缀覆盖 summary + 全部 list(TaskRealtimeBridge 用)
 * - ["works-status"] 前缀覆盖所有 id 组合
 * - ["library"] / ["discover"] / ["online"] / ["playback"] 同理
 */

type LibraryWorksParams = { page?: number; pageSize?: number; search?: string };

type DiscoverSearchParams = {
  q?: string;
  tag?: string;
  circle?: string;
  va?: string;
  subtitle?: boolean;
  page?: number;
  pageSize?: number;
  order?: string;
  sort?: string;
};

type OnlineListParams = {
  sort?: "popular" | "recommend" | "release" | "rate";
  subtitle?: boolean;
  page?: number;
  pageSize?: number;
};

export const keys = {
  health: ["health"] as const,

  tasks: {
    all: ["tasks"] as const,
    summary: ["tasks", "summary"] as const,
    list: (filters: TaskListQuery = {}) => ["tasks", "list", filters] as const,
  },

  library: {
    all: ["library"] as const,
    works: (params: LibraryWorksParams = {}) => ["library", "works", params] as const,
    work: (id: string) => ["library", "work", id] as const,
  },

  discover: {
    all: ["discover"] as const,
    search: (params: DiscoverSearchParams = {}) => ["discover", "search", params] as const,
    work: (id: string) => ["discover", "work", id] as const,
    neighbors: (id: string) => ["discover", "neighbors", id] as const,
  },

  online: {
    all: ["online"] as const,
    list: (params: OnlineListParams = {}) => ["online", "list", params] as const,
  },

  /** ids 排序去重后展开进 key,保证同一组 id 缓存命中一致 */
  worksStatus: (ids: string[] = []) =>
    ["works-status", ...Array.from(new Set(ids)).sort()] as const,

  playback: {
    all: ["playback"] as const,
    latest: (limit = 10) => ["playback", "latest", limit] as const,
  },

  sync: {
    report: ["sync", "report"] as const,
  },

  config: ["config"] as const,

  authStatus: ["auth", "status"] as const,
};
