export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

export type ActionResponse = {
  code: string;
  taskId: number;
};

export type TaskLog = {
  id: number;
  message: string;
  createdAt: string;
};

export type Task = {
  id: number;
  name: string;
  type: string;
  status: string;
  progress: number;
  message: string;
  payload: string;
  result: string;
  source?: string;
  logExcerpt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  logs?: TaskLog[];
};

type LegacyTaskLog = {
  id?: number;
  ID?: number;
  message?: string;
  Message?: string;
  createdAt?: string;
  CreatedAt?: string;
};

type RawTask = Partial<Task> & {
  ID?: number;
  Name?: string;
  Type?: string;
  Status?: string;
  Progress?: number;
  Message?: string;
  Payload?: string;
  Result?: string;
  Source?: string;
  LogExcerpt?: string;
  StartedAt?: string | null;
  CompletedAt?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
  Logs?: LegacyTaskLog[];
};

export type TaskListResponse = {
  items: Task[];
  total: number;
  page: number;
  size: number;
};

export type TaskListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: string;
  type?: string;
  status?: string;
};

export type SyncReport = {
  totals: {
    metadata: number;
    subtitle: number;
    withoutSubtitle: number;
  };
  downloads: {
    completed: number;
    failed: number;
    pending: number;
  };
  progress: {
    overall: number;
    withSubtitle: number;
    withoutSubtitle: number;
  };
};

export type ConfigResponse = {
  user: {
    account: string;
    password: string;
  };
  downloader: {
    api_url?: string;
    proxy_url?: string;
    sync_data_folder: string;
    prefer_media: string;
    max_workers?: number;
    max_retries?: number;
    sync_wanted_size?: string;
  };
  limit: {
    sync_qps: number;
    download_qps: number;
    sync_jitter_min?: number;
    sync_jitter_max?: number;
    download_jitter_min?: number;
    download_jitter_max?: number;
  };
  auth?: {
    state: string;
    message: string;
  };
};

type RawConfigResponse =
  | ConfigResponse
  | {
      User?: {
        Account?: string;
        Password?: string;
      };
      Downloader?: {
        ApiUrl?: string;
        ProxyUrl?: string;
        SyncDataFolder?: string;
        PreferMedia?: string;
        MaxWorkers?: number;
        MaxRetries?: number;
        SyncWantedSize?: string;
      };
      Limit?: {
        SyncQPS?: number;
        DownloadQPS?: number;
        SyncJitterMin?: number;
        SyncJitterMax?: number;
        DownloadJitterMin?: number;
        DownloadJitterMax?: number;
      };
      Auth?: {
        State?: string;
        Message?: string;
      };
    };

export type DiscoverFacet = {
  value: string;
  count: number;
};

export type DiscoverWorkSummary = {
  sourceId: string;
  title: string;
  circle: string;
  release: string;
  dlCount: number;
  rate: number;
  duration: number;
  hasSubtitle: boolean;
  vas: string[];
  tags: string[];
  thumbnailUrl?: string;
  mainCoverUrl?: string;
};

export type DiscoverSearchResponse = {
  items: DiscoverWorkSummary[];
  facets: {
    tags: DiscoverFacet[];
    circles: DiscoverFacet[];
    vas: DiscoverFacet[];
  };
  total: number;
  page: number;
  pageSize: number;
};

export type DiscoverWorkDetail = {
  summary: DiscoverWorkSummary;
  sourceUrl: string;
  circleId: number;
  price: number;
  reviewCount: number;
  rateCount: number;
  createDate: string;
  workAttributes: string;
  ageCategory: string;
  tracks: TrackNode[];
};

export type SearchWorkSummary = {
  sourceId: string;
  title: string;
  circle: string;
  release: string;
  dlCount: number;
  rate: number;
  duration: number;
  hasSubtitle: boolean;
  vas: string[];
  tags: string[];
  thumbnailUrl?: string;
  mainCoverUrl?: string;
};

export type SearchListResponse = {
  items: SearchWorkSummary[];
  total: number;
  count: number;
  page?: number;
  pageSize?: number;
};

export type TrackNode = {
  type: string;
  title: string;
  hash?: string;
  mediaStreamUrl?: string;
  mediaDownloadUrl?: string;
  children?: TrackNode[];
};

export type LibraryWorkSummary = {
  id: string;
  mediaId: string;
  title: string;
  releaseDate: string;
  hasSubtitles: boolean;
  fileCount: number;
  audioFileCount: number;
  subtitleCount: number;
  thumbnailUrl?: string;
};

export type LibraryFile = {
  path: string;
  name: string;
  kind: "audio" | "subtitle" | "image" | "other";
  url: string;
};

export type LibraryWorkDetail = {
  summary: LibraryWorkSummary;
  files: LibraryFile[];
};

export type LibraryListResponse = {
  items: LibraryWorkSummary[];
  total: number;
  page: number;
  pageSize: number;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
const SERVER_BASE = API_BASE.replace(/\/api$/, "");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

async function requestBlob(
  path: string,
  options?: RequestInit,
): Promise<{ blob: Blob; filename?: string }> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    blob: await res.blob(),
    filename: match?.[1],
  };
}

async function requestData<T>(path: string, options?: RequestInit): Promise<T> {
  const payload = await request<ApiEnvelope<T>>(path, options);
  return payload.data;
}

function normalizeTaskLog(log: TaskLog | LegacyTaskLog): TaskLog {
  const legacy = log as LegacyTaskLog;
  return {
    id: typeof log.id === "number" ? log.id : legacy.ID ?? 0,
    message:
      typeof log.message === "string" ? log.message : legacy.Message ?? "",
    createdAt:
      typeof log.createdAt === "string"
        ? log.createdAt
        : legacy.CreatedAt ?? "",
  };
}

function normalizeTask(raw: RawTask): Task {
  return {
    id: typeof raw.id === "number" ? raw.id : raw.ID ?? 0,
    name: typeof raw.name === "string" ? raw.name : raw.Name ?? "",
    type: typeof raw.type === "string" ? raw.type : raw.Type ?? "",
    status:
      typeof raw.status === "string" ? raw.status : raw.Status ?? "UNKNOWN",
    progress:
      typeof raw.progress === "number"
        ? raw.progress
        : typeof raw.Progress === "number"
          ? raw.Progress
          : 0,
    message:
      typeof raw.message === "string" ? raw.message : raw.Message ?? "",
    payload:
      typeof raw.payload === "string" ? raw.payload : raw.Payload ?? "",
    result: typeof raw.result === "string" ? raw.result : raw.Result ?? "",
    source:
      typeof raw.source === "string" ? raw.source : raw.Source ?? undefined,
    logExcerpt:
      typeof raw.logExcerpt === "string"
        ? raw.logExcerpt
        : raw.LogExcerpt ?? undefined,
    startedAt:
      typeof raw.startedAt === "string" || raw.startedAt === null
        ? raw.startedAt
        : raw.StartedAt ?? undefined,
    completedAt:
      typeof raw.completedAt === "string" || raw.completedAt === null
        ? raw.completedAt
        : raw.CompletedAt ?? undefined,
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : raw.CreatedAt,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : raw.UpdatedAt,
    logs: (raw.logs ?? raw.Logs ?? []).map(normalizeTaskLog),
  };
}

function normalizeTaskList(raw: {
  items: RawTask[];
  total: number;
  page: number;
  size: number;
}): TaskListResponse {
  return {
    items: raw.items.map(normalizeTask),
    total: raw.total,
    page: raw.page,
    size: raw.size,
  };
}

function normalizeConfig(raw: RawConfigResponse): ConfigResponse {
  if ("user" in raw && raw.user) {
    return raw as ConfigResponse;
  }

  const legacy = raw as Exclude<RawConfigResponse, ConfigResponse>;
  return {
    user: {
      account: legacy.User?.Account ?? "",
      password: legacy.User?.Password ?? "",
    },
    downloader: {
      api_url: legacy.Downloader?.ApiUrl ?? "",
      proxy_url: legacy.Downloader?.ProxyUrl ?? "",
      sync_data_folder: legacy.Downloader?.SyncDataFolder ?? "",
      prefer_media: legacy.Downloader?.PreferMedia ?? "",
      max_workers: legacy.Downloader?.MaxWorkers,
      max_retries: legacy.Downloader?.MaxRetries,
      sync_wanted_size: legacy.Downloader?.SyncWantedSize,
    },
    limit: {
      sync_qps: legacy.Limit?.SyncQPS ?? 0,
      download_qps: legacy.Limit?.DownloadQPS ?? 0,
      sync_jitter_min: legacy.Limit?.SyncJitterMin,
      sync_jitter_max: legacy.Limit?.SyncJitterMax,
      download_jitter_min: legacy.Limit?.DownloadJitterMin,
      download_jitter_max: legacy.Limit?.DownloadJitterMax,
    },
    auth: legacy.Auth
      ? {
          state: legacy.Auth.State ?? "unknown",
          message: legacy.Auth.Message ?? "",
        }
      : undefined,
  };
}

function toAbsoluteMediaUrl(path: string): string {
  if (!path) {
    return path;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${SERVER_BASE}${path}`;
  }
  return `${SERVER_BASE}/${path}`;
}

function normalizeLibrarySummary(
  work: LibraryWorkSummary,
): LibraryWorkSummary {
  return {
    ...work,
    thumbnailUrl: work.thumbnailUrl
      ? toAbsoluteMediaUrl(work.thumbnailUrl)
      : undefined,
  };
}

function normalizeLibraryDetail(detail: LibraryWorkDetail): LibraryWorkDetail {
  return {
    summary: normalizeLibrarySummary(detail.summary),
    files: detail.files.map((file) => ({
      ...file,
      url: toAbsoluteMediaUrl(file.url),
    })),
  };
}

function normalizeSearchWorkSummary(
  work: SearchWorkSummary,
): SearchWorkSummary {
  return {
    ...work,
    tags: Array.isArray(work.tags) ? work.tags : [],
    vas: Array.isArray(work.vas) ? work.vas : [],
    thumbnailUrl: work.thumbnailUrl
      ? toAbsoluteMediaUrl(work.thumbnailUrl)
      : undefined,
    mainCoverUrl: work.mainCoverUrl
      ? toAbsoluteMediaUrl(work.mainCoverUrl)
      : undefined,
  };
}

function normalizeTrackNode(track: TrackNode): TrackNode {
  return {
    ...track,
    children: Array.isArray(track.children)
      ? track.children.map(normalizeTrackNode)
      : [],
  };
}

function normalizeDiscoverWorkSummary(
  work: DiscoverWorkSummary,
): DiscoverWorkSummary {
  return {
    ...work,
    tags: Array.isArray(work.tags) ? work.tags : [],
    vas: Array.isArray(work.vas) ? work.vas : [],
    thumbnailUrl: work.thumbnailUrl
      ? toAbsoluteMediaUrl(work.thumbnailUrl)
      : undefined,
    mainCoverUrl: work.mainCoverUrl
      ? toAbsoluteMediaUrl(work.mainCoverUrl)
      : undefined,
  };
}

function normalizeDiscoverDetail(
  detail: DiscoverWorkDetail,
): DiscoverWorkDetail {
  return {
    ...detail,
    summary: normalizeDiscoverWorkSummary(detail.summary),
    tracks: Array.isArray(detail.tracks)
      ? detail.tracks.map(normalizeTrackNode)
      : [],
  };
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) {
      return;
    }
    query.set(key, String(value));
  });
  const raw = query.toString();
  return raw ? `?${raw}` : "";
}

export const apiClient = {
  async getTasks(params?: TaskListQuery): Promise<TaskListResponse> {
    const raw = await requestData<{
      items: RawTask[];
      total: number;
      page: number;
      size: number;
    }>(
      `/tasks${buildQueryString({
        page: params?.page,
        pageSize: params?.pageSize,
        search: params?.search,
        source: params?.source,
        type: params?.type,
        status: params?.status,
      })}`,
    );
    return normalizeTaskList(raw);
  },

  async getTask(id: number): Promise<Task> {
    const raw = await requestData<RawTask>(`/tasks/${id}`);
    return normalizeTask(raw);
  },

  retryTask(id: number) {
    return request<ActionResponse>(`/tasks/${id}/retry`, {
      method: "POST",
    });
  },

  deleteTask(id: number, options?: { withFiles?: boolean }) {
    return requestData<{ deleted: boolean; filesDeleted?: number }>(
      `/tasks/${id}${options?.withFiles ? "?withFiles=1" : ""}`,
      {
      method: "DELETE",
      },
    );
  },

  cancelTask(id: number) {
    return requestData<{ canceled: boolean }>(`/tasks/${id}/cancel`, {
      method: "POST",
    });
  },

  createDownload(payload: {
    mode: string;
    ids?: string[];
    count?: number;
    outputDir?: string;
    name?: string;
  }) {
    return request<ActionResponse>("/downloads", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  queueSyncMetadata(scope = "all") {
    return request<ActionResponse>("/sync", {
      method: "POST",
      body: JSON.stringify({ scope }),
    });
  },

  queueSyncDownload(folder?: string) {
    return request<ActionResponse>("/sync/download", {
      method: "POST",
      body: JSON.stringify(folder ? { folder } : {}),
    });
  },

  queueSyncRetry() {
    return request<ActionResponse>("/sync/retry", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  getReport(): Promise<SyncReport> {
    return requestData("/sync/report");
  },

  async getConfig(): Promise<ConfigResponse> {
    const raw = await requestData<RawConfigResponse>("/config");
    return normalizeConfig(raw);
  },

  async updateConfig(payload: ConfigResponse): Promise<ConfigResponse> {
    const raw = await requestData<RawConfigResponse>("/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return normalizeConfig(raw);
  },

  async searchWorks(params: {
    query: string;
    count?: number;
    page?: number;
    pageSize?: number;
    order?: string;
    sort?: string;
    subtitle?: string | number;
  }): Promise<SearchListResponse> {
    const data = await requestData<SearchListResponse>(
      `/search${buildQueryString({
        q: params.query,
        count: params.count,
        page: params.page,
        pageSize: params.pageSize,
        order: params.order,
        sort: params.sort,
        subtitle: params.subtitle,
      })}`,
    );
    return {
      ...data,
      items: data.items.map(normalizeSearchWorkSummary),
    };
  },

  queueSearchDownload(payload: {
    query: string;
    count?: number;
    outputDir?: string;
    name?: string;
  }) {
    return request<ActionResponse>("/search/download", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  exportSearch(payload: {
    query: string;
    count?: number;
    format: "csv" | "json";
  }) {
    return requestBlob("/search/export", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  exportSync(
    status: "failed" | "success" | "pending" | "all",
    format: "csv" | "json",
  ) {
    return requestBlob(
      `/sync/export${buildQueryString({
        status,
        format,
      })}`,
    );
  },

  searchDiscover(params: {
    q?: string;
    tag?: string;
    circle?: string;
    va?: string;
    subtitle?: boolean;
    page?: number;
    pageSize?: number;
    order?: string;
    sort?: string;
  }): Promise<DiscoverSearchResponse> {
    return requestData<DiscoverSearchResponse>(
      `/discover/search${buildQueryString({
        q: params.q,
        tag: params.tag,
        circle: params.circle,
        va: params.va,
        subtitle: params.subtitle ? 1 : 0,
        page: params.page,
        pageSize: params.pageSize,
        order: params.order,
        sort: params.sort,
      })}`,
    ).then((data) => ({
      ...data,
      items: Array.isArray(data.items)
        ? data.items.map(normalizeDiscoverWorkSummary)
        : [],
      facets: {
        tags: Array.isArray(data.facets?.tags) ? data.facets.tags : [],
        circles: Array.isArray(data.facets?.circles) ? data.facets.circles : [],
        vas: Array.isArray(data.facets?.vas) ? data.facets.vas : [],
      },
    }));
  },

  async getDiscoverWork(sourceId: string): Promise<DiscoverWorkDetail> {
    const data = await requestData<DiscoverWorkDetail>(
      `/discover/works/${encodeURIComponent(sourceId)}`,
    );
    return normalizeDiscoverDetail(data);
  },

  async getLibraryWorks(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<LibraryListResponse> {
    const data = await requestData<LibraryListResponse>(
      `/library/works${buildQueryString({
        page: params?.page,
        pageSize: params?.pageSize,
        search: params?.search,
      })}`,
    );
    return {
      ...data,
      items: data.items.map(normalizeLibrarySummary),
    };
  },

  async getLibraryWork(id: string): Promise<LibraryWorkDetail> {
    const data = await requestData<LibraryWorkDetail>(
      `/library/works/${encodeURIComponent(id)}`,
    );
    return normalizeLibraryDetail(data);
  },
};
