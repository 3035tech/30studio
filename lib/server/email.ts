import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { AUTH_QUERY_PARAMETERS, BETTER_AUTH_ENV, EMAIL_DELIVERY_LIMITS, EMAIL_ENV, EMAIL_ROUTES, PRODUCT } from "@/lib/constants";
import portugueseMessages from "@/messages/pt.json";

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
  const copy = portugueseMessages.email.verification;
  const safeName = escapeHtml(data.user.name);
  const safeUrl = escapeHtml(data.url);
  const greeting = interpolateEmail(copy.greeting, { name: data.user.name });

  await sendTransactionalEmail({
    recipient: data.user.email,
    subject: copy.subject,
    text: `${greeting}\n\n${copy.body}\n${data.url}\n\n${copy.ignore}`,
    html: `<p>${interpolateEmail(copy.greeting, { name: safeName })}</p><p>${copy.body}</p><p><a href="${safeUrl}">${copy.action}</a></p><p>${copy.ignore}</p>`,
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
  const safeOrganization = escapeHtml(data.organization.name);
  const safeInviter = escapeHtml(data.inviter.user.name);
  const safeUrl = escapeHtml(invitationUrl);
  const greeting = interpolateEmail(copy.greeting, { name: data.inviter.user.name });
  const body = interpolateEmail(copy.body, { organization: data.organization.name });

  await sendTransactionalEmail({
    recipient: data.email,
    subject: interpolateEmail(copy.subject, { organization: data.organization.name }),
    text: `${greeting}\n\n${body}\n${invitationUrl}\n\n${copy.expiry}\n${copy.ignore}`,
    html: `<p>${interpolateEmail(copy.greeting, { name: safeInviter })}</p><p>${interpolateEmail(copy.body, { organization: safeOrganization })}</p><p><a href="${safeUrl}">${copy.action}</a></p><p>${copy.expiry}</p><p>${copy.ignore}</p>`,
  });
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
