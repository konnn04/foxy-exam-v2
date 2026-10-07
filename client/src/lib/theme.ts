import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const KEY = "foxyexam:theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "system") return media.matches ? "dark" : "light";
  return pref;
}

function apply(pref: ThemePref) {
  document.documentElement.classList.toggle("dark", resolve(pref) === "dark");
}

/**
 * Gọi 1 lần lúc khởi động mỗi cửa sổ. Các cửa sổ dùng chung `localStorage`,
 * nên đổi theme ở 1 cửa sổ sẽ bắn sự kiện `storage` sang các cửa sổ còn lại.
 */
export function initTheme() {
  apply(getThemePref());
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) apply(getThemePref());
  });
  media.addEventListener("change", () => apply(getThemePref()));
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  apply(pref);
  window.dispatchEvent(new CustomEvent("foxy-theme", { detail: pref }));
}

/** Theme hiện tại (đã quy ra sáng/tối) + giá trị người dùng chọn. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const [resolved, setResolved] = useState(() => resolve(getThemePref()));

  useEffect(() => {
    const sync = () => {
      const p = getThemePref();
      setPref(p);
      setResolved(resolve(p));
    };
    window.addEventListener("foxy-theme", sync);
    window.addEventListener("storage", sync);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("foxy-theme", sync);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  return {
    pref,
    resolved,
    setPref: setThemePref,
    toggle: () => setThemePref(resolve(getThemePref()) === "dark" ? "light" : "dark"),
  };
}
