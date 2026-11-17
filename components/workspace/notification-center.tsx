"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, ChevronRight, CircleAlert, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { analyticsResponseSchema } from "@/lib/validation/analytics";
import { WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS } from "@/lib/constants";

type NotificationData = ReturnType<typeof analyticsResponseSchema.parse>["data"];
type Notification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "error" | "attention";
} & (
  | { kind: "publication"; itemId: string; brandId: string; platform: NotificationData["issues"]["publications"][number]["platform"]; plannedAt: string; section: "calendar"; publicationStatus: "failed" | "indeterminate" }
  | { kind: "approval"; itemId: string; brandId: string; platform: NotificationData["issues"]["approvals"][number]["platform"]; plannedAt: string; section: "approvals" }
  | { kind: "connection"; brandId: string }
  | { kind: "worker" }
);

export function NotificationCenter() {
  const t = useTranslations("notifications");
  const tPlatforms = useTranslations("platforms");
  const [data, setData] = useState<NotificationData | null>(null);
  const [hasError, setHasError] = useState(false);
  const [open, setOpen] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
    const controller = new AbortController();
    fetch(`/api/analytics/publications?${query.toString()}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const parsed = analyticsResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error();
        setData(parsed.data.data);
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHasError(true);
      });
    const interval = open ? window.setInterval(() => setRefreshCount((count) => count + 1), 60_000) : null;
    return () => {
      controller.abort();
      if (interval !== null) window.clearInterval(interval);
    };
  }, [open, refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); rootRef.current?.querySelector("button")?.focus(); }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const notifications = useMemo(() => {
    if (!data) return [];
    const items = [
      ...data.issues.publications.map((issue): Notification => ({ kind: "publication", id: issue.id, title: issue.title, detail: issue.status === "failed" ? t("publication.failed") : t("publication.indeterminate"), href: `#${WORKSPACE_SECTION_IDS.calendar}`, itemId: issue.itemId, brandId: issue.brandId, platform: issue.platform, plannedAt: issue.plannedAt, section: "calendar", publicationStatus: issue.status, severity: "error" })),
      ...data.issues.approvals.map((issue): Notification => ({ kind: "approval", id: issue.id, title: issue.title, detail: t("approvalPending", { brand: issue.brandName }), href: `#${WORKSPACE_SECTION_IDS.approvals}`, itemId: issue.itemId, brandId: issue.brandId, platform: issue.platform, plannedAt: issue.plannedAt, section: "approvals", severity: "attention" })),
      ...data.issues.connections.map((issue): Notification => ({ kind: "connection", id: issue.id, title: issue.displayName, detail: t("connectionNeedsAttention", { platform: tPlatforms(issue.platform), brand: issue.brandName }), href: `#${WORKSPACE_SECTION_IDS.connections}`, brandId: issue.brandId, severity: "error" })),
    ];
    if (data.worker.status === "stale" || data.worker.status === "unknown") items.unshift({ kind: "worker", id: `worker-${data.worker.status}`, title: data.worker.status === "stale" ? t("worker.stale") : t("worker.unknown"), detail: t("workerDetail"), href: `#${WORKSPACE_SECTION_IDS.analytics}`, severity: "error" });
    return items;
  }, [data, t, tPlatforms]);

  const count = data ? data.attention.failedPublications + data.attention.indeterminatePublications + data.attention.pendingApprovals + data.attention.connectionsNeedReauth + (data.worker.status === "stale" || data.worker.status === "unknown" ? 1 : 0) : 0;
  const overflowLinks = data ? [
    { key: "publications", count: Math.max(0, data.attention.failedPublications + data.attention.indeterminatePublications - notifications.filter((item) => item.kind === "publication").length), href: `#${WORKSPACE_SECTION_IDS.calendar}`, message: "morePublications" as const },
    { key: "approvals", count: Math.max(0, data.attention.pendingApprovals - notifications.filter((item) => item.kind === "approval").length), href: `#${WORKSPACE_SECTION_IDS.approvals}`, message: "moreApprovals" as const },
    { key: "connections", count: Math.max(0, data.attention.connectionsNeedReauth - notifications.filter((item) => item.kind === "connection").length), href: `#${WORKSPACE_SECTION_IDS.connections}`, message: "moreConnections" as const },
  ].filter((item) => item.count > 0) : [];

  return <div className="notificationCenter" ref={rootRef}>
    <Button appearance="quiet" className="notificationCenter__trigger" type="button" aria-label={t("open", { count })} aria-expanded={open} aria-controls="workspace-notifications-panel" onClick={() => setOpen((current) => !current)}>
      <Bell aria-hidden="true" size={19} />
      {count > 0 ? <span className="notificationCenter__badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Button>
    <div className="notificationCenter__panel" id="workspace-notifications-panel" hidden={!open} role="region" aria-label={t("title")}>
      <div className="notificationCenter__heading"><h2>{t("title")}</h2><span>{data ? t("activeCount", { count }) : t("loading")}</span><Button appearance="quiet" className="notificationCenter__refresh" type="button" aria-label={t("refresh")} onClick={() => setRefreshCount((current) => current + 1)}><RefreshCw aria-hidden="true" size={16} /></Button></div>
      {hasError ? <p className="notificationCenter__empty" role="status">{t("loadError")} <Button appearance="quiet" type="button" onClick={() => setRefreshCount((current) => current + 1)}>{t("retry")}</Button></p> : null}
      {!hasError && data && notifications.length === 0 ? <p className="notificationCenter__empty"><CheckCircle2 aria-hidden="true" size={17} />{t("empty")}</p> : null}
      {!hasError && notifications.length > 0 ? <ul className="notificationCenter__list">{notifications.map((notification) => <li key={notification.id}>
        <a href={notification.href} onClick={(event) => {
          if (notification.kind === "publication" || notification.kind === "approval") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openCalendarItem, { detail: {
              itemId: notification.itemId,
              brandId: notification.brandId,
              platform: notification.platform,
              plannedAt: notification.plannedAt,
              section: notification.section,
              ...(notification.kind === "publication" ? { publicationStatus: notification.publicationStatus } : {}),
            } }));
            window.location.hash = notification.href.slice(1);
          } else if (notification.kind === "connection") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openSocialConnections, { detail: { brandId: notification.brandId } }));
          }
          setOpen(false);
        }}>
          <span className={`notificationCenter__icon is-${notification.severity}`}>{notification.severity === "error" ? <CircleAlert aria-hidden="true" size={17} /> : <Bell aria-hidden="true" size={17} />}</span>
          <span className="notificationCenter__copy"><strong>{notification.title}</strong><small>{notification.detail}</small></span>
          <ChevronRight aria-hidden="true" size={16} />
        </a>
      </li>)}</ul> : null}
      {!hasError && overflowLinks.length > 0 ? <div className="notificationCenter__overflow">
        <p>{t("additionalAlerts")}</p>
        <ul>{overflowLinks.map((item) => <li key={item.key}><a href={item.href} onClick={() => setOpen(false)}>{t(item.message, { count: item.count })}</a></li>)}</ul>
      </div> : null}
    </div>
  </div>;
}
