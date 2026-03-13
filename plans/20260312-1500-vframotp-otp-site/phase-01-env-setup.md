# Phase 01 - Environment Setup & Project Scaffold

## Context Links
- Plan overview: [plan.md](./plan.md)
- Research: [researcher-02-frontend-deployment.md](./research/researcher-02-frontend-deployment.md)

## Overview
- **Date**: 2026-03-12
- **Priority**: Critical (blocks all other phases)
- **Status**: pending
- Foundation: git repo, Go project layout, Docker dev stack, Makefile, frontend scaffold

## Key Insights
- Use `cmd/internal/pkg` layout - Go compiler enforces `internal/` boundaries
- Docker Compose for Windows dev (no local PG/Redis install needed)
- Two Go binaries: `cmd/api` (HTTP) and `cmd/worker` (Asynq) - separate concerns
- Vite path aliases (`@/`) clean up imports significantly
- Makefile single entry point for all dev/build operations

## Requirements
- Git repo initialized, SSH keys configured on Windows + VMware + VPS
- Go 1.22+ project with `go.mod` (`module github.com/quanghuyvfarm79/vframotp`)
- Docker Compose: PostgreSQL 16 + Redis 7 with health checks
- React + TypeScript + Vite + Tailwind CSS scaffold in `frontend/`
- `.env.example` with all required vars documented
- Makefile targets: `dev`, `build`, `migrate`, `clean`

## Architecture
```
vframotp/
├── cmd/api/main.go          # HTTP server entry
├── cmd/worker/main.go       # Asynq worker entry
├── internal/
│   ├── config/              # Env config struct
│   ├── handler/             # HTTP handlers (Gin)
│   ├── service/             # Business logic
│   ├── repository/          # DB queries (GORM)
│   ├── model/               # GORM structs
│   ├── queue/               # Asynq task definitions
│   └── middleware/          # JWT, APIKey, CORS
├── pkg/
│   ├── provider/            # OTP provider HTTP client
│   └── jwt/                 # JWT helpers
├── migrations/              # golang-migrate SQL files
├── frontend/                # React + TS + Vite
├── Makefile
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## Related Code Files
| File | Action | Notes |
|------|--------|-------|
| `go.mod` | create | module name, Go version |
| `cmd/api/main.go` | create | stub - just starts Gin |
| `cmd/worker/main.go` | create | stub - just starts Asynq |
| `internal/config/config.go` | create | reads `.env` via godotenv |
| `docker-compose.yml` | create | PG16 + Redis7 |
| `Makefile` | create | dev/build/migrate targets |
| `.env.example` | create | all vars documented |
| `frontend/` | create | `npm create vite@latest` output |
| `.gitignore` | create | Go + Node + .env |

## Implementation Steps

### 1. GitHub SSH Setup (do once per machine)
```bash
# Windows (Git Bash)
ssh-keygen -t ed25519 -C "windows-dev" -f ~/.ssh/id_vframotp
# Add ~/.ssh/id_vframotp.pub to GitHub > Settings > SSH Keys
# ~/.ssh/config:
# Host github.com
#   IdentityFile ~/.ssh/id_vframotp

# VMware + VPS: same process, different key name
ssh-keygen -t ed25519 -C "vmware-dev" -f ~/.ssh/id_vframotp
```

### 2. Init Go Module
```bash
mkdir vframotp && cd vframotp
git init
go mod init github.com/quanghuyvfarm79/vframotp
go get github.com/gin-gonic/gin
go get github.com/hibiken/asynq
go get gorm.io/gorm gorm.io/driver/postgres
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-jwt/jwt/v5
go get github.com/joho/godotenv
```

### 3. Docker Compose (dev only)
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vframotp
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: vframotp
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vframotp"]
      interval: 10s; timeout: 5s; retries: 5
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s; timeout: 5s; retries: 5
volumes:
  postgres_data:
```

### 4. .env.example
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=vframotp
DB_PASS=secret
DB_NAME=vframotp
REDIS_ADDR=localhost:6379
JWT_SECRET=change_me_in_production
API_PORT=8080
WORKER_CONCURRENCY=10
```

### 5. Makefile
```makefile
.PHONY: dev build build-api build-worker migrate clean

dev:
	docker-compose up -d
	go run ./cmd/api &
	go run ./cmd/worker

build: build-api build-worker
	cd frontend && npm run build

build-api:
	CGO_ENABLED=0 GOOS=linux go build -o bin/api ./cmd/api

build-worker:
	CGO_ENABLED=0 GOOS=linux go build -o bin/worker ./cmd/worker

migrate:
	migrate -path migrations -database "postgres://vframotp:secret@localhost:5432/vframotp?sslmode=disable" up

clean:
	docker-compose down
	rm -rf bin/ frontend/dist
```

### 6. Frontend Scaffold
```bash
cd vframotp
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios react-router-dom
```

### 7. .gitignore
```
.env
bin/
frontend/node_modules/
frontend/dist/
*.exe
```

## Todo List
- [ ] Create GitHub repo `vframotp` (private)
- [ ] SSH key on Windows → add to GitHub
- [ ] SSH key on VMware → add to GitHub
- [ ] SSH key on VPS → add to GitHub
- [ ] `go mod init` + install dependencies
- [ ] Create directory structure (`mkdir -p cmd/api cmd/worker internal/{config,handler,service,repository,model,queue,middleware} pkg/{provider,jwt} migrations`)
- [ ] Write `docker-compose.yml`
- [ ] Write `.env.example`
- [ ] Write `Makefile`
- [ ] Scaffold frontend with Vite
- [ ] Configure Tailwind CSS
- [ ] Stub `cmd/api/main.go` (Gin hello world)
- [ ] Stub `cmd/worker/main.go` (Asynq hello world)
- [ ] Write `internal/config/config.go`
- [ ] Commit + push to GitHub

## Success Criteria
- `make dev` starts Docker (PG+Redis), Go API on :8080, Go worker
- `curl localhost:8080/health` returns `{"status":"ok"}`
- `cd frontend && npm run dev` starts Vite dev server
- `git push` succeeds from Windows via SSH
- `git pull && make build` succeeds on VMware

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| SSH key confusion (3 machines) | Use separate key names, document in README |
| Docker Desktop WSL2 issues on Windows | Keep Docker Desktop updated; use WSL2 backend |
| Go module proxy blocked | Set `GOPROXY=direct` if behind VPN |

## Security Considerations
- Never commit `.env` (gitignore enforced)
- Docker ports 5432/6379 bind to localhost only (default)
- Asynq dashboard on :8081 — internal only, no public exposure

## Next Steps
Phase 02: Database schema design + migrations + auth middleware
