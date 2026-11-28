# FoxyExam: hệ thống hoạt động thế nào (tài liệu kỹ thuật nội bộ)

> **Phạm vi:** toàn bộ hệ thống FoxyExam v2 tính đến 26/11/2026: máy chủ core (Laravel), app thi FoxyClient (Tauri), tầng realtime (Go), ghi hình (LiveKit), dịch vụ AI và camera điện thoại.
>
> **Nội bộ:** tài liệu có ngưỡng phát hiện, giới hạn đã biết và cách tắt từng lớp bảo vệ. **Không đưa tài liệu này vào chatbot công khai.** Chatbot trên landing page dùng [`server/resources/chat/faq_public.md`](../server/resources/chat/faq_public.md).
>
> **Cách đọc:** mỗi mục tự đứng được (để cắt thành đoạn cho RAG). Đường dẫn file tính từ gốc repo. Số liệu lấy từ code, không phải ước lượng.

---

## 1. Tổng quan

FoxyExam là hệ thống thi trực tuyến có giám sát cho trường đại học và trung tâm. Thí sinh **không thi trên trình duyệt**: họ cài **FoxyClient** (app desktop) để máy thi bị khoá và giám sát ở tầng hệ điều hành. Giảng viên và quản trị viên dùng **trang quản trị web**.

### 1.1 Các thành phần

| Thành phần | Thư mục | Công nghệ | Vai trò |
|---|---|---|---|
| Core | `server/` | Laravel 13, Inertia + React, PostgreSQL | Tài khoản, tổ chức, kỳ thi, ngân hàng đề, chấm điểm, vi phạm, trang quản trị, API cho app thi |
| FoxyClient | `client/` | Tauri v2 (Rust) + React | App thí sinh: phòng chờ (precheck), làm bài, giám sát máy, camera, màn hình, AI trên máy |
| Realtime | `realtime/` | Go, Redis | `ingest` nhận dữ liệu từ app thi; `hub` đẩy trạng thái trực tiếp cho giám thị; `worker` chuyển dữ liệu vào core; `record` quản lý ghi hình, ảnh minh chứng, clip, mã hoá |
| Gateway | `gateway/` | nginx | Cổng vào duy nhất: định tuyến, giới hạn tốc độ |
| Ghi hình | trong `docker.compose.server.yml` | LiveKit + Egress, SeaweedFS (S3) | Truyền camera/màn hình cho giám thị và ghi lại |
| AI | `ai/` | Python: insightface, torchvision, LiveKit SDK | Nhận diện khuôn mặt, vật cấm, agent phân tích video trực tiếp |
| App cũ | `foxy-exam-client/` | | Bản cũ, không phát triển nữa |

### 1.2 Sơ đồ luồng dữ liệu

```
FoxyClient ──REST──────────────▶ gateway ─▶ core (Laravel)  ◀── trang quản trị (giảng viên, admin)
    │  ──batch 1 s──────────────▶ gateway ─▶ ingest ─▶ Redis stream ─▶ worker ─▶ core (/api/internal/v1/events/bulk)
    │                                          └─▶ Redis pub/sub ─▶ hub ─WebSocket─▶ màn giám sát
    │  ──camera / màn hình (WebRTC)──▶ LiveKit ─▶ Egress ─▶ S3 (record quản lý)
    │  ──ảnh / clip minh chứng──────▶ gateway ─▶ record ─▶ S3
Điện thoại ──camera phụ (WebRTC)──▶ LiveKit (phòng riêng cam2-…)
AI agent ◀──xem video ẩn── LiveKit ;  agent ──vi phạm (ký HMAC)──▶ core
```

### 1.3 Nguyên tắc thiết kế

- **Máy chủ quyết định.** App thi đo đạc và báo cáo; quyền vào thi, đồng hồ làm bài và việc thu bài do máy chủ quyết định.
- **Chặn trước, ghi nhận sau.** Điều gì chặn được thì chặn ngay ở phòng chờ hoặc trong giờ thi (che bài). Điều gì không chắc chắn thì ghi thành vi phạm để giám thị xem.
- **AI chỉ gợi ý.** Vi phạm do AI phát hiện luôn chờ giám thị duyệt. Vi phạm là sự kiện chắc chắn (dán, mở app cấm) được tự xác nhận.
- **Dữ liệu sinh trắc học tối thiểu.** Âm thanh phân tích ngay trên máy thí sinh, không gửi đi. Ảnh khuôn mặt tham chiếu lưu riêng tư. Thí sinh phải đồng ý ở mỗi lần đăng nhập.
- **Mỗi bước ghi vết.** Precheck, vi phạm (có chuỗi băm), thao tác quản trị (audit log).

---

## 2. Vai trò và tổ chức (multi-tenant)

### 2.1 Vai trò

| Vai trò | Ở đâu | Làm gì |
|---|---|---|
| `SUPER_ADMIN` | Tổ chức gốc `ROOT` | Quản trị nền tảng: các trường, gói cước, lead, thông báo hàng loạt, website, tình trạng hệ thống. Có thể "đứng trong" một trường để hỗ trợ |
| `ORG_ADMIN` | Một trường | Quản trị trường: tài khoản, nhập sinh viên từ Excel, cài đặt, chính sách giám sát mặc định, AI soạn đề, báo cáo |
| `TEACHER` | Một trường | Khoá học, ngân hàng đề, kỳ thi, giám sát, chấm bài. Cổng `/lecturer` |
| `STUDENT` | Một trường | Chỉ dùng FoxyClient; bị chặn khỏi trang quản trị |

Không có vai trò "giám thị" riêng: giám thị là `TEACHER` hoặc `ORG_ADMIN` được gắn vào kỳ thi (`exam_proctors`).

### 2.2 Cách cách ly dữ liệu giữa các trường

- `TenantContext` (`server/app/Services/TenantContext.php`) giữ tổ chức đang hoạt động và các quyền (`capabilities`): `organizations`, `managePlans`, `billing`, `users`, `academic`, `quota`, `orgSettings`, `switchOrganization`.
- `EnforceContextScope` ánh xạ đoạn đầu URL dưới `/admin` sang quyền. Ví dụ `exams` cần `academic`, `settings` cần `orgSettings`.
- Trait `BelongsToOrganization` tự lọc `organization_id` trên Course, Exam, User cho mọi người trừ SUPER_ADMIN.
- `enforceOwnership()` chặn truy cập chéo (IDOR) bằng 403.
- `organization_id` gửi lên từ form luôn bị bỏ qua; máy chủ dùng tổ chức đang hoạt động.

### 2.3 Gói cước

Bảng `plans`: số kỳ thi mỗi tháng, số thí sinh mỗi kỳ thi, dung lượng, có AI giám sát hay không, có phát lại code hay không. Trường không có gói đang hoạt động dùng gói FREE: 1 kỳ thi/tháng, 20 thí sinh, không AI. Hiện chỉ "số kỳ thi mỗi tháng" được kiểm tra khi tạo kỳ thi trên web (xem mục 12).

---

## 3. Vòng đời một kỳ thi

### 3.1 Chuẩn bị

1. **Khoá học:** giảng viên tạo khoá học và ghi danh sinh viên (tay hoặc nhập Excel).
2. **Bộ đề:**
   - Trắc nghiệm & tự luận: một lựa chọn, nhiều lựa chọn, đúng/sai, điền khuyết, trả lời ngắn, tự luận, câu hỏi nhóm.
   - Lập trình: bài toán có test mẫu và test ẩn.
   - Có thể tạo câu hỏi bằng AI từ Word/PDF (Gemini hoặc DeepSeek, khoá API của trường).
3. **Bốc đề ngẫu nhiên:** `limit_questions` và tỉ lệ theo độ khó (`ratio_per_difficulty`).
   - Hàm `QuestionSettings::draw` bốc theo seed = id lượt thi, nên tải lại trang vẫn ra đúng đề cũ.
   - Câu hỏi nhóm được bốc nguyên nhóm.
4. **Kỳ thi:** chọn khoá học, bộ đề, thời lượng (15–300 phút), giờ mở/đóng phòng, số lượt, danh sách loại trừ, giám thị và **cấu hình giám sát** (mục 6).

### 3.2 Thí sinh vào thi

```
Đăng nhập FoxyClient ─▶ đồng ý xử lý sinh trắc học ─▶ chọn kỳ thi ─▶ PHÒNG CHỜ (precheck)
   ─▶ máy chủ xét lại, cấp mã precheck ─▶ POST /start (cần mã) ─▶ nhận khoá phiên ─▶ làm bài
   ─▶ nộp bài, hoặc máy chủ tự thu (hết giờ / vắng thi), hoặc giám thị kết thúc
```

- Đồng hồ chỉ chạy từ lúc bấm **Bắt đầu**; thời gian ở phòng chờ không tính.
- "Đóng phòng" (`end_time`) chỉ chặn lượt **mới**. Người đang làm vẫn được đủ thời lượng.
- Hạn nộp của mỗi lượt = `started_at + duration_minutes` (`ExamAttempt::deadline()`).

### 3.3 Trạng thái lượt thi

| Trạng thái | Nghĩa |
|---|---|
| `IN_PROGRESS` | Đang làm |
| `SUBMITTED` | Đã nộp; `ended_reason`: trống = thí sinh nộp, `TIME_UP` = hết giờ tự thu, `ABSENT` = mất kết nối quá lâu |
| `FORCE_ENDED` | Giám thị kết thúc, kết thúc cả kỳ thi, hoặc lượt bị huỷ |

### 3.4 Tự thu bài (lệnh `attempts:sweep`)

- Chạy mỗi phút qua Laravel Scheduler (`server/routes/console.php`). Container chạy `php artisan schedule:work` (`server/docker/start.sh`, bật bằng `RUN_SCHEDULER`, chỉ ở **một** bản).
- **TIME_UP:** quá hạn hơn 60 giây.
- **ABSENT:** không có tín hiệu quá `offline_minutes` phút (mặc định 5, đặt 0 để tắt). Tín hiệu là mốc mới nhất trong `last_seen_at`, `updated_at`, `started_at`.
- `AttemptFinisher` khoá dòng dữ liệu nên một lượt không bao giờ bị đóng hai lần (lệnh quét và nút nộp chạy cùng lúc vẫn an toàn).
- Máy chủ là đồng hồ chuẩn: lưu đáp án sau hạn + 60 giây bị từ chối (409 `TIME_UP`) và bài được thu ngay.

### 3.5 Chấm điểm

- **Tự chấm:**
  - Một lựa chọn, nhiều lựa chọn (đúng hết mới có điểm), đúng/sai: được cả hoặc không.
  - Điền khuyết: điểm theo tỉ lệ ô đúng (không phân biệt hoa thường).
  - Trả lời ngắn: so với đáp án mẫu (các đáp án được chấp nhận ngăn bằng `|`).
- **Chấm tay:** tự luận; trả lời ngắn không có đáp án mẫu. Chỉ chấm được sau khi lượt đã kết thúc.
- **Xem lại:** `is_allow_review` cho phép thí sinh xem bài; `is_hide_score` ẩn điểm. Đáp án **không bao giờ** gửi về app trong lúc thi.

---

## 4. Precheck có chữ ký (kiểm tra thiết bị trước khi vào thi)

Đây là cửa chính chặn máy không đạt chuẩn. Code: `client/src/components/ExamLobby.tsx`, `client/src-tauri/src/env_check.rs`, `server/app/Support/Precheck.php`.

### 4.1 Các mục kiểm tra ở phòng chờ

| Mục | Chặn khi |
|---|---|
| Kết nối máy chủ | Không gọi được máy chủ. Lệch đồng hồ > 2 phút chỉ cảnh báo |
| Kỳ thi | Chưa mở, đã đóng, không được dự thi, hoặc dịch vụ AI kỳ thi cần đang tắt |
| Màn hình | Hơn 1 màn hình (kể cả nhân bản, màn hình ảo), hoặc có capture card / video-in |
| Môi trường máy | Máy ảo (khi kỳ thi chặn), đang bị điều khiển từ xa, hệ điều hành không được phép |
| Ứng dụng cấm | Đang chạy app trong danh sách cấm mặc định |
| Camera | Không mở được; webview không có WebRTC; là camera ảo (khi kỳ thi chặn) |
| Khuôn mặt | Không thấy đúng một khuôn mặt nhìn thẳng |
| Người thật (liveness) | Không qua thử thách chớp mắt + quay đầu (khi bật xác thực danh tính) |
| Khuôn mặt đăng ký | Chưa có ảnh tham chiếu (khi bật xác thực danh tính) |
| Camera phụ | Chưa kết nối điện thoại hoặc sai góc đặt (khi bắt buộc) |
| Micro, chia sẻ màn hình | Khi kỳ thi bắt buộc |

### 4.2 Máy chủ ký precheck

1. Bấm **Bắt đầu** → app gửi `POST /api/v1/student/exams/{id}/precheck`, gồm:
   - mức của từng mục;
   - môi trường: hệ điều hành, máy ảo, điều khiển từ xa, thời điểm khởi động máy, camera đang dùng, các camera ảo thấy được, capture card, số màn hình.
2. Máy chủ xét lại theo chính sách kỳ thi. Mọi lần kiểm tra (kể cả bị từ chối) được lưu ở bảng `exam_prechecks`.
3. Đạt: máy chủ cấp **mã precheck** dùng một lần, hết hạn sau 15 phút, gắn với thí sinh + kỳ thi + máy (mã thiết bị đã băm).
4. `POST /start` (lượt mới **và** vào lại) bắt buộc có mã này, thiếu thì trả `428 PRECHECK_REQUIRED`. Mã của máy A không dùng được trên máy B.

### 4.3 Khoá phiên: tắt máy bật lại phải precheck lại

- Mỗi lần `start`, máy chủ cấp một **khoá phiên** mới (chỉ lưu bản băm) và huỷ khoá cũ.
- App gửi khoá qua header `X-Foxy-Session` và chỉ giữ trong `sessionStorage`, nên khoá mất khi tắt app hoặc khởi động lại máy.
- Tải đề, lưu đáp án, nộp bài và xin phiên realtime đều kiểm tra khoá; khoá sai trả `428`.
- **Hệ quả:**
  - Máy khởi động lại, mở lại app, cửa sổ thứ hai hay máy thứ hai đều phải qua precheck mới làm tiếp.
  - Cửa sổ cũ bị che bài ngay. Câu trả lời chưa gửi vẫn giữ trong hàng đợi.
- Vào lại với thời điểm khởi động khác trước (lệch > 2 phút) → vi phạm `DEVICE_RESTARTED`. Vào lại hoặc gửi yêu cầu từ IP khác → `IP_CHANGED` (ghi một lần cho mỗi địa chỉ mới).
- Mất mạng ≥ 15 giây rồi có lại: app cũng bắt precheck lại.
- Đường đăng nhập bằng mã phòng thi cũ (`/student/login`) bị đóng khi bật precheck (`426`).

Cấu hình (`server/config/foxy.php`):
- `PRECHECK_REQUIRED` (mặc định bật).
- `PRECHECK_ALLOW_DEV`: chấp nhận các mục bị bỏ qua bằng nút DEV. Mặc định chỉ bật khi `APP_ENV=local`; production phải tắt.
- `PRECHECK_TTL_MINUTES` (mặc định 15).

---

## 5. Cách ngăn chặn từng hành vi gian lận

Ở bảng dưới, "chặn" nghĩa là không cho làm hoặc che bài; "ghi" nghĩa là tạo vi phạm cho giám thị.

### 5.1 Máy và môi trường

| Hành vi | Cách xử lý | Chặn / ghi | Code |
|---|---|---|---|
| Thi trong máy ảo | Rust kiểm tra vendor hypervisor (CPUID), chuỗi firmware (SMBIOS/DMI), driver guest (VBox, VMware, QEMU, Xen, Parallels). Chỉ thấy bit "có hypervisor" thì không tính, vì Windows bật VBS/WSL2 cũng báo như vậy | Chặn ở precheck (`block_vm`, mặc định bật) | `env_check.rs`, `Precheck.php` |
| Điều khiển từ xa (RDP, xrdp, SSH -X) | Windows dùng `GetSystemMetrics(SM_REMOTESESSION)`; Linux dùng biến `XRDP_SESSION`/`SSH_CONNECTION`. App điều khiển (AnyDesk, TeamViewer, UltraViewer, RustDesk, Parsec) nằm trong danh sách cấm | Luôn chặn ở precheck; trong giờ thi kiểm tra mỗi 60 s, ghi `REMOTE_SESSION` (CRITICAL, che bài) | `env_check.rs`, `examGuard.ts` |
| Hệ điều hành không được phép | Kỳ thi chọn `allowed_os` | Chặn ở precheck | `Precheck.php` |
| Màn hình thứ hai, màn hình ảo, nhân bản | Đếm màn hình theo cả màn hình đang hoạt động lẫn driver màn hình ảo (spacedesk, Duet, Parsec, DisplayLink…) | Chặn ở precheck; trong giờ thi che bài, ghi `MULTIPLE_MONITORS` | `monitor/`, `examGuard.ts` |
| Capture card (Elgato, AVerMedia, Cam Link…) | Nhận theo tên thiết bị video-in | Chặn ở precheck; trong giờ ghi `CAPTURE_DEVICE` | `monitor/win/devices.rs`, `linux.rs` |
| Cắm thêm USB, bàn phím, chuột | Windows nhận sự kiện cắm/rút ngay; Linux quét mỗi 2 s | Ghi `DEVICE_CHANGED`; ghi `MULTIPLE_KEYBOARDS` khi có hơn 1 bàn phím ngoài | `monitor/` |
| Đổi sang máy khác giữa giờ | `lock_device`: so mã thiết bị (băm) khi vào lại | Chặn (403 `DEVICE_LOCKED`) | `Student/ExamController.php` |
| Hai người dùng chung một máy | Trùng mã thiết bị trong cùng kỳ thi | Hiện cảnh báo đỏ ở trang phiên thi | `MonitoringController::sharedDevice` |
| Khởi động lại máy, mở lại app | Khoá phiên + precheck (mục 4.3) | Bắt precheck lại; ghi `DEVICE_RESTARTED` | `Precheck.php` |
| Đổi mạng / IP | So IP với lần trước | Ghi `IP_CHANGED` (LOW, không cộng điểm rủi ro) | `Precheck.php` |

### 5.2 Phần mềm và thao tác trên máy

| Hành vi | Cách xử lý | Chặn / ghi |
|---|---|---|
| Chạy app cấm (OBS, Discord, Zoom, Zalo, Telegram, Snipping Tool, ShareX…) | Rust quét tiến trình mỗi 1,5 s; danh sách mặc định cộng `banned_apps` của kỳ thi | Che bài + ghi `BANNED_APP`. Giám thị có thể bấm "tắt tiến trình" từ xa (`KILL_PROCESS`); app không tự tắt |
| Chuyển sang cửa sổ khác | Windows: hook đổi cửa sổ đang focus | Ghi `WINDOW_LOST_FOCUS`, hoặc `APP_NOT_ALLOWED` với kỳ thi lập trình có danh sách app được phép |
| Thu nhỏ, thoát toàn màn hình | Mỗi 1,5 s app tự bật lại toàn màn hình, luôn nằm trên cùng, lấy lại focus | Ghi `WINDOW_LOST_FOCUS` khi bị thu nhỏ |
| Phím tắt hệ thống (Win, Alt+Tab, Alt+Esc, Alt+F4, Ctrl+Esc, Ctrl+Shift+Esc, PrintScreen) | Hook bàn phím cấp thấp (Windows) | Chặn phím; ghi `SYSTEM_SHORTCUT` (LOW nếu đã chặn) |
| Đóng cửa sổ thi (X, Alt+F4) | Rust chặn lệnh đóng, hiện hộp xác nhận, nút thoát mở sau 5 s | Không thoát nhầm được |
| Chụp màn hình / quay màn hình | Cửa sổ thi bật `contentProtected`: ảnh chụp và bản quay ra màu đen. PrintScreen bị chặn; app quay màn hình nằm trong danh sách cấm | Chặn |
| Dán, sao chép, cắt, kéo thả văn bản | Chặn ở tầng tài liệu (trừ khi kỳ thi tắt `prevent_paste`); chuột phải luôn bị chặn | Ghi `BULK_PASTE` (dán > 100 ký tự là CRITICAL) và `COPY_ATTEMPT` |
| Phần mềm gõ hộ, macro, AutoHotkey | Phím có cờ `LLKHF_INJECTED` (Windows) | Ghi `SYNTHETIC_INPUT` (HIGH) |
| Mở công cụ nhà phát triển | Đo chênh lệch kích thước cửa sổ mỗi 3 s | Ghi `DEVTOOLS_OPENED` |
| Gõ bất thường so với cả phòng | Heatmap thao tác (phím + chuột theo phút) đánh dấu ô bất thường | Chỉ gợi ý trên trang báo cáo, không tạo vi phạm |

### 5.3 Camera, khuôn mặt, âm thanh (AI trên máy thí sinh)

MediaPipe FaceLandmarker chạy ngay trên máy thí sinh, 15 khung/s với GPU, 5 khung/s với CPU.

| Hành vi | Điều kiện | Vi phạm |
|---|---|---|
| Rời khỏi camera | Không thấy mặt 5 s | `NO_FACE_DETECTED` (MEDIUM) |
| Có người khác | Hơn 1 khuôn mặt trong 2 s | `MULTIPLE_PEOPLE` (HIGH) |
| Quay đầu đi chỗ khác | Lệch > 25° ngang hoặc > 20° dọc trong 6 s | `LOOKING_AWAY` (LOW) |
| Liếc mắt | Đầu thẳng nhưng mắt lệch (blendshape > 0,45) trong 4 s | `GAZE_AWAY` (LOW) |
| Ngồi quá xa | Mặt chiếm < 14% khung hình trong 8 s | `FACE_TOO_FAR` (LOW) |
| Không nhìn màn hình | Không thấy mặt hoặc đang nhìn đi chỗ khác quá 1,5 s | Bài bị làm mờ, không phải vi phạm |
| Tắt camera giữa giờ | Track camera dừng | Che bài + `CAMERA_LOST` |
| Đổi sang camera khác | `deviceId` khác camera đã kiểm tra ở precheck | `CAMERA_TAMPERED` |
| Dùng camera ảo (OBS Virtual Camera, ManyCam, DroidCam, NVIDIA Broadcast, v4l2loopback…) | Tên camera khớp danh sách khoảng 30 phần mềm camera ảo | Chặn ở phòng chờ và precheck (`block_virtual_camera`) |
| Dừng chia sẻ màn hình | Track màn hình dừng | Che bài + `SCREEN_SHARE_STOPPED` |
| Nói chuyện | YAMNet (MediaPipe Audio) trên máy: điểm "giọng nói" ≥ 0,5 ở 3/5 cửa sổ ~1 s; âm thanh không rời máy | `SPEECH_DETECTED` (khi bật micro) |
| Người khác thi hộ | Agent AI so khuôn mặt với ảnh đăng ký: lệch ở 3/5 khung hình (cosine < 0,35) | `FACE_MISMATCH` (cần bật xác thực danh tính) |
| Điện thoại, sách, laptop khác trong khung hình | Agent AI phát hiện vật thể: cùng một vật xuất hiện 2/3 khung | `PROHIBITED_DEVICE` (CRITICAL) |

### 5.4 Camera phụ (điện thoại)

| Hành vi | Cách xử lý | Vi phạm |
|---|---|---|
| Không kết nối camera phụ | Chế độ `required` khoá nút Bắt đầu | Không vào được |
| Đặt sai góc | Kiểm tra lúc vào: ảnh không được dọc, không tối/che; AI phải thấy người **và** laptop | Không vào được |
| Ngắt điện thoại giữa giờ | Mất track LiveKit | `PHONE_DISCONNECTED` (HIGH, che bài) |
| Tắt màn hình, chuyển app trên điện thoại | Trang mất hiển thị | `PHONE_SCREEN_OFF` (HIGH) |
| Đổi sang camera trước | Chặn đổi camera khi đang thi | `CAMERA_TAMPERED` |
| Xoay dọc, đặt nằm phẳng | Cảm biến hướng (beta/gamma) | `PHONE_ORIENTATION_INVALID` |
| Cầm lên, di chuyển điện thoại | Gia tốc kế: độ rung > 0,6 m/s² trong 1,5 s | `PHONE_MOVED`, che bài tới khi kiểm tra lại góc đặt |
| Có người khác ở góc phụ | Agent AI đếm người trên camera điện thoại | `MULTIPLE_PEOPLE` |
| Camera phụ bị xoay lệch dần | Agent AI không còn thấy cả người lẫn laptop ở 4/5 khung | `PHONE_ORIENTATION_INVALID` |
| Không chịu nhìn camera phụ khi được yêu cầu | Kiểm tra ngẫu nhiên: lần đầu sau 6–14 phút, sau đó mỗi 8–18 phút; nhìn camera phụ 10 s, dưới 40% khung đạt là trượt | `SPOT_CHECK_FAILED` |

Điện thoại có nút **Chống chói** (phủ đen, camera vẫn chạy) và Wake Lock để màn hình không tự tắt.

### 5.5 Mạng và thời gian

| Hành vi | Cách xử lý |
|---|---|
| Rút mạng để "dừng" đồng hồ | Đồng hồ ở máy chủ; hết giờ vẫn bị thu |
| Mất mạng ngắn | Câu trả lời giữ trong hàng đợi (localStorage), gửi lại khi có mạng; sự kiện giám sát có số thứ tự, gửi lại không bị trùng |
| Mất mạng ≥ 15 s | Có mạng lại phải precheck lại |
| Mất mạng quá ngưỡng | Máy chủ thu bài, ghi "Vắng thi" |

---

## 6. Ràng buộc giữa các tính năng giám sát

Cấu hình nằm ở `exams.monitoring_config`. Mặc định của trường nằm ở `organizations.settings.monitoring_defaults`: chỉ áp dụng cho kỳ thi **mới**, kỳ thi đã tạo giữ bản riêng.

### 6.1 Quy tắc phụ thuộc (`MonitoringConfig::normalize`)

| Tuỳ chọn chính | Tuỳ chọn phụ (tự tắt khi chính tắt) |
|---|---|
| `ai_face_check` (camera + MediaPipe) | `ai_identity` (xác thực danh tính, cần dịch vụ khuôn mặt), `ai_objects` (vật cấm, cần dịch vụ vật thể) |
| `extra_camera` = `optional`/`required` | `extra_camera_objects` (vật cấm qua điện thoại), `extra_camera_spot_check` (kiểm tra ngẫu nhiên) |
| `ai_objects` hoặc `extra_camera_objects` | `prohibited_labels` (chọn trong: cell phone, laptop, book, remote, tv, keyboard, mouse, backpack, handbag, scissors) |
| `ai_face_check` hoặc `require_screen` | `violation_clips` (quay clip quanh vi phạm) |

Form trên trang quản trị khoá và tắt tuỳ chọn phụ theo đúng quy tắc này. Máy chủ chuẩn hoá lại khi lưu, nên dữ liệu luôn nhất quán.

### 6.2 Tính năng AI phụ thuộc dịch vụ

- Chỉ **bật** được một tính năng AI khi dịch vụ của nó trả lời ping (`GET /health`). Tính năng đã bật từ trước vẫn giữ khi dịch vụ chập chờn (`assertServicesReachable`).
- Kỳ thi cần dịch vụ nào mà dịch vụ đó (hoặc agent) đang tắt thì thí sinh không vào được (503 `AI_SERVICE_UNAVAILABLE`). `AI_ENFORCE=false` bỏ chặn này.
- Kết quả ping được nhớ 10 s nếu tốt, 5 s nếu lỗi.

### 6.3 Bảng tuỳ chọn đầy đủ

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `ai_face_check` | bật | Camera + phân tích khuôn mặt trên máy |
| `ai_identity` | tắt | So khuôn mặt với ảnh đăng ký (cần ảnh, cần dịch vụ) |
| `ai_objects` | tắt | Phát hiện vật cấm trên camera chính |
| `extra_camera` | `off` | Camera phụ điện thoại: tắt / tuỳ chọn / bắt buộc |
| `extra_camera_objects`, `extra_camera_spot_check` | tắt | Vật cấm qua điện thoại, kiểm tra ngẫu nhiên |
| `require_mic` | tắt | Bắt buộc micro, bật phát hiện tiếng nói |
| `require_screen` | tắt | Bắt buộc chia sẻ màn hình |
| `prevent_paste` | bật | Chặn sao chép/dán |
| `lock_device` | bật | Không cho tiếp tục bài trên máy khác |
| `block_vm` | bật | Chặn máy ảo |
| `block_virtual_camera` | bật | Chặn camera ảo |
| `allowed_os` | `[]` (mọi HĐH) | Hệ điều hành được phép |
| `offline_minutes` | 5 | Phút mất kết nối trước khi thu bài (0 = không tự thu) |
| `banned_apps` | danh sách mặc định | Thêm app cấm riêng của kỳ thi |
| `allowed_apps` | `devenv`, `code` (chỉ kỳ thi lập trình) | App được mở; **có danh sách này thì chế độ khoá toàn màn hình tắt** |
| `violation_clips` | tắt | Quay clip 10–15 s quanh vi phạm |
| `seal_after_exam` | tắt | Mã hoá video và minh chứng sau khi thi |
| `is_shuffle_questions`, `is_shuffle_answers` | bật | Xáo câu và phương án |
| `is_allow_review`, `is_hide_score` | bật, tắt | Cho xem lại bài, ẩn điểm |

---

## 7. Vi phạm: từ lúc phát hiện tới lúc giám thị xử lý

### 7.1 Đường đi

1. App phát hiện, chống trùng theo `cooldown` của từng loại, rồi chụp ảnh minh chứng.
2. App gửi qua realtime (mỗi lô ~1 s, có số thứ tự `seq`). Nếu máy chủ tắt realtime thì gửi qua REST.
3. `ingest` kiểm tra rồi đẩy vào Redis stream. `worker` gom lô và gửi vào core (ký HMAC).
4. Core lưu idempotent theo `client_event_id`, cộng điểm rủi ro và nối chuỗi băm.
5. `hub` đẩy thay đổi lên màn giám sát trong khoảng 1 giây.

Agent AI gửi vi phạm thẳng vào core, cũng ký HMAC.

### 7.2 Danh mục, duyệt và điểm rủi ro

- **Nguồn quy tắc:** `server/app/Support/ViolationCatalog.php` là nguồn duy nhất cho mức độ, cooldown, ngưỡng thời gian và việc có che bài hay không. App đọc qua `GET /api/v1/public/violation-rules`. Danh sách loại hợp lệ còn được lặp lại ở `realtime/internal/events/events.go` và `EventsController`; **thêm loại mới phải sửa cả ba**.
- **Cần duyệt:** 9 loại do AI phát hiện (khuôn mặt, ánh mắt, vật cấm, tiếng nói, kiểm tra ngẫu nhiên) chờ giám thị. Các loại còn lại là sự kiện chắc chắn, được tự xác nhận. Loại lạ mặc định chờ duyệt.
- **Điểm rủi ro:** LOW 5, MEDIUM 15, HIGH 30, CRITICAL 60. Đạt **40** thì lượt thi bị gắn cờ.
- **Giám thị xử lý:**
  - Xác nhận, đánh dấu báo nhầm, hoặc xử lý hàng loạt (tối đa 2000 vi phạm).
  - Thêm vi phạm thủ công (`MANUAL`), kèm ảnh.
  - Huỷ lượt thi: vi phạm vẫn lưu nhưng không tính.
  - Lập **biên bản vi phạm**: không vi phạm / cảnh cáo (trừ % điểm, mặc định 25%) / đình chỉ (0 điểm). Biên bản có link công khai hết hạn, thông báo cho sinh viên, gỡ lại được.

### 7.3 Minh chứng

- **Ảnh:** mỗi vi phạm cần ảnh có tối đa 3 ảnh: màn hình, camera chính, camera điện thoại. JPEG ≤ 1280 px; tối thiểu 8 s giữa hai bộ ảnh cùng loại. App có bộ đệm khung hình 3 s để vẫn có ảnh khi cửa sổ đang ẩn.
- **Clip:**
  - Quay sẵn liên tục trên máy; khi có vi phạm thì cắt khoảng ≥ 4 s trước + 5 s sau.
  - Khi agent AI phát hiện, máy chủ ra lệnh `CLIP` cho app.
  - Giám thị còn cắt được clip tới 120 s từ bản ghi đầy đủ (ffmpeg trên dịch vụ record).
- **Ghi hình:** Track Egress chép nguyên luồng VP8 thành `.webm` cho camera, màn hình và camera điện thoại. Trình phát đồng bộ cả ba nguồn trên một đồng hồ chung.
- **Mã hoá sau thi:** AES-256-GCM theo khối 64 KB (vẫn tua được), mỗi kỳ thi một khoá, khoá bọc bằng `RECORD_SEAL_KEY`. Bản gốc bị xoá; xem qua link có chữ ký, hết hạn sau 15 phút. **Mất `RECORD_SEAL_KEY` là mất dữ liệu.**
- **Chuỗi băm:** mỗi vi phạm lưu `sha256(hash trước | phiên | loại | mức | thời điểm | id sự kiện)`. `GET /admin/attempts/{id}/verify-chain` cho biết dòng đầu tiên bị sửa hoặc xoá. Phần chi tiết, kết quả duyệt và clip không nằm trong chuỗi, vì chúng được phép thay đổi hợp lệ.

---

## 8. Giám sát trực tiếp

- **Màn giám sát kỳ thi:** lưới thí sinh với trạng thái (online, rời cửa sổ, offline sau 20 s không tín hiệu, tạm dừng, đã kết thúc), số vi phạm, câu đang làm, độ tập trung, CPU/RAM, video camera hoặc màn hình (LiveKit, giám thị ẩn, chỉ xem).
- **Lệnh cho thí sinh:**
  - `WARN`: banner nhắc nhở, kèm tin nhắn chat.
  - `PAUSE` / `RESUME`: che hoặc mở bài.
  - Xin danh sách tiến trình, tắt một tiến trình.
  - Chat hai chiều.
  - Kết thúc một lượt hoặc cả kỳ thi.
  - Lệnh nằm trong Redis tới khi app xác nhận, nên mất mạng vẫn không mất lệnh.
- **Trang phiên thi:** dòng thời gian vi phạm, ảnh, clip, trình phát đồng bộ, thông tin thiết bị, lịch sử precheck, cảnh báo dùng chung máy, kiểm tra chuỗi băm, xuất CSV (vi phạm, op-log, chat), in báo cáo.
- **Báo cáo kỳ thi:** điểm, trạng thái ("Vắng thi", "Hết giờ, tự thu"), heatmap thao tác, xuất CSV.

---

## 9. Dữ liệu cá nhân và sinh trắc học

- **Đồng ý:** thí sinh đồng ý chính sách xử lý sinh trắc học **ở mỗi lần đăng nhập**. Máy chủ ghi lại token, phiên bản chính sách, IP và thời điểm. Các API sinh trắc học từ chối khi chưa đồng ý (`403 BIOMETRIC_CONSENT_REQUIRED`). Trang chính sách: `/biometric-policy`.
- **Ảnh khuôn mặt tham chiếu:**
  - Lưu riêng tư, không công khai.
  - Đăng ký một lần từ webcam hoặc điện thoại (QR 10 phút); dịch vụ AI phải thấy đúng một khuôn mặt rõ.
  - Đăng ký xong ảnh bị khoá. Đổi ảnh phải gửi yêu cầu để giảng viên duyệt.
- **Âm thanh:** phân tích ngay trên máy, không gửi đi.
- **Video:** chỉ giám thị của trường xem được; có thể mã hoá sau thi; có thể đặt thời hạn lưu (`RECORD_RETENTION_DAYS`).
- **Mã thiết bị:** chỉ gửi bản băm có salt của machine id.
- **Khoá API AI của trường:** mã hoá trên máy chủ, giao diện chỉ hiện 4 ký tự cuối.

---

## 10. Bảo mật hệ thống

- **Đăng nhập:**
  - Giới hạn 120 lần/phút mỗi IP và 10 lần/phút mỗi tài khoản + IP. `LoginGuard`: 10 lần sai/5 phút mỗi nơi gọi, 100 lần/15 phút mỗi tài khoản, IPv6 gộp theo /64.
  - Mở khoá: `php artisan foxy:unlock-login {login}`.
  - Áp dụng cho API, `/oauth/token` và form `/login` trên web.
- **Gateway:** 30 request/s mỗi token (hoặc IP), 10 request/s mỗi IP cho đăng nhập. Đường `/rt/*/internal` và `/metrics` trả 404 từ bên ngoài.
- **Giữa các dịch vụ:**
  - Ký HMAC-SHA256 (`RT_INTERNAL_SECRET`, lệch giờ tối đa ±5 phút).
  - App thi và giám thị dùng JWT ngắn hạn (`RT_JWT_SECRET`). Token của thí sinh chỉ gửi được dữ liệu cho đúng lượt thi của mình.
- **Proxy tin cậy:** chỉ dải IP nội bộ được đặt `X-Forwarded-For`, nên client không giả IP được.
- **Token lưu dạng băm:** precheck, khoá phiên, link camera điện thoại, link đăng ký khuôn mặt.
- **Cập nhật app:** ký minisign. Khoá bí mật `foxyexam-updater.key` không được commit.

---

## 11. Triển khai và vận hành

- **Máy chủ:** `docker compose -f docker.compose.server.yml up -d --build`.
  - Dịch vụ: gateway, app, ingest, hub, worker, record, livekit, egress, postgres, redis, s3.
  - Container `app` tự migrate (`RUN_MIGRATIONS`) và chạy scheduler (`RUN_SCHEDULER`, chỉ một bản).
- **CI/CD:** `.github/workflows/server-ci.yml`.
  - Các bước: chạy migrate trên PostgreSQL, kiểm tra TypeScript và build, chạy test bắt buộc, gọi webhook Coolify, kiểm tra `/up`.
- **AI:** chạy riêng bằng `ai/docker-compose.yml` (thêm `docker-compose.gpu.yml` nếu có GPU). Điền địa chỉ ở **Tình trạng hệ thống → Địa chỉ các dịch vụ**, và đặt `AI_TOKEN` giống nhau ở core và dịch vụ AI.
  - Năng lực: 1 nhân CPU theo dõi được khoảng 8–10 thí sinh ở 1 khung/s.
- **App thi:** `pnpm tauri build`.
  - Windows là nền tảng đầy đủ nhất. Linux: xem [`LINUX_TEST.md`](LINUX_TEST.md).
  - Phát hành qua GitHub Releases, app tự cập nhật.
- **Biến môi trường quan trọng:**
  - Precheck: `PRECHECK_REQUIRED`, `PRECHECK_ALLOW_DEV`.
  - AI: `AI_ENFORCE`, `AI_FACE_URL`, `AI_OBJECT_URL`, `AI_AGENT_URL`, `AI_TOKEN`.
  - Realtime và ghi hình: `RT_JWT_SECRET`, `RT_INTERNAL_SECRET`, `RECORD_SEAL_KEY`, `RECORD_RETENTION_DAYS`.
  - Sinh trắc học: `BIOMETRIC_CONSENT_REQUIRED`.
- **Kiểm tra sức khoẻ:** `/up` (Laravel), `/admin/platform/health` (DB, cache, storage, realtime, record, từng dịch vụ AI).

---

## 12. Giới hạn đã biết

Các mục này nên đưa vào kế hoạch sửa. Mục đánh dấu ✅ đã sửa ngày 26/11/2026.

**Nền tảng**
- Linux không có hook bàn phím, không chặn phím tắt, không theo dõi cửa sổ đang focus, không phát hiện gõ giả lập (giới hạn của Wayland).
- macOS hầu như chưa có giám sát tầng hệ điều hành: không có danh sách tiến trình, thiết bị hay màn hình.
- WebKitGTK trên nhiều bản Linux thiếu WebRTC, nên camera không gửi được cho giám thị.

**App thi chưa đọc một số tuỳ chọn**
- `offline_minutes`: app cố định 5 phút.
- `max_paste_chars`: app cố định 100 ký tự.
- `prevent_tab_switch` và `track_keystroke_dynamics` chưa được app dùng.
- Kiểm tra "Ứng dụng cấm" ở phòng chờ chỉ dùng danh sách mặc định; danh sách riêng của kỳ thi chỉ áp dụng khi đã vào thi.

**Khoá toàn màn hình**
- Kỳ thi lập trình có `allowed_apps` thì tắt chế độ khoá toàn màn hình và chặn phím tắt.

**Tín hiệu điện thoại**
- Tín hiệu từ điện thoại (bị di chuyển, tắt màn hình…) đi qua máy thí sinh rồi mới tới máy chủ. App bị sửa có thể bỏ qua chúng. Agent AI chỉ xem được video, không nhận được kênh dữ liệu này.

**AI**
- Phòng chờ không đối chiếu khuôn mặt với ảnh đăng ký trên máy chủ; việc đối chiếu chỉ do agent làm trong giờ thi.
- Liveness chỉ chạy trên máy thí sinh.
- Nếu không cấu hình `AI_AGENT_URL`, kỳ thi cần AI vẫn mở được dù không có agent nào phân tích video.
- `AI_TOKEN` để trống thì các endpoint AI mở công khai.
- Ngưỡng khuôn mặt của agent cố định 0,35, không đọc `FACE_MATCH_THRESHOLD`.
- `ai/docker-compose.yml` đặt sai tên biến: `INSIGHTFACE_MODEL` và `FACE_THRESHOLD`, trong khi code đọc `FACE_MODEL` và `FACE_MATCH_THRESHOLD`.
- COCO không có lớp tai nghe; nhãn `monitor` không tồn tại trong COCO.
- Phòng chờ chấp nhận độ tin cậy 0,30 cho bước kiểm tra góc đặt điện thoại, còn agent dùng 0,5.
- ✅ Agent không còn báo "laptop" là vật cấm trên camera điện thoại (điện thoại vốn phải nhìn thấy laptop).

**Gói cước, quyền và bảo mật**
- Chưa kiểm tra: số thí sinh mỗi kỳ thi, quyền "có AI giám sát" khi tạo kỳ thi trên web, dung lượng.
- Giám thị được gắn vào kỳ thi chưa giới hạn quyền xem: mọi giảng viên trong trường đều giám sát được mọi kỳ thi của trường.
- Token Sanctum không hết hạn.
- App thi tắt CSP.
- JWT realtime cũ vẫn hợp lệ tới khi hết hạn, dù khoá phiên đã đổi.

**Đã sửa ngày 26/11/2026**
- ✅ Dịch vụ ingest (Go) thiếu 9 loại vi phạm (`PHONE_SCREEN_OFF`, `PHONE_ORIENTATION_INVALID`, `PHONE_MOVED`, `CAMERA_TAMPERED`, `VIRTUAL_MACHINE`, `VIRTUAL_CAMERA`, `REMOTE_SESSION`, `IP_CHANGED`, `DEVICE_RESTARTED`), nên các loại này gửi qua realtime đều bị bỏ.
- ✅ Gateway giới hạn 2 MB cho `/rt/record/`, nên clip vi phạm lớn bị từ chối. Đã nâng lên 64 MB.
- ✅ Giảng viên bị 403 ở trang biên bản vi phạm (code kiểm tra vai trò `LECTURER` không tồn tại).
- ✅ Form đăng nhập web không giới hạn số lần thử.

---

## 13. FAQ kỹ thuật

### Kiến trúc

**H: Vì sao bắt thí sinh cài app thay vì thi trên web?**
Trình duyệt không chặn được phím tắt hệ thống, không biết app nào đang chạy, không phát hiện máy ảo, capture card hay màn hình thứ hai, và không chống chụp màn hình được. FoxyClient (Tauri + Rust) làm được những việc đó ở tầng hệ điều hành.

**H: Vì sao realtime viết bằng Go mà không để Laravel nhận trực tiếp?**
Mỗi thí sinh gửi một lô mỗi giây. 500 thí sinh là 500 request/s chỉ để báo "còn sống". `ingest` nhận, kiểm tra và ghi Redis trong vài mili giây. `worker` gom thành lô lớn gửi vào Laravel, và heartbeat chỉ ghi vào DB mỗi 15 s cho mỗi lượt.

**H: Nếu Redis hoặc worker chết, có mất vi phạm không?**
Không.
- Redis bật AOF và `noeviction`.
- Sự kiện nằm trong stream tới khi Laravel xác nhận. `worker` tự nhận lại tin bị treo quá 30 s; sau 5 lần lỗi thì chuyển sang hàng `foxy:events:dlq`.
- Phía app giữ hàng đợi có số thứ tự; gửi lại không bị trùng.

**H: Thêm một loại vi phạm mới cần sửa ở đâu?**
1. `server/app/Support/ViolationCatalog.php` (nhãn, mức độ, cooldown, có cần duyệt không).
2. `server/app/Http/Controllers/Api/Internal/EventsController.php` (`VIOLATION_TYPES`).
3. `realtime/internal/events/events.go` (`ViolationTypes`). Thiếu bước này thì ingest âm thầm bỏ vi phạm.
4. `client/src/lib/api.ts` (`ViolationType`), `client/src/lib/evidence.ts` (nguồn ảnh minh chứng nếu cần).
5. `server/resources/js/components/foxy/domain.ts` (nhãn tiếng Việt trên trang quản trị).

**H: Máy chủ biết thí sinh còn online bằng cách nào?**
Mỗi lô gửi lên cập nhật `ls` trong Redis. `hub` báo offline sau 20 s không có tín hiệu. `worker` chuyển `last_seen_at` vào DB, và lệnh `attempts:sweep` dùng mốc đó để thu bài vắng thi.

### Precheck và vào thi

**H: Thí sinh sửa app để báo "mọi thứ OK" thì sao?**
- Máy chủ vẫn tự xét lại chính sách: máy ảo, HĐH, camera ảo, điều khiển từ xa, số màn hình.
- Không có mã precheck thì không vào thi được.
- Các lớp sau vẫn hoạt động: video do giám thị xem trực tiếp và được ghi lại, agent AI phân tích video phía máy chủ, giám thị nhìn thấy điều bất thường.
- Báo cáo từ máy thí sinh không bao giờ được coi là bằng chứng tuyệt đối; đó là lý do có nhiều lớp.

**H: Mã precheck hết hạn bao lâu? Dùng lại được không?**
15 phút, dùng một lần, gắn với máy đã kiểm tra.

**H: Thí sinh đang thi thì máy sập nguồn. Chuyện gì xảy ra?**
1. Máy chủ vẫn giữ lượt thi; đồng hồ vẫn chạy.
2. Mở lại app: app đưa về phòng chờ, phải precheck lại.
3. Vào lại cùng lượt thi, câu trả lời đã lưu vẫn còn. Máy chủ ghi `DEVICE_RESTARTED`.
4. Nếu quá `offline_minutes` mới quay lại thì bài đã bị thu ("Vắng thi").

**H: Thí sinh mở app trên máy thứ hai để tra cứu bằng cửa sổ cũ?**
- Lần vào sau làm khoá phiên của cửa sổ trước mất hiệu lực, nên chỉ một nơi làm bài được.
- `lock_device` không cho tiếp tục trên máy khác.
- Hai thí sinh dùng chung một máy sẽ hiện cảnh báo.

**H: Vì sao chỉ thấy bit "hypervisor" thì không kết luận là máy ảo?**
Windows 11 bật Memory Integrity (VBS), Hyper-V hoặc WSL2 đều chạy chính hệ điều hành chủ trên hypervisor của Microsoft; bit này bật trên rất nhiều máy thật. Chặn theo bit này sẽ chặn nhầm sinh viên. Vì vậy chỉ tính khi có bằng chứng rõ: vendor VM thật, chuỗi firmware của VM, hoặc driver guest.

**H: Máy ảo "giấu mình" có lọt không?**
Có thể. Một VM được cấu hình kỹ có thể giấu CPUID và SMBIOS. Đây là cuộc đua không có điểm kết thúc; các lớp video và AI vẫn phát hiện hành vi bất thường. Có thể thêm kiểm tra độ trễ timing hoặc MAC prefix nếu cần.

**H: Vì sao đổi IP chỉ ghi mức LOW mà không chặn?**
Đổi Wi-Fi sang 4G, hoặc mạng trường đổi IP NAT, là chuyện bình thường. Ghi lại để giám thị đối chiếu khi có nghi vấn; IP_CHANGED không cộng điểm rủi ro.

### Giám sát

**H: AI có tự đánh trượt thí sinh không?**
Không. Mọi phát hiện của AI (khuôn mặt, ánh mắt, vật cấm, tiếng nói) đều chờ giám thị duyệt. Quyết định xử lý là của con người, qua biên bản vi phạm.

**H: Thí sinh liếc xuống bàn phím có bị ghi vi phạm không?**
- Liếc ngắn thì không: ánh mắt phải lệch liên tục 4 s mới ghi `GAZE_AWAY`, quay đầu phải 6 s mới ghi `LOOKING_AWAY`. Cả hai đều mức LOW và cần duyệt.
- Bài bị làm mờ ngay khi nhìn ra ngoài quá 1,5 s, nhưng làm mờ không phải vi phạm.

**H: Vì sao kỳ thi lập trình lại tắt khoá toàn màn hình?**
Kỳ thi lập trình có thể cho dùng Visual Studio hoặc VS Code (`allowed_apps`). Cửa sổ thi không thể vừa luôn nằm trên cùng vừa cho mở IDE. Thay vào đó, mọi app ngoài danh sách được phép đều bị ghi `APP_NOT_ALLOWED`.

**H: Phát hiện nói chuyện có gửi âm thanh lên máy chủ không?**
Không. YAMNet chạy ngay trên máy thí sinh; chỉ kết quả "có tiếng nói" được gửi đi.

**H: Clip vi phạm dài bao lâu?**
10–15 s: tối thiểu 4 s trước và 5 s sau thời điểm vi phạm. Hai clip cách nhau ít nhất 15 s. Giám thị có thể tự cắt đoạn tới 120 s từ bản ghi đầy đủ.

**H: Giám thị có thấy màn hình thí sinh không?**
Có, nếu kỳ thi bắt buộc chia sẻ màn hình. Màn giám sát hiện camera hoặc màn hình; trang phiên thi phát đồng bộ camera, màn hình và camera điện thoại.

**H: Giám thị có xem được nhiều kỳ thi của trường khác không?**
Không. Mọi truy vấn được lọc theo tổ chức. Chỉ Root Admin (nền tảng) chuyển vào trường để hỗ trợ được.

### Camera phụ

**H: Vì sao điện thoại phải nhìn thấy cả người lẫn laptop?**
Góc chéo khoảng 90° cho thấy tay, bàn phím, mặt bàn và màn hình laptop, là những chỗ camera trước không thấy. Phòng chờ dùng AI xác nhận khung hình có người **và** laptop.

**H: Điện thoại tắt màn hình thì camera có dừng không?**
Trình duyệt di động sẽ dừng camera khi tắt màn hình bằng nút nguồn, và việc này bị ghi `PHONE_SCREEN_OFF`. Muốn giảm chói thì dùng nút **Chống chói** trên trang: màn hình phủ đen nhưng camera vẫn chạy. Wake Lock giữ màn hình không tự tắt.

**H: Làm sao biết điện thoại bị cầm lên?**
Gia tốc kế: điện thoại đặt yên trên bàn gần như không đổi gia tốc. Cầm lên thì rung và lệch. Rung vượt ngưỡng trong 1,5 s thì báo, đứng yên lại 3 s thì hết báo.

**H: Link camera điện thoại có bị người khác dùng không?**
Token dài, lưu dạng băm, gắn với đúng thí sinh và kỳ thi, hết hạn sau 8 giờ hoặc khi nộp bài. Điện thoại chỉ phát vào phòng riêng `cam2-…` và không xem được ai.

### Dữ liệu và vận hành

**H: Câu trả lời có mất khi mất mạng không?**
Không. Câu trả lời được giữ trong localStorage, mỗi câu chỉ giữ bản mới nhất, và gửi lại khi có mạng. Trước khi nộp, app bắt gửi hết; còn câu chưa gửi thì không cho nộp và báo rõ.

**H: Hết giờ mà thí sinh đang mất mạng?**
Máy chủ thu bài với các câu đã lưu tới lúc đó. Câu chưa kịp gửi lên không được tính.

**H: Đề thi có lộ đáp án qua API không?**
Không. API gửi đề cho app đã lọc đáp án (`QuestionSettings::forClient`); test ẩn của bài lập trình không bao giờ gửi đi. Đáp án chỉ xuất hiện khi xem lại sau thi, nếu kỳ thi cho phép.

**H: Hai thí sinh có nhận cùng một đề không?**
Nếu bật bốc ngẫu nhiên thì mỗi lượt có đề riêng (seed = id lượt thi) theo tỉ lệ độ khó; ngoài ra còn xáo câu và xáo phương án.

**H: Video lưu ở đâu, bao lâu?**
Trong S3 nội bộ (SeaweedFS), giữ mãi mãi mặc định. Đặt `RECORD_RETENTION_DAYS` để tự xoá. Bật `seal_after_exam` để mã hoá.

**H: Chạy bao nhiêu thí sinh cùng lúc được?**
- Phần realtime chịu được hàng nghìn lượt nhờ gom lô, và tự giãn chu kỳ gửi khi quá tải.
- Giới hạn thực tế nằm ở băng thông LiveKit/egress (video) và AI (1 nhân CPU khoảng 8–10 thí sinh).
- Kế hoạch demo 10 thí sinh: [`PLAN_DEMO_10.md`](PLAN_DEMO_10.md).

**H: Tắt các lớp bảo vệ để test thế nào?**
- Bản dev của app có nút DEV để bỏ qua từng bước; bản phát hành không bật được.
- Phía máy chủ:
  - `PRECHECK_ALLOW_DEV=true` (chỉ local), `PRECHECK_REQUIRED=false`.
  - `AI_ENFORCE=false`.
  - `BIOMETRIC_CONSENT_REQUIRED=false` (chỉ dùng trong test).

**H: Làm sao kiểm tra nhật ký vi phạm có bị ai sửa trong DB không?**
Gọi `GET /admin/attempts/{id}/verify-chain`, hoặc xem phần kiểm tra chuỗi trên báo cáo phiên thi. Kết quả trả `ok` hoặc id của vi phạm đầu tiên bị sửa hoặc xoá.

**H: Tạo câu hỏi bằng AI có gửi tài liệu đi đâu không?**
Có: tài liệu được gửi tới Gemini hoặc DeepSeek bằng khoá API của trường. Vì vậy không nên dùng tài liệu có thông tin cá nhân của sinh viên. Có chế độ "tự dán vào chatbot" không cần khoá. Câu hỏi AI tạo chỉ là nháp; giảng viên duyệt rồi mới lưu.

---

## 14. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [`CLIENT_EXAM_FLOW.md`](CLIENT_EXAM_FLOW.md) | Luồng app thi chi tiết, precheck, camera phụ |
| [`REALTIME.md`](REALTIME.md) | Giao thức realtime (một số mục cũ hơn code: danh sách lệnh và loại vi phạm, xem mục 7 ở trên) |
| [`VIOLATIONS.md`](VIOLATIONS.md) | Danh mục vi phạm |
| [`PROCTORING_TOOLS.md`](PROCTORING_TOOLS.md) | Chat, clip, CSV, sinh trắc học |
| [`ACCOUNTS.md`](ACCOUNTS.md) | Tài khoản seed |
| [`LINUX_TEST.md`](LINUX_TEST.md) | Chạy thử trên Linux, kịch bản kiểm tra |
| [`PLAN_DEMO_10.md`](PLAN_DEMO_10.md) | Kế hoạch demo 10 thí sinh với GPU |
| [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) | Triển khai |
| [`server/resources/chat/faq_public.md`](../server/resources/chat/faq_public.md) | FAQ công khai cho chatbot landing page |
| `ai/README.md` | Dịch vụ AI |

---

## 15. Trợ lý AI trên landing page

- **Giao diện:** góc phải dưới mọi trang công khai có Zalo (`contact.zalo`, hoặc tự tạo từ hotline), Liên hệ (cuộn tới form `#tu-van`) và Trợ lý AI (`ContactDock.tsx`).
  Bật/tắt ở **Website → Liên hệ → Trợ lý AI**; nút AI chỉ hiện khi máy chủ có `CHAT_DEEPSEEK_KEY`.
- **Kiến thức:** `server/resources/chat/faq_public.md`, gửi nguyên văn ở đầu system prompt (cố định để DeepSeek cache, rẻ và nhanh).
  Bổ sung FAQ ở file này. Câu trợ lý không trả lời được hiện ở trang **Khách tiềm năng** để bổ sung.
- **Dữ liệu động qua function calling** (`App\Services\LandingChat`, nguồn `App\Support\PublicFacts`, cache 60 s):
  `get_plans` (gói, giá, giới hạn), `get_contact`, `get_download` (phiên bản FoxyClient). Không có con số nào đóng băng trong prompt.
  Cùng dữ liệu được mở công khai ở `GET /api/v1/public/facts` cho bot/crawler khác đọc.
- **Đặt dịch vụ:** trợ lý hỏi thông tin còn thiếu rồi gọi `open_contact_form`; khung chat hiện form điền sẵn. **Trợ lý không bao giờ tự gửi**:
  khách kiểm tra, đọc điều khoản (cùng modal với form trang chủ) và bấm gửi → `POST /pilot-requests` với `source=chat`, gói, quy mô, nhu cầu → hộp Leads.
- **Tốc độ và giới hạn:** trả lời streaming (SSE `POST /chat`), `max_tokens` 450, tối đa 3 vòng gọi hàm, gửi 10 lượt hội thoại gần nhất;
  15 câu/phút mỗi IP và `CHAT_DAILY_LIMIT` câu/ngày cho cả site. Lỗi của DeepSeek không hiện cho khách.
- **Rào chắn:** chỉ trả lời theo FAQ + kết quả hàm, từ chối hướng dẫn lách giám sát, không bao giờ nạp tài liệu nội bộ này.
