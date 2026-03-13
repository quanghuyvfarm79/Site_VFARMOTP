# Hướng dẫn Deploy VFRAMOTP lên Server

## Phần 1: Tạo VM trong VMware

### Bước qua từng màn hình:

**Màn 1 - Configuration:** Typical → Next

**Màn 2 - Guest OS Installation:**
- Tích "Installer disc image file (iso)"
- Browse → chọn file `ubuntu-24.04-live-server-amd64.iso`
- Next

**Màn 3 - Easy Install Information:**
```
Full name:  vframotp
User name:  vframotp
Password:   (đặt mật khẩu, nhớ lại)
```
→ Next

**Màn 4 - VM Name & Location:**
```
Virtual machine name: vframotp-test
Location: F:\vframotp-test   (ổ nào có nhiều dung lượng)
```
→ Next

**Màn 5 - Disk Capacity:**
```
Maximum disk size: 40 GB
Tích: Store virtual disk as a single file
```
→ Next

**Màn 6 - Ready to Create:**
- Bấm **Customize Hardware**
  - Memory: 4096 MB
  - Processors: 2
  - Network Adapter: NAT (giữ nguyên)
  - Floppy: Remove (xóa đi)
- Close → **Finish**

---

## Phần 2: Cài Ubuntu (trong VM)

VM tự boot. Làm theo các màn hình:

```
Language: English → Enter
Keyboard: English (US) → Done
Install type: Ubuntu Server (KHÔNG chọn minimized) → Done
Network: để mặc định (DHCP) → Done
Proxy: bỏ trống → Done
Mirror: để mặc định → Done
Storage: Use entire disk → Done → Continue (khi hỏi confirm)

Profile:
  Your name:    vframotp
  Server name:  vframotp-test
  Username:     vframotp
  Password:     (mật khẩu của bạn)
→ Done

Ubuntu Pro: Skip for now → Continue

SSH: Tích "Install OpenSSH server" ✓ → Done

Snaps: Không chọn gì → Done
```

Đợi ~10 phút → **Reboot Now** → Enter

---

## Phần 3: SSH vào VM từ Windows

Sau khi VM reboot, đăng nhập trong VM:
```
login: vframotp
password: (mật khẩu vừa đặt)
```

Lấy IP:
```bash
ip addr show
# Tìm: inet 192.168.x.x  ← đây là IP VM
```

Từ Windows Terminal / PowerShell:
```powershell
ssh vframotp@192.168.x.x
# Gõ yes → nhập mật khẩu
```

---

## Phần 4: Cài Dependencies

Copy từng block vào terminal:

### 4.1 Update hệ thống
```bash
sudo apt update && sudo apt upgrade -y
```

### 4.2 Cài Go 1.22
```bash
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
# Kết quả: go version go1.22.0 linux/amd64
```

### 4.3 Cài PostgreSQL + Redis + Nginx
```bash
sudo apt install -y postgresql postgresql-contrib redis-server nginx
sudo systemctl enable postgresql redis-server nginx
sudo systemctl start postgresql redis-server nginx
```

### 4.4 Cài Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
# Kết quả: v20.x.x
```

### 4.5 Cài golang-migrate
```bash
curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/
migrate -version
```

---

## Phần 5: Tạo Database PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER vframotp WITH PASSWORD 'Vfarm@2024';"
sudo -u postgres psql -c "CREATE DATABASE vframotp OWNER vframotp;"

# Kiểm tra
sudo -u postgres psql -c "\l"
# Thấy database "vframotp" là OK
```

---

## Phần 6: Tạo SSH Key cho GitHub Deploy

```bash
ssh-keygen -t ed25519 -C "vmware-test" -f ~/.ssh/id_vframotp
# Nhấn Enter 2 lần (bỏ trống passphrase)

cat ~/.ssh/id_vframotp.pub
# Copy TOÀN BỘ dòng này (bắt đầu bằng ssh-ed25519 ...)
```

**Vào GitHub:**
1. Vào repo `vframotp` → **Settings** → **Deploy Keys** → **Add deploy key**
2. Title: `vmware-test`
3. Key: paste dòng vừa copy
4. **Bỏ tích** "Allow write access"
5. Add key

```bash
# Cấu hình SSH dùng key này
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/id_vframotp
  StrictHostKeyChecking no
EOF

# Test kết nối
ssh -T git@github.com
# Kết quả: Hi quanghuyvfarm79! You've successfully authenticated...
```

---

## Phần 7: Clone Repo + Cấu hình App

```bash
git clone git@github.com:quanghuyvfarm79/vframotp.git /opt/vframotp
cd /opt/vframotp

# Tạo .env
cp .env.example .env
nano .env
```

Điền vào `.env` (Ctrl+X để lưu, Y, Enter):
```env
APP_ENV=production
API_PORT=8080
DATABASE_URL=postgres://vframotp:Vfarm@2024@localhost:5432/vframotp?sslmode=disable
REDIS_ADDR=localhost:6379
JWT_SECRET=thay_bang_chuoi_random_it_nhat_32_ky_tu_bat_ky
```

---

## Phần 8: Build + Migrate + Start Services

```bash
cd /opt/vframotp

# Build frontend + Go binaries
make build

# Chạy migration
export DATABASE_URL="postgres://vframotp:Vfarm@2024@localhost:5432/vframotp?sslmode=disable"
migrate -path migrations -database "$DATABASE_URL" up

# Cài systemd services
sudo cp deploy/vframotp-api.service /etc/systemd/system/
sudo cp deploy/vframotp-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vframotp-api vframotp-worker
sudo systemctl start vframotp-api vframotp-worker

# Kiểm tra
sudo systemctl status vframotp-api
sudo systemctl status vframotp-worker
# Phải thấy: active (running)
```

---

## Phần 9: Cấu hình Nginx

```bash
sudo cp /opt/vframotp/deploy/nginx.conf /etc/nginx/sites-available/vframotp
sudo ln -s /etc/nginx/sites-available/vframotp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
# Phải thấy: syntax is ok / test is successful
sudo systemctl reload nginx
```

Test local:
```bash
curl http://localhost/health
# {"status":"ok"}  ← thành công
```

Kiểm tra từ Windows browser:
```
http://192.168.x.x
# Thấy trang đăng nhập VFRAMOTP = OK
```

---

## Phần 10: Cloudflare Tunnel (Expose ra Internet)

> Dùng Cloudflare Tunnel thay port-forward router.
> Yêu cầu: có tài khoản Cloudflare + 1 domain đã add vào Cloudflare.

### 10.1 Cài cloudflared
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared version
```

### 10.2 Đăng nhập Cloudflare
```bash
cloudflared tunnel login
```
VM in ra URL dài → copy URL đó → mở trên Windows → đăng nhập Cloudflare → chọn domain → Authorize

### 10.3 Tạo Tunnel
```bash
cloudflared tunnel create vframotp-test
# Ghi lại Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# File credentials: /home/vframotp/.cloudflared/xxxxxxxx.json
```

### 10.4 Tạo config
```bash
nano ~/.cloudflared/config.yml
```
Điền vào (thay TUNNEL_ID bằng ID ở bước trên):
```yaml
tunnel: TUNNEL_ID
credentials-file: /home/vframotp/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: test.yourdomain.com
    service: http://localhost:80
  - service: http_status:404
```
Ctrl+X → Y → Enter

### 10.5 Trỏ DNS
```bash
cloudflared tunnel route dns vframotp-test test.yourdomain.com
# Tự tạo CNAME record trên Cloudflare DNS
```

### 10.6 Chạy như service
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

### 10.7 Test
Mở browser trên Windows:
```
http://test.yourdomain.com
```
Thấy trang VFRAMOTP = thành công ✓

---

## Phần 11: Deploy hàng ngày

```bash
# Windows: push code sau khi sửa
git add . && git commit -m "feat: ..." && git push origin main

# Trên VM (SSH vào):
cd /opt/vframotp && make deploy
```

`make deploy` tự làm: pull → build frontend → build Go → migrate → restart services

---

## Phần 12: VPS (sau này, khi có domain public)

Setup y hệt VMware (Phần 4→9), thêm:

### Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### SSL với Certbot (sau khi domain DNS đã trỏ về IP VPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Certbot tự sửa nginx config + auto-renewal
```

Không cần Cloudflare Tunnel vì VPS có IP public thật.

---

## Xử lý sự cố thường gặp

### Services không start
```bash
sudo journalctl -u vframotp-api -n 50
sudo journalctl -u vframotp-worker -n 50
```

### Nginx lỗi
```bash
sudo nginx -t
sudo journalctl -u nginx -n 20
```

### Database connection lỗi
```bash
sudo -u postgres psql -c "\l"   # kiểm tra DB tồn tại
echo $DATABASE_URL               # kiểm tra biến môi trường
```

### Xem disk còn trống
```bash
df -h
```

### Restart tất cả services
```bash
sudo systemctl restart vframotp-api vframotp-worker nginx
```
