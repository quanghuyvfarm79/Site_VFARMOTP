.PHONY: dev dev-api dev-worker build build-api build-worker migrate migrate-down clean frontend-dev frontend-build deploy

# Local dev: start Docker + API + Worker
dev:
	docker-compose up -d
	@echo "Waiting for DB/Redis to be ready..."
	@sleep 3
	$(MAKE) migrate
	@echo "Starting API and Worker..."
	start /B go run ./cmd/api
	go run ./cmd/worker

# Run API only (Windows)
dev-api:
	go run ./cmd/api

# Run Worker only
dev-worker:
	go run ./cmd/worker

# Build both binaries for Linux (deploy to Ubuntu)
build: build-api build-worker frontend-build

build-api:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/api ./cmd/api

build-worker:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/worker ./cmd/worker

# Run DB migrations
migrate:
	migrate -path migrations -database "postgres://vframotp:secret@localhost:5432/vframotp?sslmode=disable" up

migrate-down:
	migrate -path migrations -database "postgres://vframotp:secret@localhost:5432/vframotp?sslmode=disable" down

# Frontend
frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# Stop Docker services
clean:
	docker-compose down
	rm -rf bin/

# Deploy on Ubuntu server: pull + build + migrate + restart services
deploy:
	git pull origin main
	cd frontend && npm ci && npm run build
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/api ./cmd/api
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/worker ./cmd/worker
	migrate -path migrations -database "$$DATABASE_URL" up
	sudo systemctl restart vframotp-api vframotp-worker
	@echo "Deploy complete"

# Tidy Go modules
tidy:
	go mod tidy
