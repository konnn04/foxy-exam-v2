# 🦊 FoxyExam Client

Ứng dụng desktop (Tauri v2 + React + TypeScript) mà sinh viên dùng để thi —
không làm bài trên web, client này gọi thẳng REST API `/api/v1/student/...`
của `server/` (xem `docs/ARCHITECTURE_AND_HANDOFF.md` ở gốc repo).

> **Trạng thái hiện tại: bản dựng tạm (scaffold).** Điều hướng giữa các cửa sổ
> đã chạy được bằng nút bấm, nhưng dữ liệu đề thi/đăng nhập còn là placeholder
> tĩnh — chưa nối API thật. Các chỗ cần nối API đã đánh dấu `// TODO`.

## Yêu cầu môi trường (Windows)

- Node.js + [pnpm](https://pnpm.io/) (**bắt buộc dùng pnpm**, không dùng npm/yarn)
- Rust (`rustup`) — target `x86_64-pc-windows-msvc`
- **Visual Studio Build Tools** với workload **"Desktop development with C++"**
  (chứa MSVC `link.exe` + Windows SDK). Chỉ cài VS Installer thôi là chưa đủ —
  phải tick đúng workload này, xem [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/).

## Lệnh chạy

```powershell
pnpm install       # cài dependency
pnpm tauri dev      # chạy dev (hot-reload)
pnpm tauri build    # build bản release (.msi/.exe)
```

## Kiến trúc 5 cửa sổ

Mọi cửa sổ dùng chung một bundle React; `App.tsx` đọc `label` của cửa sổ hiện
tại (khai báo trong `src-tauri/tauri.conf.json`) để chọn màn hình tương ứng —
không cần router.

| Label | Component | Mô tả |
|---|---|---|
| `loading` | `src/windows/Loading.tsx` | Splash nhỏ, không viền, hiện đầu tiên |
| `login` | `src/windows/Login.tsx` | Đăng nhập nhỏ, không viền |
| `update` | `src/windows/Update.tsx` | Cửa sổ cập nhật — độc lập, không cần đăng nhập (xem mục dưới) |
| `main` | `src/windows/Main.tsx` | Dashboard — chọn phòng thi |
| `exam-classic` | `src/windows/ExamClassic.tsx` | Thi trắc nghiệm/tự luận (kiểu TOEIC) |
| `exam-code` | `src/windows/ExamCode.tsx` | Thi lập trình — đề bài + code editor + console |

Điều hướng qua lại dùng 2 helper trong `src/lib/windowNav.ts`:
- `switchWindow()` — hiện + focus cửa sổ đích, **ẩn** cửa sổ hiện tại (dùng cho
  luồng chính: loading → login → main → phòng thi).
- `openPopup()` — chỉ hiện + focus cửa sổ đích, **không đụng** tới cửa sổ hiện
  tại (dùng cho cửa sổ phụ độc lập như `update`).

## Chạy ngầm ở khay hệ thống (system tray)

Cấu hình trong `src-tauri/src/lib.rs`:

- Bấm nút đóng (X) trên **bất kỳ** cửa sổ nào chỉ **ẩn** cửa sổ đó, app vẫn
  chạy ngầm ở khay hệ thống (system tray) thay vì thoát hẳn.
- Click trái (đơn hoặc đúp) vào icon tray → mở lại **đúng** cửa sổ theo trạng
  thái đăng nhập: **chưa đăng nhập** → `login`, **đã đăng nhập** → `main`.
  Trạng thái này là 1 cờ `AuthState` giữ bên Rust (`src-tauri/src/lib.rs`),
  đồng bộ từ frontend qua command `set_authenticated` (gọi trong
  `src/lib/auth.ts`, ngay sau khi Login submit / bấm Đăng xuất ở Main). Cờ
  này chỉ tồn tại trong bộ nhớ (mất khi tắt app) — khi nối API thật, thay
  bằng lưu token/session thật.
- Click phải vào icon tray → menu:
  - **Kiểm tra cập nhật** — mở cửa sổ chính + phát sự kiện `tray://check-update`
    cho frontend tự chạy luồng cập nhật.
  - **Thoát** — thoát hẳn ứng dụng (`app.exit(0)`).

## Hệ thống tự động cập nhật (updater)

Dùng plugin chính thức `@tauri-apps/plugin-updater`. Luồng chạy ở
`src/lib/updater.ts` (`checkForUpdateAndInstall`), UI nằm **riêng** ở cửa sổ
`update` (`src/windows/Update.tsx`) — **không** đặt trong Main.

> **Vì sao tách riêng?** Menu tray "Kiểm tra cập nhật" phải mở được bất kể
> người dùng đã đăng nhập hay chưa (kiểm tra cập nhật không phải hành động
> cần xác thực). Nếu dùng chung cửa sổ Main — vốn chỉ nên vào được sau khi
> đăng nhập — thì bấm tray sẽ vô tình mở thẳng dashboard, bỏ qua bước đăng
> nhập. Cửa sổ `update` không hiển thị dữ liệu tài khoản/phòng thi nào nên mở
> lúc nào cũng an toàn; nút "Kiểm tra cập nhật" trên Main chỉ `openPopup()` mở
> cửa sổ này lên (không ẩn Main).

- Tự kiểm tra **âm thầm** ngay khi cửa sổ `update` được mở lần đầu (không làm
  phiền nếu đã mới nhất/lỗi mạng).
- Kiểm tra **thủ công** qua nút "Kiểm tra lại" trong cửa sổ đó, hoặc bấm lại
  menu tray khi cửa sổ đã mở sẵn — luôn hiện rõ trạng thái (đang tải / đang
  cài / lỗi...).
- Có bản mới → tải + cài + tự khởi động lại app.
- Tray click trái sẽ đưa cửa sổ **đang hiển thị** lên trước (không ép thẳng
  vào Main), để tránh nhảy qua màn hình đăng nhập tương tự.

### Khóa ký gói cập nhật

Đã sinh sẵn 1 cặp khóa minisign (không mật khẩu, dùng `--ci`):

- `src-tauri/foxyexam-updater.key` — **private key, đã gitignore, KHÔNG BAO GIỜ
  commit**. Nội dung file này (base64) sẽ được dùng làm secret
  `TAURI_SIGNING_PRIVATE_KEY` trên GitHub Actions.
- `src-tauri/foxyexam-updater.key.pub` — public key, đã nhúng sẵn vào
  `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

Nếu muốn khóa có mật khẩu (khuyến nghị cho production), sinh lại bằng:

```powershell
pnpm tauri signer generate -w ./src-tauri/foxyexam-updater.key
```
rồi cập nhật lại `pubkey` trong `tauri.conf.json` và secret tương ứng.

### Endpoint cập nhật

`plugins.updater.endpoints` trong `tauri.conf.json` hiện đang trỏ tới
placeholder `TODO_OWNER/TODO_REPO` — **cần sửa lại đúng owner/repo GitHub thật**
trước khi build release đầu tiên:

```json
"endpoints": ["https://github.com/<owner>/<repo>/releases/latest/download/latest.json"]
```

## CI/CD — phát hành qua GitHub Actions

Workflow: `.github/workflows/release-client.yml` (ở gốc repo, không phải
trong `client/`). Dùng `tauri-apps/tauri-action` để build + tạo GitHub
Release kèm `latest.json` cho updater.

**Cách dùng:**
1. Sửa `endpoints` trong `tauri.conf.json` cho đúng repo thật (xem trên).
2. Vào GitHub repo → Settings → Secrets and variables → Actions, thêm:
   - `TAURI_SIGNING_PRIVATE_KEY`: nội dung file `src-tauri/foxyexam-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: để trống (vì khóa hiện không có mật khẩu)
3. Push tag dạng `client-v0.1.0` (khớp pattern trong workflow) → tự build +
   tạo **draft** Release kèm file cài đặt + `latest.json`.
4. Vào GitHub Releases, kiểm tra rồi bấm **Publish** — lúc đó URL
   `.../releases/latest/download/latest.json` mới trỏ đúng (draft/prerelease
   không tính là "latest").
5. Mặc định chỉ build Windows (`windows-latest`) — cần thêm macOS/Linux thì bỏ
   comment 2 dòng platform tương ứng trong workflow.
