"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { PasswordField } from "@/components/ui/field";
import { authClient } from "@/lib/client/auth";
import { AUTH_LIMITS, AUTH_QUERY_PARAMETERS, INVITATION_PAGE_ROUTE } from "@/lib/constants";
import { Link } from "@/lib/i18n/routing";

export function PasswordResetForm({ token, invalid, invitationId }: { token: string | null; invalid: boolean; invitationId: string | null }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(invalid || !token ? t("passwordResetInvalid") : "");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      setMessage(t("passwordMismatch"));
      setSuccess(false);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) throw new Error();
      setSuccess(true);
      setMessage(t("resetPasswordSuccess"));
      formElement.reset();
    } catch {
      setSuccess(false);
      setMessage(t("resetPasswordError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="entryShell">
      <section className="entryPanel" aria-labelledby="reset-password-title">
        <BrandLogo priority />
        <h1 id="reset-password-title">{t("resetPasswordTitle")}</h1>
        <p className="entryDescription">{t("resetPasswordDescription")}</p>
        {!success && token && !invalid ? (
          <form className="entryForm" onSubmit={(event) => void submit(event)}>
            <PasswordField id="reset-new-password" name="newPassword" label={t("newPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} helpText={t("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters })} required />
            <PasswordField id="reset-confirm-password" name="confirmPassword" label={t("confirmPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} required />
            {message ? <p className="entryMessage entryMessage--error" role="alert">{message}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? t("working") : t("resetPasswordTitle")}</Button>
          </form>
        ) : message ? <p className={success ? "entryMessage" : "entryMessage entryMessage--error"} role={success ? "status" : "alert"}>{message}</p> : null}
        <Link className="localeLink" href={invitationId ? `${INVITATION_PAGE_ROUTE}?${AUTH_QUERY_PARAMETERS.invitationId}=${encodeURIComponent(invitationId)}` : "/"}>{invitationId ? t("returnToInvitation") : t("signIn")}</Link>
      </section>
    </main>
  );
}
