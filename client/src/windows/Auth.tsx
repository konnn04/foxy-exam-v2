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
import { ConsentGate } from "../components/ConsentGate";
import { LangSwitch } from "../components/LangSwitch";
import { Badge, BrandMark, Button, CodeTile, Empty, Input, cx } from "../components/ui";
import { LoginSlideshow, type Slide } from "../components/LoginSlideshow";
import { AppWindow, onWindowShown, switchWindow } from "../lib/windowNav";
import { setAuthenticated } from "../lib/auth";
import { ApiError, getBiometricStatus, getHealth, getMe, getPublicOrganizations, login, type PublicOrganization } from "../lib/api";
import { clearAuth, getAuth, getRecentOrgs, pushRecentOrg, saveAuth, type RecentOrg } from "../lib/authStore";
import { useI18n } from "../lib/i18n";

/** Pictures live in /public; captions come from the dictionaries (login.slides.<n>.title / .desc). */
const LOGIN_SLIDES: Slide[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `slide-${n}`,
  src: `/slide-${n}.png`,
  titleKey: `login.slides.${n}.title`,
  descKey: `login.slides.${n}.desc`,
}));

type Phase = "form" | "resuming" | "resume-error" | "consent";
type Step = 1 | 2;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/**
 * Cửa sổ đăng nhập — tải sẵn (ẩn) từ lúc mở app, chỉ hiện sau cửa sổ cập nhật.
 * Mỗi lần được hiện: có phiên lưu sẵn -> kiểm tra token rồi vào thẳng dashboard;
 * chưa có / hết hạn -> form 2 bước: chọn tổ chức -> tài khoản & mật khẩu.
 */
export default function Auth() {
  const { t } = useI18n();
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

  async function enter() {
    await setAuthenticated(true);
    await switchWindow(AppWindow.Main);
  }

  /** Biometric consent is per login: false until the student ticks it for this token. */
  async function consentGiven(): Promise<boolean> {
    try {
      return (await getBiometricStatus()).data.accepted;
    } catch {
      return false;
    }
  }

  const getOrgTypeLabel = (type: string) => {
    switch (type) {
      case "UNIVERSITY":
        return t("auth.orgType.university");
      case "COLLEGE":
        return t("auth.orgType.college");
      case "HIGH_SCHOOL":
        return t("auth.orgType.highSchool");
      case "TRAINING_CENTER":
        return t("auth.orgType.trainingCenter");
      case "ENTERPRISE":
        return t("auth.orgType.enterprise");
      default:
        return type;
    }
  };

  function declineConsent() {
    clearAuth();
    void setAuthenticated(false);
    setStep(1);
    setPhase("form");
    setError(t("auth.errConsentRequired"));
  }

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
      if (!(await consentGiven())) {
        setPhase("consent");
        return;
      }
      await enter();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
        await setAuthenticated(false);
        setPhase("form");
        setStep(2);
        setError(t("auth.resumeExpired"));
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
      setError(t("auth.errSelectOrg"));
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
      setError(t("auth.errEmptyCreds"));
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
      if (!(await consentGiven())) {
        setPhase("consent");
        return;
      }
      await enter();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.errLoginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <TitleBar
        title={step === 2 && org?.name ? t("auth.windowTitleWithOrg", { org: org.name }) : t("auth.windowTitle")}
        maximizable={false}
      />

      <div className="flex min-h-0 flex-1">
        {/* Cột trái: thương hiệu + thông tin kết nối */}
        <aside className="flex w-[44%] flex-col border-r border-line bg-surface-2 p-7">
          <BrandMark />
          <div className="flex flex-1 items-center">
            <LoginSlideshow slides={LOGIN_SLIDES} label="login.slides.label" />
          </div>
          {step === 1 ? (
            <div>
              <p className="text-sm font-semibold text-fg">{t("auth.asideTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("auth.asideDesc")}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2">
                <ShieldCheck size={14} /> {t("auth.deviceBound")}
              </li>
              <ConnectionRow latency={latency} t={t} />
            </ul>
          )}
          <p className="mt-4 font-mono text-[10px] text-subtle">
            {version && `v${version} · `}Windows x64 · Tauri 2
          </p>
          <LangSwitch className="mt-2" />
        </aside>

        {/* Cột phải */}
        <main className="flex min-w-0 flex-1 flex-col px-10 py-7">
          {phase === "resuming" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted">
              <RefreshCw size={18} className="animate-spin" />
              {t("auth.resuming")}
            </div>
          )}

          {phase === "consent" && <ConsentGate onAccepted={() => void enter()} onDeclined={declineConsent} />}

          {phase === "resume-error" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <WifiOff size={22} className="text-danger" />
              <div>
                <p className="text-sm font-semibold text-fg">{t("auth.resumeErrorTitle")}</p>
                <p className="mt-1 text-xs text-muted">{t("auth.resumeErrorDesc")}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={switchAccount}>{t("auth.switchAccount")}</Button>
                <Button variant="primary" icon={<RefreshCw size={13} />} onClick={() => void resume()}>
                  {t("auth.retry")}
                </Button>
              </div>
            </div>
          )}

          {phase === "form" && (
            <>
              <Stepper step={step} onBack={() => setStep(1)} t={t} />

              {step === 1 ? (
                <div className="mt-5 flex min-h-0 flex-1 flex-col">
                  <h1 className="text-xl font-semibold text-fg">{t("auth.step1Title")}</h1>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("auth.step1Desc")}
                  </p>

                  <Input
                    ref={searchRef}
                    className="mt-4"
                    icon={<Search size={15} />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("auth.searchPlaceholder")}
                    trailing={<kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-subtle">Ctrl K</kbd>}
                  />

                  {recent.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{t("auth.recent")}</p>
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
                        {t("auth.publicOrgs")}{orgsState === "ok" && ` · ${orgs.length}`}
                      </span>
                      <button
                        type="button"
                        onClick={loadOrgs}
                        className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
                      >
                        <RefreshCw size={11} className={orgsState === "loading" ? "animate-spin" : ""} /> {t("auth.refresh")}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {orgsState === "error" ? (
                        <Empty icon={<WifiOff size={18} />} text={t("auth.errorLoadOrgs")} />
                      ) : orgsState === "loading" && orgs.length === 0 ? (
                        <Empty text={t("auth.loadingOrgs")} />
                      ) : filtered.length === 0 ? (
                        <Empty text={t("auth.emptyFiltered")} />
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
                                  {getOrgTypeLabel(o.type)} · {o.slug}
                                </p>
                              </div>
                              {active ? (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-accent-fg">
                                  <Check size={13} /> {t("auth.selected")}
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
                    {t("auth.orPrivate")}
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
                    placeholder={t("auth.privatePlaceholder")}
                    className="font-mono uppercase"
                  />

                  {error && <ErrorBox text={error} />}

                  <Button variant="primary" size="lg" className="mt-3 w-full" onClick={goStep2}>
                    {t("auth.continue")} <ArrowRight size={15} />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="mt-5 flex flex-1 flex-col">
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                    <CodeTile code={org?.code ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{org?.name ?? org?.code}</p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {org?.private ? t("auth.privateBadge") : ""}
                        {org?.code}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setStep(1)} disabled={submitting}>
                      {t("auth.changeOrg")}
                    </Button>
                  </div>

                  <h1 className="mt-6 text-xl font-semibold text-fg">{t("auth.step2Title")}</h1>
                  <p className="mt-0.5 text-xs text-muted">{t("auth.step2Desc")}</p>

                  <label className="mt-5 mb-1.5 block text-xs font-medium text-fg">{t("auth.usernameLabel")}</label>
                  <Input
                    ref={userRef}
                    icon={<User size={15} />}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("auth.usernamePlaceholder")}
                    disabled={submitting}
                    autoComplete="username"
                  />

                  <label className="mt-4 mb-1.5 block text-xs font-medium text-fg">{t("auth.passwordLabel")}</label>
                  <Input
                    icon={<Lock size={15} />}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    disabled={submitting}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-subtle hover:text-fg"
                        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
                    {t("auth.rememberMe")}
                    <span className="text-[11px] text-subtle">
                      {remember ? t("auth.rememberHintTrue") : t("auth.rememberHintFalse")}
                    </span>
                  </label>

                  {error && <ErrorBox text={error} />}

                  <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" loading={submitting} icon={<LogIn size={15} />}>
                    {submitting ? t("auth.submitting") : t("auth.signIn")}
                  </Button>

                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-[11px] leading-relaxed text-warning">
                    <TriangleAlert size={14} className="mt-px shrink-0" />
                    {t("auth.proctorNotice")}
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

function Stepper({ step, onBack, t }: { step: Step; onBack: () => void; t: (k: string) => string }) {
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
      {pill(1, t("auth.step1"))}
      <span className="h-px w-8 bg-line" />
      {pill(2, t("auth.step2"))}
    </div>
  );
}

function ConnectionRow({ latency, t }: { latency: number | null | "offline"; t: (k: string) => string }) {
  if (latency === "offline")
    return (
      <li className="flex items-center gap-2 text-danger">
        <WifiOff size={14} /> {t("auth.serverOffline")}
      </li>
    );
  return (
    <li className="flex items-center gap-2">
      <Wifi size={14} /> {t("auth.serverConnected")}{latency !== null && <Badge className="ml-1">{latency} ms</Badge>}
    </li>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{text}</p>
  );
}
