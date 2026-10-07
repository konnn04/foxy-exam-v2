import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Camera,
  ChevronUp,
  Download,
  FileText,
  History as HistoryIcon,
  LayoutGrid,
  LogOut,
  Mic,
  Monitor,
  Moon,
  PanelLeft,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  User,
} from "lucide-react";
import TitleBar from "../components/TitleBar";
import { BrandMark, Button, cx } from "../components/ui";
import { AppWindow, onWindowShown, openPopup, switchWindow } from "../lib/windowNav";
import { setAuthenticated } from "../lib/auth";
import { clearAuth, getAuth, saveAuth, type AuthData } from "../lib/authStore";
import { clearSession, saveSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import {
  ApiError,
  getCourseExams,
  getCourses,
  getDashboard,
  getHealth,
  getMe,
  logoutRemote,
  startExam,
} from "../lib/api";
import { examState, initials, useDeviceCheck, type ExamItem, type Page, type PageProps, type StudentData } from "./main/shared";
import Dashboard from "./main/Dashboard";
import Courses from "./main/Courses";
import Exams from "./main/Exams";
import History from "./main/History";
import Profile from "./main/Profile";
import Settings from "./main/Settings";

const PAGE_TITLE: Record<Page, string> = {
  dashboard: "Bảng điều khiển",
  courses: "Khoá học",
  exams: "Kì thi",
  history: "Lịch sử thi",
  profile: "Thông tin",
  settings: "Cài đặt",
};

const EMPTY: StudentData = { dashboard: null, courses: [], exams: [], me: null };

/**
 * Cửa sổ chính — cửa sổ thường (KHÔNG protect content). Chỉ cửa sổ thi riêng
 * (`exam-classic`, `exam-code`) mới bật protect content.
 *
 * Cửa sổ không unmount khi ẩn/hiện nên tải lại dữ liệu mỗi lần được hiện bởi
 * `switchWindow` (không dùng focus: kéo cửa sổ cũng bắn focus).
 */
export default function Main() {
  const [auth, setAuth] = useState<AuthData | null>(() => getAuth());
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState<StudentData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const device = useDeviceCheck();
  const loadSeq = useRef(0);

  const goAuth = useCallback(async () => {
    clearAuth();
    clearSession();
    setData(EMPTY);
    await setAuthenticated(false);
    await switchWindow(AppWindow.Auth);
  }, []);

  const load = useCallback(async () => {
    const current = getAuth();
    setAuth(current);
    if (!current) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [dash, courses, me] = await Promise.all([getDashboard(), getCourses(), getMe()]);
      const examLists = await Promise.all(
        courses.data.map((c) =>
          getCourseExams(c.id)
            .then((r) => r.data.map((e): ExamItem => ({ ...e, course: { id: c.id, name: c.name, code: c.code } })))
            .catch(() => [] as ExamItem[]),
        ),
      );
      if (seq !== loadSeq.current) return;
      saveAuth({ ...current, user: me.data });
      setAuth(getAuth());
      setData({ dashboard: dash.data, courses: courses.data, exams: examLists.flat(), me: me.data });
      setOnline(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await goAuth();
        return;
      }
      if (err instanceof ApiError && err.status === 0) setOnline(false);
      setError(err instanceof ApiError ? err.message : "Không tải được dữ liệu.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [goAuth]);

  useEffect(() => {
    void load();
    return onWindowShown(() => {
      void load();
      device.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Kiểm tra kết nối nhẹ mỗi 30s cho chấm "online" trên thanh tiêu đề.
  useEffect(() => {
    const id = window.setInterval(() => {
      getHealth()
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function handleLogout() {
    try {
      await logoutRemote();
    } catch {
      // Offline / token đã hết hạn: vẫn đăng xuất cục bộ.
    }
    setPage("dashboard");
    await goAuth();
  }

  async function handleStart(exam: { id: number }) {
    if (!auth) return;
    setStartingId(exam.id);
    setError(null);
    try {
      const res = (await startExam(exam.id)).data;
      saveSession({
        token: auth.token,
        attemptId: res.attempt_id,
        attemptNumber: res.attempt_number,
        maxAttempts: null,
        student: { id: auth.user.id, username: auth.user.username, name: auth.user.name },
        exam: {
          id: res.exam.id,
          title: res.exam.title,
          code: res.exam.code,
          duration_minutes: res.duration_minutes,
          monitoring_config: res.exam.monitoring_config,
        },
      });
      await switchWindow(res.exam.type === "QUIZ" ? AppWindow.ExamClassic : AppWindow.ExamCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không vào được phòng thi.");
    } finally {
      setStartingId(null);
    }
  }

  if (!auth) {
    return (
      <div className="flex h-screen flex-col bg-app">
        <TitleBar title="Foxy Exam" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted">
          Chưa đăng nhập.
          <Button variant="primary" onClick={() => void switchWindow(AppWindow.Auth)}>
            Về màn hình đăng nhập
          </Button>
        </div>
      </div>
    );
  }

  const activeExams = data.exams.filter((e) => ["open", "in_progress"].includes(examState(e))).length;
  const props: PageProps = { data, loading, startingId, onStart: handleStart, onNavigate: setPage, device };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      <TitleBar
        title={`Foxy Exam — ${PAGE_TITLE[page]}`}
        right={
          online !== null && (
            <span className={cx("flex items-center gap-1.5 font-mono text-[10px]", online ? "text-success" : "text-danger")}>
              <span className={cx("h-1.5 w-1.5 rounded-full", online ? "bg-success" : "bg-danger live-dot")} />
              {online ? "online" : "offline"}
            </span>
          )
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className={cx("flex shrink-0 flex-col overflow-hidden border-r border-line bg-surface-2 transition-all", collapsed ? "w-[60px]" : "w-[220px]")}>
          <div className={cx("border-b border-line py-3.5", collapsed ? "px-2" : "px-4")}>
            <BrandMark compact={collapsed} subtitle={auth.user.organization?.name} />
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
            {!collapsed && <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Menu</p>}
            <NavItem icon={<LayoutGrid size={16} />} label="Bảng điều khiển" page="dashboard" current={page} onClick={setPage} collapsed={collapsed} />
            <NavItem icon={<BookOpen size={16} />} label="Khoá học" page="courses" current={page} onClick={setPage} collapsed={collapsed} count={data.courses.length || undefined} />
            <NavItem icon={<FileText size={16} />} label="Kì thi" page="exams" current={page} onClick={setPage} collapsed={collapsed} count={activeExams || undefined} highlight />
            <NavItem icon={<HistoryIcon size={16} />} label="Lịch sử thi" page="history" current={page} onClick={setPage} collapsed={collapsed} />
            <NavItem icon={<User size={16} />} label="Thông tin" page="profile" current={page} onClick={setPage} collapsed={collapsed} />
            <NavItem icon={<SettingsIcon size={16} />} label="Cài đặt" page="settings" current={page} onClick={setPage} collapsed={collapsed} />
          </nav>

          {!collapsed && <ReadinessCard device={device} onOpen={() => setPage("settings")} />}
          <UserCard auth={auth} collapsed={collapsed} onLogout={() => void handleLogout()} onProfile={() => setPage("profile")} />
        </aside>

        {/* Nội dung */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-fg"
              aria-label="Thu gọn menu"
            >
              <PanelLeft size={16} />
            </button>
            <span className="h-4 w-px bg-line" />
            <h1 className="text-[13px] font-semibold text-fg">{PAGE_TITLE[page]}</h1>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />} onClick={() => void load()} disabled={loading}>
                Làm mới
              </Button>
              <Button size="sm" icon={<Download size={13} />} onClick={() => void openPopup(AppWindow.Update)}>
                Cập nhật
              </Button>
              <ThemeToggle />
            </div>
          </header>

          {error && (
            <div className="border-b border-danger/30 bg-danger-soft px-6 py-2 text-xs text-danger">{error}</div>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto">
            {page === "dashboard" && <Dashboard {...props} />}
            {page === "courses" && <Courses {...props} />}
            {page === "exams" && <Exams {...props} />}
            {page === "history" && <History {...props} />}
            {page === "profile" && <Profile {...props} />}
            {page === "settings" && <Settings {...props} onLogout={() => void handleLogout()} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  page,
  current,
  onClick,
  collapsed,
  count,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  page: Page;
  current: Page;
  onClick: (p: Page) => void;
  collapsed: boolean;
  count?: number;
  highlight?: boolean;
}) {
  const active = page === current;
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={() => onClick(page)}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition",
        collapsed && "justify-center px-0",
        active
          ? "border-line bg-surface font-medium text-fg shadow-sm"
          : "border-transparent text-muted hover:bg-surface-3 hover:text-fg",
      )}
    >
      <span className={active ? "text-accent" : ""}>{icon}</span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && count !== undefined && (
        <span
          className={cx(
            "rounded-full px-1.5 text-[10px] font-semibold",
            highlight ? "bg-accent-soft text-accent-fg" : "text-subtle",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ReadinessCard({ device, onOpen }: { device: PageProps["device"]; onOpen: () => void }) {
  const row = (ok: boolean, icon: React.ReactNode, text: string) => (
    <li className={cx("flex items-center gap-2", ok ? "text-success" : "text-danger")}>
      {icon}
      {text}
    </li>
  );
  return (
    <button type="button" onClick={onOpen} className="mx-2.5 mb-2 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-line-strong">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Sẵn sàng thi</p>
      {device.snapshot ? (
        <ul className="space-y-1 text-xs">
          {row(device.cameras > 0, <Camera size={13} />, device.cameras > 0 ? `${device.cameras} camera` : "Không có camera")}
          {row(device.microphones > 0, <Mic size={13} />, device.microphones > 0 ? `${device.microphones} micro` : "Không có micro")}
          {row(device.displays === 1, <Monitor size={13} />, `${device.displays} màn hình`)}
        </ul>
      ) : (
        <p className="text-xs text-subtle">{device.checking ? "Đang kiểm tra…" : device.error ?? "—"}</p>
      )}
    </button>
  );
}

function UserCard({
  auth,
  collapsed,
  onLogout,
  onProfile,
}: {
  auth: AuthData;
  collapsed: boolean;
  onLogout: () => void;
  onProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative border-t border-line p-2.5">
      {open && (
        <div className="absolute bottom-full left-2.5 right-2.5 mb-1 min-w-[180px] rounded-lg border border-line bg-surface p-1 shadow-lg">
          <MenuButton icon={<User size={14} />} onClick={() => (setOpen(false), onProfile())}>
            Thông tin cá nhân
          </MenuButton>
          <MenuButton icon={<LogOut size={14} />} danger onClick={onLogout}>
            Đăng xuất
          </MenuButton>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-3", collapsed && "justify-center")}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-muted">
          {initials(auth.user.name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-fg">{auth.user.name}</span>
              <span className="block truncate text-[11px] text-muted">{auth.user.email}</span>
            </span>
            <ChevronUp size={14} className="text-subtle" />
          </>
        )}
      </button>
    </div>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
        danger ? "text-danger hover:bg-danger-soft" : "text-fg hover:bg-surface-3",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={resolved === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-fg"
    >
      {resolved === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
