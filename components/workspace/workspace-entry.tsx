"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { TextField } from "@/components/ui/field";
import { brandListResponseSchema, type BrandListItem } from "@/lib/validation/brands";
import { AUTH_LIMITS, BRAND_LIMITS, WORKSPACE_SECTION_IDS, type Locale } from "@/lib/constants";
import { Link } from "@/lib/i18n/routing";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { TeamManagement } from "@/components/workspace/team-management";
import { BrandKitEditor } from "@/components/brand/brand-kit-editor";
import { EditorialCalendar } from "@/components/calendar/editorial-calendar";

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
  const [isChangingOrganization, setIsChangingOrganization] = useState(false);
  const [message, setMessage] = useState("");
  const [brands, setBrands] = useState<BrandState>(INITIAL_BRANDS);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [activeBrandKitId, setActiveBrandKitId] = useState<string | null>(null);
  const [archivingBrandId, setArchivingBrandId] = useState<string | null>(null);
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
    setIsChangingOrganization(true);
    setMessage("");
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error();
      await refreshSession();
    } catch {
      setMessage(tWorkspace("organizationError"));
    } finally {
      setIsChangingOrganization(false);
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
      formElement.reset();
      await reloadBrands(activeOrganization.id);
      setMessage(tWorkspace("brandAdded"));
    } catch {
      setMessage(tWorkspace("brandError"));
    } finally {
      setBusy(false);
    }
  }

  async function reloadBrands(organizationId: string) {
    const response = await fetch("/api/brands", { credentials: "same-origin", cache: "no-store" });
    const parsed = brandListResponseSchema.safeParse(await response.json());
    if (!response.ok || !parsed.success) throw new Error();
    setBrands({ organizationId, items: parsed.data.data, pending: false, error: false });
  }

  async function handleUpdateBrand(event: FormEvent<HTMLFormElement>, brandId: string) {
    event.preventDefault();
    if (!activeOrganizationId) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          industry: String(form.get("industry") ?? "").trim(),
        }),
      });
      if (!response.ok) throw new Error();
      await reloadBrands(activeOrganizationId);
      setEditingBrandId(null);
      setMessage(tPortfolio("brandUpdated"));
    } catch {
      setMessage(tPortfolio("updateError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveBrand(brandId: string) {
    if (!activeOrganizationId) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/brands/${brandId}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      await reloadBrands(activeOrganizationId);
      setArchivingBrandId(null);
      setMessage(tPortfolio("brandArchived"));
    } catch {
      setMessage(tPortfolio("archiveError"));
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
    <WorkspaceShell
      organizations={organizationOptions}
      activeOrganizationId={activeOrganization?.id ?? organizationOptions[0]?.id ?? ""}
      userEmail={session?.user.email ?? ""}
      nextLocale={nextLocale}
      busy={busy}
      onOrganizationChange={(organizationId) => void handleOrganizationChange(organizationId)}
      onSignOut={() => void handleSignOut()}
    >
      {message ? <p className="entryMessage" role="status">{message}</p> : null}
      {currentBrands.error ? <p className="entryMessage entryMessage--error" role="alert">{tWorkspace("loadError")}</p> : null}
      <section className="workspaceOverview" id={WORKSPACE_SECTION_IDS.overview} aria-labelledby="workspace-overview-title">
        <div className="workspaceOverview__intro">
          <p className="entryKicker">{activeOrganization?.name ?? tWorkspace("title")}</p>
          <h1 id="workspace-overview-title">{tPortfolio("overviewTitle")}</h1>
          <p className="entryDescription">{tPortfolio("overviewDescription")}</p>
          <div className="workspaceOverview__actions">
            <Button asChild>
              <a href={`#${WORKSPACE_SECTION_IDS.brands}`}>{tPortfolio("viewBrands")}</a>
            </Button>
            <Button appearance="quiet" asChild>
              <a href={`#${WORKSPACE_SECTION_IDS.createBrand}`}>{tWorkspace("addBrand")}</a>
            </Button>
          </div>
        </div>
        <aside className="workspaceOverview__summary" aria-label={tPortfolio("brandCountSummary")} aria-live="polite">
          {currentBrands.pending ? <span>{tWorkspace("loadingBrands")}</span> : null}
          {currentBrands.error ? <span>{tWorkspace("loadError")}</span> : null}
          {!currentBrands.pending && !currentBrands.error ? (
            <>
              <strong>{currentBrands.items.length}</strong>
              <span>{tPortfolio("activeBrandCount", { count: currentBrands.items.length })}</span>
            </>
          ) : null}
        </aside>
      </section>

      <EditorialCalendar brands={currentBrands.items} />

      <section className="workspaceBrands" id={WORKSPACE_SECTION_IDS.brands} aria-labelledby="workspace-brands-title">
        <div className="workspaceHeading">
          <div>
            <p className="entryKicker">{tPortfolio("eyebrow")}</p>
            <h2 id="workspace-brands-title">{tPortfolio("title")}</h2>
            <p className="entryDescription">{tPortfolio("brandsSectionDescription")}</p>
          </div>
        </div>
        {currentBrands.pending ? <p className="workspaceEmpty" aria-live="polite">{tWorkspace("loadingBrands")}</p> : null}
        {!currentBrands.pending && !currentBrands.error && currentBrands.items.length === 0 ? <p className="workspaceEmpty">{tWorkspace("emptyBrands")}</p> : null}
        {currentBrands.items.length > 0 ? (
          <ul className="brandCollection">
            {currentBrands.items.map((brand) => (
              <li className="brandCollection__item" key={brand.id}>
                <span className="brandCollection__mark" aria-hidden="true">{brand.name.slice(0, BRAND_LIMITS.markCharacters).toLocaleUpperCase()}</span>
                <span className="brandCollection__identity"><strong>{brand.name}</strong><small>{brand.description || brand.industry || ""}</small></span>
                <span className="brandCollection__social">{brand.socialProfiles.length === 0 ? tPortfolio("noChannels") : brand.socialProfiles.map((profile) => profile.displayName).join(", ")}</span>
                <span className="brandCollection__actions">
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setEditingBrandId(brand.id); setArchivingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("editBrand")}</Button>
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setArchivingBrandId(brand.id); setEditingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("archiveBrand")}</Button>
                  <Button appearance="quiet" type="button" disabled={busy} aria-expanded={activeBrandKitId === brand.id} onClick={() => { setActiveBrandKitId((current) => current === brand.id ? null : brand.id); setEditingBrandId(null); setArchivingBrandId(null); }}>{tPortfolio("editBrandKit")}</Button>
                </span>
                {activeBrandKitId === brand.id ? <BrandKitEditor brandId={brand.id} brandName={brand.name} /> : null}
                {editingBrandId === brand.id ? (
                  <form className="brandCollection__editor" onSubmit={(event) => void handleUpdateBrand(event, brand.id)}>
                    <TextField id={`brand-name-${brand.id}`} name="name" label={tPortfolio("brandName")} defaultValue={brand.name} maxLength={BRAND_LIMITS.nameCharacters} required />
                    <TextField id={`brand-description-${brand.id}`} name="description" label={tPortfolio("brandDescription")} defaultValue={brand.description ?? ""} maxLength={BRAND_LIMITS.descriptionCharacters} />
                    <TextField id={`brand-industry-${brand.id}`} name="industry" label={tPortfolio("industry")} defaultValue={brand.industry ?? ""} maxLength={BRAND_LIMITS.industryCharacters} />
                    <div className="brandCollection__editorActions">
                      <Button type="submit" disabled={busy}>{busy ? tAuth("working") : tPortfolio("saveChanges")}</Button>
                      <Button appearance="quiet" type="button" disabled={busy} onClick={() => setEditingBrandId(null)}>{tPortfolio("cancel")}</Button>
                    </div>
                  </form>
                ) : null}
                {archivingBrandId === brand.id ? (
                  <div className="brandCollection__archive" role="group" aria-label={tPortfolio("archiveConfirmationLabel", { brand: brand.name })}>
                    <p>{tPortfolio("archiveConfirmation", { brand: brand.name })}</p>
                    <Button type="button" disabled={busy} onClick={() => void handleArchiveBrand(brand.id)}>{busy ? tAuth("working") : tPortfolio("confirmArchive")}</Button>
                    <Button appearance="quiet" type="button" disabled={busy} onClick={() => setArchivingBrandId(null)}>{tPortfolio("cancel")}</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <section className="brandCreate" id={WORKSPACE_SECTION_IDS.createBrand} aria-labelledby="brand-create-title">
          <div className="brandCreate__heading"><h2 id="brand-create-title">{tPortfolio("createTitle")}</h2><p>{tPortfolio("createDescription")}</p></div>
          <form className="brandCreate__form" onSubmit={handleCreateBrand}>
            <TextField id="brandName" name="brandName" label={tWorkspace("brandName")} maxLength={BRAND_LIMITS.nameCharacters} required />
            <TextField id="brandDescription" name="brandDescription" label={tWorkspace("brandDescription")} maxLength={BRAND_LIMITS.descriptionCharacters} />
            <TextField id="brandIndustry" name="brandIndustry" label={tWorkspace("brandIndustry")} maxLength={BRAND_LIMITS.industryCharacters} />
            <Button type="submit" disabled={busy || !activeOrganization?.id}>{busy ? tAuth("working") : tWorkspace("addBrand")}</Button>
          </form>
        </section>
      </section>
      <TeamManagement
        key={isChangingOrganization ? "organization-switch" : activeOrganization?.id ?? "organization-pending"}
        organizationId={isChangingOrganization ? null : activeOrganization?.id ?? null}
      />
    </WorkspaceShell>
  );
}
