import { useI18n } from "../lib/i18n";
import { cx } from "./ui";

/** Vietnamese / English toggle; the choice is remembered. */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={cx("flex items-center gap-1 text-[11px] text-muted", className)} role="group" aria-label={t("lang.label")}>
      {(["vi", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} className={cx("rounded px-1.5 py-0.5 font-semibold uppercase", lang === l ? "bg-accent-soft text-accent-fg" : "hover:text-fg")}>
          {l}
        </button>
      ))}
    </div>
  );
}
