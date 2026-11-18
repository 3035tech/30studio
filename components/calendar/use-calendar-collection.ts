import { useCallback, useEffect, useState } from "react";
import {
  CALENDAR_API_PATHS,
  CALENDAR_QUERY_PARAMETERS,
  SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS,
} from "@/lib/constants";
import {
  calendarResponseSchema,
  type CalendarItem,
  type CalendarSocialCapability,
} from "@/lib/validation/calendar";

export type CalendarCollectionState = {
  requestKey: string;
  items: CalendarItem[];
  capabilities: CalendarSocialCapability[];
  truncated: boolean;
  canManage: boolean;
  canReview: boolean;
  error: boolean;
};

const INITIAL_STATE: CalendarCollectionState = {
  requestKey: "",
  items: [],
  capabilities: [],
  truncated: false,
  canManage: false,
  canReview: false,
  error: false,
};
const EMPTY_ITEMS: CalendarItem[] = [];

type CalendarCollectionOptions = {
  organizationId: string;
  monthKey: string;
  start: string;
  end: string;
  brandId: string;
  platform: string;
  status: string;
  publicationStatus: string;
};

export function useCalendarCollection({
  organizationId,
  monthKey,
  start,
  end,
  brandId,
  platform,
  status,
  publicationStatus,
}: CalendarCollectionOptions) {
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [state, setState] = useState(INITIAL_STATE);
  const requestKey = [organizationId, monthKey, brandId, platform, status, publicationStatus, refreshIndex].join(":");

  const refresh = useCallback(() => setRefreshIndex((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      [CALENDAR_QUERY_PARAMETERS.start]: start,
      [CALENDAR_QUERY_PARAMETERS.end]: end,
    });
    if (brandId) query.set(CALENDAR_QUERY_PARAMETERS.brandId, brandId);
    if (platform) query.set(CALENDAR_QUERY_PARAMETERS.platform, platform);
    if (status) query.set(CALENDAR_QUERY_PARAMETERS.status, status);
    if (publicationStatus) query.set(CALENDAR_QUERY_PARAMETERS.publicationStatus, publicationStatus);

    async function load() {
      try {
        const response = await fetch(`${CALENDAR_API_PATHS.collection}?${query.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Calendar request failed.");
        const parsed = calendarResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Calendar response was invalid.");
        setState({
          requestKey,
          items: parsed.data.data,
          capabilities: parsed.data.capabilities,
          truncated: parsed.data.truncated,
          canManage: parsed.data.canManage,
          canReview: parsed.data.canReview,
          error: false,
        });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ ...INITIAL_STATE, requestKey, error: true });
      }
    }

    void load();
    return () => controller.abort();
  }, [brandId, end, organizationId, platform, publicationStatus, requestKey, start, status]);

  const visibleItems = state.requestKey === requestKey ? state.items : EMPTY_ITEMS;
  const pending = state.requestKey !== requestKey;
  const hasError = !pending && state.error;

  useEffect(() => {
    const now = Date.now();
    const activePublication = visibleItems.some((item) =>
      item.publicationStatus === "processing"
      || (item.publicationStatus === "queued" && Date.parse(item.plannedAt) <= now),
    );
    if (activePublication) {
      const interval = window.setInterval(refresh, SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS);
      return () => window.clearInterval(interval);
    }

    const nextQueuedPublicationAt = visibleItems.reduce<number | null>((nextAt, item) => {
      const plannedAt = Date.parse(item.plannedAt);
      return item.publicationStatus === "queued" && plannedAt > now && (nextAt === null || plannedAt < nextAt)
        ? plannedAt
        : nextAt;
    }, null);
    if (nextQueuedPublicationAt !== null) {
      const timeout = window.setTimeout(refresh, Math.max(1_000, nextQueuedPublicationAt - now));
      return () => window.clearTimeout(timeout);
    }
  }, [refresh, visibleItems]);

  return { state, visibleItems, pending, hasError, refresh };
}
