import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

type RouteScrollFilters = Record<string, unknown>;

type RouteScrollContext = {
  pathname: string;
  search: unknown;
  searchString: string;
  filters: RouteScrollFilters;
  key: string;
};

type RouteScrollPayload = RouteScrollContext & {
  scrollY: number;
  clickedItemId?: string;
  savedAt: number;
};

type UseRouteScrollRestorationOptions<TFilters extends RouteScrollFilters> = {
  ready?: boolean;
  filters?: TFilters;
  restoreFilters?: (filters: TFilters) => void;
};

const PREFIX = "route-scroll-restoration:v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 8;

function normalizeForKey(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeForKey);
  const obj = value as Record<string, unknown>;
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const v = obj[key];
      if (v !== undefined) acc[key] = normalizeForKey(v);
      return acc;
    }, {});
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForKey(value));
}

function storageSafe(value: string) {
  return encodeURIComponent(value).slice(0, 1800);
}

function storageKey(pathname: string, search: unknown, filters: RouteScrollFilters) {
  return `${PREFIX}:state:${pathname}:search=${storageSafe(stableStringify(search))}:filters=${storageSafe(stableStringify(filters))}`;
}

function contextKey(pathname: string) {
  return `${PREFIX}:context:${pathname}`;
}

function lastKey(pathname: string) {
  return `${PREFIX}:last:${pathname}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors */
  }
}

function highlightRestoredItem(id?: string) {
  if (!id || typeof document === "undefined") return;
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/"/g, "\\\"");
  const el = document.querySelector<HTMLElement>(`[data-route-scroll-id="${escaped}"]`);
  if (!el) return;
  el.classList.add("route-scroll-highlight");
  window.setTimeout(() => el.classList.remove("route-scroll-highlight"), 1800);
}

export function saveRouteScrollState(clickedItemId?: string) {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  const fallbackContext: RouteScrollContext = {
    pathname,
    search: window.location.search,
    searchString: window.location.search,
    filters: {},
    key: storageKey(pathname, window.location.search, {}),
  };
  const context = readJson<RouteScrollContext>(contextKey(pathname)) ?? fallbackContext;
  const payload: RouteScrollPayload = {
    ...context,
    scrollY: window.scrollY,
    clickedItemId,
    savedAt: Date.now(),
  };
  writeJson(payload.key, payload);
  try {
    window.sessionStorage.setItem(lastKey(pathname), payload.key);
  } catch {
    /* ignore storage errors */
  }
}

export function useRouteScrollRestoration<TFilters extends RouteScrollFilters = RouteScrollFilters>({
  ready = true,
  filters,
  restoreFilters,
}: UseRouteScrollRestorationOptions<TFilters> = {}) {
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const search = location.search ?? {};
  const effectiveFilters = filters ?? ({} as TFilters);
  const searchSignature = useMemo(() => stableStringify(search), [search]);
  const filterSignature = useMemo(() => stableStringify(effectiveFilters), [effectiveFilters]);
  const key = useMemo(
    () => storageKey(pathname, search, effectiveFilters),
    [pathname, searchSignature, filterSignature],
  );
  const restoreFiltersRef = useRef(restoreFilters);
  const restoredKeyRef = useRef<string | null>(null);
  const [pending, setPending] = useState<RouteScrollPayload | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    restoreFiltersRef.current = restoreFilters;
  }, [restoreFilters]);

  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    const context: RouteScrollContext = {
      pathname,
      search,
      searchString: typeof window === "undefined" ? "" : window.location.search,
      filters: effectiveFilters,
      key,
    };
    writeJson(contextKey(pathname), context);
  }, [pathname, searchSignature, filterSignature, key]);

  const saveScrollState = useCallback((clickedItemId?: string) => {
    saveRouteScrollState(clickedItemId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedKey = window.sessionStorage.getItem(lastKey(pathname));
    if (!savedKey || savedKey === restoredKeyRef.current) return;
    const payload = readJson<RouteScrollPayload>(savedKey);
    if (!payload || payload.pathname !== pathname || Date.now() - payload.savedAt > MAX_AGE_MS) return;

    restoredKeyRef.current = savedKey;
    setPending(payload);
    if (restoreFiltersRef.current && stableStringify(payload.filters) !== filterSignature) {
      restoreFiltersRef.current(payload.filters as TFilters);
    }
  }, [pathname]);

  useEffect(() => {
    if (!pending || !ready || typeof window === "undefined") return;
    if (stableStringify(pending.filters) !== filterSignature) return;

    let cancelled = false;
    let attempts = 0;
    const targetY = pending.scrollY;

    const restore = () => {
      if (cancelled) return;
      window.scrollTo(0, targetY);
      if (attempts === 0) {
        setHighlightedItemId(pending.clickedItemId ?? null);
        highlightRestoredItem(pending.clickedItemId);
      }
      attempts += 1;
      const isClose = Math.abs(window.scrollY - targetY) <= 2;
      if (!isClose && attempts < 60) {
        window.setTimeout(restore, attempts < 4 ? 16 : 90);
        return;
      }
      window.setTimeout(() => setHighlightedItemId(null), 1800);
      setPending(null);
    };

    requestAnimationFrame(() => requestAnimationFrame(restore));
    return () => {
      cancelled = true;
    };
  }, [pending, ready, filterSignature]);

  return { saveScrollState, highlightedItemId };
}