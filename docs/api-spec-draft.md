# API Spec Draft (v0)

> Scope: backend Go service powering React + Vite frontend. All endpoints under `/api`. Auth TBD (token header placeholder).

## Common Definitions
- **TaskStatus**: `QUEUED | RUNNING | SUCCESS | FAILED | CANCELED`.
- **TaskType**: `search-export | download | sync | sync-download | sync-retry | media-scan`.
- **Pagination**: request `page`, `pageSize`; response includes `total`, `page`, `pageSize`.
- **Error Model**: `{ "code": string, "message": string, "details"?: any }`.

## Auth & Config
### GET /api/config
- Response: `{ user, downloader, limit }` mirroring `model.Config` (strings sanitized).
### PUT /api/config
- Body: same structure, partial updates allowed.
- Behavior: validate + persist + restart EngineManager components.

## Search
### GET /api/search
- Query:
  - `q`: keyword / DSL string.
  - `count`: default 20.
  - `page`, `pageSize` for pagination of remote results.
- Response: `{ items: SearchResultView[], pagination }` where `SearchResultView` includes `sourceId`, `title`, `release`, `rateAverage`, `dlCount`, `hasSubtitle`.
### POST /api/search/export
- Body: `{ query: string, count: number, format: 'csv'|'json' }`.
- Returns: `202 Accepted` with `{ taskId }`.

## Downloads
### POST /api/downloads
- Body: `{ mode: 'single'|'batch'|'hot100', ids?: string[], count?: number, outputDir?: string }`.
- Response: `{ taskId }`.
### GET /api/downloads
- Query filters: `status`, `mode`, `search`.
- Response: task list + progress summary.
### GET /api/downloads/:id
- Response: `{ task, logs: string[], artifacts?: [{ name, url }] }`.

## Sync / Metadata
### POST /api/sync
- Body: `{ scope: 'all'|'subtitle' }`.
- Response: `202 Accepted` `{ taskId }`.
### POST /api/sync/download
- Body: `{ batchSize?: number }`.
- Response: `202 Accepted` `{ taskId }`.
### POST /api/sync/retry
- Body: `{}` (optional filters TBD).
- Response: `202 Accepted` `{ taskId }`.
### POST /api/sync/download
- Body: `{ batchSize?: number }` triggers metadata sync + download pass respecting storage limits.
### POST /api/sync/retry
- Body optional filters; reuses CLI retry semantics.
### GET /api/sync/report
- Response: `{ totals: { metadata, subtitle }, downloads: {...}, progress: {...} }` akin to CLI report logs.

## Tasks & Events
### GET /api/tasks
- Query:
  - `type`: multi-value, filters TaskType.
  - `status`: multi-value, filters TaskStatus.
  - `source`, `search`, `page`, `pageSize`.
- Response: `{ items: Task[], total, page, size }`.
### GET /api/tasks/:id
- Response: single task row (includes payload/result/logExcerpt).
### GET /api/events (SSE)
- Event types: `task` (payload includes id/status/progress/message) and `heartbeat` (ISO timestamp every ~25s).

## Media Library
### GET /api/media/folders
- Query: `page`, `pageSize`, `keyword`, `hasSubtitles`, `dateRange`.
- Response: folder info (id, name, mediaId, date, hasSubtitles, tags, stats, previewImageUrl).
### GET /api/media/folders/:id
- Response: folder detail with nested files list.
### GET /api/media/files/:id/download
- Serves actual file (with permission checks) or returns presigned path.

## Settings / Utilities
### GET /api/logs/download-errors
- Streams or paginates log entries.
### POST /api/exports/:id/resend
- Re-create download link if expired.

## TODO / Open Questions
- Auth (JWT vs API token) & rate limiting per user.
- Whether to expose WebSocket alternative to SSE.
- Decide on long-poll fallback for environments without SSE.
- Multi-tenant support? currently single-user assumption.
