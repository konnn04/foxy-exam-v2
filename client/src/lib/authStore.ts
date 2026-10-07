export interface AuthOrganization {
  id: number;
  name: string;
  code: string;
}

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  organization: AuthOrganization | null;
}

export interface AuthData {
  token: string;
  user: AuthUser;
  /** true = "Ghi nhớ đăng nhập": giữ lại cho các lần mở app sau. */
  remember: boolean;
}

const AUTH_KEY = "foxyexam:auth";
const LAST_ORG_KEY = "foxyexam:recent-orgs";

/**
 * Mọi cửa sổ dùng chung 1 WebView profile nên cùng đọc được `localStorage`.
 * Phiên "đăng nhập 1 lần" (remember = false) vẫn nằm ở đây trong lúc app chạy,
 * rồi bị xoá ở lần khởi động kế tiếp (xem `purgeNonRemembered`).
 */
export function saveAuth(auth: AuthData): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function getAuth(): AuthData | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthData;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

/** Gọi 1 lần lúc app khởi động: bỏ phiên của lần đăng nhập "chỉ 1 lần". */
export function purgeNonRemembered(): void {
  const auth = getAuth();
  if (auth && !auth.remember) clearAuth();
}

export interface RecentOrg {
  code: string;
  /** Tên hiển thị — không có với tổ chức riêng tư (nhập mã tay). */
  name?: string;
  private: boolean;
}

const RECENT_MAX = 4;

/** Tổ chức dùng gần đây, mới nhất đứng đầu. */
export function getRecentOrgs(): RecentOrg[] {
  try {
    const raw = localStorage.getItem(LAST_ORG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentOrg[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentOrg(org: RecentOrg): void {
  const list = [org, ...getRecentOrgs().filter((o) => o.code !== org.code)].slice(0, RECENT_MAX);
  localStorage.setItem(LAST_ORG_KEY, JSON.stringify(list));
}
