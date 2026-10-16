import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { acceptBiometric, getBiometricPolicy, type BiometricPolicy } from "../lib/api";
import { Button } from "./ui";
import { useI18n } from "../lib/i18n";
import { LangSwitch } from "./LangSwitch";

/**
 * Agreement to biometric processing. Shown after EVERY login (the server ties the consent to the login token and refuses
 * biometric endpoints without it), and again on first use because the first use is also a login.
 */
export function ConsentGate({ onAccepted, onDeclined }: { onAccepted: () => void; onDeclined: () => void }) {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<BiometricPolicy | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBiometricPolicy()
      .then((r) => setPolicy(r.data))
      .catch(() => setError(t("consent.errPolicy")));
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptBiometric();
      onAccepted();
    } catch {
      setError(t("consent.errSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2">
        <LangSwitch className="order-last ml-auto" />
        <ShieldCheck size={18} className="text-accent" />
        <h1 className="text-lg font-semibold text-fg">{t("consent.title")}</h1>
      </div>
      <p className="mt-1 text-xs text-muted">{t("consent.subtitle", { version: policy?.version ?? "…" })}</p>

      <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed">
        {policy?.sections.map((s, i) => (
          <div key={s.title}>
            <p className="font-semibold text-fg">
              {i + 1}. {s.title}
            </p>
            <p className="text-muted">{s.body}</p>
          </div>
        ))}
        {!policy && !error && <p className="text-muted">{t("consent.loading")}</p>}
      </div>

      {policy && (
        <button type="button" onClick={() => void openUrl(policy.url)} className="mt-2 flex items-center gap-1 self-start text-[11px] text-accent hover:underline">
          <ExternalLink size={11} /> {t("consent.full")}
        </button>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-fg">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
        <span>{t("consent.agree")}</span>
      </label>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!agree || !policy} loading={busy} onClick={() => void accept()}>
          {t("consent.accept")}
        </Button>
        <Button onClick={onDeclined}>{t("consent.decline")}</Button>
      </div>
      <p className="mt-2 text-[11px] text-subtle">{t("consent.declineHint")}</p>
    </div>
  );
}
