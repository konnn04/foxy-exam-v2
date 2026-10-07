import { useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import TitleBar from "../components/TitleBar";
import { Badge, BrandMark, Button, CodeTile, Empty, Input, Placeholder, cx } from "../components/ui";
import { AppWindow, onWindowShown, switchWindow } from "../lib/windowNav";
import { setAuthenticated } from "../lib/auth";
import { ApiError, getHealth, getMe, getPublicOrganizations, login, type PublicOrganization } from "../lib/api";
import { clearAuth, getAuth, getRecentOrgs, pushRecentOrg, saveAuth, type RecentOrg } from "../lib/authStore";

type Phase = "form" | "resuming" | "resume-error";
type Step = 1 | 2;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

const ORG_TYPE: Record<string, string> = {
  UNIVERSITY: "Đại học",
  COLLEGE: "Cao đẳng",
  HIGH_SCHOOL: "Trường THPT",
  TRAINING_CENTER: "Trung tâm đào tạo",
  ENTERPRISE: "Doanh nghiệp",
};

/**
 * Cửa sổ đăng nhập — tải sẵn (ẩn) từ lúc mở app, chỉ hiện sau cửa sổ cập nhật.
 * Mỗi lần được hiện: có phiên lưu sẵn -> kiểm tra token rồi vào thẳng dashboard;
 * chưa có / hết hạn -> form 2 bước: chọn tổ chức -> tài khoản & mật khẩu.
 */
export default function Auth() {
  const [phase, setPhase] = useState<Phase>(() => (getAuth() ? "resuming" : "form"));
  const [step, setStep] = useState<Step>(1);
  const [version, setVersion] = useState("");
  const [latency, setLatency] = useState<number | null | "offline">(null);

  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [orgsState, setOrgsState] = useState<"loading" | "ok" | "error">("loading");
  const [recent, setRecent] = useState<RecentOrg[]>(getRecentOrgs);
  const [org, setOrg] = useState<RecentOrg | null>(() => getRecentOrgs()[0] ?? null);
  const [query, setQuery] = useState("");
  const [privateCode, setPrivateCode] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resuming = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLInputElement>(null);

  function loadOrgs() {
    setOrgsState("loading");
    getPublicOrganizations()
      .then((res) => {
        setOrgs(res.data);
        setOrgsState("ok");
      })
      .catch(() => setOrgsState("error"));
  }

  function ping() {
    const t0 = performance.now();
    getHealth()
      .then(() => setLatency(Math.round(performance.now() - t0)))
      .catch(() => setLatency("offline"));
  }

  useEffect(() => {
    void getVersion().then(setVersion).catch(() => {});
    loadOrgs();
    ping();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === "k" && step === 1) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  useEffect(() => {
    if (step === 2) userRef.current?.focus();
  }, [step]);

  async function resume() {
    if (resuming.current) return;
    const auth = getAuth();
    if (!auth) {
      setPhase("form");
      return;
    }
    resuming.current = true;
    setPhase("resuming");
    try {
      const me = await getMe();
      saveAuth({ ...auth, user: me.data });
      await setAuthenticated(true);
      await switchWindow(AppWindow.Main);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
        await setAuthenticated(false);
        setPhase("form");
        setStep(2);
        setError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      } else {
        setPhase("resume-error");
      }
    } finally {
      resuming.current = false;
    }
  }

  useEffect(() => {
    return onWindowShown(() => {
      ping();
      setRecent(getRecentOrgs());
      if (getAuth()) void resume();
      else {
        setPhase("form");
        setPassword("");
      }
    });
  }, []);

  function switchAccount() {
    clearAuth();
    void setAuthenticated(false);
    setError(null);
    setStep(1);
    setPhase("form");
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return orgs;
    return orgs.filter((o) => normalize(`${o.name} ${o.code} ${o.slug}`).includes(q));
  }, [orgs, query]);

  function pickPublic(o: PublicOrganization) {
    setOrg({ code: o.code, name: o.name, private: false });
    setPrivateCode("");
    setError(null);
  }

  function goStep2() {
    const code = privateCode.trim().toUpperCase();
    if (code) {
      setOrg({ code, private: true });
    } else if (!org) {
      setError("Chọn một tổ chức hoặc nhập mã tổ chức riêng tư.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!org) {
      setStep(1);
      return;
    }
    if (!username.trim() || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await login({ orgCode: org.code, login: username.trim(), password });
      saveAuth({ token: res.access_token, user: res.user, remember });
      // Tổ chức riêng tư: lấy tên thật từ tài khoản vừa đăng nhập.
      const saved: RecentOrg = { ...org, name: res.user.organization?.name ?? org.name };
      pushRecentOrg(saved);
      setRecent(getRecentOrgs());
      setPassword("");
      await setAuthenticated(true);
      await switchWindow(AppWindow.Main);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đăng nhập thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <TitleBar
        title={`Foxy Exam — Đăng nhập${step === 2 && org?.name ? ` · ${org.name}` : ""}`}
        maximizable={false}
      />

      <div className="flex min-h-0 flex-1">
        {/* Cột trái: thương hiệu + thông tin kết nối */}
        <aside className="flex w-[44%] flex-col border-r border-line bg-surface-2 p-7">
          <BrandMark />
          <div className="flex flex-1 items-center">
            <Placeholder label="login illustration" className="aspect-[4/3] w-full" />
          </div>
          {step === 1 ? (
            <div>
              <p className="text-sm font-semibold text-fg">Thi trực tuyến có giám sát</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Camera, màn hình và tiến trình máy được giám sát
                <br />
                trong suốt thời gian làm bài.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2">
                <ShieldCheck size={14} /> Phiên thi được gắn với thiết bị này
              </li>
              <ConnectionRow latency={latency} />
            </ul>
          )}
          <p className="mt-4 font-mono text-[10px] text-subtle">
            {version && `v${version} · `}Windows x64 · Tauri 2
          </p>
        </aside>

        {/* Cột phải */}
        <main className="flex min-w-0 flex-1 flex-col px-10 py-7">
          {phase === "resuming" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted">
              <RefreshCw size={18} className="animate-spin" />
              Đang khôi phục phiên đăng nhập…
            </div>
          )}

          {phase === "resume-error" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <WifiOff size={22} className="text-danger" />
              <div>
                <p className="text-sm font-semibold text-fg">Không kết nối được máy chủ</p>
                <p className="mt-1 text-xs text-muted">Kiểm tra mạng rồi thử lại.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={switchAccount}>Đăng nhập tài khoản khác</Button>
                <Button variant="primary" icon={<RefreshCw size={13} />} onClick={() => void resume()}>
                  Thử lại
                </Button>
              </div>
            </div>
          )}

          {phase === "form" && (
            <>
              <Stepper step={step} onBack={() => setStep(1)} />

              {step === 1 ? (
                <div className="mt-5 flex min-h-0 flex-1 flex-col">
                  <h1 className="text-xl font-semibold text-fg">Bạn thi ở tổ chức nào?</h1>
                  <p className="mt-0.5 text-xs text-muted">
                    Chọn trường / trung tâm, hoặc nhập mã nếu tổ chức ở chế độ riêng tư.
                  </p>

                  <Input
                    ref={searchRef}
                    className="mt-4"
                    icon={<Search size={15} />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc mã tổ chức…"
                    trailing={<kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-subtle">Ctrl K</kbd>}
                  />

                  {recent.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Gần đây</p>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((r) => (
                          <button
                            key={r.code}
                            type="button"
                            onClick={() => {
                              setOrg(r);
                              setPrivateCode("");
                            }}
                            className={cx(
                              "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs transition",
                              org?.code === r.code
                                ? "border-accent/50 bg-accent-soft text-accent-fg"
                                : "border-line text-fg hover:bg-surface-3",
                            )}
                          >
                            <CodeTile code={r.code} className="h-5 w-5 rounded-full text-[8px]" />
                            {r.name ?? r.code}
                            {r.private && <Lock size={11} className="text-subtle" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line">
                    <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                        Tổ chức công khai{orgsState === "ok" && ` · ${orgs.length}`}
                      </span>
                      <button
                        type="button"
                        onClick={loadOrgs}
                        className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
                      >
                        <RefreshCw size={11} className={orgsState === "loading" ? "animate-spin" : ""} /> Làm mới
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {orgsState === "error" ? (
                        <Empty icon={<WifiOff size={18} />} text="Không tải được danh sách tổ chức." />
                      ) : orgsState === "loading" && orgs.length === 0 ? (
                        <Empty text="Đang tải…" />
                      ) : filtered.length === 0 ? (
                        <Empty text="Không thấy? Tổ chức của bạn có thể ở chế độ riêng tư — nhập mã bên dưới." />
                      ) : (
                        filtered.map((o) => {
                          const active = !privateCode && org?.code === o.code;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => pickPublic(o)}
                              onDoubleClick={() => {
                                pickPublic(o);
                                setStep(2);
                              }}
                              className={cx(
                                "flex w-full items-center gap-3 border-b border-l-2 border-b-line px-3 py-2.5 text-left transition last:border-b-0",
                                active ? "border-l-accent bg-accent-soft" : "border-l-transparent hover:bg-surface-2",
                              )}
                            >
                              <CodeTile code={o.code} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-fg">{o.name}</p>
                                <p className="truncate text-[11px] text-muted">
                                  {ORG_TYPE[o.type] ?? o.type} · {o.slug}
                                </p>
                              </div>
                              {active ? (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-accent-fg">
                                  <Check size={13} /> Đã chọn
                                </span>
                              ) : (
                                <ChevronRight size={15} className="text-subtle" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="my-3 flex items-center gap-3 text-[11px] text-subtle">
                    <span className="h-px flex-1 bg-line" />
                    hoặc tổ chức riêng tư
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <Input
                    icon={<KeyRound size={15} />}
                    value={privateCode}
                    onChange={(e) => {
                      setPrivateCode(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && goStep2()}
                    placeholder="Mã tổ chức riêng tư, VD: PRIV_ACAD"
                    className="font-mono uppercase"
                  />

                  {error && <ErrorBox text={error} />}

                  <Button variant="primary" size="lg" className="mt-3 w-full" onClick={goStep2}>
                    Tiếp tục <ArrowRight size={15} />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="mt-5 flex flex-1 flex-col">
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                    <CodeTile code={org?.code ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{org?.name ?? org?.code}</p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {org?.private ? "Tổ chức riêng tư · " : ""}
                        {org?.code}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setStep(1)} disabled={submitting}>
                      Đổi
                    </Button>
                  </div>

                  <h1 className="mt-6 text-xl font-semibold text-fg">Đăng nhập thí sinh</h1>
                  <p className="mt-0.5 text-xs text-muted">Dùng tài khoản do tổ chức cấp.</p>

                  <label className="mt-5 mb-1.5 block text-xs font-medium text-fg">Tên đăng nhập / MSSV / Email</label>
                  <Input
                    ref={userRef}
                    icon={<User size={15} />}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: student01"
                    disabled={submitting}
                    autoComplete="username"
                  />

                  <label className="mt-4 mb-1.5 block text-xs font-medium text-fg">Mật khẩu</label>
                  <Input
                    icon={<Lock size={15} />}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={submitting}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-subtle hover:text-fg"
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />

                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-fg">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={submitting}
                      className="h-4 w-4 accent-[var(--fg)]"
                    />
                    Ghi nhớ đăng nhập trên máy này
                    <span className="text-[11px] text-subtle">
                      {remember ? "— lần sau mở app không cần đăng nhập lại" : "— chỉ cho lần chạy này"}
                    </span>
                  </label>

                  {error && <ErrorBox text={error} />}

                  <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" loading={submitting} icon={<LogIn size={15} />}>
                    {submitting ? "Đang xác thực…" : "Đăng nhập"}
                  </Button>

                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-[11px] leading-relaxed text-warning">
                    <TriangleAlert size={14} className="mt-px shrink-0" />
                    Khi vào phòng thi, ứng dụng sẽ khoá màn hình, chặn phím tắt hệ thống và giám sát thiết bị, tiến
                    trình trên máy.
                  </div>
                </form>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Stepper({ step, onBack }: { step: Step; onBack: () => void }) {
  const pill = (n: Step, label: string) => {
    const active = step === n;
    const done = step > n;
    return (
      <button
        type="button"
        disabled={!done}
        onClick={onBack}
        className={cx(
          "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium",
          active && "border-accent/40 bg-accent-soft text-accent-fg",
          done && "border-line text-muted hover:bg-surface-3",
          !active && !done && "border-line text-subtle",
        )}
      >
        <span
          className={cx(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
            active ? "bg-accent text-white" : done ? "bg-success-soft text-success" : "bg-surface-3",
          )}
        >
          {done ? <Check size={11} /> : n}
        </span>
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-2">
      {pill(1, "Chọn tổ chức")}
      <span className="h-px w-8 bg-line" />
      {pill(2, "Đăng nhập")}
    </div>
  );
}

function ConnectionRow({ latency }: { latency: number | null | "offline" }) {
  if (latency === "offline")
    return (
      <li className="flex items-center gap-2 text-danger">
        <WifiOff size={14} /> Không kết nối được máy chủ
      </li>
    );
  return (
    <li className="flex items-center gap-2">
      <Wifi size={14} /> Kết nối máy chủ{latency !== null && <Badge className="ml-1">{latency} ms</Badge>}
    </li>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{text}</p>
  );
}
