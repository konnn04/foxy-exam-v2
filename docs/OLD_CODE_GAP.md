# Cái gì trong `.old-code` mà bản mới chưa có

Đối chiếu `.old-code` (exam-sys Laravel + exam-client Electron + face-services + object-service + supervisor-agent +
media-encoder-service) với bản hiện tại. Trạng thái: **Xong** (có và tương đương), **Một phần**, **Chưa**.
Mục "Có chủ ý khác" là thứ bản cũ làm khác và ta cố ý giữ cách mới.

## Giám sát và AI

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Supervisor agent: bot vào LiveKit, mỗi giây 1 khung hình camera, gọi face/object service | **Xong** | `ai/supervisor-agent` (webhook + reconcile). Chưa chạy thử với LiveKit thật. Bản cũ dùng gRPC, bản mới HTTP |
| Xác thực khuôn mặt định kỳ so với sinh trắc đã đăng ký | **Xong** | `FACE_MISMATCH`, mỗi giây |
| Phát hiện vật cấm qua camera | **Xong** | `PROHIBITED_DEVICE`, camera chính và camera phụ |
| Chọn lớp vật cấm theo kỳ thi / tổ chức (`object-service/prohibited-classes`, `model-classes`) | **Chưa** | Hiện là biến môi trường `PROHIBITED_LABELS` dùng chung |
| Camera điện thoại phụ qua QR (relay LiveKit, `-mobile`) | **Xong** | Phòng riêng `cam2-…`, ghi hình `camera2` |
| Kiểm tra góc đặt điện thoại (người + laptop) | **Xong** | `mobile-camera/verify` |
| Dual-camera spot check (bắt nhìn camera phụ) | **Xong** | Đếm ngược 10 s, `SPOT_CHECK_FAILED` |
| Liveness khi precheck (chớp màu, chống ảnh tĩnh) | **Chưa** | |
| Kiểm tra hướng/độ nghiêng camera ở precheck (`camera-orientation-check`) | **Một phần** | Chỉ gợi ý xoay ngang trên trang điện thoại |
| MediaPipe: hướng đầu, gaze, khoảng cách, nhiều người | **Xong** | + làm mờ bài khi không nhìn thẳng |
| Nhận diện giọng nói (Yamnet) `speech_detected_low/medium` | **Chưa** | Micro chỉ được kiểm tra ở phòng chờ, không phân tích trong giờ thi |
| Khoá/mở khóa sau vi phạm (lock + clearance: `exit_fullscreen` ↔ `enter_fullscreen`...) | **Một phần** | Che bài khi mất camera/màn hình/điện thoại/app cấm/nhiều màn hình, tự mở khi khắc phục; chưa có bảng luật lock/clearance cấu hình được |
| 27 luật vi phạm tập trung ở một file cấu hình (severity, cooldown, ngưỡng) + client/agent lấy qua API | **Một phần** | Danh mục ở `ViolationCatalog` + `docs/VIOLATIONS.md`; mức độ và cooldown vẫn nằm trong code client / agent |
| Telemetry phần cứng/mạng: CPU/RAM (`perf_metrics`), IP/MAC, device fingerprint | **Chưa** | |
| Theo dõi chuột (`mouse_click` x,y) và bản ghi phím thô để hậu kiểm (`TRACKING_*.txt`) | **Một phần** | Op-Log phím có; chuột không |
| `copy_attempt`, chặn chuột phải, F12/DevTools | **Một phần** | Chặn copy/cut/paste/kéo thả; `DEVTOOLS_OPENED` khai báo nhưng client chưa gửi; chuột phải chưa chặn |
| PrintScreen / chống quay màn hình | **Xong** | Hook PrintScreen, content protection |
| Fullscreen + always-on-top, banned apps, nhiều màn hình, capture card | **Xong** | + danh sách phần mềm được phép cho thi lập trình |
| `no_telemetry` (mất tín hiệu) | **Xong** | Vắng thi sau 5 phút |

## Bằng chứng và xem lại

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Ảnh minh chứng khi vi phạm (cam + màn hình) | **Xong** | 3 ảnh: màn hình, cam chính, cam phụ; agent đính ảnh của chính nó |
| Ghi hình egress từng thí sinh | **Xong** | camera / screen / camera2 |
| media-encoder: ghép video (stitch), **cắt clip quanh vi phạm**, trích snapshot | **Chưa** | Ta chỉ có video cả phiên + nhảy tới thời điểm vi phạm |
| Trình phát bằng chứng đồng bộ cam + màn hình (`synced-evidence-player`) | **Chưa** | Các trình phát độc lập |
| Chuỗi băm chống sửa nhật ký vi phạm (`chain_hash`, `verify-chain`) | **Chưa** | |
| Log toàn bộ sự kiện của phiên (`ExamEventLog`) + xuất `events-export` / `violations-export` | **Chưa** | Chỉ lưu vi phạm và op-log; chưa xuất CSV |
| Báo cáo vi phạm có thể tạo / gửi cho sinh viên (`report`, `report/send`, UC-T03) | **Chưa** | |
| Số liệu độ chính xác TP / FP / FN theo loại vi phạm (`attemptMetrics`) | **Chưa** | Có duyệt đúng/nhầm nhưng chưa tổng hợp |
| Biểu đồ hiệu năng máy thí sinh của phiên (`performance`) | **Chưa** | Phụ thuộc telemetry CPU/RAM |
| Giám thị tạo vi phạm thủ công (`POST …/violations`) | **Chưa** | |
| Xóa phiên / đình chỉ / tín hiệu cảnh báo | **Xong** | + hủy phiên (không tính điểm) |
| Chat giám thị ↔ thí sinh theo phiên (`chat`) | **Chưa** | Chỉ có cảnh báo một chiều từ giám thị |
| Cắt ảnh khuôn mặt (`face-crops`) để duyệt | **Chưa** | |

## Sinh trắc học

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Đăng ký khuôn mặt bằng camera / tải ảnh lên | **Xong** | Phòng chờ và trang người dùng |
| Khoá đăng ký, giảng viên mở khoá | **Xong** | |
| Đăng ký khuôn mặt bằng điện thoại qua QR đăng nhập tự động (`m/face-register`, `AutoLogin`) | **Chưa** | |
| Trang quản lý khuôn mặt toàn tổ chức (danh sách, thumbnail, khoá hàng loạt, "khoá đăng ký toàn hệ thống") | **Một phần** | Chỉ ở trang từng người dùng |
| Yêu cầu đổi sinh trắc học, duyệt / từ chối (`approve-change`, `reject-change`) | **Chưa** | |
| Khuôn mặt mồ côi (`orphan`) | **Chưa** | Không cần: ảnh nằm cùng bản ghi người dùng |
| Đồng ý sinh trắc học (`BiometricConsent`, `biometric-policy`) + nhật ký kiểm toán | **Chưa** | Nên có trước khi dùng thật với sinh viên |

## Quản trị và dữ liệu

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Phê duyệt tài khoản mới (`pending-approval`, `users/{user}/approve`) | **Chưa** | |
| Môn học (`subjects`) tách khỏi khóa học | **Chưa** | Chỉ có khóa học |
| Analytics + xuất báo cáo (`analytics/export`) | **Một phần** | Tổng quan và báo cáo từng kỳ thi; chưa xuất file |
| Thông báo trong hệ thống (`notifications`) | **Chưa** | Chuông trên giao diện chưa có dữ liệu |
| Trang xem lại bài sau khi thi cho sinh viên (`exam-review`) | **Chưa** | API `review` có, client chưa có màn hình |
| Chấm tay tự luận từng câu (`grade/{question}`) | **Một phần** | Tự luận chờ giảng viên, cần kiểm tra màn chấm |
| i18n vi/en, Sentry, chế độ offline / trang mất kết nối | **Chưa** | Client chỉ có tiếng Việt; có đếm giờ vắng thi nhưng chưa hàng đợi lưu bài offline |
| Lịch sử khóa chặn quay lại trang (`exam-history-lock`) | **Không cần** | Không phải trình duyệt |

## Có chủ ý khác

- Tauri thay Electron; hub WebSocket riêng (Go) thay Reverb; ingest + worker + Redis Streams thay DataChannel → agent → Redis.
- Dịch vụ AI gọi bằng HTTP thay gRPC (đơn giản hơn; thêm gRPC khi cần giảm độ trễ).
- Không có `proctoring.php` làm nguồn luật duy nhất: danh mục vi phạm ở `ViolationCatalog`.

## Đề xuất thứ tự làm tiếp

1. **Đồng ý sinh trắc học + chính sách** (pháp lý, trước khi dùng với sinh viên thật) và trang quản lý khuôn mặt toàn tổ chức.
2. **Chat giám thị ↔ thí sinh** và **vi phạm thủ công** (giám thị cần hành động ngay khi xem trực tiếp).
3. **Clip quanh vi phạm** (cắt từ bản ghi egress theo thời điểm) + trình phát đồng bộ cam/màn hình.
4. **Xuất CSV** (vi phạm, sự kiện, điểm) + số liệu TP/FP/FN.
5. **Chuỗi băm nhật ký** nếu cần bằng chứng không chối cãi được.
6. Liveness, nhận diện giọng nói, telemetry CPU/RAM/IP, chọn lớp vật cấm theo kỳ thi.
