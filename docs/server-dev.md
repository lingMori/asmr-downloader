# HTTP Server Development Notes

## Run locally

```bash
cd $(git rev-parse --show-toplevel)
go run .
```

如果 `.asmroner-data/config.toml` 不存在，服务会自动生成默认配置。

环境变量：

- `ASMRO_HTTP_ADDR`：监听地址，默认 `127.0.0.1:8080`
- `ASMRO_WEB_DIR`：覆盖前端 SPA 目录（默认解析 `apps/yoru/dist` → `apps/web/dist` → `./web`)
- `ASMRO_CORS_ORIGINS`：覆盖 CORS 白名单
- `GIN_MODE`

## Current routes

### System / Config / Auth

- `GET /api/healthz`
- `GET /api/config`
- `PUT /api/config`
- `POST /api/config/pick-directory`(macOS 原生目录选择对话框)
- `GET /api/auth/status`
- `POST /api/auth/check`
- `POST /api/auth/login`

### Search & Discover

- `GET /api/search`
- `POST /api/search/download`
- `POST /api/search/export`
- `GET /api/discover/search`
- `GET /api/discover/popular`
- `GET /api/discover/recommend`
- `POST /api/discover/feedback`
- `GET /api/discover/works/:sourceId`
- `GET /api/discover/works/:sourceId/neighbors`
- `GET /api/discover/works/:sourceId/tracks/:trackId/stream`
- `GET /api/discover/works/:sourceId/tracks/:trackId/file`(一切非音频叶:字幕/图片/文本/视频等,音频走 /stream)
- `GET /api/discover/works/:sourceId/cover?type=main|240x240`(封面同源代理,前端 canvas 取色用;封面不可变,Cache-Control 一天)
- `GET /api/works/status`

### Downloads & Tasks

- `POST /api/downloads`
- `GET /api/tasks`
- `GET /api/tasks/summary`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`
- `POST /api/tasks/:id/retry`
- `DELETE /api/tasks/:id`

### Sync

- `POST /api/sync`
- `POST /api/sync/download`
- `POST /api/sync/retry`
- `GET /api/sync/report`
- `GET /api/sync/export`

### Library & Collections

- `GET /api/library/works`
- `GET /api/library/works/:id`
- `GET /media/*filepath`
- `GET /api/collections`
- `POST /api/collections`
- `DELETE /api/collections/:sourceId`

### Playback

- `PUT /api/playback/progress`
- `GET /api/playback/progress/latest`
- `GET /api/playback/progress/:sourceId`
- `DELETE /api/playback/progress/:sourceId`

### Events

- `GET /api/events`(SSE)
