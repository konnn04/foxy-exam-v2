import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { acceptBiometric, getBiometricPolicy, type BiometricPolicy } from "../lib/api";
import { Button } from "./ui";

/**
 * Agreement to biometric processing. Shown after EVERY login (the server ties the consent to the login token and refuses
 * biometric endpoints without it), and again on first use because the first use is also a login.
 */
export function ConsentGate({ onAccepted, onDeclined }: { onAccepted: () => void; onDeclined: () => void }) {
  const [policy, setPolicy] = useState<BiometricPolicy | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBiometricPolicy()
      .then((r) => setPolicy(r.data))
      .catch(() => setError("Không tải được chính sách. Kiểm tra mạng rồi thử lại."));
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptBiometric();
      onAccepted();
    } catch {
      setError("Không ghi nhận được sự đồng ý. Thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-accent" />
        <h1 className="text-lg font-semibold text-fg">Đồng ý xử lý dữ liệu sinh trắc học</h1>
      </div>
      <p className="mt-1 text-xs text-muted">Bạn được hỏi ở mỗi lần đăng nhập. Phiên bản chính sách {policy?.version ?? "…"}.</p>

      <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed">
        {policy?.sections.map((s, i) => (
          <div key={s.title}>
            <p className="font-semibold text-fg">
              {i + 1}. {s.title}
            </p>
            <p className="text-muted">{s.body}</p>
          </div>
        ))}
        {!policy && !error && <p className="text-muted">Đang tải chính sách…</p>}
      </div>

      {policy && (
        <button type="button" onClick={() => void openUrl(policy.url)} className="mt-2 flex items-center gap-1 self-start text-[11px] text-accent hover:underline">
          <ExternalLink size={11} /> Mở bản đầy đủ trên web
        </button>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-fg">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
        <span>Tôi đã đọc và đồng ý cho FoxyExam xử lý ảnh khuôn mặt, hình ảnh camera và thông tin thiết bị của tôi trong kỳ thi theo chính sách trên.</span>
      </label>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!agree || !policy} loading={busy} onClick={() => void accept()}>
          Đồng ý và tiếp tục
        </Button>
        <Button onClick={onDeclined}>Không đồng ý</Button>
      </div>
      <p className="mt-2 text-[11px] text-subtle">Không đồng ý thì bạn sẽ được đăng xuất và không vào được kỳ thi có giám sát bằng khuôn mặt.</p>
    </div>
  );
}
