# Brainstorm Summary - VFRAMOTP
> Ngày: 2026-03-12 | Trạng thái: Sẵn sàng lên plan

---

## 1. Mục tiêu dự án

Xây dựng lại site bán OTP từ đầu bằng Go, thay thế site cũ (rent.otp - Laravel/PHP).
Tham khảo UI: otptextnow.com (glassmorphism + gradient tím-hồng).
Code mới hoàn toàn tại thư mục: `VFRAMOTP/`

---

## 2. Tech Stack đã chốt

| Thành phần | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Backend | Go + Gin | REST API |
| Frontend | React + TypeScript + Tailwind CSS | Build bằng Vite |
| Database | PostgreSQL | Docker local (Windows), cài thẳng (Ubuntu) |
| Queue/Worker | Asynq + Redis | Tương đương Laravel Queue |
| Auth | JWT + API Key | JWT cho web, API Key cho third-party |
| Migration | golang-migrate | Quản lý schema DB |
| Build | Makefile | Build Go binary + React |
| Queue Monitor | Asynq dashboard | Port 8081 |
| SSL verify | Tắt | Site nhỏ, provider VN cert lởm |

---

## 3. Tính năng cần làm

### Phase 1 - Core (bắt buộc)
- [ ] Auth: đăng ký (user tự đăng ký), đăng nhập, JWT
- [ ] Quản lý API Key (per user, cho third-party gọi)
- [ ] Quản lý User + Role (admin/user)
- [ ] Cấu hình Provider (config-driven, generic URL mapping)
- [ ] OTP Flow: lấy số → poll OTP → timeout → hoàn tiền
- [ ] Balance: trừ tiền khi thuê, hoàn tiền khi fail
- [ ] Lịch sử giao dịch
- [ ] Public API (như otptextnow): get_all_services, get_number, get_code, renew

### Phase 2 - Admin
- [ ] Dashboard báo cáo doanh thu
- [ ] Quản lý Users
- [ ] Quản lý Services/Providers
- [ ] Cộng tiền thủ công cho user (nạp tiền Phase 1)

### Phase 3 - Sau này (YAGNI - chưa làm)
- [ ] SePay webhook (nạp tiền tự động)
- [ ] Telegram notification
- [ ] Excel export

---

## 4. OTP Provider System (Core Design)

Không hardcode provider. Admin tự cấu hình qua bảng `providers`:

```
url          = "https://provider.com/get-phone?token=xxx"
url_otp      = "https://provider.com/get-otp?id="
key_phone    = "data.phone"        ← JSON path để parse phone
key_req_id   = "data.request_id"  ← JSON path để parse request_id
key_otp      = "data.otp_code"    ← JSON path để parse OTP
fee          = 2000               ← Phí mỗi lần thuê (VND)
timeout      = 300                ← Giây chờ tối đa
time_delay   = 10                 ← Giây giữa mỗi lần poll
```

→ Muốn đổi/thêm provider = chỉ cần điền URL mới trong admin, không cần code lại.

---

## 5. Public API Design (như otptextnow)

```
GET /api/?key={api_key}&action=get_all_services
    → [{id, name, price, timeout}]

GET /api/?key={api_key}&action=get_number&id={service_id}
    → {number: "0901234567", request_id: 14159265}
    → {message: "Your balance is not enough!"}

GET /api/?key={api_key}&action=get_code&id={request_id}
    → {otp_code: "142857"}
    → {otp_code: "is_comming"}
    → {otp_code: "timeout"}

GET /api/?key={api_key}&action=renew&id={request_id}
    → {success: true, message: "Successfully!"}
```

---

## 6. Database Schema (tóm tắt)

```
users            - id, email, password, role, balance, api_key, created_at
user_tokens      - id, user_id, token, expired_at
transactions     - id, user_id, provider_id, phone, request_id, otp,
                   status, amount, created_at
                   (status: pending/waiting_phone/waiting_otp/success/failed/cancelled)
providers        - id, name, url, url_otp, key_phone, key_req_id, key_otp,
                   fee, timeout, time_delay, use_phone_list, active
phone_list       - id, provider_id, phone, status (available/used)
balance_logs     - id, user_id, type, amount, ref_id, created_at
```

---

## 7. OTP Flow (Background Worker)

```
[User request] → Trừ balance → Tạo transaction (status=pending)
    ↓
[Asynq Job: GetPhone]
    → Gọi provider URL → Parse phone + request_id
    → Update transaction (status=waiting_otp, phone=xxx)
    ↓
[Asynq Job: PollOTP] (retry mỗi time_delay giây)
    → Gọi provider url_otp + request_id
    → Parse OTP (regex \d{4,8})
    → Nếu có OTP: status=success, lưu OTP
    → Nếu timeout: status=failed, dispatch RefundJob
    ↓
[Asynq Job: Refund]
    → Hoàn tiền vào balance
    → Update balance_logs
```

---

## 8. Môi trường & Deployment

| Môi trường | OS | Services | Mục đích |
|-----------|-----|---------|---------|
| Windows | Windows 10/11 | Go, Node.js, Docker Desktop (PG+Redis) | Dev/Code |
| VMware | Ubuntu 24.04 | Go binary, PG, Redis, Nginx | Test nội bộ |
| VPS | Ubuntu 24.04 (14.225.205.212) | Go binary, PG, Redis, Nginx + SSL | Staging/Public |

**Ports:**
- Go API: 8080 (internal)
- React: serve static bởi Nginx
- Nginx: 80/443 (public)
- Asynq dashboard: 8081 (internal only)

---

## 9. Git Workflow

```
Repo: GitHub private - "vframotp"

Flow hàng ngày:
Windows: code → git commit → git push origin main
VMware:  git pull → make build → test
VPS:     git pull → make build → restart service
```

**Setup cần làm (1 lần):**
1. Tạo GitHub account + repo private "vframotp"
2. Tạo SSH key trên Windows → add vào GitHub
3. Tạo SSH key trên VMware → add vào GitHub
4. Tạo SSH key trên VPS → add vào GitHub
5. Clone repo trên VMware + VPS

---

## 10. Cấu trúc thư mục dự án

```
vframotp/
├── cmd/
│   ├── api/          # HTTP server (main.go)
│   └── worker/       # Asynq worker (main.go)
├── internal/
│   ├── handler/      # HTTP handlers
│   ├── service/      # Business logic
│   ├── repository/   # DB queries
│   ├── model/        # Structs/models
│   ├── queue/        # Asynq tasks
│   └── middleware/   # Auth, CORS
├── pkg/
│   ├── provider/     # OTP provider HTTP client
│   └── jwt/          # JWT helpers
├── migrations/       # DB migration files (golang-migrate)
├── frontend/         # React + TS + Tailwind (Vite)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/      # API client
│   └── dist/         # Build output (served by Nginx)
├── Makefile          # Build commands
├── .env.example      # Template env
├── .gitignore
└── docker-compose.yml # Local dev (PG + Redis)
```

---

## 11. Những gì KHÔNG làm (tránh lỗi site cũ)

- ❌ Không để file debug public (`public/test.php` kiểu cũ)
- ❌ Không tắt CSRF (Go/Gin có built-in protection)
- ❌ Không bỏ qua 2FA verify (nếu implement sau)
- ❌ Không để dead routes/controllers
- ❌ Không commit file `.env` lên git
- ❌ Không làm feature chưa cần (Telegram, Excel, SePay - Phase 3)

---

## 12. Checklist trước khi lên plan

- [x] Tech stack chốt
- [x] Tính năng xác định (Phase 1/2/3)
- [x] OTP provider design (config-driven)
- [x] API design (query-param style như otptextnow)
- [x] Database schema (tóm tắt)
- [x] Môi trường (Windows/VMware/VPS)
- [x] Git workflow
- [x] Nạp tiền: Manual Phase 1
- [x] User: tự đăng ký
- [x] Domain: có sẵn
- [x] SSL: Let's Encrypt trên VPS

---

## Câu hỏi còn lại (cần trả lời trước /plan)

1. **Domain là gì?** (để cấu hình Nginx + SSL đúng)
2. **GitHub username là gì?** (để tạo repo đúng)

---

*Sau khi confirm 2 câu trên → chạy `/plan` để lên implementation plan chi tiết.*
