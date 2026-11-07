# Việc cần làm sau các thay đổi gần đây

## Máy chủ (Coolify)

1. **Redeploy** `core` (Laravel) để chạy migration mới: `…000014`–`000023` (hủy phiên, loại sinh viên khỏi kỳ thi, `mobile_camera_tokens`, khuôn mặt,
   `attempt_messages`, đồng ý sinh trắc học + yêu cầu đổi + token QR, `user_notifications`, `chain_hash` của vi phạm, chấm tay).
   Composer có thêm `sentry/sentry-laravel` (image sẽ cài khi build).
2. Redeploy `ingest`, `hub`, `record` (Go): có endpoint `/internal/v1/signal`, trường CPU/RAM, sửa lỗi mất delta khi phòng vừa mở, cắt clip.
   Image `record` cần ffmpeg — build lại image, không chỉ restart.
3. Biến môi trường cho app (đã có trong compose, kiểm tra giá trị): `RT_RECORD_INTERNAL_URL`, `AI_FACE_URL`, `AI_OBJECT_URL`, `AI_AGENT_URL`, `AI_TOKEN`,
   `RT_INTERNAL_SECRET`, `RT_JWT_SECRET`. Tuỳ chọn: `BIOMETRIC_CONSENT_REQUIRED` (mặc định true), `FFMPEG_PATH` cho `record`,
   `SENTRY_LARAVEL_DSN` (để trống = tắt báo lỗi).
4. **Dịch vụ AI** (`ai/face-service`, `ai/object-service`, `ai/supervisor-agent`) chạy ở máy riêng (ngoài compose), core gọi tới được; agent cần
   LiveKit URL/key và địa chỉ core + `RT_INTERNAL_SECRET`. Thêm URL `/webhook` của agent vào danh sách webhook của LiveKit.
5. LiveKit: giữ port-forward 7881/7882 (media); webhook của record vẫn như cũ.
6. **Đổi mật khẩu seed** (admin, giảng viên, sinh viên mẫu) — mật khẩu mặc định yếu.
7. Kiểm tra bucket S3: clip của client được lưu như bằng chứng (`evidence/…`), giới hạn 600 tệp/lượt thi và 60 MB/tệp.

## Client (máy thí sinh)

- Build lại bản mới (`pnpm tauri dev` khởi động lại, hoặc `pnpm tauri build`): có màn đồng ý sinh trắc học, chat, quay clip, QR đăng ký khuôn mặt, icon mới.
- **Ký số tự động cho Updater (GitHub Actions)**:
  - Khi tạo release tự động bằng `.github/workflows/release-client.yml`, cần cấu hình GitHub Repository Secret:
    `TAURI_SIGNING_PRIVATE_KEY` chứa nội dung khoá bí mật `foxyexam-updater.key`.
  - Public key đã được lưu sẵn trong `client/src-tauri/tauri.conf.json`.
  - Trước khi release bản mới, chạy `pnpm bump:patch` hoặc `pnpm bump:minor` tại thư mục `client/` để nâng phiên bản đồng bộ.
- Rust có thêm crate `sysinfo` và `machine-uid` (lần build đầu tải về). Thông tin máy chỉ gửi mã thiết bị đã băm.
- Biến build mặc định: `VITE_API_BASE_URL=https://foxyexam.konnn04.dev/api/v1` (tự động kế thừa từ file `.env.production`).
- `pnpm sync:mediapipe` nếu thư mục wasm/model chưa có.
- WebView2 phải hỗ trợ `MediaRecorder` webm (Windows 10/11 hiện đại đều có).

## Cấu hình theo kỳ thi

- Bật **Quay clip quanh vi phạm** ở bước Giám sát của kỳ thi (cần camera hoặc chia sẻ màn hình).
- Camera mở rộng: chọn *Tùy chọn* hoặc *Bắt buộc* nếu muốn điện thoại làm camera phụ.

## Kiểm thử thủ công nên làm một lần

1. Đăng nhập client → thấy màn đồng ý → bỏ tick thì nút bị khoá → đồng ý mới vào được; đăng nhập lần nữa → hỏi lại.
2. Thí sinh vào thi, giám thị mở `/admin/attempts/{id}`: số vi phạm tự tăng không cần F5; chat hai chiều; ghi vi phạm thủ công.
3. Gây một vi phạm (Alt+Tab) khi bật clip: sau ~10 giây vi phạm có clip camera + màn hình.
4. Phòng chờ: *Đăng ký bằng điện thoại* → quét QR → ảnh về máy tính. Khuôn mặt đã khoá → *Xin đổi* → duyệt ở `/admin/faces`.
5. Phòng chờ có thêm bước *Kiểm tra người thật* (chớp mắt 2 lần + quay đầu): thử với kỳ thi bật xác thực danh tính.
6. Bật micro cho một kỳ thi và nói liên tục vài giây: có vi phạm `SPEECH_DETECTED` chờ duyệt.
7. Nộp bài một kỳ thi có câu tự luận → `/admin/attempts/{id}/grading` chấm điểm → sinh viên mở *Xem lại* ở Dashboard thấy điểm và nhận xét.
8. Rút mạng khi đang làm bài trắc nghiệm, chọn vài câu, cắm lại: chỉ báo lưu chuyển từ lỗi sang đã lưu; nộp bài khi còn mạng yếu thì báo nếu còn câu chưa lưu.
