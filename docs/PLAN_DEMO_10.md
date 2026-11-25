# Kế hoạch: demo 10 thí sinh, AI chạy trên laptop có GPU

Mục tiêu: một kỳ thi demo tối đa **10 thí sinh**. Máy chủ (4 nhân) chạy core, realtime, LiveKit, egress. AI vật cấm và
khuôn mặt chạy trên **laptop có GPU** (GTX 1650 Max-Q, 4 GB) qua tunnel Cloudflare. Âm thanh phân tích ngay trên máy
thí sinh. Minh chứng vi phạm phải đến tay giám thị trong vài giây.

## Đã làm (nhánh `dev`)

| # | Việc | Ở đâu |
|---|---|---|
| 1 | Ghi hình bằng **Track Egress**: chép nguyên luồng VP8 ra `.webm`, không giải mã/mã hóa lại. Khai báo `track_cpu_cost: 0.1` để egress không tự giới hạn còn vài luồng. Camera không bao giờ lấy nhầm luồng màn hình | `realtime/internal/record/livekit.go`, `docker.compose.server.yml` |
| 2 | Lệnh **CLIP**: khi AI server (agent) ghi vi phạm, core gửi lệnh tới app thí sinh; app cắt 10 giây camera/màn hình đang đệm sẵn và tải lên, gắn vào đúng vi phạm (cần bật "Quay clip quanh vi phạm"). Sửa luôn lỗi cũ: ingest từ chối `REQ_PROCESSES`/`KILL_PROCESS` và làm rơi `pid` | `realtime/internal/events`, `ingest`, `server/.../Internal/EventsController.php`, `client/src/lib/examRuntime.ts` |
| 3 | AI dùng **GPU** khi có (CUDA), không có thì CPU. `/health` báo `"device"` | `ai/face-service`, `ai/object-service`, `ai/docker-compose.gpu.yml` |
| 4 | Phát hiện **tiếng nói** bằng MediaPipe Audio Classifier (YAMNet) trên máy thí sinh; không tải được thì dùng cách đo năng lượng cũ. Âm thanh không rời máy | `client/src/lib/speech.ts`, `speech-core.ts`, `scripts/sync-mediapipe.mjs` |
| 5 | **Heatmap** thao tác (thí sinh × thời gian) trên trang báo cáo kỳ thi, đánh dấu vi phạm và ô bất thường (gợi ý xem lại, không phải kết luận) | `server/app/Support/ActivityHeatmap.php`, `components/foxy/activity-heatmap.tsx` |
| 6 | **Mã hóa sau kỳ thi** (tùy chọn từng kỳ thi): AES-256-GCM theo khối 64 KB (vẫn tua được), mỗi kỳ thi một khóa, khóa bọc bằng `RECORD_SEAL_KEY`. Xóa bản gốc và clip cũ; giám thị xem qua link có chữ ký, hết hạn | `realtime/internal/record/seal.go`, `sealjob.go`, `server/app/Models/ExamAttempt.php` |
| 7 | Gateway giới hạn request theo token (cả phòng chung IP không bị chặn); đăng nhập giới hạn theo tài khoản | `gateway/nginx.conf`, `server/app/Providers/AppServiceProvider.php` |

## Triển khai

1. **Record service:** đặt `RECORD_SEAL_KEY` (`openssl rand -base64 32`) nếu muốn dùng mã hóa. **Sao lưu khóa này**: mất là không đọc lại được file đã mã hóa. `RECORD_PUBLIC_URL` đã có sẵn trong compose.
2. **Build lại** image `record` (Go), `app` (Laravel; có migration tự chạy) và `gateway`.
3. **Laptop AI có GPU:**
   - Cài driver NVIDIA và `nvidia-container-toolkit`, rồi khởi động lại Docker.
   - `cd ai && docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build`
   - Kiểm tra `curl localhost:8090/health` và `:8091/health` có `"device": "cuda"`.
   - Mở tunnel cho 8090/8091 (core gọi vào). Agent (8099) tự kết nối ra LiveKit và core; chỉ `/webhook` và `/health` của nó cần tunnel.
   - Điền địa chỉ ở **Tình trạng hệ thống → Địa chỉ các dịch vụ**, đặt `AI_TOKEN` giống nhau ở cả hai phía.
4. **Client:** `pnpm install` (thêm `@mediapipe/tasks-audio`); `pnpm dev` tự tải `yamnet.tflite`.
5. **Kỳ thi demo:** bật "Quay clip quanh vi phạm" (cho lệnh CLIP) và tùy chọn "Mã hóa video và minh chứng sau khi thi".

## Chưa kiểm chứng (phải thử trên môi trường thật)

- Chưa chạy test PHP (máy dev không có PHP). Go và Python đã có test và qua; client qua `tsc`.
- Track Egress với LiveKit thật: tên trường JSON của `StartTrackEgress`/`GetParticipant`, giá trị `cpu_cost` mặc định, việc file chỉ lên S3 khi luồng kết thúc.
- Độ trễ thực tế của lệnh CLIP (dự kiến vài giây) và chất lượng nhận diện tiếng nói của YAMNet ở phòng thi thật.
- Image GPU của `face-service`/`object-service` chưa build thử (nặng vài GB).

## Còn lại

- [ ] Tùy chọn "tự tạo cảnh báo khi heatmap bất thường" (hiện chỉ đánh dấu trên heatmap, không tạo vi phạm).
- [ ] Mã hóa cả **ảnh khuôn mặt tham chiếu** (lưu ở core, không ở record service).
- [ ] Bản ghi đang ghi dở chưa mã hóa: bật mã hóa phía lưu trữ (SSE) của SeaweedFS cho lớp bảo vệ ngay từ đầu.
- [ ] (Sau demo) chuyển AI sang mô hình "client gửi ảnh + laptop kéo việc": không cần tunnel, client không cần WebRTC.
- [ ] Kiểm thử tải: `livekit-cli load-test` (10 người) và `k6` cho đợt vào thi.
