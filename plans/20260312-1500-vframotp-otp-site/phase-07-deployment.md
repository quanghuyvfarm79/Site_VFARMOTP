# Phase 07 - Deployment

## Context Links
- Plan: [plan.md](./plan.md)
- Research: [researcher-02-frontend-deployment.md](./research/researcher-02-frontend-deployment.md)
- Brainstorm: `VFRAMOTP/brainstorm-summary.md` (section 8 - environments)

## Overview
- **Date**: 2026-03-12
- **Priority**: Medium (after core features complete)
- **Status**: pending
- Deploy to VMware Ubuntu 24.04 (test) and VPS Ubuntu 24.04 (staging/public)

## Key Insights
- Go binary is fully self-contained: copy binary + .env → run. No runtime dependency.
- Two binaries to deploy: `bin/api` and `bin/worker` → two systemd services
- Nginx: serve `frontend/dist/` as static files + reverse proxy `/api/` to `:8080`
- VPS: SSL via Let's Encrypt (Certbot) - only when domain DNS is configured
- Same setup process for VMware and VPS (document once, apply twice)
- Git workflow: Windows push → VM/VPS pull + make build + restart

## Requirements
- Ubuntu 24.04 base setup: Go, PostgreSQL 16, Redis 7, Nginx
- systemd services: `vframotp-api.service` and `vframotp-worker.service`
- Nginx config: static SPA + API proxy + security headers
- Makefile `deploy` target: pull + build + restart services
- SSL with Certbot on VPS (when domain ready)
- Git SSH configured on both servers

## Architecture

### Server Layout
```
/opt/vframotp/
├── bin/
│   ├── api           # Go API binary
│   └── worker        # Go worker binary
├── frontend/dist/    # React build output (served by Nginx)
├── migrations/       # SQL migration files
├── .env              # production env (not in git)
└── Makefile          # deploy target
```

### Nginx Config (`/etc/nginx/sites-available/vframotp`)
```nginx
server {
    listen 80;
    server_name _;   # or your domain

    root /opt/vframotp/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location ~* \.(js|css|png|jpg|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
}
```

### systemd Service (`/etc/systemd/system/vframotp-api.service`)
```ini
[Unit]
Description=VFRAMOTP API Server
After=network.target postgresql.service

[Service]
Type=simple
User=vframotp
WorkingDirectory=/opt/vframotp
EnvironmentFile=/opt/vframotp/.env
ExecStart=/opt/vframotp/bin/api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
(Duplicate for `vframotp-worker.service`, pointing to `bin/worker`)

### Makefile Deploy Target
```makefile
deploy:
	git pull origin main
	cd frontend && npm ci && npm run build
	CGO_ENABLED=0 GOOS=linux go build -o bin/api ./cmd/api
	CGO_ENABLED=0 GOOS=linux go build -o bin/worker ./cmd/worker
	migrate -path migrations -database "$$DATABASE_URL" up
	sudo systemctl restart vframotp-api vframotp-worker
	@echo "Deploy complete"
```

## Implementation Steps

### A. Ubuntu Server Setup (VMware + VPS, do once each)
```bash
# 1. System update
sudo apt update && sudo apt upgrade -y

# 2. Install Go 1.22+
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc

# 3. Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql

# 4. Install Redis 7
sudo apt install -y redis-server
sudo systemctl enable redis-server

# 5. Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# 6. Install golang-migrate
curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/

# 7. Install Node.js (for build only)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 8. Create app user
sudo useradd -m -s /bin/bash vframotp
sudo mkdir -p /opt/vframotp
sudo chown vframotp:vframotp /opt/vframotp

# 9. Create PostgreSQL DB
sudo -u postgres psql -c "CREATE USER vframotp WITH PASSWORD 'your_strong_password';"
sudo -u postgres psql -c "CREATE DATABASE vframotp OWNER vframotp;"
```

### B. Git SSH Setup (on each server)
```bash
ssh-keygen -t ed25519 -C "vmware-server" -f ~/.ssh/id_vframotp
cat ~/.ssh/id_vframotp.pub  # add this to GitHub Deploy Keys
# GitHub repo > Settings > Deploy Keys > Add key (read-only)

# ~/.ssh/config
Host github.com
  IdentityFile ~/.ssh/id_vframotp

# Clone
cd /opt/vframotp
git clone git@github.com:quanghuyvfarm79/vframotp.git .
```

### C. Configure and Start Services
```bash
# Copy and edit .env
cp .env.example .env
nano .env  # fill in DB_PASS, JWT_SECRET, etc.

# Run migrations
make migrate

# Install systemd services
sudo cp deploy/vframotp-api.service /etc/systemd/system/
sudo cp deploy/vframotp-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vframotp-api vframotp-worker
sudo systemctl start vframotp-api vframotp-worker

# Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vframotp
sudo ln -s /etc/nginx/sites-available/vframotp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### D. SSL on VPS (when domain DNS ready)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Certbot auto-modifies nginx config for SSL
# Auto-renewal: certbot installs timer automatically
```

### E. Daily Git Workflow
```bash
# Windows (develop)
git add . && git commit -m "feat: ..." && git push origin main

# VMware (test)
cd /opt/vframotp && make deploy

# VPS (staging/public)
cd /opt/vframotp && make deploy
```

### F. Store Deploy Files in Repo
```
deploy/
├── vframotp-api.service    # systemd unit
├── vframotp-worker.service # systemd unit
└── nginx.conf              # nginx site config
```

## Related Code Files
| File | Action |
|------|--------|
| `Makefile` | modify - add `deploy` target |
| `deploy/vframotp-api.service` | create |
| `deploy/vframotp-worker.service` | create |
| `deploy/nginx.conf` | create |

## Todo List
- [ ] Create `deploy/` directory in repo with systemd + nginx templates
- [ ] Add `deploy` target to Makefile
- [ ] VMware: install Go, PG, Redis, Nginx, Node
- [ ] VMware: create DB + user
- [ ] VMware: SSH key → GitHub Deploy Key
- [ ] VMware: clone repo, configure .env
- [ ] VMware: run migrations, build, start services
- [ ] VMware: configure Nginx, test via VM IP
- [ ] VPS: repeat all VMware steps
- [ ] VPS: configure SSL with Certbot (when domain ready)
- [ ] Test: `make deploy` from git pull to running in < 2 min

## Success Criteria
- `http://vmware-ip/` serves React app
- `http://vmware-ip/api/?key=...&action=get_all_services` returns JSON
- `systemctl status vframotp-api` shows `active (running)`
- `systemctl status vframotp-worker` shows `active (running)`
- Services restart automatically after server reboot (`systemctl enable`)
- VPS: HTTPS with valid Let's Encrypt cert (when domain configured)
- `make deploy` on server completes and restarts services

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| PostgreSQL port exposed to internet | Bind to localhost only (default on Ubuntu) |
| Asynq dashboard (:8081) exposed | Nginx does NOT proxy :8081; accessible only via SSH tunnel |
| systemd service not restarting | `Restart=always; RestartSec=5` in unit file |
| DB migration fails on deploy | `make deploy` runs migrate before restart; rollback with `migrate down 1` |
| VPS firewall blocks 80/443 | `sudo ufw allow 'Nginx Full'` |

## Security Considerations
- `.env` on server: owned by `vframotp` user, `chmod 600 .env`
- Nginx: no direct access to `:8080` or `:6379` from outside
- Asynq dashboard `:8081`: never proxy publicly; use SSH port forwarding for access
- PostgreSQL: no external port, only localhost connections
- UFW rules: allow only 22 (SSH), 80, 443 on VPS

## Unresolved Questions
1. What is the domain name? (needed for Nginx `server_name` and Certbot)
2. VPS root password / SSH access method?
3. VMware IP address? (for local testing documentation)

## Next Steps
Project complete. Post-launch (Phase 3/YAGNI):
- SePay webhook (auto top-up)
- Telegram notifications
- Excel transaction export
