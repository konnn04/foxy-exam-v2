# 🦊 FOXYEXAM v2 — TÀI LIỆU KIẾN TRÚC & CHUYỂN GIAO (HANDOFF NOTE)

> **Cập nhật lần cuối:** 2026-09-20  
> **Dành cho:** Bất kỳ lập trình viên hoặc AI Agent nào tiếp quản dự án để tiếp tục phát triển mà không bị đứt gãy ngữ cảnh.

---

## 1. TỔNG QUAN HỆ THỐNG (HYBRID SAAS)

FoxyExam là **Nền tảng SaaS B2B cho thuê tổ chức thi lập trình và giám sát chống gian lận AI**. Ta **tự host, không bán mã nguồn**, cung cấp dịch vụ cho các trường Đại học, Trung tâm đào tạo và Giảng viên.

### Mô hình phân vai trò của Máy chủ Web & API:
1. **Trang chủ (`/`)**: Landing page giới thiệu giải pháp, Về chúng tôi (About Us), Dự án FoxyExam, Giới thiệu FoxyClient App (Tauri v2) và Bảng giá SaaS B2B.
2. **Cổng Admin (`/admin`)**: Dành riêng cho **Root Admin** (quản lý toàn bộ trường học, tổ chức đối tác, cấu hình gói cước) và **Org Admin** (quản lý trường mình, hạn mức quota).
3. **Cổng Giảng Viên (`/lecturer`)**: Dành cho **Giảng viên** quản lý khóa học được phân công, soạn đề bài lập trình (Markdown, code mẫu C++/Python/Java, testcases), tạo kỳ thi (tự động kiểm tra Quota) và giám sát vi phạm trực tiếp (Live Proctoring).
4. **Sinh viên thi qua Client App (Tauri v2)**: Sinh viên **không làm bài trên web**. Client app kết nối qua REST API (`/api/v1/student/...`) để lấy đề, nộp bài và gửi luồng phím gõ Op-Log.
5. **Tài liệu API tương tác (`/docs/api`)**: Giao diện tài liệu OpenAPI 3.1 (Scramble Elements) tự động trích xuất schema, tham số và ví dụ mẫu cho đội ngũ phát triển Client App.

---

* **Package Manager:** **BẮT BUỘC dùng `pnpm`** (tận dụng hardlink tiết kiệm dung lượng đĩa).
* **Môi trường Windows cục bộ:** PHP 8.5 (`memory_limit = 512M`), Composer 2.10.3, CSDL SQLite (`database/database.sqlite`), **KHÔNG CÀI DOCKER TRÊN WINDOWS**. Docker chỉ dùng khi deploy lên VPS Linux.
* **UI/UX:** Hệ sinh thái **Tailwind CSS v4 + Radix UI + shadcn/ui** theo phong cách Dark Mode (Slate/Zinc, Glassmorphism).
* **Hiệu năng & Tải trang:**
  * Cấu hình **Inertia SSR** (`pnpm run build --ssr` tạo bundle tại `bootstrap/ssr/`).
  * Cấu hình **Code Splitting (Manual Chunks)** trong `vite.config.ts`: Tách riêng `vendor-react`, `vendor-inertia`, `vendor-icons`. Mỗi trang (`Landing`, `Admin`, `Lecturer`, `Login`) là một chunk độc lập vài KB, chỉ tải khi người dùng truy cập.

---

## 3. PHÂN HỆ BACKEND (LARAVEL 13) & API CLIENT

Thư mục: `server/`

### 3.1. Danh mục REST APIs v1 (`/api/v1/...`) & OpenAPI
File đặc tả: `server/public/openapi.json` (Xem trực tiếp tại `http://127.0.0.1:8000/docs`).

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Kiểm tra trạng thái máy chủ Core |
| `GET` | `/api/v1/ai/status` | Public | Kiểm tra kết nối sang Laptop AI qua Cloudflare Tunnel |
| `POST` | `/api/v1/student/login` | Public | Thí sinh đăng nhập vào phòng thi bằng mã phòng (`FOXY-2026`) |
| `GET` | `/api/v1/student/paper` | Token | Lấy đề thi lập trình, code mẫu, testcase ví dụ |
| `POST` | `/api/v1/student/heartbeat` | Token | Đồng bộ đếm ngược thời gian và giữ phiên |
| `POST` | `/api/v1/student/op-log` | Token | Gửi luồng phím gõ, **tự động bắt vi phạm dán code** (`BULK_PASTE`) |
| `POST` | `/api/v1/student/violation` | Token | Báo cáo vi phạm từ Client Guard (chuyển tab, mở DevTools...) |
| `POST` | `/api/v1/student/submit` | Token | Nộp mã nguồn bài làm |
| `GET` | `/api/v1/student/submissions` | Token | Lịch sử nộp bài |
| `POST` | `/api/v1/student/finish` | Token | Kết thúc ca thi |
| `GET` | `/api/v1/admin/quota` | Token | Xem gói cước và hạn mức sử dụng tháng của trường |
| `POST` | `/api/v1/admin/exams` | Token | Tạo kỳ thi mới (được bảo vệ bởi `QuotaService`) |
| `GET` | `/api/v1/admin/exams/{id}/violations` | Token | Danh sách vi phạm thời gian thực cho giám thị |

---

## 4. PHÂN HỆ WEB PORTAL (PAGES)

Thư mục: `server/resources/js/pages/`

* **[Landing.tsx](file:///c:/Users/Administrator/Desktop/project-foxy/server/resources/js/pages/Landing.tsx)**:
  * Trang chủ, Về chúng tôi (About Us), Dự án FoxyExam, Giới thiệu FoxyClient App (Tauri v2) và Bảng giá SaaS B2B (`FREE`, `PRO`, `ENTERPRISE`).
* **[Admin/Dashboard.tsx](file:///c:/Users/Administrator/Desktop/project-foxy/server/resources/js/pages/Admin/Dashboard.tsx)** (`/admin`):
  * **Root Admin (`SUPER_ADMIN`)**: Quản lý các trường học đối tác (`Organizations`), thêm trường mới, duyệt gói cước (`Plans`), thống kê toàn hệ thống.
  * **Org Admin (`ORG_ADMIN`)**: Quản lý trường mình, hạn mức Quota sử dụng tháng, danh sách giảng viên & sinh viên.
* **[Lecturer/Dashboard.tsx](file:///c:/Users/Administrator/Desktop/project-foxy/server/resources/js/pages/Lecturer/Dashboard.tsx)** (`/lecturer`):
  * Quản lý khóa học được phân công.
  * Quản lý ngân hàng bài toán lập trình (`Problems`): Thêm bài tập mới (Markdown, C++/Python starter templates, test cases).
  * Tạo kỳ thi lập trình mới (tự động chặn nếu vượt quota gói cước).
  * Giám sát phòng thi trực tiếp: Bảng cảnh báo đỏ các vi phạm dán code ChatGPT (`BULK_PASTE`), chuyển tab.
* **[Auth/Login.tsx](file:///c:/Users/Administrator/Desktop/project-foxy/server/resources/js/pages/Auth/Login.tsx)** (`/login`):
  * Đăng nhập phân quyền tự động: Giảng viên vào `/lecturer`, Quản trị viên vào `/admin`.

---

## 5. TÀI KHOẢN & DỮ LIỆU THỬ NGHIỆM MẪU

Dữ liệu có sẵn trong seeder:
* **Mã phòng thi lập trình:** `FOXY-2026`
* **Giảng viên trường (HCMUS):** `teacher_hcmus` / Mật khẩu: `teacher123`
* **Super Admin nền tảng:** `admin` / Mật khẩu: `admin123`
* **Sinh viên (dùng test API qua Scramble Docs):** `student01` / Mật khẩu: `student123`

---

## 6. LỆNH CHẠY & BẢO TRÌ

### Khởi động môi trường phát triển (Local Windows):
Mở terminal 1:
```powershell
cd server
php artisan serve
```
Mở terminal 2 (nếu cần sửa code giao diện với HMR):
```powershell
cd server
pnpm run dev
```

### Các URL truy cập:
* Trang chủ & Giới thiệu: `http://127.0.0.1:8000/`
* **Tài liệu API tương tác cho Client Dev:** `http://127.0.0.1:8000/docs/api`
* Cổng Quản trị Admin: `http://127.0.0.1:8000/admin`
* Cổng Giảng viên: `http://127.0.0.1:8000/lecturer`

### Chạy kiểm thử tự động:
```powershell
cd server
php artisan test
```
*(8/8 bài test đều pass 100%).*

### Triển khai lên VPS Linux (Production):
File cấu hình trong `deploy/vps/`:
* [Caddyfile](file:///c:/Users/Administrator/Desktop/project-foxy/deploy/vps/Caddyfile): Reverse proxy, tự cấp SSL, wildcard subdomain.
* [docker-compose.yml](file:///c:/Users/Administrator/Desktop/project-foxy/deploy/vps/docker-compose.yml): Caddy + FrankenPHP + PostgreSQL 16 + Redis 7.
Lệnh chạy trên VPS:
```bash
docker compose -f deploy/vps/docker-compose.yml up -d
```
