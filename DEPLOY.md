# Hướng dẫn deploy VFRAMOTP

## 1. Build code trên server

```bash
cd /opt/vframotp

# Lấy code mới nhất
git pull

# Build API, Worker và Frontend
make build
```

Sau khi build xong sẽ có:

- Backend API: `bin/api`
- Worker: `bin/worker`
- Frontend: build vào `frontend/dist` (đã được Nginx serve sẵn trong repo gốc).

---

## 2. Cấu hình systemd cho worker

File service **không nằm trong git**, nhưng nên tạo theo mẫu này:

```ini
# /etc/systemd/system/vframotp-worker.service

[Unit]
Description=VFRAMOTP Worker
After=network.target postgresql.service redis.service

[Service]
Type=simple
WorkingDirectory=/opt/vframotp
EnvironmentFile=/opt/vframotp/.env
ExecStart=/opt/vframotp/bin/worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Lưu ý quan trọng:**

- Không dùng `User=...` trong file service để tránh lỗi:
  - `Failed to determine user credentials: No such process`
  - `status=217/USER`
- Mỗi lần sửa file service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart vframotp-worker
sudo systemctl status vframotp-worker
```

Worker chạy OK khi:

```text
Active: active (running)
Worker starting with concurrency=...
```

---

## 3. Cấu hình Provider Microsoft (otp.vocfor.site)

Trong trang Admin → Quản lý Product, với provider Microsoft:

- **URL lấy số (GET)**  
  - Nếu dùng SIM pool nội bộ (`Dùng danh sách SIM` bật) → có thể để trống.

- **URL lấy OTP (GET + request_id)**

```text
http://otp.vocfor.site/get_otp?Brand=Microsoft&Token=<TOKEN>&Isdn=
```

> Quan trọng: phải kết thúc bằng `&Isdn=` để hệ thống tự ghép số phone phía sau.

- **Key phone trong response**
  - Nếu dùng SIM pool: để trống (phone lấy từ pool).
  - Nếu dùng API lấy số bên ngoài: set đúng theo JSON của API.

- **Key request_id trong response**
  - Nếu dùng SIM pool: để trống.
  - Nếu dùng API lấy số: set theo JSON, ví dụ `data.request_id`.

- **Key otp trong response**

```text
otp
```

- **Key lỗi (tuỳ chọn)**

```text
Error_Code
```

- **Giá trị lỗi fatal**

```text
6
```

- **Giá trị "hết hạn" từ upstream (`key_otp_done`)**
  - Để trống nếu upstream không trả chuỗi riêng báo hết hạn.

- **Checkbox**
  - `Hoạt động` ✅
  - `Dùng danh sách SIM` ✅ (nếu dùng SIM pool nội bộ)
  - `Cho phép Renew` ✅ (tuỳ nhu cầu)

---

## 4. Quy trình kiểm tra sau khi deploy

1. Đảm bảo API và worker đang chạy:

```bash
sudo systemctl status vframotp-api      # nếu có service API
sudo systemctl status vframotp-worker
```

2. Từ client (hoặc Postman), gọi:

- **Thuê số mới**

```text
GET /api/?key=<API_KEY>&action=get_number&id=<PROVIDER_ID>
```

Đảm bảo trả về:

```json
{ "success": true, "number": "8438...", "request_id": "..." }
```

3. Đợi khoảng `Time delay (s)` đã cấu hình cho provider.

4. Gọi **lấy OTP**:

```text
GET /api/?key=<API_KEY>&action=get_code&id=<REQUEST_ID>
```

- Nếu OTP đã có:

```json
{ "success": true, "otp_code": "123456" }
```

- Nếu vẫn `"is_comming"` trong thời gian dài:
  - Kiểm tra lại worker:

```bash
sudo journalctl -u vframotp-worker -n 30 --no-pager
```

  - Kiểm tra URL OTP bằng cách copy `URLOtp + request_id` ra browser, xem JSON trả về có `otp` đúng và `Error_Code = 0` không.

---

## 5. Ghi chú lỗi hay gặp

- **`otp_code` luôn `"is_comming"`**
  - Worker không chạy hoặc không kết nối được Redis/DB.
  - Provider config sai `URL lấy OTP` hoặc `Key otp`.

- **Worker log: `Failed to determine user credentials: No such process (status=217/USER)`**
  - Trong file service có dòng `User=...`.
  - Cách fix: xoá dòng `User=...`, reload lại systemd như hướng dẫn ở trên.

