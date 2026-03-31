# Backend Audit & API Requirements

## Current Command Responsibilities
- **config (`cmd/config.go`)**: interactive setup of downloader credentials, proxy, rate limiting, directories; writes `~/.asmroner-data/config.toml`.
- **search (`cmd/search.go`)**: parses advanced query syntax, hits asmr.one search API via `engine.EngineManager`, renders CLI table, supports `download` and `export` subcommands.
- **download (`cmd/download.go`)**: accepts single/multiple RJIDs or `hot100`; ensures directory, uses `EngineManager.SimpleDownload` or `DownloadHot100`.
- **sync (`cmd/sync.go`)**: orchestrates metadata sync → download loops, retry, export, report; persists metadata in SQLite tables `metadata_works` + `work_sync_infos`.
- **listen (`cmd/listen.go`)**: serves embedded web UI for browsing local downloads; scans directories into in-memory SQLite and exposes `/api/list` for the frontend.

## Engine/Model Insights
- `EngineManager` handles auth/login, metadata sync, search, download, limiter control, job batching via pond worker pools.
- Database schemas: `MetadataWork` (core metadata) and `WorkSyncInfo` (per-download status, dir size, fail reason, timestamps).
- Tasks currently implicit (goroutine loops). Need explicit task model (id, type, status, payload, progress, timestamps, log excerpts).

## Proposed HTTP API Surface
1. **Auth & Config**
   - `GET /api/config` → current downloader/limit settings.
   - `PUT /api/config` → update config; triggers validation + reload.
   - `POST /api/auth/login` (optional) → session token for frontend.
2. **Search & Catalog**
   - `GET /api/search` with query params (keyword, DSL, pagination) → returns `SearchResultView` list and meta.
   - `POST /api/search/export` → asynchronous export task (CSV/JSON) with callback download URL.
3. **Downloads**
   - `POST /api/downloads` → body includes `mode` (`single|batch|hot100`), target ids/count, destination; creates task.
   - `GET /api/downloads/:id` → task status + logs; `GET /api/downloads` for listing/filtering.
4. **Sync**
   - `POST /api/sync` → trigger metadata sync; options `full|incremental`, limit.
   - `POST /api/sync/download` → start sync + download pass (mirrors CLI `sync download`).
   - `POST /api/sync/retry` → retry failed entries.
   - `GET /api/sync/report` → aggregated stats (counts, subtitle ratios, storage usage).
5. **Tasks & Events**
   - `GET /api/tasks` / `GET /api/tasks/:id` for any task type.
   - `GET /api/events` (SSE/WS) streaming task progress, log lines, heartbeat.
6. **Media Library**
   - `GET /api/media/folders` (pagination, filters) → structure similar to `FolderInfo`.
   - `GET /api/media/files/:id` or direct file serving via signed URL/static path.
7. **Exports & Logs**
   - `GET /api/exports/:id` download generated files.
   - `GET /api/logs/download-errors` for troubleshooting.

## Data & Model Adjustments
- Introduce `tasks` table with fields: `id`, `type`, `payload`, `status`, `progress`, `message`, `created_at`, `updated_at`, `completed_at`.
- Extend `work_sync_infos` to include `task_id`, `priority`, `source`. Provide indexes for SourceID.
- Provide DTO mappers: `MetadataWork` → `WorkSummary`, `WorkDetail`. Sanitise paths/titles for HTTP.

## Gaps / Questions
- Authentication model (API tokens vs session) TBD.
- File serving strategy: direct filesystem vs proxy streaming; need to ensure permission boundary.
- Rate limiting/external API keys: ensure config updates propagate to running EngineManager.
- Should exports be stored on disk or streamed? Determine retention + cleanup policy.

Next: use this audit to draft OpenAPI skeleton and repo structure.
