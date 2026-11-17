"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { IntegerField } from "@/components/ui/field";
import { DASHBOARD_ALERTS, DASHBOARD_GOALS, SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, type DashboardFilters, type Locale } from "@/lib/constants";
import { parseIntegerFormValue } from "@/lib/forms";
import { analyticsRefreshResponseSchema, analyticsResponseSchema } from "@/lib/validation/analytics";
import type { z } from "zod";

type Analytics = z.infer<typeof analyticsResponseSchema>["data"];
type DashboardIssue =
  | (Analytics["issues"]["publications"][number] & { kind: "publication" })
  | (Analytics["issues"]["approvals"][number] & { kind: "approval" })
  | (Analytics["issues"]["connections"][number] & { kind: "connection"; title: string });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function PublicationAnalytics({ filters, organizationId, userId, onOpenConnection }: { filters: DashboardFilters; organizationId: string; userId: string; onOpenConnection: (brandId: string) => void }) {
  const t = useTranslations("analytics");
  const tPlatforms = useTranslations("platforms");
  const locale = useLocale() as Locale;
  const [refreshKey, setRefreshKey] = useState(0);
  const { brandId, platform, rangeDays } = filters;
  const [data, setData] = useState<Analytics | null>(null);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<"overview" | "goals" | "engagement">("overview");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [mutedAlerts, setMutedAlerts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const [muteStateReadyOrganization, setMuteStateReadyOrganization] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ attempted: number; success: number; permissionDenied: number; authenticationRequired: number; unavailable: number } | null>(null);
  const requestKey = `${organizationId}:${brandId}:${platform}:${rangeDays}:${refreshKey}`;
  const loading = loadedKey !== requestKey;
  const error = errorKey === requestKey;

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    let restored: Record<string, number> = {};
    try {
      const value: unknown = JSON.parse(localStorage.getItem(`${DASHBOARD_ALERTS.storageKey}:${organizationId}:${userId}`) ?? "null");
      if (isRecord(value)) restored = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > Date.now()));
    } catch { /* Dashboard alerts remain available if browser storage is blocked. */ }
    const restoreTimer = window.setTimeout(() => {
      setMutedAlerts(restored);
      setMuteStateReadyOrganization(organizationId);
    }, 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(restoreTimer); };
  }, [organizationId, userId]);

  useEffect(() => {
    const nextExpiration = Object.values(mutedAlerts).filter((expiresAt) => expiresAt > now).sort((a, b) => a - b)[0];
    if (!nextExpiration) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, nextExpiration - Date.now()));
    return () => window.clearTimeout(timer);
  }, [mutedAlerts, now]);

  useEffect(() => {
    if (muteStateReadyOrganization !== organizationId) return;
    try { localStorage.setItem(`${DASHBOARD_ALERTS.storageKey}:${organizationId}:${userId}`, JSON.stringify(mutedAlerts)); }
    catch { /* Alert muting remains in memory if browser storage is blocked. */ }
  }, [mutedAlerts, muteStateReadyOrganization, organizationId, userId]);

  useEffect(() => {
    const controller = new AbortController();
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
    if (brandId) params.set("brandId", brandId);
    if (platform) params.set("platform", platform);
    void fetch(`/api/analytics/publications?${params}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const parsed = analyticsResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error();
        setData(parsed.data.data);
        setErrorKey(null);
      })
      .catch((cause: unknown) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setErrorKey(requestKey); })
      .finally(() => { if (!controller.signal.aborted) setLoadedKey(requestKey); });
    return () => controller.abort();
  }, [brandId, platform, rangeDays, refreshKey, requestKey]);

  const total = (data?.totals.queued ?? 0) + (data?.totals.processing ?? 0) + (data?.totals.published ?? 0) + (data?.totals.failed ?? 0) + (data?.totals.indeterminate ?? 0);
  const reportablePlatforms = data?.platforms.filter((item) => (!platform || item.platform === platform) && Object.values(item.totals).some((value) => value > 0)) ?? [];
  const statuses = ["published", "failed", "indeterminate", "queued", "processing"] as const;
  const allDashboardIssues: DashboardIssue[] = data ? [
    ...data.issues.publications.map((issue) => ({ ...issue, kind: "publication" as const })),
    ...data.issues.approvals.map((issue) => ({ ...issue, kind: "approval" as const })),
    ...data.issues.connections.map((issue) => ({ ...issue, title: issue.displayName, kind: "connection" as const })),
  ] : [];
  const issueKey = (issue: DashboardIssue) => `${issue.kind}:${issue.id}`;
  const mutedDashboardIssues = allDashboardIssues.filter((issue) => (mutedAlerts[issueKey(issue)] ?? 0) > now);
  const activeDashboardIssues = allDashboardIssues.filter((issue) => (mutedAlerts[issueKey(issue)] ?? 0) <= now);
  const attentionItems = data ? [
    { key: "indeterminate", count: data.attention.indeterminatePublications, title: t("attention.indeterminateTitle"), detail: t("attention.indeterminateDetail"), href: `#${WORKSPACE_SECTION_IDS.calendar}` },
    { key: "failed", count: data.attention.failedPublications, title: t("attention.failedTitle"), detail: t("attention.failedDetail"), href: `#${WORKSPACE_SECTION_IDS.calendar}` },
    { key: "approvals", count: data.attention.pendingApprovals, title: t("attention.approvalsTitle"), detail: t("attention.approvalsDetail"), href: `#${WORKSPACE_SECTION_IDS.approvals}` },
    { key: "connections", count: data.attention.connectionsNeedReauth, title: t("attention.connectionsTitle"), detail: t("attention.connectionsDetail"), href: `#${WORKSPACE_SECTION_IDS.brands}` },
  ].map((item) => {
    const groupIssues = allDashboardIssues.filter((issue) => item.key === "failed" || item.key === "indeterminate"
      ? issue.kind === "publication" && issue.status === item.key
      : issue.kind === (item.key === "approvals" ? "approval" : "connection"));
    const mutedCount = groupIssues.filter((issue) => (mutedAlerts[issueKey(issue)] ?? 0) > Date.now()).length;
    return { ...item, count: Math.max(0, item.count - mutedCount), issues: activeDashboardIssues.filter((issue) => groupIssues.some((groupIssue) => issueKey(groupIssue) === issueKey(issue))) };
  }).filter((item) => item.count > 0) : [];

  function openCalendarIssue(issue: Extract<DashboardIssue, { kind: "publication" | "approval" }>, section: "calendar" | "approvals") {
    window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openCalendarItem, { detail: { itemId: issue.itemId, brandId: issue.brandId, platform: issue.platform, plannedAt: issue.plannedAt, section, ...(issue.kind === "publication" ? { publicationStatus: issue.status } : {}) } }));
    window.history.pushState(null, "", `#${section === "approvals" ? WORKSPACE_SECTION_IDS.approvals : WORKSPACE_SECTION_IDS.calendar}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function openAttentionList(key: string) {
    if (key === "connections") {
      const issue = attentionItems.find((item) => item.key === key)?.issues[0];
      if (issue?.kind === "connection") onOpenConnection(issue.brandId);
      return;
    }
    const section = key === "approvals" ? WORKSPACE_SECTION_IDS.approvals : WORKSPACE_SECTION_IDS.calendar;
    window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openCalendarList, { detail: key === "approvals"
      ? { status: "in_review" }
      : key === "failed" || key === "indeterminate" ? { publicationStatus: key } : {} }));
    window.history.pushState(null, "", `#${section}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function openCalendarList(publicationStatus?: string, plannedAt?: string | null) {
    window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openCalendarList, { detail: { ...(publicationStatus ? { publicationStatus } : {}), ...(plannedAt ? { plannedAt } : {}) } }));
    window.history.pushState(null, "", `#${WORKSPACE_SECTION_IDS.calendar}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function muteIssue(issue: DashboardIssue) {
    setMutedAlerts((current) => ({ ...current, [issueKey(issue)]: Date.now() + DASHBOARD_ALERTS.snoozeMilliseconds }));
  }

  function unmuteIssue(issue: DashboardIssue) {
    const key = issueKey(issue);
    setMutedAlerts((current) => Object.fromEntries(Object.entries(current).filter(([issueId]) => issueId !== key)));
  }

  async function refreshEngagement() {
    setRefreshing(true);
    setRefreshResult(null);
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    try {
      const response = await fetch("/api/analytics/publications", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: start.toISOString(), end: end.toISOString(), ...(brandId ? { brandId } : {}), ...(platform ? { platform } : {}) }),
      });
      const result = analyticsRefreshResponseSchema.safeParse(await response.json());
      if (!response.ok || !result.success) throw new Error();
      setRefreshResult(result.data.data);
      setRefreshKey((value) => value + 1);
    } catch {
      setRefreshResult({ attempted: -1, success: 0, permissionDenied: 0, authenticationRequired: 0, unavailable: 0 });
    } finally {
      setRefreshing(false);
    }
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandId || !platform) return;
    const form = new FormData(event.currentTarget);
    const monthlyTarget = parseIntegerFormValue(form.get("monthlyTarget"));
    if (monthlyTarget === null || monthlyTarget < DASHBOARD_GOALS.minimumMonthlyPublications || monthlyTarget > DASHBOARD_GOALS.maximumMonthlyPublications) {
      setGoalMessage(t("goals.invalid"));
      return;
    }
    setGoalSaving(true);
    setGoalMessage("");
    try {
      const response = await fetch("/api/analytics/goals", {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, platform, monthlyTarget }),
      });
      if (!response.ok) throw new Error();
      setGoalMessage(t("goals.saved"));
      setRefreshKey((value) => value + 1);
    } catch { setGoalMessage(t("goals.saveError")); }
    finally { setGoalSaving(false); }
  }

  function handleAnalyticsTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
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

  return <section className="publicationAnalytics" aria-labelledby="publication-analytics-title">
    <header className="workspaceHeading">
      <div><p className="entryKicker">{t("eyebrow")}</p><h2 id="publication-analytics-title">{t("title")}</h2><p className="entryDescription">{t("description")}</p></div>
    </header>
    {error ? <p className="entryMessage entryMessage--error" role="alert">{t("loadError")}</p> : null}
    {loading ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : null}
    {!loading && !error && data ? <>
      <p className="publicationAnalytics__coverage">{t("coverage", { start: new Intl.DateTimeFormat(locale).format(new Date(data.start)), end: new Intl.DateTimeFormat(locale).format(new Date(data.end)) })}</p>
      <div className="publicationAnalytics__tabs" role="tablist" aria-label={t("reportTabs.label")}>
        {(["overview", "goals", "engagement"] as const).map((tab) => <button
          className={activeAnalyticsTab === tab ? "publicationAnalytics__tab is-selected" : "publicationAnalytics__tab"}
          id={`publication-analytics-tab-${tab}`}
          type="button"
          role="tab"
          aria-selected={activeAnalyticsTab === tab}
          aria-controls={`publication-analytics-panel-${tab}`}
          tabIndex={activeAnalyticsTab === tab ? 0 : -1}
          key={tab}
          onClick={() => setActiveAnalyticsTab(tab)}
          onKeyDown={handleAnalyticsTabKeyDown}
        >{t(`reportTabs.${tab}`)}</button>)}
      </div>
      <div id="publication-analytics-panel-overview" className="publicationAnalytics__tabPanel" role="tabpanel" tabIndex={0} aria-labelledby="publication-analytics-tab-overview" hidden={activeAnalyticsTab !== "overview"}>
      <section className="publicationAnalytics__attention" aria-labelledby="publication-analytics-attention-title">
        <div className="publicationAnalytics__attentionHeader">
          <div><h3 id="publication-analytics-attention-title">{t("attention.title")}</h3><p>{t("attention.description")}</p></div>
        </div>
        {attentionItems.length ? <ul className="publicationAnalytics__attentionList">
          {attentionItems.map((item) => <li key={item.key}>
            <a href={item.href} onClick={(event) => { event.preventDefault(); openAttentionList(item.key); }}>
              <strong>{item.count}</strong>
              <span><b>{item.title}</b><small>{item.detail}</small></span>
              <span className="publicationAnalytics__attentionAction">{t("attention.openList")}</span>
            </a>
            {item.issues.length ? <ul className="publicationAnalytics__attentionIssues">{item.issues.map((issue) => <li key={issueKey(issue)}>
              <span><strong>{issue.title}</strong><small>{t("attention.issueContext", { brand: issue.brandName, platform: tPlatforms(issue.platform) })}</small></span>
              <span className="publicationAnalytics__attentionIssueActions">{issue.kind === "connection" ? <Button appearance="quiet" type="button" onClick={() => onOpenConnection(issue.brandId)}>{t("attention.openConnection")}</Button>
                : <Button appearance="quiet" type="button" onClick={() => openCalendarIssue(issue, issue.kind === "approval" ? "approvals" : "calendar")}>{t(issue.kind === "approval" ? "attention.reviewNow" : "attention.resolvePublication")}</Button>}
                <Button appearance="quiet" type="button" onClick={() => muteIssue(issue)}>{t("attention.mute")}</Button></span>
            </li>)}</ul> : null}
          </li>)}
        </ul> : <div className="publicationAnalytics__allClear"><p>{mutedDashboardIssues.length ? t("attention.mutedOnly") : t("attention.allClear")}</p>{!mutedDashboardIssues.length ? <a href={`#${WORKSPACE_SECTION_IDS.calendar}`}>{t("attention.planNext")}</a> : null}</div>}
        {mutedDashboardIssues.length ? <Disclosure className="publicationAnalytics__muted" title={t("attention.muted", { count: mutedDashboardIssues.length })}><ul>{mutedDashboardIssues.map((issue) => <li key={issueKey(issue)}><span>{issue.title}</span><Button appearance="quiet" type="button" onClick={() => unmuteIssue(issue)}>{t("attention.unmute")}</Button></li>)}</ul></Disclosure> : null}
      </section>
      <section className={`publicationAnalytics__worker is-${data.worker.status}`} aria-labelledby="publication-worker-title">
        <div className="publicationAnalytics__workerHeader">
          <div><h3 id="publication-worker-title">{t("worker.title")}</h3><p role={data.worker.status === "stale" ? "alert" : "status"}>{t(`worker.status.${data.worker.status}`)}</p></div>
          {data.worker.lastSeenAt ? <span>{t("worker.lastSeen", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.worker.lastSeenAt)) })}</span> : null}
        </div>
        <p>{t("worker.queue", { queued: new Intl.NumberFormat(locale).format(data.worker.queued), processing: new Intl.NumberFormat(locale).format(data.worker.processing) })}</p>
        {data.worker.oldestQueuedAt ? <p>{t("worker.oldestQueued", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.worker.oldestQueuedAt)) })}</p> : null}
        {data.worker.queued > 0 ? <Button appearance="quiet" type="button" onClick={() => openCalendarList("queued", data.worker.oldestQueuedAt)}>{t("worker.openQueue")}</Button> : null}
      </section>
      <div className="publicationAnalytics__summary" aria-label={t("summaryLabel")}>
        <Button type="button" appearance="quiet" onClick={() => openCalendarList()}><span>{t("totalPublications")}</span><strong>{total}</strong></Button>
        <Button type="button" appearance="quiet" onClick={() => openCalendarList("published")}><span>{t("status.published")}</span><strong>{data.totals.published}</strong></Button>
        <Button type="button" appearance="quiet" onClick={() => openCalendarList("failed")}><span>{t("status.failed")}</span><strong>{data.totals.failed}</strong></Button>
        <Button type="button" appearance="quiet" onClick={() => openCalendarList("indeterminate")}><span>{t("status.indeterminate")}</span><strong>{data.totals.indeterminate}</strong></Button>
      </div>
      <p className="publicationAnalytics__comparison" aria-live="polite">
        <strong>{data.comparison.publishedChange > 0 ? "+" : ""}{new Intl.NumberFormat(locale).format(data.comparison.publishedChange)}</strong>
        <span>{t("publishedComparison", { count: new Intl.NumberFormat(locale).format(data.comparison.previousPublished) })}</span>
      </p>
      {reportablePlatforms.length === 0 ? <p className="workspaceEmpty">{t("empty")}</p> : <div className="publicationAnalytics__platforms">
        {reportablePlatforms.map((item) => <article className="publicationAnalytics__platform" key={item.platform}>
          <h3>{tPlatforms(item.platform)}</h3>
          <dl>{statuses.map((status) => <div key={status}><dt>{t(`status.${status}`)}</dt><dd>{item.totals[status]}</dd></div>)}</dl>
        </article>)}
      </div>}
      </div>
      <div id="publication-analytics-panel-goals" className="publicationAnalytics__tabPanel" role="tabpanel" tabIndex={0} aria-labelledby="publication-analytics-tab-goals" hidden={activeAnalyticsTab !== "goals"}>
      <section className="publicationAnalytics__goalSection" aria-labelledby="publication-goals-title">
        <div><h3 id="publication-goals-title">{t("goals.title")}</h3><p>{t("goals.description", { days: rangeDays })}</p></div>
        {data.goalTargets.filter((goal) => !platform || goal.platform === platform).length ? <div className="publicationAnalytics__goalGrid">
          {data.goalTargets.filter((goal) => !platform || goal.platform === platform).map((goal) => {
            const actual = data.platforms.find((item) => item.platform === goal.platform)?.totals.published ?? 0;
            const target = Math.max(1, Math.round(goal.monthlyTarget * rangeDays / 30));
            const progress = Math.min(100, Math.round(actual / target * 100));
            return <article key={goal.platform}>
              <strong>{tPlatforms(goal.platform)}</strong>
              <span>{t("goals.progress", { actual: new Intl.NumberFormat(locale).format(actual), target: new Intl.NumberFormat(locale).format(target) })}</span>
              <div className="publicationAnalytics__goalTrack" role="progressbar" aria-label={t("goals.progressLabel", { platform: tPlatforms(goal.platform) })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
            </article>;
          })}
        </div> : <p className="publicationAnalytics__limitation">{t("goals.empty")}</p>}
        {data.canManageGoals ? brandId && platform ? <form className="publicationAnalytics__goalForm" key={`${brandId}:${platform}:${data.goalTargets.find((goal) => goal.platform === platform)?.monthlyTarget ?? "new"}`} onSubmit={(event) => void saveGoal(event)}>
          <IntegerField id="dashboard-monthly-publication-goal" name="monthlyTarget" min={DASHBOARD_GOALS.minimumMonthlyPublications} max={DASHBOARD_GOALS.maximumMonthlyPublications} defaultValue={data.goalTargets.find((goal) => goal.platform === platform)?.monthlyTarget ?? ""} label={t("goals.monthlyTarget", { platform: tPlatforms(platform) })} required />
          <Button type="submit" disabled={goalSaving || loading}>{goalSaving ? t("goals.saving") : t("goals.save")}</Button>
        </form> : <p className="publicationAnalytics__limitation">{t("goals.chooseScope")}</p> : null}
        {goalMessage ? <p className="publicationAnalytics__coverage" role="status">{goalMessage}</p> : null}
      </section>
      </div>
      <div id="publication-analytics-panel-engagement" className="publicationAnalytics__tabPanel" role="tabpanel" tabIndex={0} aria-labelledby="publication-analytics-tab-engagement" hidden={activeAnalyticsTab !== "engagement"}>
      <section className="publicationAnalytics__engagement" aria-labelledby="analytics-engagement-title">
        <div className="publicationAnalytics__engagementHeader">
          <div><h3 id="analytics-engagement-title">{t("engagement.title")}</h3><p>{t("engagement.description")}</p></div>
          <Button type="button" disabled={refreshing || loading} onClick={() => void refreshEngagement()}>{refreshing ? t("engagement.refreshing") : t("engagement.refresh")}</Button>
        </div>
        <div className="publicationAnalytics__platforms" role="group" aria-label={t("engagement.summaryLabel")}>
          {data.engagement.platforms.filter((item) => !platform || item.platform === platform).map((item) => {
            const freshness = !item.latestCollectedAt ? "unavailable" : now - new Date(item.latestCollectedAt).getTime() > SOCIAL_ANALYTICS_FRESHNESS_MILLISECONDS ? "stale" : "current";
            const formatMetric = (value: number | null, metric: "likes" | "comments" | "shares") => {
              if (value !== null) return new Intl.NumberFormat(locale).format(value);
              if (metric === "shares" && item.platform === "instagram") return t("engagement.notSupported");
              return item.collectedPosts ? t("engagement.metricUnavailable") : t("engagement.noMetric");
            };
            return <article className="publicationAnalytics__platform" key={item.platform} aria-label={t("engagement.platformSummary", { platform: tPlatforms(item.platform) })}>
              <h4>{tPlatforms(item.platform)}</h4>
              <p className={`publicationAnalytics__freshness is-${freshness}`} role="status">{t(`engagement.freshness.${freshness}`)}</p>
              <div className="publicationAnalytics__summary publicationAnalytics__metrics">
                <article><span>{t("engagement.likes")}</span><strong>{formatMetric(item.metrics.likes, "likes")}</strong></article>
                <article><span>{t("engagement.comments")}</span><strong>{formatMetric(item.metrics.comments, "comments")}</strong></article>
                <article><span>{t("engagement.shares")}</span><strong>{formatMetric(item.metrics.shares, "shares")}</strong></article>
                <article><span>{t("engagement.coverage")}</span><strong>{t("engagement.postsCoverage", { collected: item.collectedPosts, total: item.totalPublished })}</strong></article>
              </div>
              {item.collectedPosts === 0 ? <p className="publicationAnalytics__limitation">{item.totalPublished > 0 ? t("engagement.notCollected") : t("engagement.noPublishedPosts")}</p> : null}
              <div className="publicationAnalytics__topPosts">
                <div><h5>{t("engagement.topPostsTitle")}</h5><p>{t("engagement.topPostsMethod")}</p></div>
                {item.topPosts.length ? <ol>
                  {item.topPosts.map((post) => <li key={post.jobId}>
                    <div className="publicationAnalytics__topPostHeading"><strong>{post.title}</strong><span>{t("engagement.postContext", {
                      brand: post.brandName,
                      date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(post.scheduledAt)),
                    })}</span><small>{t("engagement.postMetricBreakdown", {
                      likes: formatMetric(post.likes, "likes"),
                      comments: formatMetric(post.comments, "comments"),
                      shares: formatMetric(post.shares, "shares"),
                    })}</small></div>
                    <span className="publicationAnalytics__topPostTotal">{new Intl.NumberFormat(locale).format(post.interactions)} {t("engagement.interactions")}</span>
                  </li>)}
                </ol> : <p>{t("engagement.topPostsEmpty")}</p>}
              </div>
              {item.latestCollectedAt ? <p className="publicationAnalytics__coverage">{t("engagement.lastCollected", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.latestCollectedAt)) })}</p> : null}
              {item.statusCounts.permission_denied ? <p className="publicationAnalytics__limitation">{t("engagement.permissionDenied", { count: item.statusCounts.permission_denied })}</p> : null}
              {item.statusCounts.authentication_required ? <p className="publicationAnalytics__limitation">{t("engagement.authenticationRequired", { count: item.statusCounts.authentication_required })}</p> : null}
              {item.statusCounts.unavailable ? <p className="publicationAnalytics__limitation">{t("engagement.unavailable", { count: item.statusCounts.unavailable })}</p> : null}
            </article>;
          })}
        </div>
        {refreshResult ? <p className="publicationAnalytics__coverage" role="status">{refreshResult.attempted < 0 ? t("engagement.refreshError") : t("engagement.refreshResult", refreshResult)}</p> : null}
      </section>
      <p className="publicationAnalytics__limitation">{t("engagementUnavailable")}</p>
      </div>
    </> : null}
    <Button appearance="quiet" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>{t("refresh")}</Button>
  </section>;
}
