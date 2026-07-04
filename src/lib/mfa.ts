import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security";

// ---------------------------------------------------------------------------
// Multi-Factor Authentication (client-side, via Supabase Auth).
// Fully static: TOTP (Authenticator app) works without any e-mail server.
// Email-OTP is prepared for when e-mail delivery is configured.
// ---------------------------------------------------------------------------

export interface MfaFactor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
}

export async function listFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all ?? []) as MfaFactor[];
}

export interface EnrollResult {
  factorId: string;
  qrSvg: string;
  secret: string;
  uri: string;
}

export async function enrollTotp(friendlyName: string): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: friendlyName || `Authenticator ${new Date().toLocaleDateString("de-DE")}`,
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) throw error;
  await logSecurityEvent("mfa_setup");
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  await logSecurityEvent("mfa_removed");
}

/** True when the user has at least one verified factor. */
export async function hasVerifiedMfa(): Promise<boolean> {
  const factors = await listFactors();
  return factors.some((f) => f.status === "verified");
}
