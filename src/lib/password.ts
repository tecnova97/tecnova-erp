// Central password policy for TecNova ERP.
// Requirements: min. 8 chars, upper- and lowercase, a number and a special char.

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "Mindestens 8 Zeichen", test: (pw) => pw.length >= 8 },
  { id: "upper", label: "Ein Großbuchstabe (A–Z)", test: (pw) => /[A-ZÄÖÜ]/.test(pw) },
  { id: "lower", label: "Ein Kleinbuchstabe (a–z)", test: (pw) => /[a-zäöüß]/.test(pw) },
  { id: "number", label: "Eine Zahl (0–9)", test: (pw) => /[0-9]/.test(pw) },
  {
    id: "special",
    label: "Ein Sonderzeichen (z. B. ! ? @ #)",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

export interface PasswordCheck {
  rule: PasswordRule;
  ok: boolean;
}

export function passwordChecks(pw: string): PasswordCheck[] {
  return PASSWORD_RULES.map((rule) => ({ rule, ok: rule.test(pw) }));
}

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}

/**
 * Returns a precise German error message for the first unmet requirement,
 * or `null` when the password is valid.
 */
export function passwordError(pw: string): string | null {
  if (pw.length < 8) return "Passwort ist zu kurz.";
  if (!/[A-ZÄÖÜ]/.test(pw)) return "Es fehlt ein Großbuchstabe.";
  if (!/[a-zäöüß]/.test(pw)) return "Es fehlt ein Kleinbuchstabe.";
  if (!/[0-9]/.test(pw)) return "Es fehlt eine Zahl.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Es fehlt ein Sonderzeichen.";
  return null;
}

export const PASSWORD_POLICY_ERROR =
  "Das Passwort erfüllt nicht die Sicherheitsanforderungen.";
