"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { CheckboxField, PasswordField, TextField } from "@/components/ui/field";
import { Link } from "@/lib/i18n/routing";
import { AUTH_LIMITS, AUTH_QUERY_PARAMETERS, EMAIL_ROUTES, INVITATION_ID_MAX_CHARACTERS, INVITATION_PAGE_ROUTE, type Locale } from "@/lib/constants";
import { authClient } from "@/lib/client/auth";

type AuthMode = "sign_in" | "sign_up" | "request_reset";

export function InvitationAcceptance({ invitationId }: { invitationId: string | null }) {
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");
  const tInvitation = useTranslations("invitationAcceptance");
  const tNavigation = useTranslations("navigation");
  const locale = useLocale() as Locale;
  const nextLocale: Locale = locale === "pt" ? "en" : "pt";
  const { data: session, isPending: sessionPending, refetch: refreshSession } = authClient.useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [rememberMe, setRememberMe] = useState(true);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const acceptanceStarted = useRef(false);

  useEffect(() => {
    if (!invitationId || !session?.user?.emailVerified || acceptanceStarted.current) return;
    acceptanceStarted.current = true;

    void authClient.organization.acceptInvitation({ invitationId }).then(async (result) => {
      if (result.error) throw new Error();
      setAccepted(true);
      await refreshSession();
    }).catch(() => {
      acceptanceStarted.current = false;
      setAcceptError(true);
    });
  }, [attempt, invitationId, refreshSession, session?.user?.emailVerified]);

  async function handleAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResetLinkSent(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (authMode === "request_reset") {
        if (!invitationId || invitationId.length > INVITATION_ID_MAX_CHARACTERS) throw new Error();
        const redirectTo = new URL(EMAIL_ROUTES.passwordReset(locale), window.location.origin);
        redirectTo.searchParams.set(AUTH_QUERY_PARAMETERS.invitationId, invitationId);
        const result = await authClient.requestPasswordReset({ email, redirectTo: redirectTo.toString() });
        if (result.error) throw new Error();
        setMessage(tAuth("resetLinkSent"));
        setResetLinkSent(true);
      } else if (authMode === "sign_up") {
        const name = String(form.get("name") ?? "").trim();
        const result = await authClient.signUp.email({ name, email, password, callbackURL: getInvitationCallbackUrl(locale, invitationId) });
        if (result.error) throw new Error();
        await refreshSession();
        setMessage(tWorkspace("emailVerificationRequired"));
      } else {
        const result = await authClient.signIn.email({ email, password, rememberMe, callbackURL: getInvitationCallbackUrl(locale, invitationId) });
        if (result.error) throw new Error();
        await refreshSession();
      }
    } catch {
      setMessage(tAuth("genericError"));
    } finally {
      setBusy(false);
    }
  }

  if (sessionPending) return <main className="entryLoading" aria-live="polite">{tAuth("loading")}</main>;

  return (
    <main className="entryShell">
      <section className="entryPanel" aria-labelledby="invitation-heading">
        <BrandLogo priority />
        <p className="entryKicker">{tInvitation("description")}</p>
        <h1 id="invitation-heading">{authMode === "request_reset" ? tAuth("requestPasswordResetTitle") : tInvitation("title")}</h1>
        {!invitationId || invitationId.length > INVITATION_ID_MAX_CHARACTERS ? <p className="entryMessage entryMessage--error" role="alert">{tInvitation("missing")}</p> : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && accepted ? (
          <div className="invitationAcceptance__result" role="status">
            <p>{tInvitation("accepted")}</p>
            <Button asChild><Link href="/">{tInvitation("openWorkspace")}</Link></Button>
          </div>
        ) : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && session?.user && !accepted && !session.user.emailVerified ? (
          <p className="entryMessage" role="status">{tInvitation("verification")}</p>
        ) : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && session?.user?.emailVerified && !accepted && !acceptError ? (
          <p className="entryLoading invitationAcceptance__status" aria-live="polite">{tInvitation("accepting")}</p>
        ) : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && session?.user && !accepted ? (
          <Button appearance="quiet" type="button" disabled={busy} onClick={async () => { await authClient.signOut(); await refreshSession(); setAcceptError(false); acceptanceStarted.current = false; }}>
            {tInvitation("useInvitedAccount")}
          </Button>
        ) : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && acceptError ? (
          <div className="entryMessage invitationAcceptance__result" role="alert">
            <p>{tInvitation("acceptError")}</p>
            <Button appearance="quiet" type="button" onClick={() => { setAcceptError(false); acceptanceStarted.current = false; setAttempt((current) => current + 1); }}>{tInvitation("retry")}</Button>
          </div>
        ) : null}
        {invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS && !session?.user ? (
          <>
            <p className="entryDescription">{authMode === "request_reset" ? tAuth("requestPasswordResetDescription") : tAuth("description")}</p>
            <form className="entryForm" onSubmit={handleAuthentication}>
              {authMode === "sign_up" ? (
                <TextField id="invitation-name" name="name" label={tAuth("name")} autoComplete="name" maxLength={AUTH_LIMITS.nameCharacters} required />
              ) : null}
              <TextField id="invitation-email" name="email" label={tAuth("email")} type="email" autoComplete="email" maxLength={AUTH_LIMITS.emailCharacters} required disabled={busy && authMode === "request_reset"} onChange={() => { if (authMode === "request_reset") { setResetLinkSent(false); setMessage(""); } }} />
              {authMode !== "request_reset" ? <PasswordField id="invitation-password" name="password" label={tAuth("password")} autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={AUTH_LIMITS.passwordCharacters} helpText={authMode === "sign_up" ? tAuth("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters }) : undefined} required /> : null}
              {authMode === "sign_in" ? <div className="entryLoginOptions">
                <CheckboxField id="invitation-remember-me" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} label={tAuth("rememberMe")} className="entryLoginOptions__remember" />
                <a className="entryLoginOptions__recovery" href="#invitation-password-reset" onClick={(event) => { event.preventDefault(); setAuthMode("request_reset"); setResetLinkSent(false); setMessage(""); }}>{tAuth("forgotPassword")}</a>
              </div> : null}
              {message ? <p className="entryMessage" role="status">{message}</p> : null}
              <Button type="submit" disabled={busy}>{busy ? tAuth("working") : authMode === "sign_up" ? tAuth("signUp") : authMode === "request_reset" ? tAuth(resetLinkSent ? "sendAnotherResetLink" : "sendResetLink") : tAuth("signIn")}</Button>
            </form>
            <Button appearance="quiet" className="entrySwitch" type="button" onClick={() => { setAuthMode(authMode === "sign_in" ? "sign_up" : "sign_in"); setResetLinkSent(false); setMessage(""); }}>
              {authMode !== "sign_in" ? tAuth("switchToSignIn") : tAuth("switchToSignUp")}
            </Button>
          </>
        ) : null}
        <Link
          className="localeLink"
          href={invitationId && invitationId.length <= INVITATION_ID_MAX_CHARACTERS
            ? `${INVITATION_PAGE_ROUTE}?${AUTH_QUERY_PARAMETERS.invitationId}=${encodeURIComponent(invitationId)}`
            : INVITATION_PAGE_ROUTE}
          locale={nextLocale}
          aria-label={tNavigation("switchLanguage")}
        >
          {locale === "pt" ? tNavigation("english") : tNavigation("portuguese")}
        </Link>
      </section>
    </main>
  );
}

function getInvitationCallbackUrl(locale: Locale, invitationId: string | null) {
  if (!invitationId || invitationId.length > INVITATION_ID_MAX_CHARACTERS) return `/${locale}`;
  return `/${locale}${INVITATION_PAGE_ROUTE}?${AUTH_QUERY_PARAMETERS.invitationId}=${encodeURIComponent(invitationId)}`;
}
