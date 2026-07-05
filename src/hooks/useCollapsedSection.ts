import { useCallback, useEffect, useState } from "react";

/**
 * Persist the collapsed/expanded state of a section per user via localStorage.
 * Default state is expanded (collapsed = false). Use a stable key per page and
 * status, e.g. `dashboard.status.<statusId>` or `auftraege.status.<statusId>`.
 */
export function useCollapsedSection(key: string) {
  const storageKey = `collapse.${key}`;

  const read = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [storageKey]);

  const [collapsed, setCollapsed] = useState<boolean>(read);

  // Keep state in sync when the key changes (e.g. reused component).
  useEffect(() => {
    setCollapsed(read());
  }, [read]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem(storageKey, "1");
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
