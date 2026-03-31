# HTTP Server Development Notes

## Run Locally
```bash
# ensure config exists under ~/.asmroner-data/config.toml via `asmroner config`
cd $(git rev-parse --show-toplevel)
go run ./cmd/server --addr :8080
```

Environment overrides:
- `ASMRO_HTTP_ADDR`: default bind address if `--addr` not provided.
- `GIN_MODE`: defaults to `release`; set `debug` for verbose logs.

## Endpoints (current)
- `GET /api/healthz`: returns status/version/timestamp.
- `GET /api/config`: returns sanitized configuration (password masked).
- `GET /api/tasks`: list tasks with filters; `GET /api/tasks/:id` fetch detail.
- `POST /api/downloads`: enqueues a download job (mode `single|batch|hot100`) and returns `taskId`.
- `POST /api/sync`: triggers metadata sync as a task.
- `GET /api/events`: SSE stream emitting `task` events and 25s heartbeats.

More routes will be added as API spec is implemented.
