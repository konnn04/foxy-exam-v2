# Chạy thử trên Linux

Kiểm tra bằng tay các lớp chống gian lận: precheck có chữ ký, máy ảo, camera ảo, điều khiển từ xa, đổi IP,
khởi động lại máy, camera phụ bị di chuyển. Phần máy chủ dùng Docker như khi triển khai thật.

## 1. Máy chủ

```bash
cp server/.env.example server/.env          # sửa DB, APP_URL, LIVEKIT_*, ...
docker compose -f docker.compose.server.yml up -d --build
docker compose -f docker.compose.server.yml logs -f app   # migrate tự chạy; scheduler (attempts:sweep) chạy mỗi phút
```

Biến cần để ý khi test:

| Biến | Giá trị khi test | Ý nghĩa |
|---|---|---|
| `PRECHECK_REQUIRED` | `true` | `/start` bắt buộc có mã precheck |
| `PRECHECK_ALLOW_DEV` | `false` để test thật, `true` nếu dùng nút DEV bỏ qua bước | Chấp nhận các mục "warn" do DEV bypass |
| `RUN_SCHEDULER` | `true` ở đúng **một** container | Tự thu bài quá giờ / mất kết nối |

AI (tuỳ chọn): `cd ai && docker compose up -d --build` (thêm `-f docker-compose.gpu.yml` nếu có GPU NVIDIA),
rồi điền địa chỉ ở **Tình trạng hệ thống → Địa chỉ các dịch vụ**.

## 2. FoxyClient trên Linux

```bash
# Ubuntu / Debian
sudo apt install build-essential curl wget file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-good gstreamer1.0-nice   # WebRTC của WebKitGTK
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cd client && pnpm install && pnpm sync:mediapipe
pnpm tauri dev            # hoặc pnpm tauri build -> .deb / .AppImage trong src-tauri/target/release/bundle
cd src-tauri && cargo test env_check -- --nocapture   # xem máy này tự báo gì (máy ảo? remote?)
```

**Rủi ro lớn nhất trên Linux:** gửi camera/màn hình cho giám thị cần WebRTC trong WebKitGTK. Nhiều bản phân phối build
WebKitGTK không có WebRTC: phòng chờ khi đó báo "webview không có WebRTC" và chặn vào thi nếu kỳ thi bắt buộc camera.
Kiểm tra sớm bằng một kỳ thi bật camera. Trên Wayland không có hook bàn phím toàn cục và không biết cửa sổ app khác đang
focus (giới hạn của Wayland); dùng phiên X11 nếu cần đủ các kiểm tra đó.

## 3. Kịch bản kiểm tra

Tạo một kỳ thi trắc nghiệm, bật camera. Mỗi lần vào thi, trang **Phiên thi → Thiết bị thí sinh** hiện lịch sử precheck
(đạt / bị từ chối, lý do, IP, hệ điều hành, máy ảo).

| Kiểm tra | Cách làm | Kết quả đúng |
|---|---|---|
| Máy ảo | Chạy FoxyClient trong VirtualBox / VMware / QEMU | Dòng "Môi trường máy" đỏ; nếu cố bấm Bắt đầu, máy chủ trả "Máy đang chạy trong máy ảo". Tắt "Chặn máy ảo" ở kỳ thi thì vào được |
| Camera ảo | `sudo modprobe v4l2loopback card_label="OBS Virtual Camera"` rồi chọn camera đó | Dòng Camera đỏ "là camera ảo"; máy chủ cũng từ chối ở precheck |
| Hệ điều hành | Kỳ thi chỉ chọn Windows, vào từ Linux | "Kỳ thi chỉ cho phép: Windows" |
| Điều khiển từ xa | Mở app qua xrdp, hoặc `ssh -X` rồi chạy app | Precheck từ chối; giữa giờ thi (kiểm tra mỗi 60 s) ghi vi phạm `REMOTE_SESSION` |
| Precheck có chữ ký | Gọi thẳng `POST /api/v1/student/exams/{id}/start` không có `precheck_token` | `428 PRECHECK_REQUIRED` |
| Tắt máy bật lại | Đang thi thì khởi động lại máy, mở lại app | App đưa về phòng chờ, phải precheck lại mới vào tiếp; phiên thi có vi phạm `DEVICE_RESTARTED` |
| Mở app ở cửa sổ/máy khác | Cửa sổ cũ còn mở trong khi vào lại từ nơi khác | Cửa sổ cũ bị che bài "Phiên làm bài đã được mở lại…", không lưu được câu trả lời |
| Đổi mạng | Đang thi thì chuyển Wi-Fi sang 4G | Vi phạm `IP_CHANGED` (mức thấp, chỉ để giám thị biết) |
| Camera phụ bị cầm lên | Quét QR bằng điện thoại, vào thi, nhấc điện thoại khỏi bàn ~2 s | Điện thoại hiện cảnh báo đỏ; máy tính che bài, ghi `PHONE_MOVED`, yêu cầu "Kiểm tra lại góc đặt" |
| Hết giờ / mất kết nối | Tắt mạng quá ngưỡng (mặc định 5 phút) hoặc để hết giờ | Bài tự thu, ghi "Vắng thi" / "Hết giờ, tự thu" |

iPhone: cảm biến chuyển động chỉ chạy sau khi người dùng bấm nút trên trang camera (Safari hỏi quyền "Motion & Orientation").
