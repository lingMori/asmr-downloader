import type { ConfigResponse } from "@/lib/api";

/** 设置页可改的账号字段;password 留空 = 保留旧值(后端语义) */
export type ConfigUserPatch = {
  account: string;
  password?: string;
};

/** 设置页可改的下载器字段(只放真正变更的 key) */
export type ConfigDownloaderPatch = {
  api_url?: string;
  proxy_url?: string;
  sync_data_folder?: string;
  max_workers?: number;
  max_retries?: number;
};

export type ConfigPatch = {
  user?: ConfigUserPatch;
  downloader?: ConfigDownloaderPatch;
};

/**
 * PUT /api/config 是合并更新,但并非全字段安全:
 * internal/server/system.go 的 handleConfigUpdate 中
 * proxy_url(无条件赋值)、max_retries(>=0 恒真)、http(无条件赋值)、
 * limit 的四个 jitter(>=0 恒真)在请求缺省时会被 Go 零值覆盖。
 * 因此每次保存都附带这些字段的当前值作"保护底",
 * 对调用方而言等价于真正的"只传改动字段"合并语义。
 */
export function buildConfigPatch(
  changed: ConfigPatch,
  current: ConfigResponse,
): ConfigResponse {
  const downloader: Record<string, unknown> = {
    proxy_url: current.downloader.proxy_url ?? "",
    max_retries: current.downloader.max_retries ?? 0,
    ...(current.downloader.http ? { http: current.downloader.http } : {}),
    ...(changed.downloader ?? {}),
  };
  const payload: Record<string, unknown> = {
    downloader,
    limit: current.limit,
  };
  if (changed.user) {
    payload.user = changed.user;
  }
  return payload as unknown as ConfigResponse;
}
