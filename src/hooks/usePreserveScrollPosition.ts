import { useEffect, useRef } from "react";

/**
 * Preserve the window scroll position across data reloads, mutations and
 * dialog open/close cycles so the page does not jump back to the top.
 *
 * The current scroll position is continuously stored in sessionStorage under a
 * stable per-page key. Once `ready` is true (i.e. the list content has been
 * rendered) the stored position is restored exactly once per mount, after paint,
 * so async data loads never reset the scroll to the top.
 *
 * Usage:
 *   usePreserveScrollPosition("auftraege", !isLoading);
 */
export function usePreserveScrollPosition(key: string, ready: boolean = true) {
  const storageKey = `scroll.${key}`;
  const restored = useRef(false);

  // Continuously remember where the user is.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = () => {
      try {
        window.sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* ignore storage errors */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [storageKey]);

  // Restore once the content is present, exactly once per mount.
  useEffect(() => {
    if (!ready || restored.current || typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    if (raw == null) {
      restored.current = true;
      return;
    }
    const y = Number.parseInt(raw, 10);
    if (Number.isNaN(y)) {
      restored.current = true;
      return;
    }
    restored.current = true;
    // Restore after paint so the freshly rendered list has its full height.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }, [ready, storageKey]);
}
