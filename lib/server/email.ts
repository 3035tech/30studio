import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { AUTH_QUERY_PARAMETERS, BRAND_ASSETS, BETTER_AUTH_ENV, EMAIL_DELIVERY_LIMITS, EMAIL_ENV, EMAIL_ROUTES, PRODUCT } from "@/lib/constants";
import englishMessages from "@/messages/en.json";
import portugueseMessages from "@/messages/pt.json";
import type { Locale } from "@/lib/constants";

const emailTransportEnvironmentSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65_535),
  secure: z.enum(["true", "false"]).optional(),
  requireTls: z.enum(["true", "false"]).optional(),
  user: z.string().trim().optional(),
  password: z.string().optional(),
  from: z.string().trim().email(),
}).superRefine((config, context) => {
  if (Boolean(config.user) !== Boolean(config.password)) {
    context.addIssue({ code: "custom", message: "SMTP credentials must be provided together." });
  }

  const secure = config.secure === "true" || (config.secure === undefined && config.port === 465);
  const requireTls = config.requireTls !== "false";
  if (process.env.NODE_ENV === "production" && !secure && !requireTls) {
    context.addIssue({ code: "custom", message: "Production email transport must use TLS." });
  }
});

type EmailTransportConfig = z.infer<typeof emailTransportEnvironmentSchema>;

export type TransactionalEmail = {
  recipient: string;
  subject: string;
  text: string;
  html: string;
};

type BrandedEmailTemplate = {
  locale: Locale;
  greeting: string;
  body: string;
  action: string;
  href: string;
  expiry?: string;
  footer: string;
};

export class EmailDeliveryError extends Error {
  constructor() {
    super("Transactional email delivery failed.");
    this.name = "EmailDeliveryError";
  }
}

function getEmailTransportConfig() {
  const hasAnySetting = Object.values(EMAIL_ENV).some((environmentKey) => Boolean(process.env[environmentKey]));
  if (!hasAnySetting) return null;

  const result = emailTransportEnvironmentSchema.safeParse({
    host: process.env[EMAIL_ENV.host],
    port: process.env[EMAIL_ENV.port],
    secure: process.env[EMAIL_ENV.secure],
    requireTls: process.env[EMAIL_ENV.requireTls],
    user: process.env[EMAIL_ENV.user],
    password: process.env[EMAIL_ENV.password],
    from: process.env[EMAIL_ENV.from],
  });

  return result.success ? result.data : null;
}

export function isEmailDeliveryConfigured() {
  return getEmailTransportConfig() !== null;
}

export async function sendTransactionalEmail(email: TransactionalEmail) {
  const config = getEmailTransportConfig();
  if (!config) throw new EmailDeliveryError();

  const transport = nodemailer.createTransport(createTransportOptions(config));
  try {
    await transport.sendMail({
      from: { name: PRODUCT.name, address: config.from },
      to: email.recipient,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {
    throw new EmailDeliveryError();
  } finally {
    transport.close();
  }
}

export async function sendVerificationEmail(data: { user: { name: string; email: string }; url: string }) {
  const locale = getEmailUrlLocale(data.url);
  const copy = locale === "en" ? englishMessages.email.verification : portugueseMessages.email.verification;
  const greeting = interpolateEmail(copy.greeting, { name: data.user.name });

  await sendTransactionalEmail({
    recipient: data.user.email,
    subject: copy.subject,
    text: `${greeting}\n\n${copy.body}\n${data.url}\n\n${copy.ignore}`,
    html: renderBrandedEmail({ locale, greeting, body: copy.body, action: copy.action, href: data.url, footer: copy.ignore }),
  });
}

export async function sendInvitationEmail(data: {
  id: string;
  email: string;
  role: string;
  organization: { name: string };
  inviter: { user: { name: string } };
}) {
  const copy = portugueseMessages.email.invitation;
  const authUrl = process.env[BETTER_AUTH_ENV.url];
  if (!authUrl) throw new EmailDeliveryError();
  const url = new URL(EMAIL_ROUTES.invitationAccept, authUrl);
  url.searchParams.set(AUTH_QUERY_PARAMETERS.invitationId, data.id);
  const invitationUrl = url.toString();
  const greeting = interpolateEmail(copy.greeting, { name: data.inviter.user.name });
  const body = interpolateEmail(copy.body, { organization: data.organization.name });

  await sendTransactionalEmail({
    recipient: data.email,
    subject: interpolateEmail(copy.subject, { organization: data.organization.name }),
    text: `${greeting}\n\n${body}\n${invitationUrl}\n\n${copy.expiry}\n${copy.ignore}`,
    html: renderBrandedEmail({ locale: "pt", greeting, body, action: copy.action, href: invitationUrl, expiry: copy.expiry, footer: copy.ignore }),
  });
}

export async function sendPasswordResetEmail(data: { user: { name: string; email: string }; url: string }) {
  const locale = getEmailUrlLocale(data.url);
  const copy = locale === "en" ? englishMessages.email.passwordReset : portugueseMessages.email.passwordReset;
  const greeting = interpolateEmail(copy.greeting, { name: data.user.name });

  await sendTransactionalEmail({
    recipient: data.user.email,
    subject: copy.subject,
    text: `${greeting}\n\n${copy.body}\n${data.url}\n\n${copy.expiry}\n${copy.ignore}`,
    html: renderBrandedEmail({ locale, greeting, body: copy.body, action: copy.action, href: data.url, expiry: copy.expiry, footer: copy.ignore }),
  });
}

function renderBrandedEmail(template: BrandedEmailTemplate) {
  const safeGreeting = escapeHtml(template.greeting);
  const safeBody = escapeHtml(template.body);
  const safeAction = escapeHtml(template.action);
  const safeHref = escapeHtml(template.href);
  const safeExpiry = template.expiry ? escapeHtml(template.expiry) : "";
  const safeFooter = escapeHtml(template.footer);
  const brandBaseUrl = process.env[BETTER_AUTH_ENV.url] ?? template.href;
  let logoMarkup = `<span style="display:inline-block;color:#334155;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;letter-spacing:-1px;line-height:1">${escapeHtml(PRODUCT.name)}</span>`;
  try {
    const logoUrl = escapeHtml(new URL(BRAND_ASSETS.logoOnLight, brandBaseUrl).toString());
    logoMarkup = `<img src="${logoUrl}" width="148" alt="${escapeHtml(PRODUCT.name)}" style="display:block;width:148px;max-width:100%;height:auto;border:0">`;
  } catch { /* Keep the text wordmark if a public origin is not configured. */ }

  return `<!doctype html><html lang="${template.locale === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#F7F8FC;color:#334155;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safeBody}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#F7F8FC"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px"><tr><td style="padding:8px 24px 22px">${logoMarkup}</td></tr><tr><td style="padding:32px 30px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px"><h1 style="margin:0 0 18px;color:#334155;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.35">${safeGreeting}</h1><p style="margin:0 0 22px;color:#334155;font-size:16px;line-height:1.65">${safeBody}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px"><tr><td align="center" bgcolor="#6A00FF" style="border-radius:7px"><a href="${safeHref}" style="display:inline-block;padding:13px 20px;border:1px solid #6A00FF;border-radius:7px;color:#FFFFFF;font-size:15px;font-weight:700;line-height:1.3;text-decoration:none">${safeAction}</a></td></tr></table>${safeExpiry ? `<p style="margin:0 0 16px;color:#64748B;font-size:14px;line-height:1.55">${safeExpiry}</p>` : ""}<p style="margin:0;color:#64748B;font-size:14px;line-height:1.55">${safeFooter}</p></td></tr><tr><td style="padding:20px 24px 0;color:#64748B;font-size:12px;line-height:1.5;text-align:center">${escapeHtml(PRODUCT.name)} · ${escapeHtml(PRODUCT.groupName)}</td></tr></table></td></tr></table></body></html>`;
}

function getEmailUrlLocale(emailUrl: string): Locale {
  try {
    let candidate = new URL(emailUrl);
    for (let depth = 0; depth < 2; depth += 1) {
      if (candidate.pathname.startsWith("/en/")) return "en";
      if (candidate.pathname.startsWith("/pt/")) return "pt";
      const callbackUrl = candidate.searchParams.get("callbackURL");
      if (!callbackUrl) break;
      candidate = new URL(callbackUrl, candidate.origin);
    }
  } catch { /* Use the product's default locale for malformed callback URLs. */ }
  return "pt";
}

function interpolateEmail(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, key: string) => values[key] ?? placeholder);
}

function createTransportOptions(config: EmailTransportConfig) {
  const secure = config.secure === "true" || (config.secure === undefined && config.port === 465);
  const requireTLS = config.requireTls !== "false";

  return {
    host: config.host,
    port: config.port,
    secure,
    requireTLS: !secure && requireTLS,
    connectionTimeout: EMAIL_DELIVERY_LIMITS.connectionTimeoutMilliseconds,
    greetingTimeout: EMAIL_DELIVERY_LIMITS.greetingTimeoutMilliseconds,
    socketTimeout: EMAIL_DELIVERY_LIMITS.socketTimeoutMilliseconds,
    ...(config.user && config.password ? { auth: { user: config.user, pass: config.password } } : {}),
    tls: { rejectUnauthorized: true },
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}
