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
| Chọn lớp vật cấm theo kỳ thi / tổ chức (`object-service/prohibited-classes`, `model-classes`) | **Xong** | `monitoring_config.prohibited_labels`, chọn ở form kỳ thi; agent lọc theo danh sách của kỳ thi |
| Camera điện thoại phụ qua QR (relay LiveKit, `-mobile`) | **Xong** | Phòng riêng `cam2-…`, ghi hình `camera2` |
| Kiểm tra góc đặt điện thoại (người + laptop) | **Xong** | `mobile-camera/verify` (bắt buộc ở cả precheck và khi kết nối lại giữa giờ thi) |
| Dual-camera spot check (bắt nhìn camera phụ) | **Xong** | Đếm ngược 10 s, `SPOT_CHECK_FAILED` |
| Liveness khi precheck (chớp màu, chống ảnh tĩnh) | **Xong** | Chớp mắt 2 lần + quay đầu, thứ tự ngẫu nhiên, bắt buộc khi kỳ thi xác thực danh tính. Không dùng chớp màu |
| Kiểm tra hướng/độ nghiêng camera ở precheck (`camera-orientation-check`) | **Xong** | Bắt buộc xoay ngang (Landscape), kiểm tra cảm biến góc nghiêng chống đặt nằm phẳng trên bàn, khóa đổi camera khi vào thi, phát hiện tắt màn hình điện thoại (`PHONE_SCREEN_OFF`, `PHONE_ORIENTATION_INVALID`, `CAMERA_TAMPERED`) |
| MediaPipe: hướng đầu, gaze, khoảng cách, nhiều người | **Xong** | + làm mờ bài khi không nhìn thẳng |
| Nhận diện giọng nói (Yamnet) `speech_detected_low/medium` | **Xong** | `SPEECH_DETECTED` dựa trên năng lượng dải 300–3400 Hz kéo dài ≥ 2,5 giây, chỉ phân tích mức âm thanh, không ghi âm |
| Khoá/mở khóa sau vi phạm (lock + clearance: `exit_fullscreen` ↔ `enter_fullscreen`...) | **Xong** | Che bài khi mất camera/màn hình/điện thoại/app cấm/nhiều màn hình/tắt màn hình điện thoại/đổi camera; bắt buộc precheck lại khi reconnect hoặc mất mạng kéo dài |
| 27+ luật vi phạm tập trung ở một file cấu hình (severity, cooldown, ngưỡng) + client/agent lấy qua API | **Xong** | Tập trung 30 luật tại `ViolationCatalog::RULES` + API `/api/v1/public/violation-rules` đồng bộ xuống Client |
| Telemetry phần cứng/mạng: CPU/RAM (`perf_metrics`), IP/MAC, device fingerprint | **Xong** | CPU/RAM trực tiếp trên ô Live và lưu lịch sử theo từng batch Op-Log để vẽ biểu đồ trên trang phiên thi; thông tin máy + IP + mã thiết bị băm + cảnh báo cùng máy |
| Theo dõi chuột (`mouse_click` x,y) và bản ghi phím thô để hậu kiểm (`TRACKING_*.txt`) | **Xong** | Ghi nhận tọa độ nhấp chuột (`mouse_clicks`), biểu đồ nhấp chuột và xuất file `TRACKING_{attemptId}.txt` |
| `copy_attempt`, chặn chuột phải, F12/DevTools | **Xong** | Chặn + báo `COPY_ATTEMPT`, chặn chuột phải, `DEVTOOLS_OPENED` theo chênh lệch kích thước cửa sổ |
| PrintScreen / chống quay màn hình | **Xong** | Hook PrintScreen, content protection |
| Fullscreen + always-on-top, banned apps, nhiều màn hình, capture card | **Xong** | + danh sách phần mềm được phép cho thi lập trình |
| `no_telemetry` (mất tín hiệu) | **Xong** | Vắng thi sau 5 phút |

## Bằng chứng và xem lại

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Ảnh minh chứng khi vi phạm (cam + màn hình) | **Xong** | 3 ảnh: màn hình, cam chính, cam phụ; agent đính ảnh của chính nó |
| Ghi hình egress từng thí sinh | **Xong** | camera / screen / camera2 |
| media-encoder: ghép video (stitch), **cắt clip quanh vi phạm**, trích snapshot | **Xong** | Client tự quay clip 5 giây trước/sau vi phạm; record service cắt clip từ bản ghi bằng ffmpeg. Không ghép (stitch) |
| Trình phát bằng chứng đồng bộ cam + màn hình (`synced-evidence-player`) | **Xong** | Một đồng hồ chung cho camera, màn hình, camera phụ |
| Chuỗi băm chống sửa nhật ký vi phạm (`chain_hash`, `verify-chain`) | **Xong** | Băm các trường bất biến theo thứ tự id; nút *Kiểm tra toàn vẹn* ở trang phiên thi. Vi phạm cũ chưa có chuỗi |
| Log toàn bộ sự kiện của phiên (`ExamEventLog`) + xuất `events-export` / `violations-export` | **Xong** | Xuất CSV vi phạm, Op-Log, chat, kết quả, tổng quan kỳ thi và file hậu kiểm `TRACKING_*.txt` |
| Báo cáo vi phạm có thể tạo / gửi cho sinh viên (`report`, `report/send`, UC-T03) | **Xong** | Xuất biên bản in ấn / PDF (`/admin/attempts/{id}/report`) và gửi biên bản đến hộp thông báo & khung chat của thí sinh (`/admin/attempts/{id}/send-report`) |
| Số liệu độ chính xác TP / FP / FN theo loại vi phạm (`attemptMetrics`) | **Không làm** | Theo yêu cầu: chỉ xuất CSV |
| Biểu đồ hiệu năng máy thí sinh của phiên (`performance`) | **Xong** | Biểu đồ lịch sử CPU / RAM và nhấp chuột trên dòng thời gian của phiên thi (`/admin/attempts/{id}`) |
| Giám thị tạo vi phạm thủ công (`POST …/violations`) | **Xong** | Loại `MANUAL` |
| Xóa phiên / đình chỉ / tín hiệu cảnh báo | **Xong** | + hủy phiên (không tính điểm) |
| Chat giám thị ↔ thí sinh theo phiên (`chat`) | **Xong** | Lưu log, xuất CSV, realtime |
| Cắt ảnh khuôn mặt (`face-crops`) để duyệt | **Xong** | Hiển thị ảnh khuôn mặt mẫu sinh trắc học đã đăng ký cạnh ảnh minh chứng vi phạm để đối chiếu trực tiếp |

## Sinh trắc học

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Đăng ký khuôn mặt bằng camera / tải ảnh lên | **Xong** | Phòng chờ và trang người dùng |
| Khoá đăng ký, giảng viên mở khoá | **Xong** | |
| Đăng ký khuôn mặt bằng điện thoại qua QR đăng nhập tự động (`m/face-register`, `AutoLogin`) | **Xong** | Token dùng một lần 10 phút, trang `/m/face/{token}` |
| Trang quản lý khuôn mặt toàn tổ chức (danh sách, thumbnail, khoá hàng loạt, "khoá đăng ký toàn hệ thống") | **Xong** | `/admin/faces` |
| Yêu cầu đổi sinh trắc học, duyệt / từ chối (`approve-change`, `reject-change`) | **Xong** | |
| Khuôn mặt mồ côi (`orphan`) | **Chưa** | Không cần: ảnh nằm cùng bản ghi người dùng |
| Đồng ý sinh trắc học (`BiometricConsent`, `biometric-policy`) + nhật ký kiểm toán | **Xong** | Ở mỗi lần đăng nhập, ràng buộc với token |

## Quản trị và dữ liệu

| Tính năng cũ | Trạng thái | Ghi chú |
|---|---|---|
| Phê duyệt tài khoản mới (`pending-approval`, `users/{user}/approve`) | **Không cần** | Bản mới không có tự đăng ký: quản trị tạo tài khoản |
| Môn học (`subjects`) tách khỏi khóa học | **Chưa** | Chỉ có khóa học |
| Analytics + xuất báo cáo (`analytics/export`) | **Xong** | CSV tổng quan kỳ thi, kết quả, vi phạm |
| Thông báo trong hệ thống (`notifications`) | **Xong** | Chuông thông báo ở cả trang quản trị và ứng dụng FoxyClient của thí sinh (nhận biên bản giám sát, thông báo duyệt sinh trắc) |
| Trang xem lại bài sau khi thi cho sinh viên (`exam-review`) | **Xong** | Hộp thoại *Xem lại* ở Dashboard; tôn trọng `is_allow_review` / `is_hide_score` |
| Chấm tay tự luận từng câu (`grade/{question}`) | **Xong** | `/admin/attempts/{id}/grading` |
| i18n vi/en, Sentry, chế độ offline / trang mất kết nối | **Một phần** | Sentry (client + server, tắt khi không có DSN), hàng đợi lưu bài offline, hạ tầng i18n vi/en mới dịch màn đồng ý và chat |
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
