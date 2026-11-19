import { useSyncExternalStore } from "react";

// Import modular locale JSON files organized by window / domain
import viCommon from "../locales/vi/common.json";
import enCommon from "../locales/en/common.json";
import viAuth from "../locales/vi/auth.json";
import enAuth from "../locales/en/auth.json";
import viUpdate from "../locales/vi/update.json";
import enUpdate from "../locales/en/update.json";
import viMain from "../locales/vi/main.json";
import enMain from "../locales/en/main.json";
import viExam from "../locales/vi/exam.json";
import enExam from "../locales/en/exam.json";

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

/** Merged dictionaries from window-specific JSON files */
const vi: Record<string, string> = {
  ...viCommon,
  ...viAuth,
  ...viUpdate,
  ...viMain,
  ...viExam,
};

const en: Record<string, string> = {
  ...enCommon,
  ...enAuth,
  ...enUpdate,
  ...enMain,
  ...enExam,
};

const DICT: Record<Lang, Record<string, string>> = { vi, en };

export interface PolicySection {
  title: string;
  body: string;
}

export const BIOMETRIC_SECTIONS_VI: PolicySection[] = [
  {
    title: "Dữ liệu được xử lý",
    body: "Ảnh khuôn mặt tham chiếu bạn đăng ký, hình ảnh từ camera và camera phụ trong lúc thi, ảnh chụp màn hình và đặc trưng khuôn mặt (vector số) dùng để so khớp. Hệ thống cũng ghi lại thông tin thiết bị: hệ điều hành, tên máy, mức dùng CPU/RAM, địa chỉ IP và mã nhận dạng thiết bị đã băm.",
  },
  {
    title: "Mục đích",
    body: "Chỉ để xác minh danh tính thí sinh và phát hiện gian lận trong kỳ thi bạn tham gia. Không dùng để quảng cáo, không bán hay chia sẻ cho bên thứ ba ngoài đơn vị tổ chức thi và nhà cung cấp hạ tầng lưu trữ của họ.",
  },
  {
    title: "Ai được xem",
    body: "Giảng viên, giám thị và quản trị viên của tổ chức tổ chức kỳ thi, theo quy chế thi của tổ chức đó.",
  },
  {
    title: "Thời gian lưu giữ",
    body: "Bản ghi và ảnh minh chứng được lưu theo thời hạn mà tổ chức cấu hình, sau đó bị xoá. Ảnh khuôn mặt tham chiếu được giữ đến khi bạn hoặc tổ chức yêu cầu xoá.",
  },
  {
    title: "Quyền của bạn",
    body: "Bạn có thể xem dữ liệu của mình, yêu cầu thay ảnh khuôn mặt (giảng viên sẽ duyệt) hoặc yêu cầu xoá bằng cách liên hệ đơn vị tổ chức thi. Nếu không đồng ý, bạn không thể tham gia kỳ thi có giám sát bằng khuôn mặt.",
  },
  {
    title: "Xác nhận mỗi lần đăng nhập",
    body: "Do tính chất nhạy cảm của dữ liệu sinh trắc học, bạn được hỏi lại sự đồng ý ở mỗi lần đăng nhập. Mỗi lần đồng ý đều được ghi lại cùng thời điểm, địa chỉ IP và phiên bản chính sách.",
  },
];

export const BIOMETRIC_SECTIONS_EN: PolicySection[] = [
  {
    title: "Processed Data",
    body: "Your registered reference face photo, video streams from the primary webcam and secondary mobile camera during exams, screen captures, and facial feature embeddings (numerical vectors) used for verification. The system also logs device telemetries: operating system, computer name, CPU/RAM usage, IP address, and hashed machine identifier.",
  },
  {
    title: "Purpose of Processing",
    body: "Strictly to verify candidate identity and prevent academic dishonesty during your enrolled exams. Never used for advertising, nor sold or shared with any third party outside the exam-hosting institution and their authorized secure infrastructure providers.",
  },
  {
    title: "Access & Authorized Viewers",
    body: "Instructors, invigilators, and authorized institution administrators in accordance with the institution’s official academic examination regulations.",
  },
  {
    title: "Retention Period",
    body: "Audit logs and evidence media are retained according to the retention window configured by the institution, after which they are permanently purged. Your reference face portrait is stored until you or the institution requests deletion.",
  },
  {
    title: "Your Rights",
    body: "You may inspect your stored data, request an update to your reference face photo (subject to instructor review), or request deletion by contacting your institution. If consent is declined, you cannot participate in exams requiring facial proctoring.",
  },
  {
    title: "Consent Required at Each Login",
    body: "Given the sensitive nature of biometric data, your explicit consent is requested at each login session. Each recorded consent includes the precise timestamp, IP address, and policy version.",
  },
];

export function translate(key: string, vars?: Record<string, string | number>, l: Lang = lang): string {
  const text = DICT[l]?.[key] ?? vi[key] ?? key;
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
  return {
    lang: current,
    setLang,
    t: (key: string, vars?: Record<string, string | number>) => translate(key, vars, current),
  };
}
