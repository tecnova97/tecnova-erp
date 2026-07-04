import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "disponent" | "worker";

export interface Profile {
  id: string;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  avatar_url: string | null;
  disabled?: boolean;
  force_password_change?: boolean;
  last_login_at?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: Set<string>;
  loading: boolean;
  isStaff: boolean;
  /** Permission check. Owners always pass (never lock the owner out). */
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_RANK: Record<AppRole, number> = { owner: 3, disponent: 2, worker: 1 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.rpc("current_permissions"),
    ]);
    const profileRow = (prof as Profile) ?? null;
    // Disabled accounts are signed out immediately.
    if (profileRow?.disabled) {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
      setPermissions(new Set());
      return;
    }
    setProfile(profileRow);
    const list = (roles ?? []).map((r) => r.role as AppRole);
    list.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
    setRole(list[0] ?? "worker");
    setPermissions(
      new Set(((perms as { permission_key: string }[] | null) ?? []).map((p) => p.permission_key)),
    );
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadUserData(sess.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setPermissions(new Set());
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isOwner = role === "owner";
  const can = (permission: string) => isOwner || permissions.has(permission);
  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    permissions,
    loading,
    isStaff: role === "owner" || role === "disponent",
    can,
    canAny: (perms: string[]) => perms.some((p) => can(p)),
    refresh: async () => {
      if (session?.user) await loadUserData(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
