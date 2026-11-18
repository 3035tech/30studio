"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/field";
import { useSystemFeedback } from "@/components/ui/system-feedback";
import { authClient } from "@/lib/client/auth";
import { AUTH_LIMITS, EMAIL_ROUTES, WORKSPACE_SECTION_IDS, type Locale } from "@/lib/constants";
import { WorkspaceNameSettings } from "@/components/workspace/workspace-name-settings";

export function AccountProfile({ email }: { email: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("accountProfile");
  const tAuth = useTranslations("auth");
  const showFeedback = useSystemFeedback();
  const [busy, setBusy] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "workspace">("account");

  function validatePasswordConfirmation(form: HTMLFormElement | null) {
    if (!form) return;
    const values = new FormData(form);
    const newPassword = String(values.get("newPassword") ?? "");
    const confirmation = String(values.get("confirmPassword") ?? "");
    setPasswordMismatch(Boolean(newPassword && confirmation && newPassword !== confirmation));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    setBusy(true);
    if (newPassword !== confirmation) {
      setPasswordMismatch(true);
      setBusy(false);
      return;
    }
    setPasswordMismatch(false);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error();
      formElement.reset();
      showFeedback("success", t("passwordChanged"));
    } catch {
      showFeedback("error", t("passwordChangeError"));
    } finally {
      setBusy(false);
    }
  }

  async function requestReset() {
    setBusy(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${EMAIL_ROUTES.passwordReset(locale)}`,
      });
      if (result.error) throw new Error();
      showFeedback("success", t("recoverySent"));
    } catch {
      showFeedback("error", tAuth("genericError"));
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
      <div className="accountProfile__tabs" role="tablist" aria-label={t("sectionsLabel")} onKeyDown={(event) => {
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']"));
        const current = tabs.findIndex((tab) => tab === document.activeElement);
        const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click(); }
      }}>
        <button className="accountProfile__tab" id="profile-tab-account" type="button" role="tab" tabIndex={activeTab === "account" ? 0 : -1} aria-selected={activeTab === "account"} aria-controls="profile-panel-account" onClick={() => setActiveTab("account")}>{t("accountTab")}</button>
        <button className="accountProfile__tab" id="profile-tab-workspace" type="button" role="tab" tabIndex={activeTab === "workspace" ? 0 : -1} aria-selected={activeTab === "workspace"} aria-controls="profile-panel-workspace" onClick={() => setActiveTab("workspace")}>{t("workspaceTab")}</button>
      </div>
      <div className="accountProfile__panel" id="profile-panel-account" role="tabpanel" aria-labelledby="profile-tab-account" tabIndex={0} hidden={activeTab !== "account"}>
        {activeTab === "account" ? <>
        <div className="accountProfile__accountGrid">
          <div className="accountProfile__identity">
            <div className="accountProfile__identityLabel"><Mail aria-hidden="true" size={18} /><span>{t("email")}</span></div>
            <strong>{email}</strong>
            <p>{t("emailHelp")}</p>
          </div>
          <form className="entryForm accountProfile__form" onSubmit={(event) => void changePassword(event)}>
            <div className="accountProfile__formHeading"><h2>{t("changePassword")}</h2><p>{t("passwordChangeHelp")}</p></div>
            <PasswordField id="current-password" name="currentPassword" label={t("currentPassword")} autoComplete="current-password" required />
            <PasswordField id="new-password" name="newPassword" label={tAuth("newPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} helpText={tAuth("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters })} onInput={(event) => validatePasswordConfirmation(event.currentTarget.form)} required />
            <PasswordField id="confirm-password" name="confirmPassword" label={tAuth("confirmPassword")} autoComplete="new-password" minLength={AUTH_LIMITS.passwordCharacters} error={passwordMismatch ? tAuth("passwordMismatch") : undefined} onInput={(event) => validatePasswordConfirmation(event.currentTarget.form)} required />
            <div className="accountProfile__actions">
              <Button type="submit" disabled={busy}>{busy ? tAuth("working") : t("changePassword")}</Button>
              <Button appearance="quiet" type="button" disabled={busy} onClick={() => void requestReset()}>{t("sendRecovery")}</Button>
            </div>
          </form>
        </div>
        </> : null}
      </div>
      <div className="accountProfile__panel" id="profile-panel-workspace" role="tabpanel" aria-labelledby="profile-tab-workspace" tabIndex={0} hidden={activeTab !== "workspace"}>
        {activeTab === "workspace" ? <WorkspaceNameSettings /> : null}
      </div>
    </section>
  );
}
