"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { TextField } from "@/components/ui/field";
import { Link } from "@/lib/i18n/routing";
import { AUTH_LIMITS, AUTH_QUERY_PARAMETERS, INVITATION_ID_MAX_CHARACTERS, INVITATION_PAGE_ROUTE, type Locale } from "@/lib/constants";
import { authClient } from "@/lib/client/auth";

type AuthMode = "sign_in" | "sign_up";

export function InvitationAcceptance({ invitationId }: { invitationId: string | null }) {
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");
  const tInvitation = useTranslations("invitationAcceptance");
  const tNavigation = useTranslations("navigation");
  const locale = useLocale() as Locale;
  const nextLocale: Locale = locale === "pt" ? "en" : "pt";
  const { data: session, isPending: sessionPending, refetch: refreshSession } = authClient.useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
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
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (authMode === "sign_up") {
        const name = String(form.get("name") ?? "").trim();
        const result = await authClient.signUp.email({ name, email, password, callbackURL: getInvitationCallbackUrl(locale, invitationId) });
        if (result.error) throw new Error();
        await refreshSession();
        setMessage(tWorkspace("emailVerificationRequired"));
      } else {
        const result = await authClient.signIn.email({ email, password, callbackURL: getInvitationCallbackUrl(locale, invitationId) });
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
        <h1 id="invitation-heading">{tInvitation("title")}</h1>
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
            <p className="entryDescription">{tAuth("description")}</p>
            <form className="entryForm" onSubmit={handleAuthentication}>
              {authMode === "sign_up" ? (
                <TextField id="invitation-name" name="name" label={tAuth("name")} autoComplete="name" maxLength={AUTH_LIMITS.nameCharacters} required />
              ) : null}
              <TextField id="invitation-email" name="email" label={tAuth("email")} type="email" autoComplete="email" required />
              <TextField id="invitation-password" name="password" label={tAuth("password")} type="password" autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={AUTH_LIMITS.passwordCharacters} required />
              {message ? <p className="entryMessage" role="status">{message}</p> : null}
              <Button type="submit" disabled={busy}>{busy ? tAuth("working") : authMode === "sign_up" ? tAuth("signUp") : tAuth("signIn")}</Button>
            </form>
            <Button appearance="quiet" className="entrySwitch" type="button" onClick={() => { setAuthMode(authMode === "sign_in" ? "sign_up" : "sign_in"); setMessage(""); }}>
              {authMode === "sign_up" ? tAuth("switchToSignIn") : tAuth("switchToSignUp")}
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
