# FoxyClient — exam flow

```
Dashboard ──pick exam──▶ exam window (lobby) ──"Bắt đầu"──▶ exam screen ──submit / force-end──▶ Dashboard
                          │ device check, no attempt yet      │ attempt + clock, guard, realtime, LiveKit
```

1. **Pick an exam** (`windows/Main.tsx`): only stores a *pending exam* and shows the exam window. No attempt exists yet, so the
   exam clock does **not** run during setup.
2. **Lobby** (`components/ExamLobby.tsx`): server reachable + clock skew, exam open / enrolled / AI available (`GET /student/exams/{id}`),
   exactly one display, no banned app (Rust monitor), camera preview, microphone level meter, optional screen share.
   Required checks block the *Bắt đầu* button; each shows how to fix it. Camera is required when the exam has `ai_face_check`,
   mic when `require_mic`; screen sharing is recommended, not blocking (WebView support varies).
3. **Start** → `POST /student/exams/{id}/start` (creates or resumes the attempt) → paper (`take` for classical, `paper` for coding).
4. **Runtime** (`lib/examRuntime.ts`, one hook used by both exam windows):
   * `RealtimeClient` (`lib/realtime.ts`): one batched request per ~1 s (heartbeat with focus / fullscreen / camera / screen, violations,
     keystroke op-logs), idempotent `seq` persisted per attempt and re-synced with `GET /rt/ingest/v1/state`, gzip, retry with backoff,
     token refresh on 401, server-driven `next_flush_ms`. If the server has no realtime plane (`REALTIME_DISABLED`) or the DEV bypass
     `realtime` is on, violations / op-logs use the plain REST endpoints.
   * LiveKit: the camera / screen captured in the lobby are published to the exam room (`lib/media.ts`); the record service starts
     egress by itself. A capture that stops mid-exam is reported as a violation and flips `camera` / `screen` in the heartbeat.
   * Proctor commands arrive on the batch response: `WARN` → banner, `PAUSE` / `RESUME` → paper covered / uncovered,
     `FORCE_END` or `end: true` → the attempt is closed server-side and the window returns to the dashboard.
5. **Question types** (`windows/ExamClassic.tsx`): single / multiple choice, true-false, fill-in-the-blank (`[1] [2]` markers become inputs,
   answer = JSON array in `answer_content`), short answer, essay (word limits; audio/file modes show a "not supported yet" notice),
   groups with text / image / audio passages (limited listens, optional seeking). Answer keys never reach the client.

## Dev bypass (testing without a proctoring-grade machine)

Only in dev builds (`pnpm dev` / `pnpm tauri dev`): `lib/dev.ts` returns `false` for every flag when `import.meta.env.DEV` is false,
so a released client cannot enable them whatever is in `localStorage`.

* Floating **DEV** button (lobby + exam windows) toggles: skip lobby · no camera · no screen · ignore extra monitors / banned apps /
  keyboards · REST instead of realtime · ignore a failing health check. Choices persist in `localStorage`.
* Or preset them: `VITE_FOXY_DEV_BYPASS=all` (or `setup,camera,devices`) in `client/.env.development.local`.
* Kiosk lockdown (fullscreen, always-on-top, shortcut blocking) is already off in dev builds.
* The exam header shows `DEV bypass: …` while any flag is active, so test runs are never mistaken for real ones.
* Server side: `AI_ENFORCE=false` lets exams that ask for face monitoring start when no AI worker exists.

Config: `client/.env.example`. Verification of the batching client against a real stack: `bash realtime/scripts/smoke.sh`.

## Giám sát, khoá thi và chạy code (cập nhật)

- Mọi request của cửa sổ thi gửi `X-Foxy-Attempt`; server chọn đúng lượt thi nên thi lại không ghi đè lượt cũ.
- Rời phòng/mất kết nối quá 5 phút: client coi là vắng, server (`attempts:expire-offline`) đóng lượt thi với `ended_reason=ABSENT`.
- Đóng cửa sổ thi/Alt+F4 chỉ phát `exam://close-requested`; UI hiện hộp xác nhận, nút thoát mở sau 5 giây. Thoát thật gọi `runtime.end()` (tắt camera, guard, realtime).
- Mất camera hoặc dừng chia sẻ màn hình (khi kỳ thi yêu cầu) sẽ che bài thi và cho nút bật lại.
- `allowed_apps` (mặc định `devenv`, `code`) chỉ áp dụng cho kỳ thi lập trình: các app này không bị ép on-top/đổi cửa sổ; app khác vẫn ghi nhận.
- MediaPipe FaceLandmarker: `pnpm sync:mediapipe` chép wasm + model vào `public/mediapipe`; delegate chọn ở Cài đặt (tự động GPU → CPU).
- Chạy thử code dùng trình biên dịch có sẵn trên máy (g++, clang++, MSVC, Python, Java) qua `runner_toolchains` / `runner_run`.
- Màn giám sát: `GET /admin/exams/{id}/live-video` cấp token LiveKit ẩn, chỉ subscribe; tile hiển thị camera hoặc màn hình của thí sinh.

## Soạn code, terminal và hiển thị (cập nhật)

- Mọi sao chép / dán / cắt / kéo thả văn bản bị chặn trong cửa sổ thi trừ khi kỳ thi tắt `prevent_paste` (mặc định bật, áp dụng cả trắc nghiệm lẫn lập trình, kể cả 1 ký tự). Mỗi lần cố dán ghi một vi phạm `BULK_PASTE`.
- Các sự kiện trùng (cùng loại, cùng tiến trình hoặc nội dung trong 2 giây) chỉ ghi một lần.
- "Chạy" mở terminal tích hợp (`Terminal.tsx`): chương trình chạy bằng trình biên dịch của máy với stdin/stdout nối ống, kết quả đẩy về cửa sổ qua sự kiện `runner://data`, `runner://exit`; thí sinh gõ dữ liệu ngay trong terminal. Không mở console của hệ điều hành. Lệnh Rust: `runner_session_start/write/close_stdin/kill`. Lưu ý C/C++ dùng `printf`/`scanf` bị đệm khi chạy qua ống; `cout`/`cin` tự xả trước khi đọc.
- Đề bài, câu hỏi, đáp án hiển thị Markdown có GFM và công thức LaTeX (`$x^2$`, `$$...$$`); code có tô màu cú pháp (Prism). Server dùng cùng bộ ở trình soạn bài toán, xem trước câu hỏi và xem bài làm.
- Có thể kéo thả đổi độ rộng: khung đề bài / code, chiều cao terminal (client) và cột của mọi bảng `FxList` (server), nhớ theo máy.

## Camera mở rộng (điện thoại) và ảnh minh chứng

Cấu hình kỳ thi `monitoring_config.extra_camera`: `off` | `optional` | `required`.

1. Phòng chờ tự tạo liên kết (`POST /student/exams/{id}/mobile-camera`) và hiện mã QR. Token chỉ lưu dạng SHA-256 (`mobile_camera_tokens`), gắn với (sinh viên, kỳ thi) rồi gắn vào lượt thi khi bắt đầu; hết hạn khi nộp bài.
2. Điện thoại mở `/m/camera/{token}`, bật camera và đổi token lấy thông tin LiveKit (`POST /api/v1/public/mobile-camera/{token}/exchange`). Trước giờ thi nó phát vào phòng riêng `lobby-{user}-{exam}`; phòng chờ của máy tính vào cùng phòng (chỉ xem) để hiện hình xem trước.
3. Máy tính gửi ảnh từ điện thoại tới `POST /student/exams/{id}/mobile-camera/verify`: dịch vụ vật thể phải thấy người và laptop (bỏ qua nếu chưa có dịch vụ AI). Chế độ `required` khoá nút Bắt đầu tới khi đạt.
4. Khi bắt đầu thi, máy tính gửi tin `go` qua kênh dữ liệu LiveKit; điện thoại đổi token lại và phát vào phòng thi `exam-{id}` với danh tính `attempt-{aid}-mobile` (không được xem ai khác). Record service ghi hình thành `camera2`. Nếu tin `go` mất, trang điện thoại tự kiểm tra lại mỗi 20 s khi còn ở phòng chờ.
5. Trong giờ thi điện thoại gửi một ảnh nhỏ mỗi 20 s lên record service (`purpose: phone`, chỉ giữ 12 ảnh mới nhất). Khi có vi phạm, máy tính "nhận" ảnh mới nhất (≤ 90 s) thành minh chứng.

Mỗi vi phạm có ảnh minh chứng (`details.evidence`): **màn hình**, **camera chính** và **camera phụ** (nếu dùng). `violations.evidence_id` là ảnh sát nhất với loại vi phạm. Trang phiên thi của giám thị hiện cả ba ảnh và có thêm trình phát video `camera2`.
