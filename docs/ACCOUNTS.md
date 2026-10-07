# 📋 Danh Sách Tài Khoản & Hướng Dẫn Phân Quyền (FoxyExam v2)

Tài liệu này tổng hợp toàn bộ danh sách tài khoản dùng thử (Seeded Accounts), phân quyền vai trò (RBAC), điểm truy cập (Portals / APIs) và kịch bản kiểm thử mẫu cho hệ thống **FoxyExam Core Server**.

---

## 1. Bảng Thông Tin Đăng Nhập Mặc Định

| Vai trò (Role) | Tên hiển thị | Username | Mật khẩu | Email | Tổ chức (Tenant) | Gói SaaS | Điểm truy cập / Mục đích |
|---|---|---|---|---|---|---|---|
| **SUPER_ADMIN** | Super Administrator | `admin` | `admin123` | `admin@foxyexam.com` | Foxy Platform Root (`ROOT`) | ENTERPRISE | Web `/admin` (Quản trị toàn sàn, duyệt gói cước, các trường) |
| **ORG_ADMIN** | Quản Trị Viên HCMUS | `admin_hcmus` | `admin123` | `admin@hcmus.edu.vn` | ĐH Khoa học Tự nhiên (`HCMUS`) | PRO (30 kỳ thi/tháng) | Web `/admin` (Quản lý trường HCMUS, xem Quota tháng, giảng viên) |
| **TEACHER** | Thầy Nguyễn Văn A | `teacher_hcmus` | `teacher123` | `teacher@hcmus.edu.vn` | ĐH Khoa học Tự nhiên (`HCMUS`) | Kế thừa PRO của trường | Web `/lecturer` (Soạn đề, tạo kỳ thi, giám sát trực tiếp) |
| **STUDENT** | Nguyễn Văn B | `student01` | `student123` | `student01@student.hcmus.edu.vn` | ĐH Khoa học Tự nhiên (`HCMUS`) | — | Client App (Tauri v2) / API `POST /api/v1/student/login` |

---

## 2. Điểm Truy Cập & Phân Luồng (Routing Logic)

### 🌐 A. Đăng nhập qua Web Portal (Dành cho Quản trị & Giảng viên)
- **URL Đăng nhập**: `http://127.0.0.1:8000/login`
- **Cơ chế điều hướng tự động**:
  - Khi `admin` hoặc `admin_hcmus` đăng nhập -> Chuyển hướng tới **Cổng Quản Trị** (`/admin`).
  - Khi `teacher_hcmus` đăng nhập -> Tự động chuyển hướng tới **Cổng Giảng Viên** (`/lecturer`).
  - Nếu Giảng viên cố ý gõ `/admin`, hệ thống sẽ chặn và chuyển về `/lecturer`.

### 🖥️ B. Đăng nhập qua Desktop App (Dành cho Thí sinh / Sinh viên)
> **Lưu ý quan trọng:** Sinh viên **KHÔNG** làm bài thi trên trình duyệt web thông thường để đảm bảo tính toàn vẹn và chống gian lận. Thí sinh đăng nhập qua Desktop App (FoxyClient) kết nối với REST API máy chủ.

- **Endpoint API**: `POST /api/v1/auth/login` (Portal) hoặc `POST /api/v1/student/login` (Mã phòng)
- **Tài liệu OpenAPI tra cứu & thử nghiệm**: `http://127.0.0.1:8000/docs/api`
- **Payload yêu cầu**:
  ```json
  {
    "exam_code": "FOXY-2026",
    "username": "student01",
    "password": "student123"
  }
  ```

---

## 3. Dữ Liệu Demo Đi Kèm (Seeded Data)

Hệ thống đã nạp sẵn cấu trúc dữ liệu thực tế để phục vụ demo và kiểm thử:

### 🏢 Tổ chức & Gói cước (Tenants & Plans)
1. **Foxy Platform Root (`ROOT`)**:
   - Gói cước: `ENTERPRISE` (Không giới hạn tính năng và dung lượng).
2. **Trường ĐH Khoa học Tự nhiên (`HCMUS`)**:
   - Gói cước: `PRO` (1.490.000đ/tháng).
   - Hạn mức: Tối đa 30 kỳ thi/tháng, 100 thí sinh/kỳ, 20GB lưu trữ, kích hoạt AI Giám sát & Quay lại hành trình gõ code (Code Replay).

### 📚 Khóa học & Kỳ thi Demo
- **Khóa học**: `CS101 - Nhập Môn Lập Trình C++` (Giảng viên: Thầy Nguyễn Văn A).
- **Kỳ thi**: `Kỳ Thi Lập Trình C++ Cuối Kỳ`
  - **Mã phòng thi**: `FOXY-2026`
  - **Thời lượng**: 90 phút.
  - **Cấu hình chống gian lận**: Chặn chuyển tab, chặn dán code vượt quá 80 ký tự, theo dõi nhịp gõ phím (keystroke dynamics), kích hoạt camera AI.
- **Đề bài thi**:
  - **Bài 1**: *Tìm Phần Tử Lớn Nhất và Nhỏ Nhất trong mảng $N$ số nguyên*.
  - **Ngôn ngữ cho phép**: C++, Python.
  - Đã có sẵn 1 Test Case công khai (Sample) và 1 Test Case ẩn để chấm điểm tự động.

---

## 4. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### Kịch bản 1: Quản trị viên Root / Trường học (`admin` / `admin_hcmus`)
1. Truy cập `http://127.0.0.1:8000/login`.
2. Nhập username `admin` (mật khẩu `admin123`) hoặc `admin_hcmus` (mật khẩu `admin123`).
3. Xác nhận vào trang **Admin Dashboard** (`/admin`):
   - Xem thống kê tổ chức, hạn mức Quota đã dùng trong tháng.
   - Thao tác nhanh quản lý trường học hoặc nâng cấp gói dịch vụ.

### Kịch bản 2: Giảng viên quản lý môn học & đề thi (`teacher_hcmus`)
1. Truy cập `http://127.0.0.1:8000/login`.
2. Nhập username `teacher_hcmus`, mật khẩu `teacher123`.
3. Xác nhận được đưa tới **Lecturer Dashboard** (`/lecturer`):
   - Xem khóa học `CS101`.
   - Xem kỳ thi đang mở với mã phòng `FOXY-2026`.
   - Xem bảng cảnh báo gian lận trực tiếp (Live Cheating Alerts: vi phạm dán code, rời màn hình).

### Kịch bản 3: Sinh viên vào thi qua API (`student01`)
1. Mở giao diện API Docs tại: `http://127.0.0.1:8000/docs/api`.
2. Tìm đến mục **Auth** -> `POST /api/v1/auth/login` hoặc `POST /api/v1/student/login`.
3. Bấm **Send API Request** để gửi thông tin:
   ```json
   {
     "exam_code": "FOXY-2026",
     "username": "student01",
     "password": "student123"
   }
   ```
4. Hệ thống trả về mã `200 OK` kèm `access_token`, thông tin phiên làm bài (`attempt_id`), nội dung đề bài và starter code C++/Python.
5. Kiểm tra API nộp bài (`POST /api/v1/student/submit`) hoặc ghi nhận hành vi gõ (`POST /api/v1/student/telemetry/keystroke`).

---

## 5. Lệnh Khôi Phục / Re-seed Dữ Liệu

Nếu trong quá trình test bạn muốn làm mới lại database về trạng thái ban đầu:

```bash
cd server
php artisan migrate:fresh --seed
```
Sau khi chạy xong lệnh trên, toàn bộ bảng, gói cước và 4 tài khoản trên sẽ được thiết lập lại nguyên vẹn.

---

## 6. Dữ liệu seed mở rộng (`php artisan migrate:fresh --seed`)

Seeder dựng sẵn **1 root + 3 tổ chức**, mỗi tổ chức có nhiều giảng viên, sinh viên, 3 khóa học và **4 bộ đề (2 phổ thông + 2 lập trình)** kèm kỳ thi ở nhiều trạng thái (đã kết thúc / đang diễn ra / đã lên lịch / nháp), lượt thi, bài nộp và vi phạm mẫu.

| Tổ chức | Mã | Gói | Quản trị | Giảng viên | Sinh viên (đăng nhập bằng MSSV) |
|---|---|---|---|---|---|
| Trường ĐH Khoa học Tự nhiên | `HCMUS` | PRO | `admin_hcmus` / `admin123` | `teacher_hcmus`, `gv_hcmus_02`… `gv_hcmus_06` / `teacher123` | `student01`, `21120002`… `21120040` / `student123` |
| Trường ĐH Bách khoa TP.HCM | `HCMUT` | ENTERPRISE | `admin_hcmut` / `admin123` | `gv_hcmut_01`… `gv_hcmut_05` / `teacher123` | `21100001`… `21100036` / `student123` |
| Trung tâm Tin học & Anh ngữ FoxyLab (riêng tư — nhập mã `FLAB`) | `FLAB` | PRO | `admin_flab` / `admin123` | `gv_flab_01`… `gv_flab_05` / `teacher123` | `5001`… `5036` / `student123` |

## 7. Cổng truy cập theo vai trò

- `/admin` — Root Admin và Org Admin. Root Admin ở ngữ cảnh ROOT chỉ có: Tổ chức, Gói cước, Tài khoản hệ thống; chuyển sang một trường thì chạy đúng như Org Admin của trường đó.
- `/lecturer` — Giảng viên. Cùng giao diện với `/admin` nhưng chỉ có các trang học thuật (khóa học, kỳ thi, ngân hàng đề, giám sát kỳ thi). Vào nhầm cổng sẽ được chuyển về cổng đúng của vai trò.
- Sinh viên không dùng cổng web; thi bằng FoxyClient.
