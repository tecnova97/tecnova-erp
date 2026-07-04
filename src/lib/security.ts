import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Trusted device ("Dieses Gerät 30 Tage merken")
// When trusted, MFA is not requested again for 30 days on this device.
// ---------------------------------------------------------------------------
const TRUST_KEY = "tecnova.trusted_device";
const DEVICE_ID_KEY = "tecnova.device_id";
const TRUST_DAYS = 30;

/** Stable per-browser device identifier (created lazily). */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "Gerät";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  return `${browser} · ${os}`;
}

export function trustDevice(): void {
  const expires = Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(TRUST_KEY, String(expires));
}

export function untrustDevice(): void {
  localStorage.removeItem(TRUST_KEY);
}

export function isDeviceTrusted(): boolean {
  const raw = localStorage.getItem(TRUST_KEY);
  if (!raw) return false;
  const expires = Number(raw);
  if (!Number.isFinite(expires) || expires < Date.now()) {
    localStorage.removeItem(TRUST_KEY);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Best-effort public IP (used for the security log). Cached per session.
// ---------------------------------------------------------------------------
let ipPromise: Promise<string | null> | null = null;

export function getClientIp(): Promise<string | null> {
  if (ipPromise) return ipPromise;
  ipPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const data = (await res.json()) as { ip?: string };
      return data.ip ?? null;
    } catch {
      return null;
    }
  })();
  return ipPromise;
}

// ---------------------------------------------------------------------------
// Failed-login protection + security log
// ---------------------------------------------------------------------------
export type LoginAction = "login_failed" | "login_success" | "login_locked";

export interface LoginLockState {
  locked: boolean;
  failed_count: number;
  seconds_remaining: number;
}

export const MAX_LOGIN_ATTEMPTS = 5;

export async function recordLoginAttempt(email: string, action: LoginAction): Promise<void> {
  try {
    const ip = await getClientIp();
    await supabase.rpc("record_login_attempt", {
      _email: email,
      _action: action,
      _ip: ip ?? undefined,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch {
    // Logging must never block the login flow.
  }
}

export async function checkLoginLock(email: string): Promise<LoginLockState> {
  try {
    const { data, error } = await supabase.rpc("check_login_lock", { _email: email });
    if (error || !data) return { locked: false, failed_count: 0, seconds_remaining: 0 };
    return data as unknown as LoginLockState;
  } catch {
    return { locked: false, failed_count: 0, seconds_remaining: 0 };
  }
}

export function lockMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Zu viele fehlgeschlagene Anmeldeversuche. Die Anmeldung ist für ca. ${minutes} Minute${
    minutes === 1 ? "" : "n"
  } gesperrt.`;
}

export interface SecurityEvent {
  id: string;
  email: string | null;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function fetchSecurityEvents(limit = 50): Promise<SecurityEvent[]> {
  const { data, error } = await supabase
    .from("security_events")
    .select("id,email,user_id,action,ip_address,user_agent,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SecurityEvent[];
}

// ---------------------------------------------------------------------------
// Generic security-event logging (MFA, trusted devices, forced logout, …)
// Reuses the record_login_attempt RPC which writes to security_events + activity_log.
// ---------------------------------------------------------------------------
export async function logSecurityEvent(action: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? "";
    const ip = await getClientIp();
    await supabase.rpc("record_login_attempt", {
      _email: email,
      _action: action,
      _ip: ip ?? undefined,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch {
    // Logging must never block the flow.
  }
}

// ---------------------------------------------------------------------------
// Trusted devices persisted in the database (view / revoke across devices).
// ---------------------------------------------------------------------------
export interface TrustedDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  label: string | null;
  user_agent: string | null;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
}

/** Records / refreshes this browser as a trusted device for the given user. */
export async function registerTrustedDevice(userId: string): Promise<void> {
  const expires = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    await supabase.from("trusted_devices").upsert(
      {
        user_id: userId,
        device_id: getDeviceId(),
        label: deviceLabel(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        last_seen_at: new Date().toISOString(),
        expires_at: expires,
      } as never,
      { onConflict: "user_id,device_id" },
    );
    await logSecurityEvent("trusted_device_added");
  } catch {
    // best-effort
  }
}

export const trustedDevicesQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["trusted_devices", userId ?? "all"],
    queryFn: async (): Promise<TrustedDeviceRow[]> => {
      let q = supabase
        .from("trusted_devices")
        .select("id,user_id,device_id,label,user_agent,last_seen_at,expires_at,created_at")
        .order("last_seen_at", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TrustedDeviceRow[];
    },
  });

export async function removeTrustedDevice(id: string, thisDeviceId?: string): Promise<void> {
  const { error } = await supabase.from("trusted_devices").delete().eq("id", id);
  if (error) throw error;
  // If we removed the current browser, also drop the local trust flag.
  if (thisDeviceId && thisDeviceId === getDeviceId()) untrustDevice();
  await logSecurityEvent("trusted_device_removed");
}

