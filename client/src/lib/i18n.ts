import { useSyncExternalStore } from "react";

export type Lang = "vi" | "en";

const KEY = "foxyexam:lang";
const listeners = new Set<() => void>();

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* default below */
  }
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

let lang: Lang = initial();

export const getLang = () => lang;

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* only a convenience */
  }
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

/** Vietnamese is the source language: a key missing in English falls back to it. Strings may contain {name} placeholders. */
const en: Record<string, string> = {
  "consent.title": "Consent to biometric data processing",
  "consent.subtitle": "You are asked at every login. Policy version {version}.",
  "consent.loading": "Loading the policy…",
  "consent.full": "Open the full text on the web",
  "consent.agree": "I have read and agree that FoxyExam processes my face photo, camera images and device information during the exam under this policy.",
  "consent.accept": "Agree and continue",
  "consent.decline": "Do not agree",
  "consent.declineHint": "If you decline you are signed out and cannot take exams monitored by face checks.",
  "consent.errPolicy": "Could not load the policy. Check your connection and try again.",
  "consent.errSave": "Could not record your consent. Try again.",
  "chat.title": "Chat with the proctor",
  "chat.empty": "Message only when you need technical help. Everything is logged.",
  "chat.placeholder": "Type a message…",
  "chat.you": "You",
  "chat.proctor": "Proctor",
  "chat.send": "Send",
  "chat.close": "Close",
  "lang.label": "Language",
};

const vi: Record<string, string> = {
  "consent.title": "Đồng ý xử lý dữ liệu sinh trắc học",
  "consent.subtitle": "Bạn được hỏi ở mỗi lần đăng nhập. Phiên bản chính sách {version}.",
  "consent.loading": "Đang tải chính sách…",
  "consent.full": "Mở bản đầy đủ trên web",
  "consent.agree": "Tôi đã đọc và đồng ý cho FoxyExam xử lý ảnh khuôn mặt, hình ảnh camera và thông tin thiết bị của tôi trong kỳ thi theo chính sách trên.",
  "consent.accept": "Đồng ý và tiếp tục",
  "consent.decline": "Không đồng ý",
  "consent.declineHint": "Không đồng ý thì bạn sẽ được đăng xuất và không vào được kỳ thi có giám sát bằng khuôn mặt.",
  "consent.errPolicy": "Không tải được chính sách. Kiểm tra mạng rồi thử lại.",
  "consent.errSave": "Không ghi nhận được sự đồng ý. Thử lại.",
  "chat.title": "Trao đổi với giám thị",
  "chat.empty": "Chỉ nhắn khi cần hỗ trợ kỹ thuật. Nội dung được lưu lại.",
  "chat.placeholder": "Nhập tin nhắn…",
  "chat.you": "Bạn",
  "chat.proctor": "Giám thị",
  "chat.send": "Gửi",
  "chat.close": "Đóng",
  "lang.label": "Ngôn ngữ",
};

const DICT: Record<Lang, Record<string, string>> = { vi, en };

export function translate(key: string, vars?: Record<string, string | number>, l: Lang = lang): string {
  const text = DICT[l][key] ?? vi[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, n: string) => String(vars[n] ?? `{${n}}`)) : text;
}

/** `const { t, lang, setLang } = useI18n();` re-renders the component when the language changes. */
export function useI18n() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => lang,
  );
  return { lang: current, setLang, t: (key: string, vars?: Record<string, string | number>) => translate(key, vars, current) };
}
