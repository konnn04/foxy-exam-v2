/**
 * URL gốc của Exam Guard Core API.
 *
 * Mặc định trỏ về máy chủ chính thức: https://foxyexam.konnn04.dev/api/v1
 * Có thể ghi đè bằng biến môi trường `VITE_API_BASE_URL` khi build hoặc dev.
 */
export const DEFAULT_API_BASE_URL = "https://foxyexam.konnn04.dev/api/v1";

export const API_BASE_URL: string =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, "")) ||
  DEFAULT_API_BASE_URL;
