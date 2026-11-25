import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { cx } from "./ui";

export interface Slide {
  id: string;
  /** Image URL (files in /public are served from the root). */
  src: string;
  /** i18n keys of the caption. */
  titleKey: string;
  descKey: string;
}

/**
 * Auto-advancing picture carousel for the sign-in screen. No library: every slide stays mounted (so all images are
 * loaded up front and nothing flashes on change) and only the current one is visible. Moves on every `intervalMs`,
 * pauses while the pointer or keyboard focus is on it or while the window is hidden, and honours reduced motion
 * (the slide still changes, the fade/scale is dropped).
 */
export function LoginSlideshow({
  slides,
  intervalMs = 5000,
  label,
  className,
}: {
  slides: Slide[];
  intervalMs?: number;
  /** Accessible name of the region (an i18n key). */
  label: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // A fresh timer per slide: picking a dot (or resuming after a pause) always gives the full interval again.
  const paused = hovered || hidden || slides.length < 2;
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), intervalMs);
    return () => window.clearTimeout(timer);
  }, [index, paused, intervalMs, slides.length]);

  const go = useCallback((i: number) => setIndex(i), []);

  if (slides.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t(label)}
      className={cx("flex w-full flex-col", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Picture frame: same footprint as the placeholder it replaces. object-contain keeps the whole picture. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
        {slides.map((s, i) => (
          <img
            key={s.id}
            src={s.src}
            alt={t(s.titleKey)}
            aria-hidden={i !== index}
            draggable={false}
            decoding="async"
            className={cx(
              "absolute inset-0 h-full w-full select-none object-contain transition-[opacity,transform] duration-[350ms] ease-out motion-reduce:transition-none",
              i === index ? "scale-100 opacity-100" : "scale-95 opacity-0 motion-reduce:scale-100",
            )}
          />
        ))}
      </div>

      {/* Caption: stacked the same way so it fades together with the picture. Fixed height: the layout never jumps. */}
      <div className="relative mt-5 h-[3.6rem] text-center" aria-live={paused ? "polite" : "off"}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}`}
            aria-hidden={i !== index}
            className={cx(
              "absolute inset-0 transition-opacity duration-[350ms] ease-out motion-reduce:transition-none",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <p className="text-sm font-semibold text-fg">{t(s.titleKey)}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{t(s.descKey)}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5" role="group">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={t("login.slides.goTo", { n: i + 1 })}
            aria-current={i === index}
            className="group flex h-4 items-center"
          >
            <span className={cx("block h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none", i === index ? "w-4 bg-accent" : "w-1.5 bg-line-strong group-hover:bg-muted")} />
          </button>
        ))}
      </div>
    </div>
  );
}
