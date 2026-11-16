"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/field";
import { authClient } from "@/lib/client/auth";
import { AUTH_LIMITS, EMAIL_ROUTES, WORKSPACE_SECTION_IDS, type Locale } from "@/lib/constants";
import { WorkspaceNameSettings } from "@/components/workspace/workspace-name-settings";

export function AccountProfile({ email }: { email: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("accountProfile");
  const tAuth = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    setBusy(true);
    setMessage("");
    if (newPassword !== confirmation) {
      setMessage(tAuth("passwordMismatch"));
      setIsError(true);
      setBusy(false);
      return;
    }
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error();
      formElement.reset();
      setMessage(t("passwordChanged"));
      setIsError(false);
    } catch {
      setMessage(t("passwordChangeError"));
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function requestReset() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${EMAIL_ROUTES.passwordReset(locale)}`,
      });
      if (result.error) throw new Error();
      setMessage(t("recoverySent"));
      setIsError(false);
    } catch {
      setMessage(tAuth("genericError"));
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="accountProfile" id={WORKSPACE_SECTION_IDS.profile} aria-labelledby="account-profile-title">
      <header className="workspaceHeading">
        <div>
          <h1 id="account-profile-title">{t("title")}</h1>
          <p className="entryDescription">{t("description")}</p>
        </div>
      </header>
      <div className="accountProfile__identity"><span>{t("email")}</span><strong>{email}</strong></div>
      <form className="entryForm accountProfile__form" onSubmit={(event) => void changePassword(event)}>
        <h2>{t("changePassword")}</h2>
        <PasswordField id="current-password" name="currentPassword" label={t("currentPassword")} autoComplete="current-password" required />
        <PasswordField id="new-password" name="newPassword" label={tAuth("newPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} helpText={tAuth("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters })} required />
        <PasswordField id="confirm-password" name="confirmPassword" label={tAuth("confirmPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} required />
        {message ? <p className={isError ? "entryMessage entryMessage--error" : "entryMessage"} role={isError ? "alert" : "status"}>{message}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? tAuth("working") : t("changePassword")}</Button>
        <Button appearance="quiet" type="button" disabled={busy} onClick={() => void requestReset()}>{t("sendRecovery")}</Button>
      </form>
      <WorkspaceNameSettings />
    </section>
  );
}
