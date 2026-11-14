"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SelectField, TextField } from "@/components/ui/field";
import { brandListResponseSchema, type BrandListItem } from "@/lib/validation/brands";
import { AUTH_LIMITS, BRAND_LIMITS, type Locale } from "@/lib/constants";
import { Link } from "@/lib/i18n/routing";

type AuthMode = "sign_in" | "sign_up";
type BrandState = { organizationId: string | null; items: BrandListItem[]; pending: boolean; error: boolean };

const INITIAL_BRANDS: BrandState = { organizationId: null, items: [], pending: false, error: false };
const SLUG_PATTERN = /[^a-z0-9]+/g;
const EDGE_DASHES_PATTERN = /^-+|-+$/g;

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(SLUG_PATTERN, "-").replace(EDGE_DASHES_PATTERN, "");
}

export function WorkspaceEntry() {
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");
  const tPortfolio = useTranslations("portfolio");
  const tNavigation = useTranslations("navigation");
  const locale = useLocale() as Locale;
  const nextLocale: Locale = locale === "pt" ? "en" : "pt";
  const { data: session, isPending: sessionPending, refetch: refreshSession } = authClient.useSession();
  const { data: organizations, isPending: organizationsPending } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [brands, setBrands] = useState<BrandState>(INITIAL_BRANDS);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");

  const organizationOptions = useMemo(() => organizations ?? [], [organizations]);
  const isAuthenticated = Boolean(session?.user);
  const activeOrganizationId = activeOrganization?.id ?? null;
  const currentBrands = brands.organizationId === activeOrganizationId
    ? brands
    : { organizationId: activeOrganizationId, items: [], pending: Boolean(activeOrganizationId), error: false };

  useEffect(() => {
    if (!session?.user?.id || !activeOrganizationId) return;

    const controller = new AbortController();
    fetch("/api/brands", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const parsed = brandListResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error();
        setBrands({ organizationId: activeOrganizationId, items: parsed.data.data, pending: false, error: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBrands({ organizationId: activeOrganizationId, items: [], pending: false, error: true });
      });

    return () => controller.abort();
  }, [activeOrganizationId, session?.user?.id]);

  useEffect(() => {
    const activeId = session?.session.activeOrganizationId;
    if (session?.user && !activeId && organizationOptions.length > 0) {
      void authClient.organization.setActive({ organizationId: organizationOptions[0].id }).then(() => refreshSession());
    }
  }, [organizationOptions, refreshSession, session?.session.activeOrganizationId, session?.user]);

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
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message);
        await refreshSession();
        setMessage(tWorkspace("emailVerificationRequired"));
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
        await refreshSession();
        setMessage("");
      }
    } catch {
      setMessage(tAuth("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const name = organizationName.trim();
    const slug = makeSlug(organizationSlug);

    try {
      const result = await authClient.organization.create({ name, slug, keepCurrentActiveOrganization: false });
      if (result.error || !result.data) throw new Error();
      await authClient.organization.setActive({ organizationId: result.data.id });
      await refreshSession();
      setOrganizationName("");
    } catch {
      setMessage(tWorkspace("organizationError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleOrganizationChange(organizationId: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error();
      await refreshSession();
    } catch {
      setMessage(tWorkspace("organizationError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganization?.id) return;
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("brandName") ?? "").trim(),
      description: String(form.get("brandDescription") ?? "").trim(),
      industry: String(form.get("brandIndustry") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      await response.json();
      formElement.reset();
      const refreshed = await fetch("/api/brands", { credentials: "same-origin", cache: "no-store" });
      const parsed = brandListResponseSchema.safeParse(await refreshed.json());
      if (!refreshed.ok || !parsed.success) throw new Error();
      setBrands({ organizationId: activeOrganizationId, items: parsed.data.data, pending: false, error: false });
      setMessage(tWorkspace("brandAdded"));
    } catch {
      setMessage(tWorkspace("brandError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await authClient.signOut();
    await refreshSession();
    setBusy(false);
  }

  if (sessionPending) return <main className="entryLoading" aria-live="polite">{tAuth("loading")}</main>;

  if (!isAuthenticated) {
    return (
      <main className="entryShell">
        <section className="entryPanel" aria-labelledby="auth-heading">
          <BrandLogo priority />
          <p className="entryKicker">{tAuth("description")}</p>
          <h1 id="auth-heading">{authMode === "sign_up" ? tAuth("signUpTitle") : tAuth("signInTitle")}</h1>
          <p className="entryDescription">{tWorkspace("description")}</p>
          <form className="entryForm" onSubmit={handleAuthentication}>
            {authMode === "sign_up" ? (
              <TextField id="name" name="name" label={tAuth("name")} autoComplete="name" maxLength={AUTH_LIMITS.nameCharacters} required />
            ) : null}
            <TextField id="email" name="email" label={tAuth("email")} type="email" autoComplete="email" required />
            <TextField id="password" name="password" label={tAuth("password")} type="password" autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={AUTH_LIMITS.passwordCharacters} required />
            {message ? <p className="entryMessage" role="status">{message}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? tAuth("working") : authMode === "sign_up" ? tAuth("signUp") : tAuth("signIn")}</Button>
          </form>
          <Button appearance="quiet" className="entrySwitch" type="button" onClick={() => { setAuthMode(authMode === "sign_in" ? "sign_up" : "sign_in"); setMessage(""); }}>
            {authMode === "sign_up" ? tAuth("switchToSignIn") : tAuth("switchToSignUp")}
          </Button>
          <Link className="localeLink" href="/" locale={nextLocale} aria-label={tNavigation("switchLanguage")}>{locale === "pt" ? "EN" : "PT"}</Link>
        </section>
      </main>
    );
  }

  if (organizationsPending) return <main className="entryLoading" aria-live="polite">{tAuth("loading")}</main>;

  if (organizationOptions.length === 0) {
    return (
      <main className="entryShell">
        <section className="entryPanel" aria-labelledby="organization-heading">
          <BrandLogo priority />
          <p className="entryKicker">{tAuth("description")}</p>
          <h1 id="organization-heading">{tWorkspace("createTitle")}</h1>
          <p className="entryDescription">{tWorkspace("description")}</p>
          <form className="entryForm" onSubmit={handleCreateOrganization}>
            <TextField id="organizationName" name="organizationName" label={tWorkspace("organizationName")} value={organizationName} onChange={(event) => {
              const name = event.target.value;
              setOrganizationName(name);
              setOrganizationSlug((current) => !current || current === makeSlug(organizationName) ? makeSlug(name) : current);
            }} maxLength={AUTH_LIMITS.nameCharacters} required />
            <TextField id="organizationSlug" name="organizationSlug" label={tWorkspace("organizationSlug")} value={organizationSlug} onChange={(event) => setOrganizationSlug(makeSlug(event.target.value))} maxLength={AUTH_LIMITS.slugCharacters} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
            {message ? <p className="entryMessage" role="alert">{message}</p> : null}
            <Button type="submit" disabled={busy || !organizationSlug}>{busy ? tAuth("working") : tWorkspace("createOrganization")}</Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="workspaceShell">
      <header className="workspaceHeader">
        <Link className="workspaceBrand" href="#workspace" aria-label={tWorkspace("title")}><BrandLogo /></Link>
        <div className="workspaceHeaderActions">
          <SelectField id="organization" label={tWorkspace("switchOrganization")} value={activeOrganization?.id ?? ""} onChange={(event) => void handleOrganizationChange(event.target.value)} disabled={busy}>
            <option value="" disabled>{tWorkspace("switchOrganization")}</option>
            {organizationOptions.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </SelectField>
          <span className="workspaceEmail">{session?.user.email}</span>
          <Link className="localeLink" href="/" locale={nextLocale} aria-label={tNavigation("switchLanguage")}>{locale === "pt" ? "EN" : "PT"}</Link>
          <Button appearance="quiet" type="button" onClick={() => void handleSignOut()} disabled={busy}>{tWorkspace("signOut")}</Button>
        </div>
      </header>
      <section className="workspaceContent" id="workspace">
        <div className="workspaceHeading">
          <div>
            <p className="entryKicker">{activeOrganization?.name ?? tWorkspace("title")}</p>
            <h1>{tPortfolio("title")}</h1>
            <p className="entryDescription">{tPortfolio("subtitle")}</p>
          </div>
          <p className="brandCount">{tWorkspace("brandCount", { count: currentBrands.items.length })}</p>
        </div>
        {message ? <p className="entryMessage" role="status">{message}</p> : null}
        {currentBrands.error ? <p className="entryMessage entryMessage--error" role="alert">{tWorkspace("loadError")}</p> : null}
        {currentBrands.pending ? <p className="workspaceEmpty" aria-live="polite">{tWorkspace("loadingBrands")}</p> : null}
        {!currentBrands.pending && !currentBrands.error && currentBrands.items.length === 0 ? <p className="workspaceEmpty">{tWorkspace("emptyBrands")}</p> : null}
        {currentBrands.items.length > 0 ? (
          <ul className="brandCollection">
            {currentBrands.items.map((brand) => (
              <li className="brandCollection__item" key={brand.id}>
                <span className="brandCollection__mark" aria-hidden="true">{brand.name.slice(0, BRAND_LIMITS.markCharacters).toLocaleUpperCase()}</span>
                <span className="brandCollection__identity"><strong>{brand.name}</strong><small>{brand.description || brand.industry || ""}</small></span>
                <span className="brandCollection__social">{brand.socialProfiles.length === 0 ? tPortfolio("noChannels") : brand.socialProfiles.map((profile) => profile.displayName).join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <section className="brandCreate" aria-labelledby="brand-create-title">
          <div className="brandCreate__heading"><h2 id="brand-create-title">{tPortfolio("createTitle")}</h2><p>{tPortfolio("createDescription")}</p></div>
          <form className="brandCreate__form" onSubmit={handleCreateBrand}>
            <TextField id="brandName" name="brandName" label={tWorkspace("brandName")} maxLength={BRAND_LIMITS.nameCharacters} required />
            <TextField id="brandDescription" name="brandDescription" label={tWorkspace("brandDescription")} maxLength={BRAND_LIMITS.descriptionCharacters} />
            <TextField id="brandIndustry" name="brandIndustry" label={tWorkspace("brandIndustry")} maxLength={BRAND_LIMITS.industryCharacters} />
            <Button type="submit" disabled={busy || !activeOrganization?.id}>{busy ? tAuth("working") : tWorkspace("addBrand")}</Button>
          </form>
        </section>
      </section>
    </main>
  );
}
