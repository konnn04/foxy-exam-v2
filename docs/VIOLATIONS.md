# Cơ chế ghi nhận vi phạm

Nguồn sự thật: `server/app/Support/ViolationCatalog.php` (phân loại duyệt), `realtime/internal/events/events.go` và
`EventsController::VIOLATION_TYPES` (danh sách chấp nhận). Nhãn tiếng Việt: `server/resources/js/components/foxy/domain.ts`.

## Quy tắc duyệt

- **Tự xác nhận (`is_reviewed = true` ngay khi tạo)**: sự việc client tự quan sát được, không phụ thuộc xác suất.
- **Chờ giám thị duyệt**: phát hiện dựa trên AI / ước lượng / phán đoán (khuôn mặt, ánh nhìn, vật thể).
- Loại chưa được phân loại mặc định là **chờ duyệt** (không tin mù quáng).
- Giám thị vẫn có thể "Đặt lại" hoặc "Đánh dấu nhầm" mọi vi phạm. Phiên bị hủy (`voided_at`) không tính vào bộ đếm.
- Các vi phạm liên tiếp cùng loại được gộp thành một nhóm khi hiển thị (`×N`, khoảng thời gian).

## Tự xác nhận

| Loại | Mức | Cơ chế | Điều kiện |
|---|---|---|---|
| `WINDOW_LOST_FOCUS` | MEDIUM | Rust `monitor://foreground` | Cửa sổ trước mặt không phải app thi (không có danh sách cho phép); cũng ghi khi thu nhỏ cửa sổ thi |
| `APP_NOT_ALLOWED` | MEDIUM | như trên | Có danh sách phần mềm được phép và app đang dùng không nằm trong đó |
| `SYSTEM_SHORTCUT` | LOW (đã chặn) / MEDIUM | Rust keyboard hook | Alt+Tab, phím Windows, Ctrl+Esc… |
| `SYNTHETIC_INPUT` | HIGH | Rust keyboard hook | Phím do phần mềm giả lập (cờ injected) |
| `BANNED_APP` | HIGH | Rust quét tiến trình mỗi 1,5 s | Tiến trình nằm trong danh sách cấm (OBS, AnyDesk, TeamViewer, Discord…) |
| `MULTIPLE_MONITORS` | HIGH | Rust displays + thiết bị | Nhiều hơn 1 màn hình, kể cả nhân bản hoặc màn ảo |
| `CAPTURE_DEVICE` | HIGH | Rust SetupAPI | Capture card / thiết bị video-in (Elgato, AVerMedia, HDMI capture…) |
| `MULTIPLE_KEYBOARDS` | MEDIUM | Rust thiết bị | Nhiều hơn 1 bàn phím ngoài (theo VID:PID) |
| `DEVICE_CHANGED` | MEDIUM | Rust thiết bị | Cắm hoặc rút thiết bị trong giờ thi |
| `BULK_PASTE` | HIGH / CRITICAL | Client onPaste | Dán nhiều hơn `max_paste_chars`; > 100 ký tự là CRITICAL (server) |
| `CAMERA_LOST` | HIGH | Client, track `ended` | Camera tắt hoặc rút giữa giờ thi |
| `SCREEN_SHARE_STOPPED` | HIGH | Client, track `ended` | Dừng chia sẻ màn hình giữa giờ thi |

## Chờ duyệt (AI / xác suất)

| Loại | Mức | Cơ chế | Điều kiện |
|---|---|---|---|
| `NO_FACE_DETECTED` | MEDIUM | MediaPipe trên máy | Không thấy khuôn mặt liên tục 5 s (báo lại sau 30 s) |
| `MULTIPLE_PEOPLE` | HIGH | MediaPipe | Hơn 1 khuôn mặt liên tục 2 s (báo lại sau 30 s) |
| `LOOKING_AWAY` | LOW | MediaPipe (hướng đầu + ánh mắt) | Đầu lệch > 35° ngang / 30° dọc hoặc mắt lệch > 0,6 trong 6 s (báo lại sau 45 s) |
| `FACE_TOO_FAR` | LOW | MediaPipe | Khuôn mặt chiếm < 14% chiều ngang khung trong 8 s (báo lại sau 60 s) |
| `FACE_MISMATCH` | HIGH | Dịch vụ AI khuôn mặt (`ai/face-service`) | Khuôn mặt khác với khung hình đầu tiên của lượt thi (cosine < 0,35); khung hình gửi mỗi ~40 s |
| `PROHIBITED_DEVICE` | HIGH | Dịch vụ AI vật thể (`ai/object-service`) | Thấy điện thoại, laptop, sách, điều khiển, TV trong khung camera (tối đa 1 lần/phút); chưa nhận diện được tai nghe |

## Đã khai báo nhưng chưa có cơ chế phát

`TAB_SWITCH`, `DEVTOOLS_OPENED`, `OFFLINE_TOO_LONG`: loại hợp lệ ở server nhưng client hiện không gửi. Mất kết nối quá 5 phút
được xử lý bằng trạng thái vắng thi (`ended_reason = ABSENT`, lệnh `attempts:expire-offline`), không tạo bản ghi vi phạm.

## Không tạo vi phạm

- Làm mờ nội dung bài thi khi thí sinh không nhìn thẳng (chỉ là phản hồi giao diện; bộ phát hiện `LOOKING_AWAY` chạy riêng).
- Mất kết nối ngắn dưới 10 s.

## Thêm một loại mới

1. Thêm vào `events.go` (`ViolationTypes`), `EventsController::VIOLATION_TYPES` và union `ViolationType` ở `client/src/lib/api.ts`.
2. Phân loại trong `ViolationCatalog` (`AUTO` hay `REVIEW`) và thêm nhãn ở `domain.ts`.
3. Cập nhật bảng trong tài liệu này.
