/**
 * URL gốc của FoxyExam Core API — xem `server/public/openapi.json` /
 * `http://127.0.0.1:8000/docs`.
 *
 * Production: đặt `VITE_API_BASE_URL=https://<domain>/api/v1` khi build
 * (vd client/.env.production). Dev: mặc định server `php artisan serve`.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api/v1";
