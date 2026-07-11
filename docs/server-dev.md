# HTTP Server Development Notes

## Run locally

```bash
cd $(git rev-parse --show-toplevel)
go run .
```

如果 `.asmroner-data/config.toml` 不存在，服务会自动生成默认配置。

环境变量：

- `ASMRO_HTTP_ADDR`
- `ASMRO_WEB_DIR`
- `GIN_MODE`

## Current routes

- `GET /api/healthz`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/search`
- `POST /api/search/download`
- `POST /api/search/export`
- `GET /api/discover/search`
- `GET /api/discover/works/:sourceId`
- `POST /api/downloads`
- `GET /api/library/works`
- `GET /api/library/works/:id`
- `GET /media/*filepath`
- `POST /api/sync`
- `POST /api/sync/download`
- `POST /api/sync/retry`
- `GET /api/sync/report`
- `GET /api/sync/export`
- `GET /api/tasks`
- `GET /api/tasks/summary`
- `GET /api/tasks/:id`
- `GET /api/events`
