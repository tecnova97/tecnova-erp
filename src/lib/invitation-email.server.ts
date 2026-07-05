// Server-only SMTP sender for invitation e-mails.
//
// Runs exclusively inside server functions on the Cloudflare Workers runtime.
// Uses `worker-mailer` (a pure SMTP client built on `cloudflare:sockets`) so it
// works on the edge runtime where Node's `net`/`tls`-based nodemailer does not.
//
// The SMTP password is read from environment variables and never leaves the
// server. This file must never be imported from client components (the
// `.server.ts` suffix keeps it out of the client bundle).
import { WorkerMailer } from "worker-mailer";

export interface InvitationEmailInput {
  email: string;
  vorname: string;
  nachname: string;
  registerUrl: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing SMTP environment variable: ${name}`);
  }
  return value.trim();
}

function buildBody(vorname: string, registerUrl: string): string {
  const anrede = vorname.trim() ? vorname.trim() : "";
  return [
    `Hallo ${anrede}`.trimEnd() + ",",
    "",
    "Sie wurden zu TecNova ERP eingeladen.",
    "",
    "Bitte klicken Sie auf den folgenden Link, um Ihr Konto zu erstellen und ein Passwort festzulegen:",
    "",
    registerUrl,
    "",
    "Wenn Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.",
    "",
    "Viele Grüße",
    "",
    "TecNova",
  ].join("\n");
}

export async function sendInvitationEmailSmtp(input: InvitationEmailInput): Promise<void> {
  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const password = requireEnv("SMTP_PASSWORD");
  const fromEmail = requireEnv("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "TecNova";

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid SMTP_PORT");
  }

  // Port 465 = implicit TLS; anything else (587/25) uses STARTTLS.
  const secure = port === 465;

  await WorkerMailer.send(
    {
      host,
      port,
      secure,
      startTls: !secure,
      credentials: { username: user, password },
      authType: ["plain", "login"],
    },
    {
      from: { name: fromName, email: fromEmail },
      to: { email: input.email },
      subject: "TecNova ERP Einladung",
      text: buildBody(input.vorname, input.registerUrl),
    },
  );
}
