# Công cụ giám thị: chat, vi phạm thủ công, clip, CSV, sinh trắc học

## Trang phiên thi `/admin/attempts/{id}` cập nhật realtime

Trang không polling. Nó mở một kết nối hub của kỳ thi (cùng loại trang Live dùng) và chỉ tải lại dữ liệu từ server
(`router.reload`) khi dòng của phiên này thay đổi: trạng thái, số vi phạm, `ev_seq` (một vi phạm vừa có thêm clip) hoặc
`chat_seq` (tin nhắn mới). Phiên đã kết thúc không mở kết nối.

Chi tiết một vi phạm chỉ mở khi giám thị bấm vào nó (hoặc vào bằng `?violation=ID`). Ảnh minh chứng là ảnh nhỏ, bấm để phóng to;
clip phát ngay trong khung, tự nhảy tới thời điểm vi phạm.

## Chat giám thị ↔ thí sinh

- Lưu DB bảng `attempt_messages` (nội dung, người gửi, vai trò, thời điểm). Chỉ gửi được khi phiên `IN_PROGRESS`, nhưng log đọc được mãi.
- Giám thị → thí sinh: core lưu rồi gọi ingest `POST /internal/v1/signal` (ký HMAC) với lệnh `CHAT`; lệnh đi cùng response của ingest như `WARN`.
- Thí sinh → giám thị: REST `POST /student/attempts/{id}/chat`; core gửi signal trường `cs` (id tin mới), hub đẩy `chat_seq` cho trang giám thị,
  trang tải tin mới hơn id đang có.
- Xuất log: `/admin/attempts/{id}/export/chat.csv`. Hộp chat ở trang Live (nút **Chat** trên ô thí sinh, chấm đỏ khi có tin mới) và trang phiên thi.

## Vi phạm thủ công

`POST /admin/attempts/{id}/violations` {severity, message} tạo vi phạm loại `MANUAL`, đã xác nhận ngay, tính điểm rủi ro như vi phạm khác;
`details.source = proctor` kèm tên người ghi.

## Xuất CSV (không có thống kê TP/FP/FN)

| Đường dẫn | Nội dung |
|---|---|
| `/admin/reports/{exam}/export/attempts.csv` | điểm, trạng thái, số vi phạm từng lượt |
| `/admin/reports/{exam}/export/violations.csv` | mọi vi phạm của kỳ thi |
| `/admin/attempts/{id}/export/violations.csv` | vi phạm một phiên |
| `/admin/attempts/{id}/export/chat.csv` | log chat |

UTF-8 có BOM (Excel đọc đúng tiếng Việt); ô bắt đầu bằng `= + - @` được thêm `'` để không chạy thành công thức.

## Clip quanh vi phạm

Hai loại, đều tuỳ chọn:

1. **Client tự quay (nhẹ, bật theo kỳ thi)** — tuỳ chọn *Quay clip quanh vi phạm* (`monitoring_config.violation_clips`, cần bật camera hoặc bắt buộc chia sẻ màn hình).
   Mỗi nguồn (camera, màn hình) có hai `MediaRecorder` chạy lệch nhau 5 giây, mỗi cái khởi động lại sau 10 giây, trên bản clone của track đã hạ độ phân giải
   (camera 640×360 / 10 fps, màn hình 1280×720 / 5 fps, ~300–450 kbps). Khi có vi phạm, bộ ghi lâu nhất (đã có 5–10 giây hình) chạy thêm 5 giây rồi dừng:
   clip dài 10–15 giây, có ≥ 5 giây trước và 5 giây sau. Hai clip (camera, màn hình) được tải lên như bằng chứng (`video/webm`), rồi client gọi
   `POST /student/violation-clip` để gắn vào vi phạm (tìm theo loại + thời điểm ±3 giây, thử lại khi core chưa kịp lưu vi phạm). Giãn cách ≥ 15 giây giữa hai clip;
   vi phạm mức LOW không quay; vi phạm nằm trong cửa sổ clip đang quay dùng chung clip đó.
2. **Cắt từ bản ghi egress (theo yêu cầu giám thị)** — nút *Clip* trên từng khung của trình phát gọi record service
   `GET /v1/recordings/{id}/clip?from=&to=` (giây, tối đa 120): ffmpeg cắt đúng đoạn, lưu `clips/{id}/{from}-{to}.mp4`, lần sau lấy từ cache.
   Image `record` cần ffmpeg (đã thêm vào Dockerfile); biến `FFMPEG_PATH` nếu ffmpeg không nằm trong PATH.

## Trình phát đồng bộ

Camera, màn hình, camera phụ chạy trên **một đồng hồ chung** (play/pause, ±10 giây, thanh tua, tốc độ 0.5–4×). Mỗi video tự bám đồng hồ theo
`started_at` của bản ghi; lệch quá 0,6 giây thì tua lại; ở thời điểm không có bản ghi thì tạm dừng và báo rõ.

## Sinh trắc học

- **Đồng ý ở mỗi lần đăng nhập**: client hiện màn đồng ý (tick bắt buộc) sau đăng nhập và cả khi khôi phục phiên chưa có đồng ý.
  Server ghi `biometric_consents` (token, phiên bản chính sách, IP, user-agent, thời điểm) và middleware `biometric` từ chối
  (`403 BIOMETRIC_CONSENT_REQUIRED`) các endpoint xử lý sinh trắc học nếu token hiện tại chưa đồng ý: đăng ký khuôn mặt, bắt đầu thi, realtime session,
  camera phụ, QR đăng ký, yêu cầu đổi. Request không có bearer token thật (phiên web, test) không bị chặn. Tắt toàn bộ bằng `BIOMETRIC_CONSENT_REQUIRED=false`.
- Văn bản chính sách ở `App\Support\BiometricPolicy` (đổi `VERSION` khi sửa nội dung), trang công khai `/biometric-policy`.
- **Quản lý khuôn mặt toàn tổ chức** `/admin/faces`: số liệu, tìm kiếm + lọc, xem ảnh, khoá/mở khoá từng người hoặc hàng loạt, xoá, *Khoá tất cả*, cột đồng ý gần nhất.
- **Yêu cầu đổi khuôn mặt**: sinh viên (ảnh đã khoá) gửi lý do từ phòng chờ → thông báo cho giảng viên/admin → duyệt (mở khoá) hoặc từ chối kèm lý do → thông báo lại sinh viên.
- **Đăng ký bằng điện thoại**: phòng chờ tạo QR (token dùng một lần, 10 phút) → điện thoại mở `/m/face/{token}`, chụp bằng camera trước, gửi lên → máy tính tự nhận
  (phòng chờ hỏi trạng thái mỗi 3 giây chỉ trong lúc QR đang mở).

## Thông báo trong hệ thống

Bảng `user_notifications`; `App\Support\Notify::to()/staff()`. Chuông ở thanh trên của trang quản trị tải khi mở trang, khi cửa sổ lấy lại focus và khi mở menu
(không có kênh push tới trang quản trị, không dùng timer). Hiện phát sinh từ: yêu cầu đổi khuôn mặt và quyết định duyệt.

## Bổ sung

- **Chấm tay** `/admin/attempts/{id}/grading`: các câu tự luận, trả lời ngắn, điền chỗ trống chờ chấm; điểm bị chặn ở mức tối đa của câu, tổng điểm của phiên được tính lại
  (câu tự chấm + chấm tay + bài lập trình), sinh viên được thông báo và thấy nhận xét trong *Xem lại*.
- **Xem lại của sinh viên**: `is_allow_review = false` chặn hẳn (403), `is_hide_score = true` ẩn điểm tổng, điểm từng câu và đúng/sai trong Dashboard, nộp bài và xem lại.
- **Chuỗi băm nhật ký vi phạm**: mỗi vi phạm lưu `chain_hash = sha256(hash_trước | phiên | loại | mức độ | giây | client_event_id)`; chi tiết, duyệt và clip không nằm trong chuỗi vì đổi được hợp lệ.
  `GET /admin/attempts/{id}/verify-chain` báo `ok` hoặc vi phạm đầu tiên bị đứt.
- **Thiết bị**: Rust `system_info` / `system_load`; CPU/RAM gửi theo heartbeat 5 giây. Trang phiên thi hiện tên máy, hệ điều hành, CPU, RAM, IP, mã thiết bị (băm) và cảnh báo
  nếu cùng mã với thí sinh khác trong kỳ thi.
- **Vật cấm theo kỳ thi**: `monitoring_config.prohibited_labels` (10 lớp COCO ở `App\Support\ProhibitedObjects`); bỏ chọn hết = bộ mặc định.
- **Liveness**: `LivenessChallenge` trong `vision-core.ts` (kiểm thử bằng `npx vite-node scripts/vision-core.test.ts`).
- **Hàng đợi bài làm offline**: `answerQueue.ts`, giữ trong localStorage, chỉ gửi câu trả lời mới nhất của mỗi câu, gửi lại khi có mạng, trước khi nộp bài phải gửi hết.
