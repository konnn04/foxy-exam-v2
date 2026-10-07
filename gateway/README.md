# 🛡️ Foxy Exam — API Gateway (Nginx)

Cổng vào duy nhất (Single Ingress Point) cho toàn bộ hệ thống Foxy Exam. Chịu trách nhiệm TLS Termination (HTTPS), WebSocket Upgrade, Rate Limiting và định tuyến tới các service nội bộ.

Mọi cấu hình domain và upstream service **đã được thiết lập sẵn trong Dockerfile** để bạn có thể build và chạy ngay lập tức mà không cần mount cấu hình thủ công.

---

## 1. Sơ đồ Kiến trúc Gateway

```
Internet (HTTP :80 / HTTPS :443)
        │
   ┌────▼─────────────┐
   │   foxy-gateway   │  ← TLS terminate + Rate limit + Multi-tenant Subdomain
   │   (Nginx Alpine) │
   └────┬─────────────┘
        │
   ┌────┼──────────────┬──────────────────┬─────────────────┐
   ▼    ▼              ▼                  ▼                 ▼
:8000   :8080          :8000 (remote)     :7880             :80
app     reverb (WS)    ai-worker (GPU)    livekit (SFU)     gateway-health
(Core)  (Telemetry)    (Face/Object/Media)(WebRTC signaling)(JSON status)
```

---

## 2. Các biến môi trường thiết lập sẵn trong Dockerfile

| Biến môi trường | Mặc định trong Dockerfile | Mô tả |
|---|---|---|
| `APP_DOMAIN` | `foxyexam.com` | Tên miền chính của nền tảng |
| `SERVER_NAME` | `foxyexam.com *.foxyexam.com localhost 127.0.0.1` | Các domain tiếp nhận request (hỗ trợ wildcard subdomain cho các trường học) |
| `CORE_HOST` | `app:8000` | Host & port máy chủ backend Laravel (Web + REST API) |
| `REVERB_HOST` | `app:8080` | Host & port máy chủ WebSocket Laravel Reverb |
| `AI_HOST` | `ai-worker:8000` | Host & port máy chủ AI Proctoring (hoặc qua Cloudflare Tunnel) |
| `CLIENT_MAX_BODY_SIZE` | `100M` | Dung lượng upload tối đa (video, ảnh snapshot, bài nộp) |
| `SSL_CERT_PATH` | `/etc/nginx/certs/fullchain.pem` | Đường dẫn chứng chỉ SSL công khai |
| `SSL_KEY_PATH` | `/etc/nginx/certs/privkey.pem` | Đường dẫn khóa riêng tư SSL |

---

## 3. Khởi Động Nhanh

### Cách 1: Chạy Docker Standalone (Tự sinh SSL)
Nếu bạn không mount chứng chỉ SSL, Gateway sẽ **tự động sinh chứng chỉ self-signed SSL** có hiệu lực cho `*.foxyexam.com` và `localhost`, không bao giờ bị crash Nginx:

```bash
# Build image
docker build -t foxy-gateway ./gateway

# Chạy container
docker run -d --name foxy-gateway \
  -p 80:80 -p 443:443 \
  foxy-gateway
```

### Cách 2: Chạy qua Docker Compose
```bash
cd gateway
docker compose up -d
```

### Cách 3: Ghi đè Domain & Service khi chạy
```bash
docker run -d --name foxy-gateway \
  -p 80:80 -p 443:443 \
  -e APP_DOMAIN=yourdomain.edu.vn \
  -e SERVER_NAME="yourdomain.edu.vn *.yourdomain.edu.vn" \
  -e CORE_HOST=127.0.0.1:8000 \
  foxy-gateway
```

---

## 4. Cấu hình SSL Production

### A. Dùng Cloudflare Origin Certificate (Khuyến nghị cho VPS)
1. Trên Cloudflare Dashboard → **SSL/TLS** → **Origin Server** → **Create Certificate** (*.yourdomain.com và yourdomain.com).
2. Lưu file chứng chỉ vào `gateway/certs/fullchain.pem`.
3. Lưu file khóa bí mật vào `gateway/certs/privkey.pem`.
4. Bật chế độ SSL trên Cloudflare là **Full (strict)**.
5. Khi mount thư mục `./certs:/etc/nginx/certs:ro`, Gateway sẽ tự động nhận diện và sử dụng chứng chỉ của bạn.

---

## 5. Bảng Điều Phối Tuyến Đường (Route Map)

| Đường dẫn (Path) | Dịch vụ Upstream | Giao thức | Mô tả |
|---|---|---|---|
| `/` | `$CORE_HOST` | HTTP/1.1 | Landing page, Cổng Admin, Giảng viên, Inertia SSR & REST APIs |
| `/api/v1/auth/login` | `$CORE_HOST` | HTTP/1.1 | Đăng nhập hệ thống (bảo vệ bởi `auth_limit`: 10 req/s) |
| `/api/v1/student/login` | `$CORE_HOST` | HTTP/1.1 | Đăng nhập phòng thi sinh viên (bảo vệ bởi `auth_limit`) |
| `/api/*` | `$CORE_HOST` | HTTP/1.1 | Các REST API v1 khác (bảo vệ bởi `api_limit`: 30 req/s) |
| `/app/*` | `$REVERB_HOST` | WSS (WebSocket) | Luồng đẩy dữ liệu realtime & telemetry sinh viên |
| `/ai/*`, `/face/*`, `/object/*`, `/media/*` | `$AI_HOST` | HTTP/1.1 | Xử lý AI nhận diện khuôn mặt, phát hiện vật cấm & ghép clip |
| `/gateway-health` | Nginx Internal | JSON | Kiểm tra trạng thái sống của Gateway |

---

## 6. Kiểm tra (Health Check)

```bash
# Kiểm tra qua HTTP (port 80)
curl http://localhost/gateway-health

# Kiểm tra qua HTTPS (port 443)
curl -k https://localhost/gateway-health
```
Phản hồi mẫu:
```json
{"status":"ok","gateway":"foxy-gateway","ssl":true,"timestamp":"2026-09-20T15:00:00+07:00"}
```
