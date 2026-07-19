export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

export type ActionResponse = {
  code: string;
  task_id: number;
};

export type TaskLog = {
  id: number;
  task_id?: number;
  message: string;
  created_at: string;
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
  log_excerpt?: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  logs?: TaskLog[];
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
  type?: string | string[];
  status?: string | string[];
};

export type TaskSummary = {
  total: number;
  queued: number;
  running: number;
  success: number;
  failed: number;
  canceled: number;
  terminated: number;
};

export type AuthStatus = {
  state: string;
  message: string;
};

export type SyncReport = {
  totals: {
    metadata: number;
    subtitle: number;
    without_subtitle: number;
  };
  downloads: {
    completed: number;
    failed: number;
    pending: number;
  };
  progress: {
    overall: number;
    with_subtitle: number;
    without_subtitle: number;
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
    http?: {
      user_agent?: string;
      origin?: string;
      referer?: string;
      accept_language?: string;
      sec_ch_ua?: string;
      sec_ch_ua_platform?: string;
      extra?: Record<string, string>;
    };
  };
  limit: {
    sync_qps: number;
    download_qps: number;
    sync_jitter_min?: number;
    sync_jitter_max?: number;
    download_jitter_min?: number;
    download_jitter_max?: number;
  };
  auth?: AuthStatus;
};

export type DiscoverFacet = {
  value: string;
  count: number;
};

export type DiscoverWorkSummary = {
  source_id: string;
  title: string;
  circle: string;
  release: string;
  dl_count: number;
  rate: number;
  duration: number;
  has_subtitle: boolean;
  vas: string[];
  tags: string[];
  thumbnail_url?: string;
  main_cover_url?: string;
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
  page_size: number;
};

export type DiscoverWorkDetail = {
  summary: DiscoverWorkSummary;
  source_url: string;
  circle_id: number;
  price: number;
  review_count: number;
  rate_count: number;
  create_date: string;
  work_attributes: string;
  age_category: string;
  tracks: TrackNode[];
};

export type DiscoverWorkListResponse = {
  items: DiscoverWorkSummary[];
  page: number;
  page_size: number;
  total: number;
};

export type FeedbackType =
  | "start-listen"
  | "listen-5mins"
  | "listen-15mins"
  | "listen-30mins"
  | "listen-60mins"
  | "listen-30percent";

export type PlaybackProgress = {
  source_id: string;
  work_title: string;
  cover_url: string;
  track_path: string;
  track_title: string;
  position: number;
  duration: number;
  updated_at: string;
};

export type SearchWorkSummary = {
  source_id: string;
  title: string;
  circle: string;
  release: string;
  dl_count: number;
  rate: number;
  duration: number;
  has_subtitle: boolean;
  vas: string[];
  tags: string[];
  thumbnail_url?: string;
  main_cover_url?: string;
};

export type SearchListResponse = {
  items: SearchWorkSummary[];
  total: number;
  count: number;
  page?: number;
  page_size?: number;
};

export type TrackNode = {
  id?: string;
  type: string;
  title: string;
  hash?: string;
  work_title?: string;
  play_url?: string;
  file_url?: string;
  media_stream_url?: string;
  media_download_url?: string;
  children?: TrackNode[];
};

export type LibraryWorkSummary = {
  id: string;
  media_id: string;
  title: string;
  release_date: string;
  has_subtitles: boolean;
  file_count: number;
  audio_file_count: number;
  subtitle_count: number;
  thumbnail_url?: string;
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
  page_size: number;
};

export type WorkStatus = {
  source_id: string;
  state:
    | "none"
    | "queued"
    | "downloading"
    | "downloaded"
    | "in_library"
    | "failed"
    | "canceled"
    | "terminated";
  label: string;
  message?: string;
  task_id?: number;
  library_id?: string;
};

export type WorkStatusResponse = {
  items: WorkStatus[];
};

export type HealthResponse = {
  status: string;
  version: string;
  time: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8080/api" : "/api");
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
    throw new Error(await readErrorMessage(res));
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
    throw new Error(await readErrorMessage(res));
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    blob: await res.blob(),
    filename: match?.[1],
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    return `${res.status} ${res.statusText}`.trim();
  }
  try {
    const payload = JSON.parse(text) as { message?: unknown; code?: unknown };
    if (typeof payload.message === "string" && payload.message.trim() !== "") {
      return payload.message;
    }
    if (typeof payload.code === "string" && payload.code.trim() !== "") {
      return payload.code;
    }
  } catch {
    return text;
  }
  return text;
}

async function requestData<T>(path: string, options?: RequestInit): Promise<T> {
  const payload = await request<ApiEnvelope<T>>(path, options);
  return payload.data;
}

export function toAbsoluteMediaUrl(path: string): string {
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

function absolutizeLibrarySummary(work: LibraryWorkSummary): LibraryWorkSummary {
  return work.thumbnail_url
    ? { ...work, thumbnail_url: toAbsoluteMediaUrl(work.thumbnail_url) }
    : work;
}

function absolutizeLibraryDetail(detail: LibraryWorkDetail): LibraryWorkDetail {
  return {
    summary: absolutizeLibrarySummary(detail.summary),
    files: detail.files.map((file) => ({
      ...file,
      url: toAbsoluteMediaUrl(file.url),
    })),
  };
}

function absolutizeWorkCovers<T extends DiscoverWorkSummary | SearchWorkSummary>(
  work: T,
): T {
  return {
    ...work,
    tags: Array.isArray(work.tags) ? work.tags : [],
    vas: Array.isArray(work.vas) ? work.vas : [],
    thumbnail_url: work.thumbnail_url
      ? toAbsoluteMediaUrl(work.thumbnail_url)
      : undefined,
    main_cover_url: work.main_cover_url
      ? toAbsoluteMediaUrl(work.main_cover_url)
      : undefined,
  };
}

function absolutizePlaybackProgress(progress: PlaybackProgress): PlaybackProgress {
  return progress.cover_url
    ? { ...progress, cover_url: toAbsoluteMediaUrl(progress.cover_url) }
    : progress;
}

type DiscoverWorkListQuery = {
  page?: number;
  pageSize?: number;
  subtitle?: boolean;
};

async function requestDiscoverWorkList(
  path: string,
  params?: DiscoverWorkListQuery,
): Promise<DiscoverWorkListResponse> {
  const data = await requestData<DiscoverWorkListResponse>(
    `${path}${buildQueryString({
      page: params?.page,
      page_size: params?.pageSize,
      subtitle: params?.subtitle ? 1 : undefined,
    })}`,
  );
  return {
    items: Array.isArray(data.items) ? data.items.map(absolutizeWorkCovers) : [],
    page: data.page ?? 1,
    page_size: data.page_size ?? 0,
    total: data.total ?? 0,
  };
}

function absolutizeTrackNode(track: TrackNode, sourceId: string, trackId: string): TrackNode {
  const isFolder =
    track.type.toLowerCase().includes("folder") ||
    Boolean(track.children?.length);
  const id = track.id || trackId;
  const isAudio = isPlayableAudioTrack(track);
  const isSubtitle = isSubtitleTrack(track);
  const playUrl =
    track.play_url ||
    (!isFolder && isAudio
      ? `/api/discover/works/${encodeURIComponent(sourceId)}/tracks/${encodeURIComponent(id)}/stream`
      : undefined);
  const fileUrl =
    track.file_url ||
    (!isFolder && isSubtitle
      ? `/api/discover/works/${encodeURIComponent(sourceId)}/tracks/${encodeURIComponent(id)}/file`
      : undefined);

  return {
    ...track,
    id,
    play_url: playUrl ? toAbsoluteMediaUrl(playUrl) : undefined,
    file_url: fileUrl ? toAbsoluteMediaUrl(fileUrl) : undefined,
    children: Array.isArray(track.children)
      ? track.children.map((child, index) =>
          absolutizeTrackNode(child, sourceId, `${id}.${index}`),
        )
      : undefined,
  };
}

function isPlayableAudioTrack(track: TrackNode) {
  const type = track.type.toLowerCase();
  const title = track.title.toLowerCase();
  return (
    type.includes("audio") ||
    /\.(mp3|wav|m4a|aac|flac|ogg|opus|webm)$/i.test(title)
  );
}

function isSubtitleTrack(track: TrackNode) {
  const type = track.type.toLowerCase();
  const title = track.title.toLowerCase();
  return (
    type.includes("subtitle") ||
    /\.(lrc|srt|vtt|ass|ssa)$/i.test(title)
  );
}

function buildQueryString(
  params: Record<string, string | number | boolean | string[] | undefined>,
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) {
      return;
    }
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, item));
      return;
    }
    query.set(key, String(value));
  });
  const raw = query.toString();
  return raw ? `?${raw}` : "";
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return requestData<HealthResponse>("/healthz");
  },

  async getTasks(params?: TaskListQuery): Promise<TaskListResponse> {
    return requestData<TaskListResponse>(
      `/tasks${buildQueryString({
        page: params?.page,
        page_size: params?.pageSize,
        search: params?.search,
        source: params?.source,
        type: params?.type,
        status: params?.status,
      })}`,
    );
  },

  getTaskSummary(params?: Omit<TaskListQuery, "page" | "pageSize">): Promise<TaskSummary> {
    return requestData<TaskSummary>(
      `/tasks/summary${buildQueryString({
        search: params?.search,
        source: params?.source,
        type: params?.type,
        status: params?.status,
      })}`,
    );
  },

  async getTask(id: number): Promise<Task> {
    return requestData<Task>(`/tasks/${id}`);
  },

  getAuthStatus(): Promise<AuthStatus> {
    return requestData<AuthStatus>("/auth/status");
  },

  checkAuth(): Promise<AuthStatus> {
    return requestData<AuthStatus>("/auth/check", {
      method: "POST",
    });
  },

  loginAuth(): Promise<AuthStatus> {
    return requestData<AuthStatus>("/auth/login", {
      method: "POST",
    });
  },

  async getWorkStatuses(sourceIds: string[]): Promise<WorkStatusResponse> {
    const ids = Array.from(
      new Set(sourceIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (ids.length === 0) {
      return { items: [] };
    }
    return requestData<WorkStatusResponse>(
      `/works/status${buildQueryString({
        source_ids: ids.join(","),
      })}`,
    );
  },

  retryTask(id: number) {
    return request<ActionResponse>(`/tasks/${id}/retry`, {
      method: "POST",
    });
  },

  deleteTask(id: number, options?: { withFiles?: boolean }) {
    return requestData<{ deleted: boolean; filesDeleted?: number }>(
      `/tasks/${id}${options?.withFiles ? "?with_files=1" : ""}`,
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
    output_dir?: string;
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

  getConfig(): Promise<ConfigResponse> {
    return requestData<ConfigResponse>("/config");
  },

  updateConfig(payload: ConfigResponse): Promise<ConfigResponse> {
    return requestData<ConfigResponse>("/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
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
        page_size: params.pageSize,
        order: params.order,
        sort: params.sort,
        subtitle: params.subtitle,
      })}`,
    );
    return {
      ...data,
      items: (data.items ?? []).map(absolutizeWorkCovers),
    };
  },

  queueSearchDownload(payload: {
    query: string;
    count?: number;
    output_dir?: string;
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

  async searchDiscover(params: {
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
    const data = await requestData<DiscoverSearchResponse>(
      `/discover/search${buildQueryString({
        q: params.q,
        tag: params.tag,
        circle: params.circle,
        va: params.va,
        subtitle: params.subtitle ? 1 : 0,
        page: params.page,
        page_size: params.pageSize,
        order: params.order,
        sort: params.sort,
      })}`,
    );
    return {
      ...data,
      items: Array.isArray(data.items) ? data.items.map(absolutizeWorkCovers) : [],
      facets: {
        tags: Array.isArray(data.facets?.tags) ? data.facets.tags : [],
        circles: Array.isArray(data.facets?.circles) ? data.facets.circles : [],
        vas: Array.isArray(data.facets?.vas) ? data.facets.vas : [],
      },
    };
  },

  async getDiscoverWork(sourceId: string): Promise<DiscoverWorkDetail> {
    const data = await requestData<DiscoverWorkDetail>(
      `/discover/works/${encodeURIComponent(sourceId)}`,
    );
    const canonicalSourceId = data.summary?.source_id || sourceId;
    return {
      ...data,
      summary: absolutizeWorkCovers(data.summary),
      tracks: Array.isArray(data.tracks)
        ? data.tracks.map((track, index) =>
            absolutizeTrackNode(track, canonicalSourceId, String(index)),
          )
        : [],
    };
  },

  getPopularWorks(params?: DiscoverWorkListQuery): Promise<DiscoverWorkListResponse> {
    return requestDiscoverWorkList("/discover/popular", params);
  },

  getRecommendWorks(params?: DiscoverWorkListQuery): Promise<DiscoverWorkListResponse> {
    return requestDiscoverWorkList("/discover/recommend", params);
  },

  getWorkNeighbors(
    sourceId: string,
    params?: DiscoverWorkListQuery,
  ): Promise<DiscoverWorkListResponse> {
    return requestDiscoverWorkList(
      `/discover/works/${encodeURIComponent(sourceId)}/neighbors`,
      params,
    );
  },

  sendFeedback(sourceId: string, type: FeedbackType): Promise<{ sent: boolean }> {
    return requestData<{ sent: boolean }>("/discover/feedback", {
      method: "POST",
      body: JSON.stringify({ source_id: sourceId, type }),
    });
  },

  savePlaybackProgress(progress: PlaybackProgress): Promise<{ saved: boolean }> {
    return requestData<{ saved: boolean }>("/playback/progress", {
      method: "PUT",
      body: JSON.stringify(progress),
    });
  },

  async getLatestPlaybackProgress(limit = 10): Promise<{ items: PlaybackProgress[] }> {
    const data = await requestData<{ items: PlaybackProgress[] }>(
      `/playback/progress/latest${buildQueryString({ limit })}`,
    );
    return {
      items: Array.isArray(data.items) ? data.items.map(absolutizePlaybackProgress) : [],
    };
  },

  /** Rejects with an error when the server has no record (404) for this work. */
  async getPlaybackProgress(sourceId: string): Promise<PlaybackProgress> {
    const data = await requestData<PlaybackProgress>(
      `/playback/progress/${encodeURIComponent(sourceId)}`,
    );
    return absolutizePlaybackProgress(data);
  },

  async getLibraryWorks(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<LibraryListResponse> {
    const data = await requestData<LibraryListResponse>(
      `/library/works${buildQueryString({
        page: params?.page,
        page_size: params?.pageSize,
        search: params?.search,
      })}`,
    );
    return {
      ...data,
      items: data.items.map(absolutizeLibrarySummary),
    };
  },

  async getLibraryWork(id: string): Promise<LibraryWorkDetail> {
    const data = await requestData<LibraryWorkDetail>(
      `/library/works/${encodeURIComponent(id)}`,
    );
    return absolutizeLibraryDetail(data);
  },
};
