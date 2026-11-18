"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AtSign, Facebook, Globe, Instagram, Rss } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { CheckboxField, IntegerField, SelectField, TextField } from "@/components/ui/field";
import { useSystemFeedback } from "@/components/ui/system-feedback";
import { COMPETITOR_RETRIEVAL_METHODS, COMPETITOR_SOURCE_STATUS, COMPETITOR_WORKER, SOCIAL_PLATFORMS, type Locale } from "@/lib/constants";
import { parseIntegerFormValue } from "@/lib/forms";
import type { BrandListItem } from "@/lib/validation/brands";
import { competitorAnalysisRetryResponseSchema, competitorAlertSettingsSchema, competitorProfileLookupResponseSchema, competitorSourcesResponseSchema } from "@/lib/validation/competitors";
import type { z } from "zod";

type CompetitorData = z.infer<typeof competitorSourcesResponseSchema>["data"];
type CompetitorObservation = CompetitorData["sources"][number]["observations"][number];
type CompetitorTopic = NonNullable<CompetitorObservation["analysis"]>["topic"];
const feedErrorTranslationKeys = ["invalid_source_url", "blocked_source_address", "source_request_failed", "source_response_too_large", "source_content_type_unsupported", "source_feed_invalid", "source_http_failure", "social_connection_required", "social_permission_required", "x_api_disabled", "site_robots_blocked", "site_sitemap_unavailable", "site_content_unsupported", "worker_interrupted"] as const;
type ProfileLookupData = z.infer<typeof competitorProfileLookupResponseSchema>["data"];
type ProfileLookupError = { brandId: string; key: "lookupConnectionRequired" | "lookupInstagramConnectionRequired" | "lookupFacebookConnectionRequired" | "lookupXConnectionRequired" | "lookupXDisabled" | "lookupNotFound" | "lookupInvalid" | "lookupUnavailable" };
type ProfileLookupPreview = { brandId: string; data: ProfileLookupData };
export function CompetitorIntelligence({ brands, selectedBrandId, onBrandChange, onOpenConnections }: { brands: BrandListItem[]; selectedBrandId: string; onBrandChange: (brandId: string) => void; onOpenConnections: (brandId: string) => void }) {
  const t = useTranslations("competitorResearch");
  const tPlatforms = useTranslations("platforms");
  const showFeedback = useSystemFeedback();
  const locale = useLocale() as Locale;
  const activeBrands = brands.filter((brand) => brand.isActive);
  const brandId = activeBrands.some((brand) => brand.id === selectedBrandId) ? selectedBrandId : activeBrands[0]?.id ?? "";
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceMethodFilter, setSourceMethodFilter] = useState<typeof COMPETITOR_RETRIEVAL_METHODS[number] | "">("");
  const [sourceStatusFilter, setSourceStatusFilter] = useState<typeof COMPETITOR_SOURCE_STATUS[keyof typeof COMPETITOR_SOURCE_STATUS] | "">("");
  const [sourceSort, setSourceSort] = useState<"attention" | "recent" | "name">("attention");
  const [websiteName, setWebsiteName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [lookupPlatform, setLookupPlatform] = useState<"youtube" | "instagram" | "facebook" | "x">("youtube");
  const [lookupError, setLookupError] = useState<ProfileLookupError | null>(null);
  const [profilePreview, setProfilePreview] = useState<ProfileLookupPreview | null>(null);
  const [alertSettingsError, setAlertSettingsError] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "sources">("overview");
  const requestKey = `${brandId}:${refreshKey}`;
  const loading = Boolean(brandId) && loadedKey !== requestKey;
  const error = errorKey === requestKey;
  const currentData = loadedKey === requestKey ? data : null;

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const currentIndex = tabs.indexOf(event.currentTarget);
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
      : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab?.focus();
    nextTab?.click();
  }

  useEffect(() => {
    if (!brandId) return;
    const controller = new AbortController();
    void fetch(`/api/brands/${brandId}/competitors`, {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error();
      const parsed = competitorSourcesResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error();
      setData(parsed.data.data);
      setErrorKey(null);
    }).catch((cause: unknown) => {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setErrorKey(requestKey);
    }).finally(() => { if (!controller.signal.aborted) setLoadedKey(requestKey); });
    return () => controller.abort();
  }, [brandId, refreshKey, requestKey]);

  async function lookupProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandId) return;
    setLookupBusy(true);
    setLookupError(null);
    setProfilePreview(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/lookup`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: lookupPlatform, identifier }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const code = typeof payload === "object" && payload !== null && !Array.isArray(payload) && "code" in payload && typeof payload.code === "string" ? payload.code : "";
        setLookupError({ brandId, key: code === "COMPETITOR_X_API_DISABLED" ? "lookupXDisabled" : code === "COMPETITOR_INSTAGRAM_CONNECTION_REQUIRED" ? "lookupInstagramConnectionRequired" : code === "COMPETITOR_FACEBOOK_CONNECTION_REQUIRED" ? "lookupFacebookConnectionRequired" : code === "COMPETITOR_X_CONNECTION_REQUIRED" ? "lookupXConnectionRequired" : code === "COMPETITOR_YOUTUBE_CONNECTION_REQUIRED" ? "lookupConnectionRequired"
          : code === "COMPETITOR_PROFILE_NOT_FOUND" ? "lookupNotFound"
            : code === "INVALID_REQUEST" ? "lookupInvalid" : "lookupUnavailable" });
        return;
      }
      const parsed = competitorProfileLookupResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error();
      setProfilePreview({ brandId, data: parsed.data.data });
    } catch {
      setLookupError({ brandId, key: "lookupUnavailable" });
    } finally {
      setLookupBusy(false);
    }
  }

  async function addSource() {
    const preview = profilePreview?.brandId === brandId ? profilePreview.data : null;
    if (!brandId || !preview) return;
    setSaving(true);
    try {
      const response = await fetch(preview.platform === "instagram" ? `/api/brands/${brandId}/competitors/instagram` : preview.platform === "facebook" ? `/api/brands/${brandId}/competitors/facebook` : preview.platform === "x" ? `/api/brands/${brandId}/competitors/x` : `/api/brands/${brandId}/competitors`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview.platform === "instagram" || preview.platform === "facebook" || preview.platform === "x"
          ? { identifier: preview.handle?.replace(/^@/u, "") ?? preview.externalProfileId }
          : { name: preview.name, feedUrl: preview.feedUrl }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const code = typeof payload === "object" && payload !== null && !Array.isArray(payload) && "code" in payload && typeof payload.code === "string" ? payload.code : "";
        const key = code === "COMPETITOR_X_API_DISABLED" ? "lookupXDisabled"
          : code === "COMPETITOR_SOURCE_EXISTS" ? "sourceDuplicate"
          : code === "COMPETITOR_SOURCE_LIMIT_REACHED" ? "sourceLimit"
            : code === "COMPETITOR_INSTAGRAM_CONNECTION_REQUIRED" ? "lookupInstagramConnectionRequired"
              : code === "COMPETITOR_FACEBOOK_CONNECTION_REQUIRED" ? "lookupFacebookConnectionRequired"
                : code === "COMPETITOR_X_CONNECTION_REQUIRED" ? "lookupXConnectionRequired"
                : code === "COMPETITOR_YOUTUBE_CONNECTION_REQUIRED" ? "lookupConnectionRequired"
                  : code === "COMPETITOR_PROFILE_NOT_FOUND" ? "lookupNotFound"
                    : code === "INVALID_REQUEST" ? "lookupInvalid" : "saveError";
        showFeedback("error", t(key));
        return;
      }
      setIdentifier("");
      setProfilePreview(null);
      setActiveTab("sources");
      showFeedback("success", t("sourceAdded"));
      setRefreshKey((value) => value + 1);
    } catch {
      showFeedback("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function addWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandId || !websiteName.trim() || !websiteUrl.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: websiteName, feedUrl: websiteUrl, retrievalMethod: "website_crawl" }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const code = typeof payload === "object" && payload !== null && !Array.isArray(payload) && "code" in payload && typeof payload.code === "string" ? payload.code : "";
        showFeedback("error", t(code === "COMPETITOR_SOURCE_EXISTS" ? "sourceDuplicate" : code === "COMPETITOR_SOURCE_LIMIT_REACHED" ? "sourceLimit" : code === "INVALID_REQUEST" ? "websiteInvalid" : "saveError"));
        return;
      }
      setWebsiteName("");
      setWebsiteUrl("");
      setActiveTab("sources");
      showFeedback("success", t("sourceAdded"));
      setRefreshKey((value) => value + 1);
    } catch {
      showFeedback("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function updateSource(sourceId: string, status: typeof COMPETITOR_SOURCE_STATUS[keyof typeof COMPETITOR_SOURCE_STATUS]) {
    if (!brandId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      const feedbackKey = status === COMPETITOR_SOURCE_STATUS.archived ? "sourceArchived"
        : status === COMPETITOR_SOURCE_STATUS.paused ? "sourcePaused"
          : currentData?.sources.find((source) => source.id === sourceId)?.status === COMPETITOR_SOURCE_STATUS.archived ? "sourceRestored" : "sourceResumed";
      showFeedback("success", t(feedbackKey));
      setRefreshKey((value) => value + 1);
    } catch {
      showFeedback("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function retryAnalysis(sourceId: string) {
    if (!brandId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}/analysis`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const result = competitorAnalysisRetryResponseSchema.safeParse(await response.json());
      if (!response.ok || !result.success) throw new Error();
      showFeedback("success", t("retryQueued", { count: result.data.data.retried }));
      setRefreshKey((value) => value + 1);
    } catch {
      showFeedback("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function retrySource(sourceId: string) {
    if (!brandId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}/retry`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (response.status === 409) { showFeedback("error", t("retrySourceBusy")); return; }
      if (!response.ok) throw new Error();
      showFeedback("success", t("retrySourceQueued"));
      setRefreshKey((value) => value + 1);
    } catch { showFeedback("error", t("saveError")); }
    finally { setSaving(false); }
  }

  async function saveAlertSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandId || !currentData) return;
    const form = new FormData(event.currentTarget);
    const parsed = competitorAlertSettingsSchema.safeParse({
      enabled: form.get("enabled") === "on",
      failureThreshold: parseIntegerFormValue(form.get("failureThreshold")),
      staleAfterHours: parseIntegerFormValue(form.get("staleAfterHours")),
    });
    if (!parsed.success) { setAlertSettingsError(true); return; }
    setAlertSettingsError(false);
    setSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/alerts`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error();
      showFeedback("success", t("alertSettingsSaved"));
      setRefreshKey((value) => value + 1);
    } catch { showFeedback("error", t("saveError")); }
    finally { setSaving(false); }
  }

  const analysisGroups = new Map<CompetitorTopic, Array<{ sourceName: string; observation: CompetitorObservation }>>();
  for (const source of currentData?.sources ?? []) {
    for (const observation of source.observations) {
      const topic = observation.analysis?.topic;
      if (!topic) continue;
      const entries = analysisGroups.get(topic) ?? [];
      entries.push({ sourceName: source.name, observation });
      analysisGroups.set(topic, entries);
    }
  }
  const rankedTopics = [...analysisGroups].sort((left, right) => right[1].length - left[1].length).slice(0, 4);
  const pendingAnalysisCount = currentData?.sources.reduce((total, source) => total + source.observations.filter((observation) => observation.analysisStatus === "pending" || observation.analysisStatus === "processing").length, 0) ?? 0;
  const activeSourceCount = currentData?.sources.filter((source) => source.status === COMPETITOR_SOURCE_STATUS.active).length ?? 0;
  const sourceAttentionCount = currentData?.sources.filter((source) => source.status === COMPETITOR_SOURCE_STATUS.active && (source.hasError || source.isStale)).length ?? 0;
  const newObservationCount = currentData?.sources.reduce((total, source) => total + source.newObservationCount, 0) ?? 0;
  const normalizedSourceSearch = sourceSearch.trim().toLocaleLowerCase(locale);
  const visibleSources = (currentData?.sources ?? []).filter((source) =>
    (!sourceMethodFilter || source.retrievalMethod === sourceMethodFilter)
    && (!sourceStatusFilter || source.status === sourceStatusFilter)
    && (!normalizedSourceSearch || `${source.name} ${source.feedUrl}`.toLocaleLowerCase(locale).includes(normalizedSourceSearch)),
  ).sort((left, right) => {
    if (sourceSort === "name") return left.name.localeCompare(right.name, locale);
    if (sourceSort === "recent") return (right.lastFetchedAt ? new Date(right.lastFetchedAt).getTime() : 0) - (left.lastFetchedAt ? new Date(left.lastFetchedAt).getTime() : 0);
    const leftNeedsAttention = left.status === COMPETITOR_SOURCE_STATUS.active && (left.hasError || left.isStale);
    const rightNeedsAttention = right.status === COMPETITOR_SOURCE_STATUS.active && (right.hasError || right.isStale);
    return Number(rightNeedsAttention) - Number(leftNeedsAttention) || left.name.localeCompare(right.name, locale);
  });

  return <section className="competitorIntelligence" id="workspace-competitors" aria-labelledby="competitor-intelligence-title">
    <header className="workspaceHeading">
      <div><p className="entryKicker">{t("eyebrow")}</p><h2 id="competitor-intelligence-title">{t("title")}</h2><p className="entryDescription">{t("description")}</p></div>
    </header>
    <div className="competitorIntelligence__controls">
      <SelectField id="competitor-brand" label={t("brandContext")} value={brandId} onChange={(event) => onBrandChange(event.target.value)}>
        {activeBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </SelectField>
    </div>
    {data?.canManage ? <section className="competitorIntelligence__addProfile" aria-labelledby="competitor-add-profile-title">
      <div><h3 id="competitor-add-profile-title">{t("addProfileTitle")}</h3><p>{t("addProfileDescription")}</p></div>
      <form className="competitorIntelligence__form" onSubmit={(event) => void lookupProfile(event)}>
        <SelectField id="competitor-profile-network" label={t("network")} value={lookupPlatform} onChange={(event) => { const platform = event.target.value; if (platform === "youtube" || platform === "instagram" || platform === "facebook" || platform === "x") setLookupPlatform(platform); setIdentifier(""); setProfilePreview(null); setLookupError(null); }}>
          {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform} disabled={platform !== "youtube" && platform !== "instagram" && platform !== "facebook" && (platform !== "x" || !currentData?.features.xApiEnabled)}>{platform === "x" && !currentData?.features.xApiEnabled ? t("platformLookupXDisabled") : platform === "linkedin" ? t("platformLookupLinkedInUnavailable") : platform !== "youtube" && platform !== "instagram" && platform !== "facebook" && platform !== "x" ? t("platformLookupUnavailable", { platform: tPlatforms(platform) }) : tPlatforms(platform)}</option>)}
        </SelectField>
        <Disclosure className="competitorIntelligence__websiteDisclosure" title={t("linkedinReadBoundaryTitle")}>
          <p>{t("linkedinReadBoundary")}</p>
        </Disclosure>
        {!currentData?.features.xApiEnabled ? <p>{t("xMonitoringAdminDisabled")}</p> : null}
        <TextField id="competitor-profile-identifier" label={t("profileIdentifier")} value={identifier} onChange={(event) => { setIdentifier(event.target.value); setProfilePreview(null); setLookupError(null); }} maxLength={COMPETITOR_WORKER.maximumProfileIdentifierCharacters} placeholder={lookupPlatform === "instagram" ? t("instagramIdentifierPlaceholder") : lookupPlatform === "facebook" ? t("facebookIdentifierPlaceholder") : lookupPlatform === "x" ? t("xIdentifierPlaceholder") : t("profileIdentifierPlaceholder")} required />
        <Button type="submit" disabled={lookupBusy || saving || loading || !brandId || !identifier.trim()}>{lookupBusy ? t("lookingUp") : t("validateProfile")}</Button>
        <p>{t(lookupPlatform === "instagram" ? "profileLookupHelpInstagram" : lookupPlatform === "facebook" ? "profileLookupHelpFacebook" : lookupPlatform === "x" ? "profileLookupHelpX" : "profileLookupHelp")}</p>
      </form>
      {lookupError?.brandId === brandId ? <div className="competitorIntelligence__lookupFeedback"><p className="entryMessage entryMessage--error" role="alert">{t(lookupError.key)}</p>{lookupError.key.includes("ConnectionRequired") ? <Button appearance="quiet" type="button" onClick={() => onOpenConnections(brandId)}>{t("openConnections")}</Button> : null}</div> : null}
      {profilePreview?.brandId === brandId ? <article className="competitorIntelligence__profilePreview" aria-label={t("profilePreviewTitle")}>
        <div><span>{t("profileValidated", { platform: tPlatforms(profilePreview.data.platform) })}</span><h4>{profilePreview.data.name}</h4><p>{profilePreview.data.handle ?? profilePreview.data.externalProfileId}</p><a href={profilePreview.data.profileUrl} target="_blank" rel="noopener noreferrer">{profilePreview.data.profileUrl}</a></div>
        <div><Button type="button" disabled={saving} onClick={() => void addSource()}>{saving ? t("working") : t("confirmAddProfile")}</Button><Button appearance="quiet" type="button" disabled={saving} onClick={() => setProfilePreview(null)}>{t("changeIdentifier")}</Button></div>
      </article> : null}
      <Disclosure className="competitorIntelligence__websiteDisclosure" title={t("addWebsiteTitle")}>
        <p>{t("websiteHelp")}</p>
        <form className="competitorIntelligence__websiteForm" onSubmit={(event) => void addWebsite(event)}>
          <TextField id="competitor-website-name" label={t("websiteName")} value={websiteName} onChange={(event) => setWebsiteName(event.target.value)} maxLength={120} required />
          <TextField id="competitor-website-url" type="url" label={t("websiteUrl")} value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" maxLength={2048} required />
          <Button type="submit" disabled={saving || loading || !brandId || !websiteName.trim() || !websiteUrl.trim()}>{saving ? t("working") : t("addWebsite")}</Button>
        </form>
      </Disclosure>
    </section> : null}
    {alertSettingsError ? <p className="entryMessage entryMessage--error" role="alert">{t("alertSettingsError")}</p> : null}
    {loading ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : null}
    {error ? <p className="entryMessage entryMessage--error" role="alert">{t("loadError")}</p> : null}
    {!brandId || activeBrands.length === 0 ? <p className="workspaceEmpty">{t("noBrands")}</p> : null}
    {!loading && !error && currentData ? <>
      <div className="publicationAnalytics__tabs" role="tablist" aria-label={t("tabsLabel")}>
        {(["overview", "sources"] as const).map((tab) => <button
          className={activeTab === tab ? "publicationAnalytics__tab is-selected" : "publicationAnalytics__tab"}
          id={`competitor-tab-${tab}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`competitor-panel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1}
          key={tab}
          onClick={() => setActiveTab(tab)}
          onKeyDown={handleTabKeyDown}
        >{t(`tabs.${tab}`)}</button>)}
      </div>
      <div id="competitor-panel-overview" className="publicationAnalytics__tabPanel" role="tabpanel" tabIndex={0} aria-labelledby="competitor-tab-overview" hidden={activeTab !== "overview"}>
    {!loading && !error && currentData ? <section className="competitorIntelligence__analysis" aria-labelledby="competitor-analysis-title">
      <div><h3 id="competitor-analysis-title">{t("analysisTitle")}</h3><p>{t("analysisDescription")}</p></div>
      {pendingAnalysisCount > 0 ? <p className="competitorIntelligence__sourceMeta" role="status">{t("analysisPending", { count: pendingAnalysisCount })}</p> : null}
      {rankedTopics.length ? <ol className="competitorIntelligence__themes">
        {rankedTopics.map(([topic, entries]) => <li key={topic}>
          <h4>{t(`topics.${topic}`)}<span>{t("evidenceCount", { count: entries.length })}</span></h4>
          <ul>{entries.slice(0, 3).map(({ sourceName, observation }) => <li key={observation.id}>
            <div><a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{observation.title}</a><small>{t("sourceContext", { source: sourceName })}</small></div>
            {observation.analysis ? <><p>{observation.analysis.observedPattern[locale]}</p><p><strong>{t("opportunityLabel")}: </strong>{observation.analysis.editorialOpportunity[locale]}</p></> : null}
          </li>)}</ul>
        </li>)}
      </ol> : <p className="competitorIntelligence__sourceMeta">{t("analysisEmpty")}</p>}
      {currentData.sources.some((source) => source.analysisUnavailableCount > 0) ? <p className="competitorIntelligence__sourceMeta">{t("analysisUnavailable")}</p> : null}
    </section> : null}
    {!loading && !error && currentData ? <section className="competitorIntelligence__operations" aria-label={t("operationsSummaryTitle")}>
      <div><span>{t("operationsActiveSources")}</span><strong>{activeSourceCount}</strong></div>
      <div className={sourceAttentionCount ? "has-attention" : ""}><span>{t("operationsAttention")}</span><strong>{sourceAttentionCount}</strong></div>
      <div><span>{t("operationsNewPublications", { hours: COMPETITOR_WORKER.recentPublicationAlertHours })}</span><strong>{newObservationCount}</strong></div>
      <div><span>{t("operationsPendingAnalysis")}</span><strong>{currentData.coverage.pending + currentData.coverage.processing}</strong></div>
    </section> : null}
    {!loading && !error && currentData ? <section className="competitorIntelligence__trends" aria-labelledby="competitor-trends-title">
      <div><h3 id="competitor-trends-title">{t("trendTitle")}</h3><p>{t("trendDescription", { days: currentData.trendComparison.windowDays })}</p></div>
      <p className="competitorIntelligence__trendTotals">{t("trendTotals", { current: currentData.trendComparison.currentTotal, previous: currentData.trendComparison.previousTotal })}</p>
      {currentData.trendComparison.topics.length ? <ul>{currentData.trendComparison.topics.map((topic) => {
        const evidence = currentData.sources.flatMap((source) => source.observations.map((observation) => ({ sourceName: source.name, observation })))
          .find(({ observation }) => observation.analysis?.topic === topic.topic && observation.contentPublishedAt && new Date(observation.contentPublishedAt).getTime() >= Date.now() - currentData.trendComparison.windowDays * 24 * 60 * 60_000);
        return <li key={topic.topic}>
          <strong>{t(`topics.${topic.topic}`)}</strong>
          <span>{t("trendCounts", { current: topic.current, previous: topic.previous, change: new Intl.NumberFormat(locale, { signDisplay: "always" }).format(topic.current - topic.previous) })}</span>
          {evidence ? <a href={evidence.observation.sourceUrl} target="_blank" rel="noopener noreferrer">{t("trendEvidence", { source: evidence.sourceName })}: {evidence.observation.title}</a> : <small>{t("trendEvidenceUnavailable")}</small>}
        </li>;
      })}</ul> : <p className="competitorIntelligence__sourceMeta">{t("trendEmpty")}</p>}
    </section> : null}
    {!loading && !error && currentData ? <section className="competitorIntelligence__monitoring" aria-label={t("monitoringTitle")}>
      <div className="competitorIntelligence__workerHealth" role={currentData.worker.status === "healthy" ? "status" : "alert"}>
        <strong>{t(`worker.${currentData.worker.status}`)}</strong>
        <span>{currentData.worker.lastSeenAt ? t("workerLastSeen", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentData.worker.lastSeenAt)) }) : t("workerNeverSeen")}</span>
      </div>
      <div className="competitorIntelligence__coverage" aria-label={t("coverageTitle")}>
        <strong>{t("coverageTitle")}</strong>
        <span>{t("coverageTotal", { count: currentData.coverage.total })}</span>
        <span>{t("coverageReady", { count: currentData.coverage.ready })}</span>
        <span>{t("coveragePending", { count: currentData.coverage.pending + currentData.coverage.processing })}</span>
        <span>{t("coverageUnavailable", { count: currentData.coverage.unavailable })}</span>
      </div>
      {currentData.alerts.length > 0 ? <ul className="competitorIntelligence__alerts" aria-label={t("alertsTitle")}>
        {currentData.alerts.map((alert, index) => <li key={`${alert.sourceId}:${alert.type}:${index}`} role="alert"><span>{t(`alertType.${alert.type}`, { source: alert.sourceName, count: alert.count ?? 0, hours: COMPETITOR_WORKER.recentPublicationAlertHours })}</span><a href={`#competitor-source-${alert.sourceId}`} onClick={() => setActiveTab("sources")}>{t("viewSource")}</a></li>)}
      </ul> : null}
      {currentData.canManage ? <form key={`${brandId}:${currentData.alertSettings.enabled}:${currentData.alertSettings.failureThreshold}:${currentData.alertSettings.staleAfterHours}`} className="competitorIntelligence__alertSettings" onSubmit={(event) => void saveAlertSettings(event)}>
        <h3>{t("alertSettingsTitle")}</h3>
        <CheckboxField id="competitor-alerts-enabled" name="enabled" defaultChecked={currentData.alertSettings.enabled} label={t("alertsEnabled")} />
        <IntegerField id="competitor-alert-failure-threshold" name="failureThreshold" min={COMPETITOR_WORKER.minimumAlertFailureThreshold} max={COMPETITOR_WORKER.maximumAlertFailureThreshold} defaultValue={currentData.alertSettings.failureThreshold} label={t("failureThreshold")} required />
        <IntegerField id="competitor-alert-stale-hours" name="staleAfterHours" min={COMPETITOR_WORKER.minimumAlertStaleAfterHours} max={COMPETITOR_WORKER.maximumAlertStaleAfterHours} defaultValue={currentData.alertSettings.staleAfterHours} label={t("staleAfterHours")} required />
        <Button appearance="quiet" type="submit" disabled={saving}>{t("saveAlertSettings")}</Button>
      </form> : null}
    </section> : null}
      </div>
      <div id="competitor-panel-sources" className="publicationAnalytics__tabPanel" role="tabpanel" tabIndex={0} aria-labelledby="competitor-tab-sources" hidden={activeTab !== "sources"}>
    {!loading && !error && currentData && currentData.sources.length === 0 ? <p className="workspaceEmpty">{t("empty")}</p> : null}
    {!loading && !error && currentData?.sources.length ? <>
      <section className="competitorIntelligence__sourceFilters" aria-label={t("sourceFiltersTitle")}>
        <TextField id="competitor-source-search" type="search" label={t("sourceSearch")} value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} />
        <SelectField id="competitor-source-method-filter" label={t("sourceNetworkFilter")} value={sourceMethodFilter} onChange={(event) => setSourceMethodFilter(COMPETITOR_RETRIEVAL_METHODS.find((method) => method === event.target.value) ?? "")}>
          <option value="">{t("allSourceNetworks")}</option>
          {COMPETITOR_RETRIEVAL_METHODS.map((method) => <option key={method} value={method}>{t(`sourceMethod.${method}`)}</option>)}
        </SelectField>
        <SelectField id="competitor-source-status-filter" label={t("sourceStatusFilter")} value={sourceStatusFilter} onChange={(event) => setSourceStatusFilter(Object.values(COMPETITOR_SOURCE_STATUS).find((status) => status === event.target.value) ?? "")}>
          <option value="">{t("allSourceStatuses")}</option>
          {Object.values(COMPETITOR_SOURCE_STATUS).map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
        </SelectField>
        <SelectField id="competitor-source-sort" label={t("sourceSort")} value={sourceSort} onChange={(event) => setSourceSort(event.target.value === "recent" || event.target.value === "name" ? event.target.value : "attention")}>
          <option value="attention">{t("sortAttention")}</option><option value="recent">{t("sortRecent")}</option><option value="name">{t("sortName")}</option>
        </SelectField>
        <span aria-live="polite">{t("sourcesFound", { count: visibleSources.length })}</span>
        {sourceSearch || sourceMethodFilter || sourceStatusFilter ? <Button appearance="quiet" type="button" onClick={() => { setSourceSearch(""); setSourceMethodFilter(""); setSourceStatusFilter(""); }}>{t("clearSourceFilters")}</Button> : null}
      </section>
      {visibleSources.length === 0 ? <p className="workspaceEmpty">{t("noSourcesMatch")}</p> : <ul className="competitorIntelligence__sources">
      {visibleSources.map((source) => <li key={source.id} id={`competitor-source-${source.id}`}>
        <div className="competitorIntelligence__sourceHeader">
          <div><h3>{source.name} <span className="competitorIntelligence__sourceType">{source.retrievalMethod === "instagram_graph" ? <Instagram aria-hidden="true" size={14} /> : source.retrievalMethod === "facebook_graph" ? <Facebook aria-hidden="true" size={14} /> : source.retrievalMethod === "website_crawl" ? <Globe aria-hidden="true" size={14} /> : source.retrievalMethod === "x_api" ? <AtSign aria-hidden="true" size={14} /> : <Rss aria-hidden="true" size={14} />}{t(`sourceMethod.${source.retrievalMethod}`)}</span></h3><a href={source.feedUrl} target="_blank" rel="noopener noreferrer">{source.feedUrl}</a></div>
          <div className="competitorIntelligence__sourceActions">
            <span>{t(`status.${source.status}`)}</span>
            <strong className={`competitorIntelligence__health competitorIntelligence__health--${source.status === COMPETITOR_SOURCE_STATUS.archived ? "archived" : source.status === COMPETITOR_SOURCE_STATUS.paused ? "paused" : source.hasError ? "failing" : source.isStale ? "stale" : "healthy"}`}>
              {t(`sourceHealth.${source.status === COMPETITOR_SOURCE_STATUS.archived ? "archived" : source.status === COMPETITOR_SOURCE_STATUS.paused ? "paused" : source.hasError ? "failing" : source.isStale ? "stale" : "healthy"}`)}
            </strong>
            {source.analysisUnavailableCount > 0 ? <span>{t("unavailableAnalyses", { count: source.analysisUnavailableCount })}</span> : null}
            {currentData.canManage && source.status === COMPETITOR_SOURCE_STATUS.active ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void retrySource(source.id)}>{t("retrySource")}</Button> : null}
            {currentData.canManage && source.analysisUnavailableCount > 0 ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void retryAnalysis(source.id)}>{t("retryAnalysis")}</Button> : null}
            {currentData.canManage && source.status !== COMPETITOR_SOURCE_STATUS.archived ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void updateSource(source.id, source.status === COMPETITOR_SOURCE_STATUS.active ? COMPETITOR_SOURCE_STATUS.paused : COMPETITOR_SOURCE_STATUS.active)}>{source.status === COMPETITOR_SOURCE_STATUS.active ? t("pause") : t("resume")}</Button> : null}
            {currentData.canManage && source.status === COMPETITOR_SOURCE_STATUS.archived ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void updateSource(source.id, COMPETITOR_SOURCE_STATUS.active)}>{t("restore")}</Button> : null}
            {currentData.canManage && source.status !== COMPETITOR_SOURCE_STATUS.archived ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void updateSource(source.id, COMPETITOR_SOURCE_STATUS.archived)}>{t("archive")}</Button> : null}
          </div>
        </div>
        {source.lastFetchedAt ? <p className="competitorIntelligence__sourceMeta">{t("lastFetched", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.lastFetchedAt)) })}</p> : <p className="competitorIntelligence__sourceMeta">{t("waitingForWorker")}</p>}
        {source.status === COMPETITOR_SOURCE_STATUS.active ? <p className="competitorIntelligence__sourceMeta">{source.hasError
          ? t("sourceRetryAt", { count: source.failureCount, date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.nextFetchAt)) })
          : t("nextCheck", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.nextFetchAt)) })}</p> : null}
        {source.hasError ? <p className="entryMessage entryMessage--error">{t("sourceIssue")}</p> : null}
        {source.lastErrorCode ? <p className="competitorIntelligence__sourceMeta">{t(`feedErrors.${feedErrorTranslationKeys.includes(source.lastErrorCode as typeof feedErrorTranslationKeys[number]) ? source.lastErrorCode : "unknown"}`)}</p> : null}
        {source.fetchRuns.length ? <Disclosure className="competitorIntelligence__history" title={t("fetchHistoryTitle", { count: source.fetchRuns.length })}><ol>
          {source.fetchRuns.map((run) => <li key={run.id}><div><strong>{t(`fetchStatus.${run.status}`)}</strong><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.startedAt))}</span></div>
            <span>{t("fetchRunItems", { count: run.newItemCount })}</span>
            {run.errorCode ? <small>{t(`feedErrors.${feedErrorTranslationKeys.includes(run.errorCode as typeof feedErrorTranslationKeys[number]) ? run.errorCode : "unknown"}`)}</small> : null}
            {run.completedAt ? <small>{t("fetchRunDuration", { seconds: Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)) })}</small> : null}
          </li>)}
        </ol></Disclosure> : null}
        {source.observations.length ? <ol className="competitorIntelligence__observations">
          {source.observations.map((observation) => <li key={observation.id}>
            <div><a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{observation.title}</a><p>{observation.summary || t("noSummary")}</p>
              {observation.analysis ? <div className="competitorIntelligence__observationAnalysis"><strong>{t(`topics.${observation.analysis.topic}`)}</strong><span>{observation.analysis.observedPattern[locale]}</span><p>{observation.analysis.editorialOpportunity[locale]}</p></div> : <small>{t(`analysisStatus.${observation.analysisStatus}`)}</small>}
            </div>
            <span>{observation.contentPublishedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(observation.contentPublishedAt)) : t("dateUnavailable")}</span>
          </li>)}
        </ol> : <p className="competitorIntelligence__sourceMeta">{t("noObservations")}</p>}
      </li>)}
      </ul>}
    </> : null}
      </div>
    </> : null}
  </section>;
}
