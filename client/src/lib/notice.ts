/** One-shot message for the dashboard after an exam window closed by itself (absent, suspended...). */
const KEY = "foxyexam:notice";

export const NOTICE_TEXT: Record<string, string> = {
  absent: "Bạn mất kết nối quá 5 phút nên bị tính vắng thi; bài làm hiện có đã được nộp.",
  force_ended: "Giám thị đã đình chỉ phiên thi của bạn.",
  ended: "Phiên thi đã kết thúc.",
};

export const setNotice = (reason: string) => localStorage.setItem(KEY, NOTICE_TEXT[reason] ?? NOTICE_TEXT.ended);

export function takeNotice(): string | null {
  const v = localStorage.getItem(KEY);
  if (v) localStorage.removeItem(KEY);
  return v;
}
