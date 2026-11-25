import { translate } from "./i18n";

/** One-shot message for the dashboard after an exam window closed by itself (absent, suspended...). */
const KEY = "foxyexam:notice";

const KNOWN = ["absent", "force_ended", "ended"];

/** Stores only the reason: the text is written when it is shown, in the language selected at that moment. */
export const setNotice = (reason: string) => localStorage.setItem(KEY, KNOWN.includes(reason) ? reason : "ended");

export function takeNotice(): string | null {
  const v = localStorage.getItem(KEY);
  if (v) localStorage.removeItem(KEY);
  return v ? translate(`notice.${v}`) : null;
}
