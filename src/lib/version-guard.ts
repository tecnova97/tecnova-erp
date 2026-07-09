import { toast } from "sonner";

/**
 * Post-deployment stale-asset recovery.
 *
 * After a new deploy, browsers may still reference old hashed JS/CSS chunks
 * (e.g. /assets/index-xxxx.js) that now return 404. This installs a global
 * handler that detects failed chunk/asset loads and performs ONE automatic
 * hard reload to pull the fresh index + assets. A sessionStorage flag prevents
 * infinite reload loops; if a reload was already attempted, we show a friendly
 * "Neue Version verfügbar" message instead.
 */

const RELOAD_FLAG = "tecnova:chunk-reload";

function isChunkMessage(message: string): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module|ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk/i.test(
    message,
  );
}

function isAssetUrl(url: string): boolean {
  return /\/assets\/.+\.(?:js|mjs|css)(?:\?|$)/i.test(url);
}

let recovering = false;

function maybeRecover() {
  if (recovering) return;
  recovering = true;

  let alreadyReloaded = false;
  try {
    alreadyReloaded = Boolean(sessionStorage.getItem(RELOAD_FLAG));
  } catch {
    alreadyReloaded = false;
  }

  if (alreadyReloaded) {
    // A reload already happened this session and it still failed — don't loop.
    toast.error("Neue Version verfügbar. Bitte Seite neu laden.", {
      duration: Infinity,
      action: {
        label: "Neu laden",
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage unavailable — without loop protection, show the prompt.
    toast.error("Neue Version verfügbar. Bitte Seite neu laden.", {
      duration: Infinity,
      action: { label: "Neu laden", onClick: () => window.location.reload() },
    });
    return;
  }

  window.location.reload();
}

let installed = false;

/** Install the global stale-asset recovery handler (client-only, idempotent). */
export function installVersionGuard() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  // The app booted successfully — clear any prior recovery flag once stable so
  // a future deploy can recover again.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* ignore */
    }
  }, 6000);

  // Resource load errors (script/link 404) surface on the capture phase only.
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag !== "SCRIPT" && tag !== "LINK") return;
      const url =
        (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || "";
      if (isAssetUrl(url)) maybeRecover();
    },
    true,
  );

  // Dynamic import() failures (route/code-split chunks) reject asynchronously.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string" ? reason : (reason?.message as string | undefined) ?? "";
    if (isChunkMessage(message)) maybeRecover();
  });
}
