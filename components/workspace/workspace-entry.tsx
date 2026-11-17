"use client";

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/client/auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckboxField, FileField, PasswordField, SelectField, TextField } from "@/components/ui/field";
import { brandListItemSchema, brandListResponseSchema, type BrandListItem } from "@/lib/validation/brands";
import { AUTH_LIMITS, BRAND_ASSET_LIMITS, BRAND_LIMITS, BRAND_SEGMENTS, DASHBOARD_FILTERS, EMAIL_ROUTES, SOCIAL_PLATFORMS, SOCIAL_PROFILE_STATUS, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, type BrandSegment, type DashboardFilters, type Locale } from "@/lib/constants";
import { Link } from "@/lib/i18n/routing";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { TeamManagement } from "@/components/workspace/team-management";
import { BrandKitEditor } from "@/components/brand/brand-kit-editor";
import { EditorialCalendar } from "@/components/calendar/editorial-calendar";
import { SocialConnectionManager } from "@/components/workspace/social-connection-manager";
import { SocialPlatformIcon } from "@/components/ui/social-platform-icon";
import { AnalyticsWorkspace } from "@/components/workspace/analytics-workspace";
import { CompetitorIntelligence } from "@/components/workspace/competitor-intelligence";
import { AccountProfile } from "@/components/workspace/account-profile";
import { uploadBrandAssetFile } from "@/components/brand/upload-brand-asset";

type AuthMode = "sign_in" | "sign_up" | "request_reset";
type BrandState = { organizationId: string | null; items: BrandListItem[]; pending: boolean; error: boolean; canManage: boolean | null };

const INITIAL_BRANDS: BrandState = { organizationId: null, items: [], pending: false, error: false, canManage: null };
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
  const tBrandKit = useTranslations("brandKit");
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
  const [messageIsError, setMessageIsError] = useState(false);
  const [brands, setBrands] = useState<BrandState>(INITIAL_BRANDS);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [activeBrandKitId, setActiveBrandKitId] = useState<string | null>(null);
  const [brandView, setBrandView] = useState<"brands" | "connections">("brands");
  const [connectionBrandId, setConnectionBrandId] = useState("");
  const [createBrandOpen, setCreateBrandOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [brandSegmentFilter, setBrandSegmentFilter] = useState<BrandSegment | "">("");
  const [brandSetupPrompt, setBrandSetupPrompt] = useState<BrandListItem | null>(null);
  const [archivingBrandId, setArchivingBrandId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>({ brandId: "", platform: "", rangeDays: 30 });
  const [competitorBrandContext, setCompetitorBrandContext] = useState("");
  const [filtersReadyOrganization, setFiltersReadyOrganization] = useState<string | null>(null);
  const [canManageContent, setCanManageContent] = useState<boolean | null>(null);

  const organizationOptions = useMemo(() => organizations ?? [], [organizations]);
  const isAuthenticated = Boolean(session?.user);
  const activeOrganizationId = activeOrganization?.id ?? null;
  const currentBrands = brands.organizationId === activeOrganizationId
    ? brands
    : { organizationId: activeOrganizationId, items: [], pending: Boolean(activeOrganizationId), error: false, canManage: null };
  const activeBrands = useMemo(() => currentBrands.items.filter((brand) => brand.isActive), [currentBrands.items]);
  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLocaleLowerCase(locale === "pt" ? "pt-BR" : "en");
    return activeBrands.filter((brand) => {
      const matchesSegment = !brandSegmentFilter || brand.industry === brandSegmentFilter;
      const searchText = `${brand.name} ${brand.description ?? ""} ${brand.industry ?? ""}`.toLocaleLowerCase(locale === "pt" ? "pt-BR" : "en");
      return matchesSegment && (!query || searchText.includes(query));
    });
  }, [activeBrands, brandSearch, brandSegmentFilter, locale]);
  const activeBrandCount = activeBrands.length;
  const selectedConnectionBrand = activeBrands.find((brand) => brand.id === connectionBrandId) ?? activeBrands[0] ?? null;
  const canCreateContent = canManageContent === true && activeBrandCount > 0 && !currentBrands.pending && !currentBrands.error;

  useEffect(() => {
    if (!socialConnectionBrandId || !activeBrands.some((brand) => brand.id === socialConnectionBrandId)) return;
    const timer = window.setTimeout(() => {
      setConnectionBrandId(socialConnectionBrandId);
      setBrandView("connections");
      window.location.hash = WORKSPACE_SECTION_IDS.connections;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeBrands, socialConnectionBrandId]);

  useEffect(() => {
    function handleOpenConnections(event: Event) {
      if (!(event instanceof CustomEvent) || !isRecord(event.detail) || typeof event.detail.brandId !== "string") return;
      if (!activeBrands.some((brand) => brand.id === event.detail.brandId)) return;
      setConnectionBrandId(event.detail.brandId);
      setActiveBrandKitId(null);
      setBrandView("connections");
      window.location.hash = WORKSPACE_SECTION_IDS.connections;
    }
    window.addEventListener(WORKSPACE_UI_EVENTS.openSocialConnections, handleOpenConnections);
    return () => window.removeEventListener(WORKSPACE_UI_EVENTS.openSocialConnections, handleOpenConnections);
  }, [activeBrands]);

  useEffect(() => {
    function syncBrandView() {
      if (window.location.hash === `#${WORKSPACE_SECTION_IDS.connections}`) setBrandView("connections");
      if (window.location.hash === `#${WORKSPACE_SECTION_IDS.brands}`) setBrandView("brands");
    }
    window.addEventListener("hashchange", syncBrandView);
    const timer = window.setTimeout(syncBrandView, 0);
    return () => { window.removeEventListener("hashchange", syncBrandView); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (brandView !== "connections" || window.location.hash !== `#${WORKSPACE_SECTION_IDS.connections}`) return;
    window.setTimeout(() => document.getElementById(WORKSPACE_SECTION_IDS.connections)?.scrollIntoView({ block: "start" }), 0);
  }, [brandView]);

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
        setBrands({ organizationId: activeOrganizationId, items: parsed.data.data, pending: false, error: false, canManage: parsed.data.canManage });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBrands({ organizationId: activeOrganizationId, items: [], pending: false, error: true, canManage: null });
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
    setMessageIsError(false);
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
        const result = await authClient.signUp.email({ name, email, password, callbackURL: `/${locale}` });
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
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
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
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleOrganizationChange(organizationId: string) {
    setBusy(true);
    setCanManageContent(null);
    setIsChangingOrganization(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error();
      await refreshSession();
    } catch {
      setMessage(tWorkspace("organizationError"));
      setMessageIsError(true);
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
    setMessageIsError(false);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("brandName") ?? "").trim(),
      description: String(form.get("brandDescription") ?? "").trim(),
      industry: String(form.get("brandIndustry") ?? "").trim(),
      websiteUrl: String(form.get("brandWebsite") ?? "").trim(),
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
      const logoFile = form.get("brandLogo");
      let logoUploadFailed = false;
      if (logoFile instanceof File && logoFile.size > 0) {
        try {
          await uploadBrandAssetFile(createdBrandResult.data.id, logoFile, { kind: "logo", altText: createdBrandResult.data.name });
        } catch {
          logoUploadFailed = true;
        }
      }
      formElement.reset();
      setCreateBrandOpen(false);
      await reloadBrands(activeOrganization.id);
      setBrandSetupPrompt(createdBrandResult.data);
      setMessage(logoUploadFailed ? tPortfolio("brandAddedLogoFailed") : logoFile instanceof File && logoFile.size > 0 ? tPortfolio("brandAddedLogoPending") : tWorkspace("brandAdded"));
    } catch {
      setMessage(tWorkspace("brandError"));
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function reloadBrands(organizationId: string) {
    const response = await fetch("/api/brands", { credentials: "same-origin", cache: "no-store" });
    const parsed = brandListResponseSchema.safeParse(await response.json());
    if (!response.ok || !parsed.success) throw new Error();
    setBrands({ organizationId, items: parsed.data.data, pending: false, error: false, canManage: parsed.data.canManage });
    setConnectionBrandId(parsed.data.data.find((brand) => brand.isActive)?.id ?? "");
  }

  function openSocialConnections(brandId?: string) {
    if (brandId) setConnectionBrandId(brandId);
    setActiveBrandKitId(null);
    selectBrandView("connections");
  }

  function selectBrandView(view: "brands" | "connections") {
    setBrandView(view);
    window.location.hash = view === "brands" ? WORKSPACE_SECTION_IDS.brands : WORKSPACE_SECTION_IDS.connections;
  }

  function handleBrandTabsKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const view = brandView === "brands" ? "connections" : "brands";
    selectBrandView(view);
    document.getElementById(`brand-tab-${view}`)?.focus();
  }

  function getBrandSegmentLabel(industry: string | null) {
    const segment = BRAND_SEGMENTS.find((item) => item === industry);
    return segment ? tPortfolio(`segments.${segment}`) : industry ?? "";
  }

  async function retryLoadBrands() {
    if (!activeOrganizationId) return;
    setBrands((current) => ({ ...current, organizationId: activeOrganizationId, pending: true, error: false, canManage: null }));
    try {
      await reloadBrands(activeOrganizationId);
    } catch {
      setBrands((current) => ({ ...current, organizationId: activeOrganizationId, pending: false, error: true, canManage: null }));
    }
  }

  async function handleUpdateBrand(event: FormEvent<HTMLFormElement>, brandId: string) {
    event.preventDefault();
    if (!activeOrganizationId) return;
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    const form = new FormData(event.currentTarget);
    const logoFile = form.get("brandLogo");
    let logoUploadFailed = false;

    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          industry: String(form.get("industry") ?? "").trim(),
          websiteUrl: String(form.get("websiteUrl") ?? "").trim(),
        }),
      });
      if (!response.ok) throw new Error();
      if (logoFile instanceof File && logoFile.size > 0) {
        try {
          await uploadBrandAssetFile(brandId, logoFile, { kind: "logo", altText: String(form.get("name") ?? "").trim() });
        } catch {
          logoUploadFailed = true;
        }
      }
      await reloadBrands(activeOrganizationId);
      setEditingBrandId(null);
      setMessage(logoUploadFailed ? tPortfolio("brandUpdatedLogoFailed") : logoFile instanceof File && logoFile.size > 0 ? tPortfolio("brandUpdatedLogoPending") : tPortfolio("brandUpdated"));
    } catch {
      setMessage(tPortfolio("updateError"));
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveBrand(brandId: string) {
    if (!activeOrganizationId) return;
    setBusy(true);
    setMessage("");
    setMessageIsError(false);

    try {
      const response = await fetch(`/api/brands/${brandId}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      await reloadBrands(activeOrganizationId);
      setArchivingBrandId(null);
      setMessage(tPortfolio("brandArchived"));
    } catch {
      setMessage(tPortfolio("archiveError"));
      setMessageIsError(true);
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
            <TextField id="email" name="email" label={tAuth("email")} type="email" autoComplete="email" maxLength={AUTH_LIMITS.emailCharacters} required disabled={busy && authMode === "request_reset"} onChange={() => { if (authMode === "request_reset") setResetLinkSent(false); if (messageIsError || authMode === "request_reset") { setMessage(""); setMessageIsError(false); } }} />
            {authMode !== "request_reset" ? <PasswordField id="password" name="password" label={tAuth("password")} autoComplete={authMode === "sign_up" ? "new-password" : "current-password"} minLength={AUTH_LIMITS.passwordCharacters} helpText={authMode === "sign_up" ? tAuth("passwordMinimum", { count: AUTH_LIMITS.passwordCharacters }) : undefined} required onChange={() => { if (messageIsError) { setMessage(""); setMessageIsError(false); } }} /> : null}
            {authMode === "sign_in" ? <div className="entryLoginOptions">
              <CheckboxField id="remember-me" name="rememberMe" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} label={tAuth("rememberMe")} className="entryLoginOptions__remember" />
              <a className="entryLoginOptions__recovery" href="#request-password-reset" onClick={(event) => { event.preventDefault(); setAuthMode("request_reset"); setResetLinkSent(false); setMessage(""); }}>{tAuth("forgotPassword")}</a>
            </div> : null}
            {message ? <p className={messageIsError ? "entryMessage entryMessage--error" : "entryMessage"} role={messageIsError ? "alert" : "status"}>{message}</p> : null}
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
      {message ? <p className={messageIsError ? "entryMessage entryMessage--error" : "entryMessage"} role={messageIsError ? "alert" : "status"}>{message}</p> : null}
      {socialConnectionResult === "connected" || socialConnectionResult === "failed" || socialConnectionResult === "already_connected" || socialConnectionResult === "no_publishable_pages" ? <p className="entryMessage" role="status">{tSocialConnections(socialConnectionResult)}</p> : null}
      <section className="workspaceOverview" id={WORKSPACE_SECTION_IDS.overview} aria-labelledby="workspace-overview-title">
        <div className="workspaceOverview__intro">
          <p className="entryKicker">{activeOrganization?.name ?? tWorkspace("title")}</p>
          <h1 id="workspace-overview-title">{tPortfolio("overviewTitle")}</h1>
          <p className="entryDescription">{tPortfolio("overviewDescription")}</p>
          <div className="workspaceOverview__actions">
            {currentBrands.pending || canManageContent === null ? <Button type="button" disabled>{tPortfolio("checkingNextStep")}</Button>
              : currentBrands.error ? <Button type="button" disabled={currentBrands.pending} onClick={() => void retryLoadBrands()}>{tPortfolio("retryLoad")}</Button>
                : activeBrandCount === 0 ? <Button type="button" onClick={() => setCreateBrandOpen(true)}>{tWorkspace("addBrand")}</Button>
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
        filters={dashboardFilters}
        onOpenConnection={(brandId) => openSocialConnections(brandId)}
      />

      <CompetitorIntelligence
        brands={currentBrands.items.filter((brand) => brand.isActive)}
        selectedBrandId={competitorBrandContext}
        onBrandChange={setCompetitorBrandContext}
        onOpenConnections={(brandId) => openSocialConnections(brandId)}
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
          {currentBrands.canManage ? <Button type="button" onClick={() => setCreateBrandOpen(true)} disabled={busy || currentBrands.error || currentBrands.pending}>{tPortfolio("newBrand")}</Button> : null}
        </div>
        <div className="brandSectionTabs" role="tablist" aria-label={tPortfolio("title")}>
          <button type="button" role="tab" id="brand-tab-brands" aria-selected={brandView === "brands"} aria-controls="brand-panel-brands" tabIndex={brandView === "brands" ? 0 : -1} className={brandView === "brands" ? "brandSectionTabs__tab is-active" : "brandSectionTabs__tab"} onClick={() => selectBrandView("brands")} onKeyDown={handleBrandTabsKeyDown}>{tPortfolio("brandTab")}</button>
          <button type="button" role="tab" id="brand-tab-connections" aria-selected={brandView === "connections"} aria-controls={WORKSPACE_SECTION_IDS.connections} tabIndex={brandView === "connections" ? 0 : -1} className={brandView === "connections" ? "brandSectionTabs__tab is-active" : "brandSectionTabs__tab"} onClick={() => openSocialConnections()} onKeyDown={handleBrandTabsKeyDown}>{tPortfolio("connectionsTab")}</button>
        </div>
        <div id="brand-panel-brands" role="tabpanel" aria-labelledby="brand-tab-brands" hidden={brandView !== "brands"}>
        {currentBrands.pending ? <p className="workspaceEmpty" aria-live="polite">{tWorkspace("loadingBrands")}</p> : null}
        {currentBrands.error ? <div className="brandCollection__loadError" role="alert"><p>{tPortfolio("loadError")}</p><Button appearance="quiet" type="button" disabled={currentBrands.pending} onClick={() => void retryLoadBrands()}>{tPortfolio("retryLoad")}</Button></div> : null}
        {!currentBrands.pending && !currentBrands.error && currentBrands.items.length === 0 ? <p className="workspaceEmpty">{currentBrands.canManage ? tWorkspace("emptyBrands") : tPortfolio("noBrandsReadOnly")}</p> : null}
        {!currentBrands.pending && !currentBrands.error && activeBrands.length > 0 ? <div className="brandCollectionFilters">
          <TextField id="brand-search" type="search" label={tPortfolio("searchBrands")} value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} />
          <SelectField id="brand-segment-filter" label={tPortfolio("segmentFilter")} value={brandSegmentFilter} onChange={(event) => setBrandSegmentFilter(BRAND_SEGMENTS.find((segment) => segment === event.target.value) ?? "")}>
            <option value="">{tPortfolio("allSegments")}</option>
            {BRAND_SEGMENTS.map((segment) => <option key={segment} value={segment}>{tPortfolio(`segments.${segment}`)}</option>)}
          </SelectField>
          <span className="brandCollectionFilters__count" aria-live="polite">{tPortfolio("brandsFound", { count: filteredBrands.length })}</span>
          {brandSearch || brandSegmentFilter ? <Button appearance="quiet" type="button" onClick={() => { setBrandSearch(""); setBrandSegmentFilter(""); }}>{tPortfolio("clearBrandFilters")}</Button> : null}
        </div> : null}
        {!currentBrands.pending && !currentBrands.error && activeBrands.length > 0 && filteredBrands.length === 0 ? <p className="workspaceEmpty">{tPortfolio("noBrandsMatch")}</p> : null}
        {filteredBrands.length > 0 ? (
          <ul className="brandCollection">
            {filteredBrands.map((brand) => {
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
                <span className="brandCollection__mark" aria-hidden="true">{brand.logoAssetId ? <Image src={`/api/brands/${brand.id}/logo/${brand.logoAssetId}`} alt="" fill sizes="48px" unoptimized /> : brand.name.slice(0, BRAND_LIMITS.markCharacters).toLocaleUpperCase()}</span>
                <span className="brandCollection__identity">
                  <strong>{brand.name}</strong><small>{brand.description || getBrandSegmentLabel(brand.industry)}</small>
                  {brand.websiteUrl ? <a className="brandCollection__website" href={brand.websiteUrl} target="_blank" rel="noreferrer">{brand.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : null}
                  <span className="brandCollection__setupSummary" aria-label={tPortfolio("brandSetupSummary")}>
                    <span><small>{tPortfolio("brandKitStatusTitle")}</small><strong className={`brandSetupStatus brandSetupStatus--${brand.brandKitStatus ?? "empty"}`}>{brand.brandKitStatus ? tPortfolio(`brandKitStatuses.${brand.brandKitStatus}`) : tPortfolio("brandKitNotStarted")}</strong></span>
                    <span><small>{tPortfolio("socialSetupTitle")}</small><strong className={`brandSetupStatus brandSetupStatus--${socialSetupStatus}`}>{socialSetupText}</strong></span>
                  </span>
                </span>
                <span className="brandCollection__social">
                  {brand.socialProfiles.length === 0 ? tPortfolio("noChannels") : brand.socialProfiles.map((profile) => (
                    <span className="brandCollection__profile" key={profile.id}>
                      <span className="brandCollection__profileName"><SocialPlatformIcon platform={profile.platform} /><span>{tPlatforms(profile.platform)} · {profile.displayName}</span></span>
                      <small className={`brandProfileStatus brandProfileStatus--${profile.status}`}>{tProfileStatus(profile.status)}</small>
                    </span>
                  ))}
                </span>
                <span className="brandCollection__actions">
                  {currentBrands.canManage ? <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setEditingBrandId(brand.id); setArchivingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("editBrand")}</Button> : null}
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => openSocialConnections(brand.id)}>{tPortfolio("manageChannels")}</Button>
                  {currentBrands.canManage ? <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setArchivingBrandId(brand.id); setEditingBrandId(null); setActiveBrandKitId(null); }}>{tPortfolio("archiveBrand")}</Button> : null}
                  <Button appearance="quiet" type="button" disabled={busy} aria-expanded={activeBrandKitId === brand.id} onClick={() => { setActiveBrandKitId((current) => current === brand.id ? null : brand.id); setEditingBrandId(null); setArchivingBrandId(null); }}>{tPortfolio("editBrandKit")}</Button>
                </span>
              </li>;
            })}
          </ul>
        ) : null}
          {brandSetupPrompt && brandSetupPrompt.organizationId === activeOrganizationId && activeBrands.some((brand) => brand.id === brandSetupPrompt.id) ? <section className="brandSetupNext" aria-labelledby="brand-setup-next-title">
            <div><h3 id="brand-setup-next-title">{tPortfolio("brandSetupNextTitle", { brand: brandSetupPrompt.name })}</h3><p>{tPortfolio("brandSetupNextDescription")}</p></div>
            <div className="brandSetupNext__actions">
              <Button type="button" onClick={() => openSocialConnections(brandSetupPrompt.id)}>{tPortfolio("setupConnections")}</Button>
              <Button appearance="quiet" type="button" onClick={() => { setBrandView("brands"); setActiveBrandKitId(brandSetupPrompt.id); document.getElementById(`workspace-brand-${brandSetupPrompt.id}`)?.scrollIntoView({ block: "center" }); }}>{tPortfolio("setupBrandKit")}</Button>
              <Button appearance="quiet" type="button" onClick={() => setBrandSetupPrompt(null)}>{tPortfolio("setupLater")}</Button>
            </div>
          </section> : null}
        </div>
        <section id={WORKSPACE_SECTION_IDS.connections} className="brandConnectionsPanel" role="tabpanel" aria-labelledby="brand-tab-connections" hidden={brandView !== "connections"}>
          <div className="brandConnectionsPanel__heading"><div><h3>{tPortfolio("connectionsPageTitle")}</h3><p>{tPortfolio("connectionsPageDescription")}</p></div></div>
          {activeBrands.length ? <>
            <SelectField id="connections-brand" label={tPortfolio("connectionsBrand")} value={selectedConnectionBrand?.id ?? ""} onChange={(event) => setConnectionBrandId(event.target.value)}>
              {activeBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </SelectField>
            {brandView === "connections" && selectedConnectionBrand ? <SocialConnectionManager key={selectedConnectionBrand.id} brandId={selectedConnectionBrand.id} canManage={currentBrands.canManage === true} /> : null}
          </> : <div className="workspaceEmpty"><p>{currentBrands.canManage ? tWorkspace("emptyBrands") : tPortfolio("noBrandsReadOnly")}</p>{currentBrands.canManage ? <Button type="button" onClick={() => setCreateBrandOpen(true)}>{tPortfolio("newBrand")}</Button> : null}</div>}
        </section>
        <Dialog open={createBrandOpen && currentBrands.canManage === true} onOpenChange={(open) => { if (!busy) setCreateBrandOpen(open); }}>
          <DialogContent className="brandFormDialog" aria-labelledby="brand-create-title" aria-describedby="brand-create-description">
            <DialogHeader><DialogTitle id="brand-create-title">{tPortfolio("createBrandDialogTitle")}</DialogTitle><DialogDescription id="brand-create-description">{tPortfolio("createDescription")}</DialogDescription></DialogHeader>
            <form className="brandCreate__form" onSubmit={handleCreateBrand}>
              <TextField id="brandName" name="brandName" label={tWorkspace("brandName")} maxLength={BRAND_LIMITS.nameCharacters} required />
              <TextField id="brandDescription" name="brandDescription" label={tWorkspace("brandDescription")} maxLength={BRAND_LIMITS.descriptionCharacters} />
              <SelectField id="brandIndustry" name="brandIndustry" label={tWorkspace("brandIndustry")} defaultValue="" required>
                <option value="" disabled>{tPortfolio("selectSegment")}</option>
                {BRAND_SEGMENTS.map((segment) => <option key={segment} value={segment}>{tPortfolio(`segments.${segment}`)}</option>)}
              </SelectField>
              <TextField id="brandWebsite" name="brandWebsite" type="url" label={tPortfolio("websiteUrl")} placeholder="https://" maxLength={BRAND_LIMITS.websiteUrlCharacters} />
              <FileField id="brandLogo" name="brandLogo" label={tPortfolio("brandLogo")} helpText={tPortfolio("brandLogoHelp")} accept={BRAND_ASSET_LIMITS.allowedMimeTypes.join(",")} />
              <div className="brandCollection__editorActions"><DialogClose asChild><Button appearance="quiet" type="button" disabled={busy}>{tPortfolio("cancel")}</Button></DialogClose><Button type="submit" disabled={busy || !activeOrganization?.id || currentBrands.error || currentBrands.pending}>{busy ? tAuth("working") : tWorkspace("addBrand")}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(editingBrandId)} onOpenChange={(open) => { if (!open && !busy) setEditingBrandId(null); }}>
          {activeBrands.find((brand) => brand.id === editingBrandId) ? (() => {
            const brand = activeBrands.find((item) => item.id === editingBrandId)!;
            return <DialogContent className="brandFormDialog" aria-labelledby="brand-edit-title">
              <DialogHeader><DialogTitle id="brand-edit-title">{tPortfolio("editBrandDialogTitle")}</DialogTitle><DialogDescription>{brand.name}</DialogDescription></DialogHeader>
              <form className="brandCreate__form" onSubmit={(event) => void handleUpdateBrand(event, brand.id)}>
                <TextField id="brand-edit-name" name="name" label={tPortfolio("brandName")} defaultValue={brand.name} maxLength={BRAND_LIMITS.nameCharacters} required />
                <TextField id="brand-edit-description" name="description" label={tPortfolio("brandDescription")} defaultValue={brand.description ?? ""} maxLength={BRAND_LIMITS.descriptionCharacters} />
                <SelectField id="brand-edit-industry" name="industry" label={tPortfolio("industry")} defaultValue={brand.industry ?? "other"}>
                  {brand.industry && !BRAND_SEGMENTS.some((segment) => segment === brand.industry) ? <option value={brand.industry}>{brand.industry}</option> : null}
                  {BRAND_SEGMENTS.map((segment) => <option key={segment} value={segment}>{tPortfolio(`segments.${segment}`)}</option>)}
                </SelectField>
                <TextField id="brand-edit-website" name="websiteUrl" type="url" label={tPortfolio("websiteUrl")} defaultValue={brand.websiteUrl ?? ""} maxLength={BRAND_LIMITS.websiteUrlCharacters} />
                {brand.logoAssetId ? <div className="brandEditLogo"><span className="brandEditLogo__preview">{brand.logoAssetStatus ? <Image src={`/api/brands/${brand.id}/logo/${brand.logoAssetId}`} alt="" fill sizes="72px" unoptimized /> : null}</span><span><strong>{tPortfolio("currentBrandLogo")}</strong>{brand.logoAssetStatus === "pending_review" ? <small>{tPortfolio("brandLogoPending")}</small> : null}</span></div> : null}
                <FileField id="brand-edit-logo" name="brandLogo" label={tPortfolio("replaceBrandLogo")} helpText={tPortfolio("brandLogoHelp")} accept={BRAND_ASSET_LIMITS.allowedMimeTypes.join(",")} />
                <div className="brandCollection__editorActions"><Button type="submit" disabled={busy}>{busy ? tAuth("working") : tPortfolio("saveChanges")}</Button><Button appearance="quiet" type="button" disabled={busy} onClick={() => setEditingBrandId(null)}>{tPortfolio("cancel")}</Button></div>
              </form>
            </DialogContent>;
          })() : null}
        </Dialog>
        <Dialog open={Boolean(archivingBrandId)} onOpenChange={(open) => { if (!open && !busy) setArchivingBrandId(null); }}>
          {activeBrands.find((brand) => brand.id === archivingBrandId) ? (() => {
            const brand = activeBrands.find((item) => item.id === archivingBrandId);
            if (!brand) return null;
            return <DialogContent aria-labelledby="brand-archive-title" aria-describedby="brand-archive-description">
              <DialogHeader><DialogTitle id="brand-archive-title">{tPortfolio("archiveBrand")}</DialogTitle><DialogDescription id="brand-archive-description">{tPortfolio("archiveConfirmation", { brand: brand.name })}</DialogDescription></DialogHeader>
              <div className="brandCollection__editorActions"><Button appearance="quiet" type="button" disabled={busy} onClick={() => setArchivingBrandId(null)}>{tPortfolio("cancel")}</Button><Button appearance="danger" type="button" disabled={busy} onClick={() => void handleArchiveBrand(brand.id)}>{busy ? tAuth("working") : tPortfolio("confirmArchive")}</Button></div>
            </DialogContent>;
          })() : null}
        </Dialog>
        <Dialog open={Boolean(activeBrandKitId)} onOpenChange={(open) => { if (!open && !busy) setActiveBrandKitId(null); }}>
          {activeBrands.find((brand) => brand.id === activeBrandKitId) ? (() => {
            const brand = activeBrands.find((item) => item.id === activeBrandKitId);
            if (!brand) return null;
            return <DialogContent className="brandKitDialog" aria-labelledby="brand-kit-dialog-title" aria-describedby="brand-kit-dialog-description">
              <DialogHeader><DialogTitle id="brand-kit-dialog-title">{tBrandKit("title", { brand: brand.name })}</DialogTitle><DialogDescription id="brand-kit-dialog-description">{tBrandKit("description")}</DialogDescription></DialogHeader>
              <div className="brandKitDialog__close"><DialogClose asChild><Button appearance="quiet" type="button" disabled={busy}><X aria-hidden="true" size={16} />{tPortfolio("closeBrandKit")}</Button></DialogClose></div>
              <BrandKitEditor brandId={brand.id} brandName={brand.name} showHeader={false} />
            </DialogContent>;
          })() : null}
        </Dialog>
      </section>
      <TeamManagement
        key={`team:${isChangingOrganization ? "organization-switch" : activeOrganization?.id ?? "organization-pending"}`}
        organizationId={isChangingOrganization ? null : activeOrganization?.id ?? null}
        brands={currentBrands.items.filter((brand) => brand.isActive)}
      />
    </WorkspaceShell>
  );
}
