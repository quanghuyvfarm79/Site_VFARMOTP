# Hướng Dẫn Deploy VFRAMOTP

**Dự án:** VFRAMOTP - Hệ thống quản lý OTP
**Stack:** Go + Gin + GORM + PostgreSQL + Redis (Asynq) / React + TypeScript + Vite
**Domain:** otp.nghienbanquyen.com (qua Cloudflare Tunnel)
**Môi trường:** Ubuntu 24.04 Server trên VMware Workstation 17
**Ngày cập nhật:** 2026-03-13

---

## Mục Lục

1. [Cài VMware và Ubuntu 24.04](#phần-1-cài-vmware-và-ubuntu-2404)
2. [Cài phần mềm cần thiết](#phần-2-cài-phần-mềm-cần-thiết)
3. [Deploy code](#phần-3-deploy-code)
4. [Cài systemd services](#phần-4-cài-systemd-services)
5. [Cài Nginx](#phần-5-cài-nginx)
6. [Cài Cloudflare Tunnel](#phần-6-cài-cloudflare-tunnel)
7. [Quy trình update code](#phần-7-quy-trình-update-code)
8. [Tài khoản mặc định](#tài-khoản-mặc-định)
9. [Troubleshooting](#troubleshooting)

---

## PHẦN 1: Cài VMware và Ubuntu 24.04

### 1.1 Cài VMware Workstation 17

1. Tải VMware Workstation 17 từ [vmware.com](https://www.vmware.com)
2. Cài đặt bình thường theo wizard
3. Tạo VM mới: **File > New Virtual Machine > Typical**
4. Chọn file ISO Ubuntu 24.04 Server
5. Cấu hình tài nguyên:
   - RAM: tối thiểu 2 GB
   - CPU: tối thiểu 2 cores
   - Disk: tối thiểu 20 GB
6. Network: chọn **Bridged**
   - Tick chọn **"Replicate physical network connection state"**
   - Mục đích: VM sẽ lấy IP cùng dải mạng với máy host, dễ SSH vào

### 1.2 Cài Ubuntu 24.04 Server

Khởi động VM và cài Ubuntu theo các bước sau:

| Bước | Lựa chọn |
|------|-----------|
| Language | English |
| Installer update | Continue without updating |
| Keyboard | English (US) |
| Network | Giữ mặc định (DHCP) |
| Proxy | Để trống |
| Mirror | Giữ mặc định |
| Storage | **Use entire disk** (KHÔNG chọn LVM) |

**Profile setup** - đây là bước quan trọng nhất, username này dùng để SSH sau:

| Trường | Giá trị |
|--------|---------|
| Your name | vfarmotp |
| Server name | vfarmotptest |
| Username | **vfarmotp** |
| Password | (đặt mật khẩu mạnh, ghi nhớ lại) |

> **QUAN TRỌNG:** Username là `vfarmotp` (không phải `vframotp`). Nhầm username này sẽ gây lỗi SSH và systemd service sau này.

- **OpenSSH server:** Chọn **YES** (tick "Install OpenSSH server")
- **Snaps:** Bỏ qua, chọn **Done**
- Chờ cài xong, chọn **Reboot Now**

### 1.3 SSH vào VM từ máy Windows

Sau khi VM reboot, tìm IP của VM:

```bash
ip addr show
```

Tìm dòng `inet` của card mạng chính (thường là `ens33` hoặc `eth0`), ví dụ: `192.168.1.105`.

Từ máy Windows, mở Terminal (PowerShell hoặc CMD) và SSH vào:

```bash
ssh vfarmotp@<IP_VM>
```

Ví dụ:

```bash
ssh vfarmotp@192.168.1.105
```

Nhập mật khẩu đã đặt lúc cài Ubuntu. Nếu đăng nhập thành công, tiếp tục các bước tiếp theo.

---

## PHẦN 2: Cài Phần Mềm Cần Thiết

Tất cả lệnh bên dưới chạy trong terminal SSH vào VM.

### 2.1 Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Cài Go 1.22

```bash
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
```

Kết quả mong đợi:

```
go version go1.22.4 linux/amd64
```

### 2.3 Cài Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

Kết quả mong đợi: Node 20.x và npm 10.x.

### 2.4 Cài PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Tạo user và database cho ứng dụng:

```bash
sudo -u postgres psql
```

Trong psql, chạy lần lượt các lệnh sau:

```sql
CREATE USER vfarmotp WITH PASSWORD 'Vfarm@2024';
CREATE DATABASE vframotp OWNER vfarmotp;
GRANT ALL PRIVILEGES ON DATABASE vframotp TO vfarmotp;
\q
```

### 2.5 Cài Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
```

Kiểm tra Redis đang chạy:

```bash
redis-cli ping
```

Kết quả mong đợi: `PONG`

### 2.6 Cài golang-migrate

Tool này dùng để chạy database migration:

```bash
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.17.1/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/
migrate -version
```

### 2.7 Cài make

```bash
sudo apt install -y make
```

---

## PHẦN 3: Deploy Code

### 3.1 Tạo thư mục ứng dụng

```bash
sudo mkdir -p /opt/vframotp
sudo chown vfarmotp:vfarmotp /opt/vframotp
```

### 3.2 Tạo SSH deploy key để clone từ GitHub

```bash
ssh-keygen -t ed25519 -C "deploy@vfarmotptest" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub
```

Copy toàn bộ nội dung in ra (dòng bắt đầu bằng `ssh-ed25519 ...`).

Lên GitHub, vào repo: **Settings > Deploy keys > Add deploy key**

- Title: `vfarmotptest deploy`
- Key: paste public key vừa copy
- Allow write access: **NO** (không cần)
- Bấm **Add key**

Cấu hình SSH client để dùng deploy key khi kết nối GitHub:

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_key
  StrictHostKeyChecking no
EOF
```

### 3.3 Clone repository

```bash
git clone git@github.com:quanghuyvfarm79/Site_VFARMOTP.git /opt/vframotp
cd /opt/vframotp
```

### 3.4 Tạo file .env

```bash
cat > /opt/vframotp/.env << 'EOF'
APP_ENV=production
API_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=vfarmotp
DB_PASS=Vfarm@2024
DB_NAME=vframotp
REDIS_ADDR=localhost:6379
JWT_SECRET=abcdef1234567890abcdef1234567890
WORKER_CONCURRENCY=10
EOF
```

> **Lưu ý bảo mật:** Thay `JWT_SECRET` bằng một chuỗi ngẫu nhiên đủ dài trong môi trường production thực tế.

### 3.5 Build frontend và backend

```bash
cd /opt/vframotp
cd frontend && npm ci && cd ..
make build
```

Lệnh `make build` sẽ:
- Build Go backend ra file binary `./api` (API server)
- Build Go worker ra file binary `./worker` (Asynq worker)
- Frontend đã được build ở bước `npm ci` và kết quả nằm ở `frontend/dist/`

Kiểm tra file binary đã tạo ra:

```bash
ls -lh /opt/vframotp/api /opt/vframotp/worker
```

### 3.6 Chạy database migration

```bash
migrate -path ./migrations -database "postgres://vfarmotp:Vfarm@2024@localhost:5432/vframotp?sslmode=disable" up
```

Nếu migration thành công, sẽ thấy output như:

```
1/u create_users (Xms)
2/u create_otp_sessions (Xms)
...
```

---

## PHẦN 4: Cài Systemd Services

Systemd services giúp API server và Worker tự động khởi động khi VM reboot và tự restart nếu bị crash.

### 4.1 Nội dung file service

File `deploy/vframotp-api.service` trong repo đã có sẵn với nội dung:

```ini
[Unit]
Description=VFRAMOTP API Server
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=vfarmotp
WorkingDirectory=/opt/vframotp
EnvironmentFile=/opt/vframotp/.env
ExecStart=/opt/vframotp/api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

File `deploy/vframotp-worker.service` trong repo đã có sẵn với nội dung:

```ini
[Unit]
Description=VFRAMOTP Worker
After=network.target redis-server.service

[Service]
Type=simple
User=vfarmotp
WorkingDirectory=/opt/vframotp
EnvironmentFile=/opt/vframotp/.env
ExecStart=/opt/vframotp/worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **QUAN TRỌNG:** `User=vfarmotp` phải khớp chính xác với username trên máy Ubuntu. Nếu username khác, sửa lại trước khi cài.

### 4.2 Cài và kích hoạt services

```bash
sudo cp /opt/vframotp/deploy/vframotp-api.service /etc/systemd/system/
sudo cp /opt/vframotp/deploy/vframotp-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vframotp-api
sudo systemctl enable --now vframotp-worker
```

### 4.3 Kiểm tra services đang chạy

```bash
sudo systemctl status vframotp-api
sudo systemctl status vframotp-worker
```

Kết quả mong đợi: cả hai đều hiển thị `Active: active (running)`.

---

## PHẦN 5: Cài Nginx

Nginx đóng vai trò reverse proxy: nhận request HTTP từ Cloudflare Tunnel, chuyển `/api/` đến Go backend (cổng 8080) và phục vụ file tĩnh của React frontend.

### 5.1 Cài Nginx

```bash
sudo apt install -y nginx
```

### 5.2 Tạo config cho site

```bash
sudo nano /etc/nginx/sites-available/vframotp
```

Dán nội dung sau:

```nginx
server {
    listen 80;
    server_name _;

    root /opt/vframotp/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Lưu file: `Ctrl+O`, Enter, `Ctrl+X`.

> **Giải thích cấu hình:**
> - `location /api/` chuyển tiếp mọi request `/api/...` đến Go API server ở cổng 8080
> - `location /` phục vụ React SPA, fallback về `index.html` để React Router hoạt động

### 5.3 Kích hoạt config và khởi động Nginx

```bash
sudo ln -s /etc/nginx/sites-available/vframotp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
```

Lệnh `nginx -t` kiểm tra syntax config. Nếu output là `syntax is ok` và `test is successful` thì tiếp tục.

---

## PHẦN 6: Cài Cloudflare Tunnel

Cloudflare Tunnel giúp expose ứng dụng ra internet qua domain `otp.nghienbanquyen.com` mà không cần mở port hay có IP public.

### 6.1 Cài cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

Kiểm tra:

```bash
cloudflared --version
```

### 6.2 Đăng nhập Cloudflare

```bash
cloudflared tunnel login
```

Lệnh này in ra một URL. Mở URL đó trên trình duyệt máy Windows, đăng nhập Cloudflare, chọn domain `nghienbanquyen.com`, rồi bấm **Authorize**.

Sau khi authorize, file `~/.cloudflared/cert.pem` sẽ được tạo tự động trên VM.

### 6.3 Tạo tunnel

```bash
cloudflared tunnel create vframotp
```

Output sẽ có dạng:

```
Created tunnel vframotp with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Ghi lại **Tunnel ID** (chuỗi UUID đó). File credentials được lưu tại `~/.cloudflared/<TUNNEL_ID>.json`.

### 6.4 Tạo file config

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Dán nội dung sau, thay `<TUNNEL_ID>` bằng UUID vừa ghi và `<USERNAME>` bằng `vfarmotp`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<USERNAME>/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: otp.nghienbanquyen.com
    service: http://localhost:80
  - service: http_status:404
```

Ví dụ thực tế:

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890
credentials-file: /home/vfarmotp/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
ingress:
  - hostname: otp.nghienbanquyen.com
    service: http://localhost:80
  - service: http_status:404
```

### 6.5 Cấu hình DNS trên Cloudflare

```bash
cloudflared tunnel route dns vframotp otp.nghienbanquyen.com
```

Lệnh này tự động tạo CNAME record trên Cloudflare DNS, trỏ `otp.nghienbanquyen.com` về tunnel.

### 6.6 Cài cloudflared thành systemd service

```bash
sudo cloudflared --config /home/vfarmotp/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

> **QUAN TRỌNG:** Phải truyền `--config` với đường dẫn tuyệt đối. Nếu không, cloudflared sẽ báo lỗi "no config found".

Kết quả mong đợi: `Active: active (running)`.

### 6.7 Kiểm tra kết quả

Mở trình duyệt máy Windows, truy cập:

```
https://otp.nghienbanquyen.com
```

Nếu thấy giao diện React của VFRAMOTP hiện ra, việc deploy đã hoàn tất.

---

## PHẦN 7: Quy Trình Update Code

Mỗi khi có code mới trên GitHub, chạy các lệnh sau theo thứ tự:

```bash
cd /opt/vframotp

# 1. Pull code mới
git pull

# 2. Install dependencies frontend (nếu có thay đổi package.json)
cd frontend && npm ci && cd ..

# 3. Build lại
make build

# 4. Chạy migration mới (nếu có)
migrate -path ./migrations -database "postgres://vfarmotp:Vfarm@2024@localhost:5432/vframotp?sslmode=disable" up

# 5. Restart services
sudo systemctl restart vframotp-api
sudo systemctl restart vframotp-worker
```

Kiểm tra sau khi restart:

```bash
sudo systemctl status vframotp-api
sudo systemctl status vframotp-worker
sudo journalctl -u vframotp-api -n 20 --no-pager
```

---

## Tài Khoản Mặc Định

Tài khoản được seed vào database sau khi chạy migration:

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| Admin | admin@vframotp.com | Admin@123 |

> **Lưu ý:** Đổi mật khẩu admin ngay sau lần đăng nhập đầu tiên trong môi trường production.

---

## Troubleshooting

### Xem log realtime

```bash
# Log API server
sudo journalctl -u vframotp-api -f

# Log Worker
sudo journalctl -u vframotp-worker -f

# Log Nginx
sudo journalctl -u nginx -f

# Log Cloudflare Tunnel
sudo journalctl -u cloudflared -f
```

### Xem log gần đây (không follow)

```bash
sudo journalctl -u vframotp-api -n 50 --no-pager
```

### Restart tất cả services cùng lúc

```bash
sudo systemctl restart vframotp-api vframotp-worker nginx cloudflared
```

### Kiểm tra các cổng đang lắng nghe

```bash
ss -tlnp | grep -E '80|8080|5432|6379'
```

Kết quả mong đợi: cổng 80 (Nginx), 8080 (Go API), 5432 (PostgreSQL), 6379 (Redis) đều hiện ra.

---

### Bảng Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `ssh: Permission denied` | Nhập sai username | Dùng `ssh vfarmotp@<IP>` (không phải `vframotp`) |
| `go: command not found` | Chưa load PATH | Chạy `source ~/.bashrc` |
| `cmd/api: no such file` khi build | `.gitignore` có dòng `api` thay vì `/api` | Kiểm tra `.gitignore`, sửa thành `/api` và `/worker` |
| `systemd: status 217/USER` | `User=` trong service file sai username | Sửa `User=` cho đúng username, rồi `sudo systemctl daemon-reload` |
| `cloudflared: no config found` | Thiếu flag `--config` khi install service | Chạy `sudo cloudflared --config /home/vfarmotp/.cloudflared/config.yml service install` |
| `HTTP 500` khi đăng ký - column does not exist | Chưa chạy migration | Chạy lại lệnh `migrate ... up` ở Phần 3.6 |

---

### Kiểm tra kết nối database thủ công

```bash
psql -h localhost -U vfarmotp -d vframotp
```

Nhập password `Vfarm@2024`. Nếu vào được psql prompt thì database ổn.

### Kiểm tra API server phản hồi

```bash
curl -s http://localhost:8080/health
```

Nếu trả về JSON thì API đang chạy bình thường.

### Kiểm tra Nginx phục vụ đúng file

```bash
curl -s http://localhost/ | head -20
```

Nên thấy HTML của React app.
