"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { CheckboxField, IntegerField, SelectField, TextField } from "@/components/ui/field";
import { COMPETITOR_SOURCE_STATUS, COMPETITOR_WORKER, type Locale } from "@/lib/constants";
import { parseIntegerFormValue } from "@/lib/forms";
import type { BrandListItem } from "@/lib/validation/brands";
import { competitorAnalysisRetryResponseSchema, competitorAlertSettingsSchema, competitorSourcesResponseSchema } from "@/lib/validation/competitors";
import type { z } from "zod";

type CompetitorData = z.infer<typeof competitorSourcesResponseSchema>["data"];
type CompetitorObservation = CompetitorData["sources"][number]["observations"][number];
type CompetitorTopic = NonNullable<CompetitorObservation["analysis"]>["topic"];
const feedErrorTranslationKeys = ["invalid_source_url", "blocked_source_address", "source_request_failed", "source_response_too_large", "source_content_type_unsupported", "source_feed_invalid", "source_http_failure", "worker_interrupted"] as const;

export function CompetitorIntelligence({ brands, selectedBrandId, onBrandChange }: { brands: BrandListItem[]; selectedBrandId: string; onBrandChange: (brandId: string) => void }) {
  const t = useTranslations("competitorResearch");
  const locale = useLocale() as Locale;
  const activeBrands = brands.filter((brand) => brand.isActive);
  const brandId = activeBrands.some((brand) => brand.id === selectedBrandId) ? selectedBrandId : activeBrands[0]?.id ?? "";
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const requestKey = `${brandId}:${refreshKey}`;
  const loading = Boolean(brandId) && loadedKey !== requestKey;
  const error = errorKey === requestKey;
  const currentData = loadedKey === requestKey ? data : null;

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

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name") ?? ""), feedUrl: String(form.get("feedUrl") ?? "") }),
      });
      if (response.status === 409) { setMessage(t("sourceConflict")); return; }
      if (!response.ok) throw new Error();
      formElement.reset();
      setMessage(t("sourceAdded"));
      setRefreshKey((value) => value + 1);
    } catch {
      setMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function updateSource(sourceId: string, status: typeof COMPETITOR_SOURCE_STATUS[keyof typeof COMPETITOR_SOURCE_STATUS]) {
    if (!brandId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setRefreshKey((value) => value + 1);
    } catch {
      setMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function retryAnalysis(sourceId: string) {
    if (!brandId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}/analysis`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const result = competitorAnalysisRetryResponseSchema.safeParse(await response.json());
      if (!response.ok || !result.success) throw new Error();
      setMessage(t("retryQueued", { count: result.data.data.retried }));
      setRefreshKey((value) => value + 1);
    } catch {
      setMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function retrySource(sourceId: string) {
    if (!brandId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/${sourceId}/retry`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (response.status === 409) { setMessage(t("retrySourceBusy")); return; }
      if (!response.ok) throw new Error();
      setMessage(t("retrySourceQueued"));
      setRefreshKey((value) => value + 1);
    } catch { setMessage(t("saveError")); }
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
    if (!parsed.success) { setMessage(t("alertSettingsError")); return; }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/competitors/alerts`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error();
      setMessage(t("alertSettingsSaved"));
      setRefreshKey((value) => value + 1);
    } catch { setMessage(t("saveError")); }
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

  return <section className="competitorIntelligence" aria-labelledby="competitor-intelligence-title">
    <header className="workspaceHeading">
      <div><p className="entryKicker">{t("eyebrow")}</p><h2 id="competitor-intelligence-title">{t("title")}</h2><p className="entryDescription">{t("description")}</p></div>
    </header>
    <div className="competitorIntelligence__controls">
      <SelectField id="competitor-brand" label={t("brand")} value={brandId} onChange={(event) => onBrandChange(event.target.value)}>
        {activeBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </SelectField>
    </div>
    {data?.canManage ? <form className="competitorIntelligence__form" onSubmit={(event) => void addSource(event)}>
      <TextField id="competitor-source-name" name="name" label={t("sourceName")} maxLength={120} required />
      <TextField id="competitor-feed-url" name="feedUrl" label={t("feedUrl")} type="url" maxLength={2048} placeholder={t("feedUrlPlaceholder")} required />
      <p>{t("sourceHelp")}</p>
      <Button type="submit" disabled={saving || loading || !brandId}>{saving ? t("working") : t("addSource")}</Button>
    </form> : null}
    {message ? <p className="entryMessage" role="status">{message}</p> : null}
    {loading ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : null}
    {error ? <p className="entryMessage entryMessage--error" role="alert">{t("loadError")}</p> : null}
    {!brandId || activeBrands.length === 0 ? <p className="workspaceEmpty">{t("noBrands")}</p> : null}
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
        {currentData.alerts.map((alert, index) => <li key={`${alert.sourceId}:${alert.type}:${index}`} role="alert">{t(`alertType.${alert.type}`, { source: alert.sourceName })}</li>)}
      </ul> : null}
      {currentData.canManage ? <form key={`${brandId}:${currentData.alertSettings.enabled}:${currentData.alertSettings.failureThreshold}:${currentData.alertSettings.staleAfterHours}`} className="competitorIntelligence__alertSettings" onSubmit={(event) => void saveAlertSettings(event)}>
        <h3>{t("alertSettingsTitle")}</h3>
        <CheckboxField id="competitor-alerts-enabled" name="enabled" defaultChecked={currentData.alertSettings.enabled} label={t("alertsEnabled")} />
        <IntegerField id="competitor-alert-failure-threshold" name="failureThreshold" min={COMPETITOR_WORKER.minimumAlertFailureThreshold} max={COMPETITOR_WORKER.maximumAlertFailureThreshold} defaultValue={currentData.alertSettings.failureThreshold} label={t("failureThreshold")} required />
        <IntegerField id="competitor-alert-stale-hours" name="staleAfterHours" min={COMPETITOR_WORKER.minimumAlertStaleAfterHours} max={COMPETITOR_WORKER.maximumAlertStaleAfterHours} defaultValue={currentData.alertSettings.staleAfterHours} label={t("staleAfterHours")} required />
        <Button appearance="quiet" type="submit" disabled={saving}>{t("saveAlertSettings")}</Button>
      </form> : null}
    </section> : null}
    {!loading && !error && currentData && currentData.sources.length === 0 ? <p className="workspaceEmpty">{t("empty")}</p> : null}
    {!loading && !error && currentData?.sources.length ? <ul className="competitorIntelligence__sources">
      {currentData.sources.map((source) => <li key={source.id}>
        <div className="competitorIntelligence__sourceHeader">
          <div><h3>{source.name}</h3><a href={source.feedUrl} target="_blank" rel="noopener noreferrer">{source.feedUrl}</a></div>
          <div className="competitorIntelligence__sourceActions">
            <span>{t(`status.${source.status}`)}</span>
            <strong className={`competitorIntelligence__health competitorIntelligence__health--${source.status === COMPETITOR_SOURCE_STATUS.archived ? "archived" : source.status === COMPETITOR_SOURCE_STATUS.paused ? "paused" : source.hasError ? "failing" : source.isStale ? "stale" : "healthy"}`}>
              {t(`sourceHealth.${source.status === COMPETITOR_SOURCE_STATUS.archived ? "archived" : source.status === COMPETITOR_SOURCE_STATUS.paused ? "paused" : source.hasError ? "failing" : source.isStale ? "stale" : "healthy"}`)}
            </strong>
            {source.analysisUnavailableCount > 0 ? <span>{t("unavailableAnalyses", { count: source.analysisUnavailableCount })}</span> : null}
            {currentData.canManage && source.status === COMPETITOR_SOURCE_STATUS.active && (source.hasError || source.isStale) ? <Button appearance="quiet" type="button" disabled={saving} onClick={() => void retrySource(source.id)}>{t("retrySource")}</Button> : null}
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
    </ul> : null}
  </section>;
}
