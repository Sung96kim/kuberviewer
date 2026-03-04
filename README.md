# KuberViewer

A modern web-based Kubernetes dashboard for browsing, managing, and troubleshooting cluster resources.

## Architecture

```
Browser → Nginx (TLS, static assets, reverse proxy)
              ├── /       → React SPA
              └── /api/*  → FastAPI backend → Kubernetes API
```

- **Frontend** — React 19, TanStack Router/Query/Table, Tailwind CSS, xterm.js, Monaco Editor
- **Backend** — Python 3.12, FastAPI, official `kubernetes` Python client
- **Proxy** — Nginx with self-signed TLS, gzip, WebSocket support

## Features

- Multi-cluster context switching with bulk delete
- OIDC authentication (via kubelogin)
- Resource browsing with auto-discovered API groups (Workloads, Networking, Storage, Config, CRDs)
- YAML editor with apply/patch/scale operations
- Resource creation from templates with saved definitions (localStorage)
- Pod log streaming (follow, search, timestamps, multi-container)
- Interactive pod terminal with Ctrl+C/V copy-paste (WebSocket-based xterm.js)
- Real-time resource watching (Server-Sent Events)
- Configurable polling speeds (Fast 1s, Normal 5s, Slow 30s, Paused, Custom)
- Node and pod metrics (via metrics-server)
- Prometheus integration (range/instant queries)
- Global resource search (Cmd+K)
- Cluster health overview (node/pod status)
- Dark mode

## Prerequisites

- Docker and Docker Compose
- A valid kubeconfig at `~/.kube/config` (or set `KUBECONFIG` env var)
- OpenSSL (for generating self-signed certs)

## Setup

### 1. Generate self-signed TLS certificates

Nginx expects certs in a `certs/` directory at the project root:

```bash
mkdir -p certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/selfsigned.key \
  -out certs/selfsigned.crt \
  -subj "/CN=localhost"
```

The `certs/` directory is gitignored.

### 2. Kubeconfig

Docker Compose mounts your kubeconfig read-only into the backend container:

```yaml
volumes:
  - ${KUBECONFIG:-${HOME}/.kube/config}:/root/.kube/config:ro
  - ${HOME}/.kube/cache:/root/.kube/cache  # for OIDC token cache
```

If your kubeconfig is not at the default path, set the `KUBECONFIG` environment variable before running Docker Compose.

For OIDC-based clusters, the backend container includes `kubectl` and `kubelogin` (kubectl-oidc_login). The `~/.kube/cache` volume is mounted read-write so OIDC tokens persist across container restarts.

### 3. Build and run

```bash
docker compose up --build -d
```

Open https://localhost:3443 (accept the self-signed cert warning).

| Service  | Port  | Description                          |
|----------|-------|--------------------------------------|
| Frontend | 3000  | HTTP (redirects to HTTPS on 3443)    |
| Frontend | 3443  | HTTPS (Nginx → SPA + API proxy)      |
| Backend  | 8000  | FastAPI (direct access, no TLS)      |

All ports bind to `127.0.0.1` only.

## Local development

Run the backend and frontend separately for hot-reload:

```bash
# Terminal 1 — Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000` automatically.

## Configuration

All backend settings use the `KUBERVIEWER_` prefix and can be set as environment variables or in Docker Compose:

| Variable                    | Default                     | Description                      |
|-----------------------------|-----------------------------|----------------------------------|
| `KUBERVIEWER_KUBECONFIG_PATH` | `~/.kube/config`          | Path to kubeconfig file          |
| `KUBERVIEWER_CORS_ORIGINS`    | `["http://localhost:5173"]` | Allowed CORS origins             |
| `KUBERVIEWER_LOG_LEVEL`       | `info`                    | Logging level                    |

## Project structure

```
kuberviewer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, routers
│   │   ├── config.py            # Pydantic Settings
│   │   ├── models.py            # Pydantic models
│   │   ├── kube/
│   │   │   ├── manager.py       # KubeManager singleton, OIDC auth
│   │   │   ├── discovery.py     # API resource discovery + grouping
│   │   │   ├── resources.py     # Generic K8s CRUD via raw API
│   │   │   ├── exec.py          # Pod exec (WebSocket)
│   │   │   ├── logs.py          # Pod log streaming (SSE)
│   │   │   ├── watch.py         # Resource watch (SSE)
│   │   │   ├── metrics.py       # Node/pod metrics (metrics-server)
│   │   │   └── prometheus.py    # Prometheus queries
│   │   └── routers/             # FastAPI route handlers
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── api.ts               # Typed fetch wrapper for /api/*
│   │   ├── routes/              # File-based routes (TanStack Router)
│   │   ├── components/
│   │   │   ├── layout/          # Header, Sidebar, ClusterHealth
│   │   │   ├── resources/       # ResourceTable, ResourceDetail, YAML editor
│   │   │   ├── detail-tabs/     # Resource-specific detail views
│   │   │   ├── terminal/        # Pod terminal (xterm.js)
│   │   │   ├── logs/            # Log streaming with search
│   │   │   └── ui/              # shadcn/ui base components
│   │   ├── hooks/               # React Query hooks, polling, exec, logs
│   │   └── lib/                 # Utilities, resource templates, saved definitions
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile.frontend          # Multi-stage: Node build → Nginx
├── Dockerfile.backend           # Python 3.12 + kubectl + kubelogin
├── docker-compose.yml
├── nginx.conf
├── certs/                       # Self-signed TLS certs (gitignored)
└── docs/plans/                  # Implementation plans
```

## API endpoints

Interactive Swagger docs are available at [localhost:8000/docs](http://localhost:8000/docs) when the backend is running.

## License

MIT
