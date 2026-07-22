# Repository Structure & Scaffolding Plan

> Historical planning document. The repository has since been simplified around `main.go` + `internal/*` + `apps/web`.

```
asmr-downloader/
├── apps/
│   ├── backend/          # Go HTTP service (API + CLI entrypoints)
│   │   ├── cmd/          # cobra CLI + server main
│   │   ├── internal/
│   │   │   ├── http/handlers, middleware, dto
│   │   │   ├── services/ (search, download, sync, tasks)
│   │   │   ├── jobs/     # task runners, worker pools
│   │   │   ├── store/    # repositories (sqlite, fs abstractions)
│   │   │   └── config/
│   │   └── api/          # OpenAPI spec and generated clients
│   └── web/              # React + Vite + TanStack Router/Query + shadcn
│       ├── src/
│       │   ├── routes/   # TanStack Router route definitions
│       │   ├── components/
│       │   │   ├── ui/   # shadcn generated components
│       │   │   └── common/
│       │   ├── features/ # dashboard, search, tasks, library, settings
│       │   ├── lib/      # api client, hooks, utils
│       │   ├── styles/   # tailwind config, glassmorphism tokens
│       │   └── tests/
│       ├── public/
│       └── storybook/
├── packages/
│   ├── shared-contracts/ # OpenAPI generated TypeScript types, zod schemas
│   ├── ui-tokens/        # Tailwind + CSS tokens (if split out)
│   └── tooling/          # shared lint configs, scripts
├── docs/
├── scripts/
└── package.json / pnpm-workspace.yaml / go.work
```

## Scaffolding Tasks
1. **Monorepo Tooling**
   - Introduce `pnpm-workspace.yaml` covering root, `apps/web`, `packages/*`.
   - Add `package.json` scripts for lint/test/build/storybook.
   - Configure `go.work` (or keep single module) referencing `apps/backend` and shared packages.
2. **Backend App Layout**
   - Move current Go sources into `apps/backend` while preserving module path `asmroner` (or rename to `github.com/fireinrain/asmroner`).
   - Split `cmd` into `cmd/cli` and `cmd/server`; server main hosts Gin/Fiber HTTP service.
   - Create `internal/http` for handlers/middleware, `internal/services` as wrappers around EngineManager, `internal/store` for DB access, `internal/tasks` for queue management.
   - Add `api/openapi.yaml` (generated via `oapi-codegen` or `kin-openapi`).
3. **Frontend App Setup**
   - Bootstrap `apps/web` via `pnpm create vite@latest web -- --template react-ts` (or manual). Replace CRA artifacts.
   - Install dependencies: `@tanstack/router`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `tailwindcss`, `class-variance-authority`, `lucide-react`, `shadcn-ui`, `framer-motion`, `axios` or custom fetch wrapper, `msw`, `vitest`, `@testing-library/react`, `storybook`.
   - Initialize Tailwind v4 + shadcn CLI config; generate base components.
   - Configure absolute imports + `tsconfig.paths.json`.
4. **Shared Contracts**
   - Generate TypeScript types from OpenAPI into `packages/shared-contracts`; export fetch clients + zod validators.
   - Publish Go DTO conversions referencing same spec to avoid drift.
5. **Scripts & CI**
   - `scripts/dev-backend.sh`, `scripts/dev-frontend.sh`, `scripts/dev-all.sh` for convenience.
   - GitHub Actions: `backend-ci` (go fmt, vet, test), `frontend-ci` (pnpm install, lint, test, build), `storybook-deploy`, `e2e` (Playwright, triggered nightly).
   - Pre-commit hooks for Go fmt, gofumpt, Biome.

## Migration Notes
- Keep existing CLI entry working during transition: CLI commands call into `internal/services` shared with HTTP handlers.
- `listen` web assets replaced by React app; maintain compatibility until new UI ready (optional env flag to serve legacy UI).
- Document environment variables: backend `.env` (DB path, data dir, API credentials), frontend `.env` (VITE_API_BASE_URL).
- Schedule incremental PRs: move code, add HTTP server skeleton, expose first endpoints, bootstrap frontend, etc.
