# ASMRoner

ASMRoner 现在已经收敛为一套全新的前后端架构：

- Go HTTP 服务
- React + Vite 控制台前端
- SQLite 任务/同步状态存储
- 本地媒体库浏览与播放

旧的 Cobra CLI 和旧的内嵌 `listen/webui` 已经移除，项目入口统一为新的 HTTP 服务。

## 当前能力

- 配置读取与保存
- 搜索作品
- 高级查询语法搜索
- 搜索结果批量下载
- 搜索结果导出 CSV / JSON
- 单个 / 批量 RJ 下载
- `hot100` 下载
- 元数据同步
- 同步下载
- 失败重试
- 同步状态导出 CSV / JSON
- 任务队列与 SSE 实时状态
- 本地媒体库浏览、播放、字幕轨道匹配

## 目录结构

```text
asmr-downloader/
├── apps/web/              # React + Vite 前端
├── internal/
│   ├── server/            # HTTP 路由与处理器
│   ├── services/          # 业务服务层
│   ├── store/             # SQLite 访问
│   ├── engine/            # asmr.one 交互与下载引擎
│   ├── model/             # 数据模型
│   ├── events/            # SSE 事件中心
│   └── database/          # 数据库初始化
├── docs/
├── main.go                # 统一服务入口
└── package.json
```

## 启动方式

### 1. 启动后端

```bash
go run . --addr :8080
```

如果 `.asmroner-data/config.toml` 不存在，服务会自动按默认值生成配置文件。

默认地址：

- `ASMRO_HTTP_ADDR=:8080`

### 2. 启动前端

```bash
npm install --prefix apps/web
npm run dev:web
```

默认前端地址：

- `http://localhost:5173`

默认后端 API：

- `http://localhost:8080/api`

如需修改前端 API 地址，可设置：

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

## 配置文件

配置文件路径：

```text
.asmroner-data/config.toml
```

默认配置包括：

- 账号密码
- API 地址
- 代理
- 最大并发与重试次数
- 同步目录
- 同步容量限制
- 优先媒体格式
- 限流与抖动参数

这些内容现在都可以直接在前端 `Settings` 页面修改并保存。

## 主要页面

- `Dashboard`：总体状态概览
- `Discover`：搜索、搜索导出、搜索下载、RJ 批量下载、hot100
- `Queue`：任务队列与任务详情
- `Library`：本地媒体浏览、播放、字幕匹配、文件访问
- `Sync`：元数据同步、批量下载、失败重试、同步导出
- `Settings`：配置编辑与持久化

## API 概览

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
- `GET /api/tasks/:id`
- `GET /api/events`

## 测试与构建

```bash
go test ./...
npm run test:web
npm run build:web
```

## 补充文档

- [docs/current-project-map.md](docs/current-project-map.md)
- [docs/server-dev.md](docs/server-dev.md)
