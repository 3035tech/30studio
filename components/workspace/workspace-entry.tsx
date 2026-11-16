"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { CheckboxField, PasswordField, SelectField, TextField } from "@/components/ui/field";
import { brandListItemSchema, brandListResponseSchema, type BrandListItem } from "@/lib/validation/brands";
import { AUTH_LIMITS, BRAND_LIMITS, DASHBOARD_FILTERS, EMAIL_ROUTES, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUS, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, type DashboardFilters, type Locale } from "@/lib/constants";
import { Link } from "@/lib/i18n/routing";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { TeamManagement } from "@/components/workspace/team-management";
import { BrandKitEditor } from "@/components/brand/brand-kit-editor";
import { EditorialCalendar } from "@/components/calendar/editorial-calendar";
import { SocialConnectionManager } from "@/components/workspace/social-connection-manager";
import { AnalyticsWorkspace } from "@/components/workspace/analytics-workspace";
import { AccountProfile } from "@/components/workspace/account-profile";

type AuthMode = "sign_in" | "sign_up" | "request_reset";
type BrandState = { organizationId: string | null; items: BrandListItem[]; pending: boolean; error: boolean };

const INITIAL_BRANDS: BrandState = { organizationId: null, items: [], pending: false, error: false };
const SLUG_PATTERN = /[^a-z0-9]+/g;
const EDGE_DASHES_PATTERN = /^-+|-+$/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(SLUG_PATTERN, "-").replace(EDGE_DASHES_PATTERN, "");
}

export function WorkspaceEntry({ socialConnectionResult, socialConnectionBrandId }: { socialConnectionResult: string | null; socialConnectionBrandId: string | null }) {
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");
  const tPortfolio = useTranslations("portfolio");
  const tNavigation = useTranslations("navigation");
  const tPlatforms = useTranslations("platforms");
  const tProfileStatus = useTranslations("profileStatus");
  const tSocialConnections = useTranslations("socialConnections");
  const tDashboard = useTranslations("dashboardFilters");
  const locale = useLocale() as Locale;
  const nextLocale: Locale = locale === "pt" ? "en" : "pt";
  const { data: session, isPending: sessionPending, refetch: refreshSession } = authClient.useSession();
  const { data: organizations, isPending: organizationsPending, refetch: refreshOrganizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [rememberMe, setRememberMe] = useState(true);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isChangingOrganization, setIsChangingOrganization] = useState(false);
  const [message, setMessage] = useState("");
  const [brands, setBrands] = useState<BrandState>(INITIAL_BRANDS);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [activeBrandKitId, setActiveBrandKitId] = useState<string | null>(null);
  const [activeSocialConnectionsId, setActiveSocialConnectionsId] = useState<string | null>(null);
  const [brandSetupPrompt, setBrandSetupPrompt] = useState<BrandListItem | null>(null);
  const [archivingBrandId, setArchivingBrandId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>({ brandId: "", platform: "", rangeDays: 30 });
  const [filtersReadyOrganization, setFiltersReadyOrganization] = useState<string | null>(null);
  const [canManageContent, setCanManageContent] = useState<boolean | null>(null);

  const organizationOptions = useMemo(() => organizations ?? [], [organizations]);
  const isAuthenticated = Boolean(session?.user);
  const activeOrganizationId = activeOrganization?.id ?? null;
  const currentBrands = brands.organizationId === activeOrganizationId
    ? brands
    : { organizationId: activeOrganizationId, items: [], pending: Boolean(activeOrganizationId), error: false };
  const activeBrands = useMemo(() => currentBrands.items.filter((brand) => brand.isActive), [currentBrands.items]);
  const activeBrandCount = activeBrands.length;
  const canCreateContent = canManageContent === true && activeBrandCount > 0 && !currentBrands.pending && !currentBrands.error;

  useEffect(() => {
    if (!activeOrganizationId) {
      const timer = window.setTimeout(() => setFiltersReadyOrganization(null), 0);
      return () => window.clearTimeout(timer);
    }
    const filterStorageKey = `${DASHBOARD_FILTERS.storageKey}:${activeOrganizationId}:${session?.user.id ?? "anonymous"}`;
    let restoredBrandId = "";
    let restoredPlatform: DashboardFilters["platform"] = "";
    let restoredRangeDays: DashboardFilters["rangeDays"] = 30;
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(filterStorageKey) ?? "null");
      if (isRecord(value)) {
        if (typeof value.brandId === "string") restoredBrandId = value.brandId;
        if (typeof value.platform === "string") restoredPlatform = SOCIAL_PLATFORMS.find((item) => item === value.platform) ?? "";
        if (value.rangeDays === 90) restoredRangeDays = 90;
      }
    } catch { /* Keep the default dashboard filters when browser storage is unavailable. */ }
    const timer = window.setTimeout(() => {
      setDashboardFilters({ brandId: restoredBrandId, platform: restoredPlatform, rangeDays: restoredRangeDays });
      setFiltersReadyOrganization(activeOrganizationId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeOrganizationId, session?.user.id]);

  useEffect(() => {
    if (!activeOrganizationId || filtersReadyOrganization !== activeOrganizationId) return;
    try { sessionStorage.setItem(`${DASHBOARD_FILTERS.storageKey}:${activeOrganizationId}:${session?.user.id ?? "anonymous"}`, JSON.stringify(dashboardFilters)); }
    catch { /* Dashboard filters still work for the current page when browser storage is unavailable. */ }
  }, [activeOrganizationId, dashboardFilters, filtersReadyOrganization, session?.user.id]);

  useEffect(() => {
    if (!dashboardFilters.brandId || currentBrands.pending) return;
    if (!currentBrands.items.some((brand) => brand.id === dashboardFilters.brandId && brand.isActive)) {
      const timer = window.setTimeout(() => setDashboardFilters((current) => ({ ...current, brandId: "" })), 0);
      return () => window.clearTimeout(timer);
    }
  }, [currentBrands.items, currentBrands.pending, dashboardFilters.brandId]);

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
    setResetLinkSent(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (authMode === "request_reset") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}${EMAIL_ROUTES.passwordReset(locale)}`,
        });
        if (result.error) throw new Error();
        setMessage(tAuth("resetLinkSent"));
        setResetLinkSent(true);
      } else if (authMode === "sign_up") {
        const name = String(form.get("name") ?? "").trim();
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message);
        await refreshSession();
        setMessage(tWorkspace("emailVerificationRequired"));
      } else {
        const result = await authClient.signIn.email({ email, password, rememberMe });
        if (result.error) throw new Error(result.error.message);
        await refreshSession();
        await refreshOrganizations();
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
    setCanManageContent(null);
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
      const createdBrandResult = brandListItemSchema.safeParse((await response.json()).data);
      if (!createdBrandResult.success) throw new Error();
      formElement.reset();
      await reloadBrands(activeOrganization.id);
      setBrandSetupPrompt(createdBrandResult.data);
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

  async function retryLoadBrands() {
    if (!activeOrganizationId) return;
    setBrands((current) => ({ ...current, organizationId: activeOrganizationId, pending: true, error: false }));
    try {
      await reloadBrands(activeOrganizationId);
    } catch {
      setBrands((current) => ({ ...current, organizationId: activeOrganizationId, pending: false, error: true }));
    }
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
          <h1 id="auth-heading">{authMode === "sign_up" ? tAuth("signUpTitle") : authMode === "request_reset" ? tAuth("requestPasswordResetTitle") : tAuth("signInTitle")}</h1>
          {authMode === "request_reset" ? <p className="entryDescription">{tAuth("requestPasswordResetDescription")}</p> : <p className="entryDescription">{tAuth(authMode === "sign_up" ? "signUpDescription" : "signInDescription")}</p>}
          <form className="entryForm" onSubmit={handleAuthentication}>
            {authMode === "sign_up" ? (
              <TextField id="name" name="name" label={tAuth("name")} autoComplete="name" maxLength={AUTH_LIMITS.nameCharacters} required />
            ) : null}
            <TextField id="email" name="email" label={tAuth("email")} type="email" autoComplete="email" required disabled={busy && authMode === "request_reset"} onChange={() => { if (authMode === "request_reset") { setResetLinkSent(false); setMessage(""); } }} />
            {authMode !== "request_reset" ? <PasswordField id="password" name="password" label={tAuth("password")} autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={AUTH_LIMITS.passwordCharacters} helpText={authMode === "sign_up" ? tAuth("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters }) : undefined} required /> : null}
            {authMode === "sign_in" ? <div className="entryLoginOptions">
              <CheckboxField id="remember-me" name="rememberMe" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} label={tAuth("rememberMe")} className="entryLoginOptions__remember" />
              <a className="entryLoginOptions__recovery" href="#request-password-reset" onClick={(event) => { event.preventDefault(); setAuthMode("request_reset"); setResetLinkSent(false); setMessage(""); }}>{tAuth("forgotPassword")}</a>
            </div> : null}
            {message ? <p className="entryMessage" role="status">{message}</p> : null}
            <Button type="submit" disabled={busy}>{busy ? tAuth("working") : authMode === "sign_up" ? tAuth("signUp") : authMode === "request_reset" ? tAuth(resetLinkSent ? "sendAnotherResetLink" : "sendResetLink") : tAuth("signIn")}</Button>
          </form>
          <Button appearance="quiet" className="entrySwitch" type="button" onClick={() => { setAuthMode(authMode === "sign_up" ? "sign_in" : authMode === "request_reset" ? "sign_in" : "sign_up"); setResetLinkSent(false); setMessage(""); }}>
            {authMode === "sign_up" || authMode === "request_reset" ? tAuth("switchToSignIn") : tAuth("switchToSignUp")}
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
      canCreateContent={canCreateContent}
      onOrganizationChange={(organizationId) => void handleOrganizationChange(organizationId)}
      onSignOut={() => void handleSignOut()}
    >
      {message ? <p className="entryMessage" role="status">{message}</p> : null}
      {socialConnectionResult === "connected" || socialConnectionResult === "failed" || socialConnectionResult === "already_connected" || socialConnectionResult === "no_publishable_pages" ? <p className="entryMessage" role="status">{tSocialConnections(socialConnectionResult)}</p> : null}
      <section className="workspaceOverview" id={WORKSPACE_SECTION_IDS.overview} aria-labelledby="workspace-overview-title">
        <div className="workspaceOverview__intro">
          <p className="entryKicker">{activeOrganization?.name ?? tWorkspace("title")}</p>
          <h1 id="workspace-overview-title">{tPortfolio("overviewTitle")}</h1>
          <p className="entryDescription">{tPortfolio("overviewDescription")}</p>
          <div className="workspaceOverview__actions">
            {currentBrands.pending || canManageContent === null ? <Button type="button" disabled>{tPortfolio("checkingNextStep")}</Button>
              : currentBrands.error ? <Button type="button" disabled={currentBrands.pending} onClick={() => void retryLoadBrands()}>{tPortfolio("retryLoad")}</Button>
                : activeBrandCount === 0 ? <Button asChild><a href={`#${WORKSPACE_SECTION_IDS.createBrand}`}>{tWorkspace("addBrand")}</a></Button>
                  : canCreateContent ? <Button type="button" onClick={() => { window.location.hash = WORKSPACE_SECTION_IDS.calendar; window.dispatchEvent(new Event(WORKSPACE_UI_EVENTS.createContent)); }}>{tNavigation("createContent")}</Button>
                    : <Button asChild><a href={`#${WORKSPACE_SECTION_IDS.calendar}`}>{tPortfolio("openCalendar")}</a></Button>}
            {!currentBrands.pending && activeBrandCount > 0 ? <Button appearance="quiet" asChild><a href={`#${WORKSPACE_SECTION_IDS.brands}`}>{tPortfolio("viewBrands")}</a></Button> : null}
          </div>
        </div>
        {!currentBrands.pending && !currentBrands.error ? <aside className="workspaceOverview__summary" aria-label={tPortfolio("brandCountSummary")} aria-live="polite">
          <strong>{activeBrandCount}</strong>
          <span>{tPortfolio("activeBrandCount", { count: activeBrandCount })}</span>
        </aside> : null}
      </section>

      <section className="dashboardFilterBar" aria-label={tDashboard("title")}>
        <SelectField id="dashboard-brand-filter" label={tDashboard("brand")} value={dashboardFilters.brandId} onChange={(event) => setDashboardFilters((current) => ({ ...current, brandId: event.target.value }))}>
          <option value="">{tDashboard("allBrands")}</option>{currentBrands.items.filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </SelectField>
        <SelectField id="dashboard-platform-filter" label={tDashboard("platform")} value={dashboardFilters.platform} onChange={(event) => setDashboardFilters((current) => ({ ...current, platform: SOCIAL_PLATFORMS.find((platform) => platform === event.target.value) ?? "" }))}>
          <option value="">{tDashboard("allPlatforms")}</option>{SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{tPlatforms(platform)}</option>)}
        </SelectField>
        <SelectField id="dashboard-range-filter" label={tDashboard("period")} value={String(dashboardFilters.rangeDays)} onChange={(event) => setDashboardFilters((current) => ({ ...current, rangeDays: Number(event.target.value) === 90 ? 90 : 30 }))}>
          <option value="30">{tDashboard("lastDays", { count: 30 })}</option><option value="90">{tDashboard("lastDays", { count: 90 })}</option>
        </SelectField>
        <Button appearance="quiet" type="button" onClick={() => setDashboardFilters({ brandId: "", platform: "", rangeDays: 30 })}>{tDashboard("reset")}</Button>
        <p>{tDashboard("scope")}</p>
      </section>

      <AnalyticsWorkspace
        organizationId={activeOrganizationId ?? ""}
        userId={session?.user.id ?? ""}
        brands={currentBrands.items.filter((brand) => brand.isActive)}
        filters={dashboardFilters}
        onBrandChange={(brandId) => setDashboardFilters((current) => ({ ...current, brandId }))}
        onOpenConnection={(brandId) => {
          setActiveSocialConnectionsId(brandId);
          window.location.hash = WORKSPACE_SECTION_IDS.brands;
        }}
      />

      <EditorialCalendar key={`calendar:${activeOrganizationId ?? "workspace-pending"}`} organizationId={activeOrganizationId ?? ""} brands={activeBrands} dashboardFilters={dashboardFilters} onDashboardFiltersChange={setDashboardFilters} onCanManageChange={setCanManageContent} />

      <AccountProfile email={session?.user.email ?? ""} />

      <section className="workspaceBrands" id={WORKSPACE_SECTION_IDS.brands} aria-labelledby="workspace-brands-title">
        <div className="workspaceHeading">
          <div>
            <p className="entryKicker">{tPortfolio("eyebrow")}</p>
            <h2 id="workspace-brands-title">{tPortfolio("title")}</h2>
            <p className="entryDescription">{tPortfolio("brandsSectionDescription")}</p>
          </div>
        </div>
        {currentBrands.pending ? <p className="workspaceEmpty" aria-live="polite">{tWorkspace("loadingBrands")}</p> : null}
        {currentBrands.error ? <div className="brandCollection__loadError" role="alert"><p>{tPortfolio("loadError")}</p><Button appearance="quiet" type="button" disabled={currentBrands.pending} onClick={() => void retryLoadBrands()}>{tPortfolio("retryLoad")}</Button></div> : null}
        {!currentBrands.pending && !currentBrands.error && currentBrands.items.length === 0 ? <p className="workspaceEmpty">{tWorkspace("emptyBrands")}</p> : null}
        {currentBrands.items.length > 0 ? (
          <ul className="brandCollection">
            {currentBrands.items.map((brand) => {
              const connectedCount = brand.socialProfiles.filter((profile) => profile.status === SOCIAL_PROFILE_STATUS.connected).length;
              const reauthCount = brand.socialProfiles.filter((profile) => profile.status === SOCIAL_PROFILE_STATUS.reauthRequired).length;
              const socialSetupStatus = reauthCount > 0 ? "reauth" : connectedCount > 0 ? "connected" : "notConnected";
              const socialSetupText = reauthCount > 0 && connectedCount > 0
                ? tPortfolio("socialMixedCount", { connected: connectedCount, reauth: reauthCount })
                : reauthCount > 0
                  ? tPortfolio("socialReconnectCount", { count: reauthCount })
                  : connectedCount > 0
                    ? tPortfolio("socialConnectedCount", { count: connectedCount })
                    : tPortfolio("socialNotConnected");
              return <li className="brandCollection__item" id={`workspace-brand-${brand.id}`} key={brand.id}>
                <span className="brandCollection__mark" aria-hidden="true">{brand.name.slice(0, BRAND_LIMITS.markCharacters).toLocaleUpperCase()}</span>
                <span className="brandCollection__identity">
                  <strong>{brand.name}</strong><small>{brand.description || brand.industry || ""}</small>
                  <span className="brandCollection__setupSummary" aria-label={tPortfolio("brandSetupSummary")}>
                    <span><small>{tPortfolio("brandKitStatusTitle")}</small><strong className={`brandSetupStatus brandSetupStatus--${brand.brandKitStatus ?? "empty"}`}>{brand.brandKitStatus ? tPortfolio(`brandKitStatuses.${brand.brandKitStatus}`) : tPortfolio("brandKitNotStarted")}</strong></span>
                    <span><small>{tPortfolio("socialSetupTitle")}</small><strong className={`brandSetupStatus brandSetupStatus--${socialSetupStatus}`}>{socialSetupText}</strong></span>
                  </span>
                </span>
                <span className="brandCollection__social">
                  {brand.socialProfiles.length === 0 ? tPortfolio("noChannels") : brand.socialProfiles.map((profile) => (
                    <span className="brandCollection__profile" key={profile.id}>
                      <span>{tPlatforms(profile.platform)} · {profile.displayName}</span>
                      <small className={`brandProfileStatus brandProfileStatus--${profile.status}`}>{tProfileStatus(profile.status)}</small>
                    </span>
                  ))}
                </span>
                <span className="brandCollection__actions">
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setEditingBrandId(brand.id); setArchivingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("editBrand")}</Button>
                  <Button appearance="quiet" type="button" disabled={busy} aria-expanded={activeSocialConnectionsId === brand.id} onClick={() => setActiveSocialConnectionsId((current) => current === brand.id ? null : brand.id)}>{tPortfolio("manageChannels")}</Button>
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setArchivingBrandId(brand.id); setEditingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("archiveBrand")}</Button>
                  <Button appearance="quiet" type="button" disabled={busy} aria-expanded={activeBrandKitId === brand.id} onClick={() => { setActiveBrandKitId((current) => current === brand.id ? null : brand.id); setEditingBrandId(null); setArchivingBrandId(null); }}>{tPortfolio("editBrandKit")}</Button>
                </span>
                {activeBrandKitId === brand.id ? <BrandKitEditor brandId={brand.id} brandName={brand.name} /> : null}
                {activeSocialConnectionsId === brand.id || socialConnectionBrandId === brand.id ? <SocialConnectionManager brandId={brand.id} /> : null}
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
              </li>;
            })}
          </ul>
        ) : null}
        <section className="brandCreate" id={WORKSPACE_SECTION_IDS.createBrand} aria-labelledby="brand-create-title">
          <div className="brandCreate__heading"><h2 id="brand-create-title">{tPortfolio("createTitle")}</h2><p>{tPortfolio("createDescription")}</p></div>
          <form className="brandCreate__form" onSubmit={handleCreateBrand}>
            <TextField id="brandName" name="brandName" label={tWorkspace("brandName")} maxLength={BRAND_LIMITS.nameCharacters} required />
            <TextField id="brandDescription" name="brandDescription" label={tWorkspace("brandDescription")} maxLength={BRAND_LIMITS.descriptionCharacters} />
            <TextField id="brandIndustry" name="brandIndustry" label={tWorkspace("brandIndustry")} maxLength={BRAND_LIMITS.industryCharacters} />
            <Button type="submit" disabled={busy || !activeOrganization?.id || currentBrands.error || currentBrands.pending}>{busy ? tAuth("working") : tWorkspace("addBrand")}</Button>
          </form>
          {brandSetupPrompt && brandSetupPrompt.organizationId === activeOrganizationId && activeBrands.some((brand) => brand.id === brandSetupPrompt.id) ? <section className="brandSetupNext" aria-labelledby="brand-setup-next-title">
            <div><h3 id="brand-setup-next-title">{tPortfolio("brandSetupNextTitle", { brand: brandSetupPrompt.name })}</h3><p>{tPortfolio("brandSetupNextDescription")}</p></div>
            <div className="brandSetupNext__actions">
              <Button type="button" onClick={() => { setActiveSocialConnectionsId(brandSetupPrompt.id); setActiveBrandKitId(null); document.getElementById(`workspace-brand-${brandSetupPrompt.id}`)?.scrollIntoView({ block: "center" }); }}>{tPortfolio("setupConnections")}</Button>
              <Button appearance="quiet" type="button" onClick={() => { setActiveBrandKitId(brandSetupPrompt.id); setActiveSocialConnectionsId(null); document.getElementById(`workspace-brand-${brandSetupPrompt.id}`)?.scrollIntoView({ block: "center" }); }}>{tPortfolio("setupBrandKit")}</Button>
              <Button appearance="quiet" type="button" onClick={() => setBrandSetupPrompt(null)}>{tPortfolio("setupLater")}</Button>
            </div>
          </section> : null}
        </section>
      </section>
      <TeamManagement
        key={`team:${isChangingOrganization ? "organization-switch" : activeOrganization?.id ?? "organization-pending"}`}
        organizationId={isChangingOrganization ? null : activeOrganization?.id ?? null}
        brands={currentBrands.items.filter((brand) => brand.isActive)}
      />
    </WorkspaceShell>
  );
}
