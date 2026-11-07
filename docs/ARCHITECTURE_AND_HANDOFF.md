# 🛡️ EXAM GUARD (STEM 2026) — TÀI LIỆU KIẾN TRÚC & CHUYỂN GIAO (HANDOFF NOTE)

> **Cập nhật lần cuối:** 2026-11-07  
> **Đề án:** Exam Guard — Hệ thống giám sát thi cử trực tuyến thông minh (Cuộc thi Sinh viên với Ý tưởng Sáng tạo & Khởi nghiệp 2026 - Trường ĐH Mở TP.HCM).  
> **Dành cho:** Bất kỳ lập trình viên hoặc AI Agent nào tiếp quản dự án để tiếp tục phát triển mà không bị đứt gãy ngữ cảnh.

---

## 1. TỔNG QUAN HỆ THỐNG (HYBRID SAAS & EDGE AI PROCTORING)

Exam Guard là **Nền tảng SaaS B2B kết hợp Edge AI và Live Proctoring** phục vụ khảo thí đại học, cao đẳng và trung tâm đào tạo. Hệ thống bảo đảm toàn vẹn học thuật theo cơ chế phòng vệ 4 tầng: Khóa Kiosk hệ điều hành, AI giám sát tại biên (Edge CV), Giám sát đa góc nhìn (WebRTC SFU với camera phụ điện thoại) và Bằng chứng vi phạm gắn mã băm SHA-256.

### Mô hình phân vai trò của Máy chủ Web & API:
1. **Cổng Thông Tin Công Khai (Public Portal)**:
   - **Trang chủ (`/`)**: Hero, bảng tổng quan tính năng, lợi ích kinh tế, lời kêu gọi hành động.
   - **Tính năng (`/features`)**: 4 tầng phòng vệ toàn diện, mockup giao diện có hỗ trợ tương tác phóng to xem chi tiết (`medium-zoom`).
   - **Bảng giá (`/pricing`)**: Mô hình linh hoạt theo ca thi (4.500đ – 7.500đ/lượt) hoặc theo học kỳ/năm.
   - **Đề án STEM 2026 (`/about`)**: Thông tin 5 sinh viên sáng lập, 2 giảng viên cố vấn, sứ mệnh, số liệu kiểm thử thực tế và FAQ kỹ thuật.
   - **Tải ứng dụng (`/download`)**: Tải gói cài đặt Windows (`.exe` NSIS và `.msi`), tự động truy xuất bản phát hành mới nhất từ GitHub Releases qua endpoint `/api/v1/client/download/latest-exe`.
   - **Đa ngôn ngữ (i18n)**: Hỗ trợ chuyển đổi song ngữ tức thì `VI / EN` lưu trạng thái qua `localStorage`.
2. **Cổng Admin (`/admin`)**: Dành riêng cho **Super Admin** (quản lý trường học, gói cước SaaS) và **Org Admin** (quản lý trường OU, xem quota ca thi, phân công giảng viên).
3. **Cổng Giảng Viên (`/lecturer`)**: Giảng viên soạn đề (lập trình Markdown/testcases hoặc trắc nghiệm 6 dạng câu hỏi), tạo ca thi và giám sát trực tiếp phòng thi (Live Proctoring Grid).
4. **Cổng Giám Sát Phụ Bằng Điện Thoại (`/cam2/{token}`)**: Điện thoại thí sinh quét mã QR để kích hoạt camera góc 45°, truyền video WebRTC vào LiveKit SFU, tích hợp Blackout Mode tiết kiệm pin và chống khoá màn hình.
5. **Thí sinh thi qua Client App (Tauri v2)**: Thí sinh làm bài thi trong môi trường đóng băng Kiosk an toàn, chạy mô hình MediaPipe FaceLandmarker cục bộ trên CPU.
6. **Tài liệu API tương tác (`/docs/api`)**: OpenAPI 3.1 trích xuất tự động qua Scramble.

---

## 2. QUY CHUẨN KỸ THUẬT & PHÁT TRIỂN

* **Package Manager:** **BẮT BUỘC dùng `pnpm`**.
* **Môi trường Windows cục bộ:** PHP 8.2+, Node.js 22+, Rust 1.80+ (dành cho Tauri v2). CSDL SQLite cục bộ hoặc PostgreSQL.
* **Quy trình đóng gói & Cập nhật Client (SemVer & Updater)**:
  - Nâng phiên bản tự động bằng lệnh:
    ```bash
    cd client
    pnpm bump:patch   # hoặc pnpm bump:minor
    ```
    Script tự động cập nhật `package.json` và `src-tauri/tauri.conf.json`.
  - Client tự động kiểm tra bản cập nhật qua GitHub Actions release workflow.
* **UI/UX:** Tailwind CSS v4, Lucide Icons, medium-zoom.

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
* **Giảng viên trường (OU):** `teacher_ou` / Mật khẩu: `teacher123`
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

### Triển khai lên VPS Linux (Production, Coolify):
Toàn bộ server (không gồm client) nằm trong **`docker.compose.server.yml`** ở gốc repo; biến môi trường mẫu: `.env.server.example`.
Cấu hình LiveKit nằm trong biến môi trường của compose; DB `foxy_record` do service `record` tự tạo. Chi tiết kiến trúc realtime, API và cách deploy: **[docs/REALTIME.md](REALTIME.md)**.
