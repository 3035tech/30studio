"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, List, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { SocialPlatformIcon } from "@/components/ui/social-platform-icon";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Dialog, DialogCancel, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentMediaPanel } from "@/components/calendar/content-media-panel";
import { CalendarItemsView } from "@/components/calendar/calendar-items-view";
import { API_ERROR_CODES, CALENDAR, CALENDAR_API_PATHS, CALENDAR_FORM_FIELDS, CALENDAR_QUERY_PARAMETERS, CALENDAR_UI_IDS, CALENDAR_VIEW_MODE, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, CAMPAIGN_API_PATHS, CAMPAIGN_FORM_FIELDS, CONTENT_APPROVAL_ACTION, CONTENT_APPROVAL_LIMITS, CONTENT_APPROVAL_STATUS, CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_STATUS, CONTENT_STATUSES, SOCIAL_PLATFORMS, SOCIAL_PUBLICATION_JOB_STATUSES, SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS, SOCIAL_PUBLICATION_RECONCILIATION_LIMITS, type CalendarViewMode, type ContentStatus, type DashboardFilters, type Locale, type SocialPlatform } from "@/lib/constants";
import { getCalendarMonthBounds, toLocalDateInputValue } from "@/lib/calendar";
import type { BrandListItem } from "@/lib/validation/brands";
import { calendarCampaignCreateResponseSchema, calendarCampaignCreateSchema, calendarCopyDraftResponseSchema, calendarContentVersionResponseSchema, calendarResponseSchema, contentApprovalActionResponseSchema, type CalendarItem, type CalendarSocialCapability } from "@/lib/validation/calendar";
import { contentReviewResponseSchema } from "@/lib/validation/content-review";
import { socialPublicationReconciliationResponseSchema, socialPublicationReconciliationRequestSchema } from "@/lib/validation/social-publication";
import { useSystemFeedback } from "@/components/ui/system-feedback";
import { countSocialCopyCharacters, exceedsSocialCopyLimit } from "@/lib/social-copy";

type CalendarState = {
  requestKey: string;
  items: CalendarItem[];
  capabilities: CalendarSocialCapability[];
  truncated: boolean;
  canManage: boolean;
  canReview: boolean;
  error: boolean;
};

const INITIAL_STATE: CalendarState = { requestKey: "", items: [], capabilities: [], truncated: false, canManage: false, canReview: false, error: false };
const EMPTY_BRANDS: readonly BrandListItem[] = [];
const EMPTY_ITEMS: CalendarItem[] = [];
type GeneratedCopy = z.infer<typeof calendarCopyDraftResponseSchema>["data"] & {
  itemId: string;
  selectedVariantIndex: number | null;
};
type CampaignSchedule = { date: string; time: string };
type CampaignNextStep = { itemId: string; brandId: string; platform: SocialPlatform; plannedAt: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function isContentEditable(status: ContentStatus) {
  return CONTENT_EDITABLE_STATUSES.some((editableStatus) => editableStatus === status);
}

export function EditorialCalendar({ organizationId, brands = EMPTY_BRANDS, dashboardFilters, onDashboardFiltersChange, onCanManageChange }: { organizationId: string; brands: readonly BrandListItem[]; dashboardFilters: DashboardFilters; onDashboardFiltersChange: (next: (current: DashboardFilters) => DashboardFilters) => void; onCanManageChange: (canManage: boolean) => void }) {
  const showFeedback = useSystemFeedback();
  const t = useTranslations("calendar");
  const locale = useLocale() as Locale;
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const brandFilter = dashboardFilters.brandId;
  const platformFilter = dashboardFilters.platform;
  const [statusFilter, setStatusFilter] = useState("");
  const [publicationFilter, setPublicationFilter] = useState("");
  const [viewMode, setViewMode] = useState<CalendarViewMode>(CALENDAR_VIEW_MODE.month);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [contentVersionState, setContentVersionState] = useState<{
    itemId: string;
    data: ReturnType<typeof calendarContentVersionResponseSchema.parse>["data"] & { canManage: boolean; canReview: boolean } | null;
    error: boolean;
  } | null>(null);
  const [contentRefreshIndex, setContentRefreshIndex] = useState(0);
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [selectedSocialProfileId, setSelectedSocialProfileId] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [discardChangesPrompt, setDiscardChangesPrompt] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [publicationReconciliationMessage, setPublicationReconciliationMessage] = useState("");
  const [reconciliationOutcome, setReconciliationOutcome] = useState<z.infer<typeof socialPublicationReconciliationRequestSchema>["outcome"]>("published");
  const [reconciliationEvidence, setReconciliationEvidence] = useState("");
  const [externalPostId, setExternalPostId] = useState("");
  const [confirmedNoPost, setConfirmedNoPost] = useState(false);
  const [contentReview, setContentReview] = useState<ReturnType<typeof contentReviewResponseSchema.parse>["data"] | null>(null);
  const [reviewingContent, setReviewingContent] = useState(false);
  const [state, setState] = useState(INITIAL_STATE);
  const [formOpen, setFormOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"details" | "schedule">("details");
  const [campaignFormError, setCampaignFormError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignBrandId, setCampaignBrandId] = useState("");
  const [campaignBrief, setCampaignBrief] = useState("");
  const [campaignSchedules, setCampaignSchedules] = useState<Partial<Record<SocialPlatform, CampaignSchedule>>>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([SOCIAL_PLATFORMS[0]]);
  const [campaignIdempotencyKey, setCampaignIdempotencyKey] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [notice, setNotice] = useState("");
  const [campaignNextStep, setCampaignNextStep] = useState<CampaignNextStep | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [dashboardOpenItemId, setDashboardOpenItemId] = useState<string | null>(null);
  const dashboardNavigationRef = useRef(false);

  function setStatusNotice(message: string) {
    setCampaignNextStep(null);
    setNotice(message);
  }

  const bounds = getCalendarMonthBounds(month.getFullYear(), month.getMonth(), CALENDAR.firstWeekday[locale]);
  const requestKey = [organizationId, getMonthKey(month), brandFilter, platformFilter, statusFilter, publicationFilter, refreshIndex].join(":");
  const start = bounds.start.toISOString();
  const end = bounds.end.toISOString();

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      [CALENDAR_QUERY_PARAMETERS.start]: start,
      [CALENDAR_QUERY_PARAMETERS.end]: end,
    });
    if (brandFilter) query.set(CALENDAR_QUERY_PARAMETERS.brandId, brandFilter);
    if (platformFilter) query.set(CALENDAR_QUERY_PARAMETERS.platform, platformFilter);
    if (statusFilter) query.set(CALENDAR_QUERY_PARAMETERS.status, statusFilter);
    if (publicationFilter) query.set(CALENDAR_QUERY_PARAMETERS.publicationStatus, publicationFilter);

    const load = async () => {
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
        setState({ requestKey, items: parsed.data.data, capabilities: parsed.data.capabilities, truncated: parsed.data.truncated, canManage: parsed.data.canManage, canReview: parsed.data.canReview, error: false });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ requestKey, items: [], capabilities: [], truncated: false, canManage: false, canReview: false, error: true });
      }
    };
    void load();
    return () => controller.abort();
  }, [brandFilter, end, organizationId, platformFilter, publicationFilter, requestKey, start, statusFilter]);

  useEffect(() => {
    if (!selectedItem) return;
    const controller = new AbortController();
    const loadVersions = async () => {
      try {
        const response = await fetch(CALENDAR_API_PATHS.versions(selectedItem.id), {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Content history request failed.");
        const parsed = calendarContentVersionResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Content history response was invalid.");
        const approval = parsed.data.data.approval;
        const currentRequest = approval.history.find((entry) => entry.matchesCurrent);
        setSelectedSocialProfileId(currentRequest?.targetProfile?.id ?? (approval.targetProfiles.length === 1 ? approval.targetProfiles[0].id : ""));
        setContentVersionState({ itemId: selectedItem.id, data: { ...parsed.data.data, canManage: parsed.data.canManage, canReview: parsed.data.canReview }, error: false });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setContentVersionState({ itemId: selectedItem.id, data: null, error: true });
      }
    };
    void loadVersions();
    return () => controller.abort();
  }, [contentRefreshIndex, selectedItem]);

  const visibleItems = state.requestKey === requestKey ? state.items : EMPTY_ITEMS;
  const pending = state.requestKey !== requestKey;
  const hasError = !pending && state.error;
  const selectedCopy = selectedItem && contentVersionState?.itemId === selectedItem.id && contentVersionState.data
    ? generatedCopy?.itemId === selectedItem.id
      ? generatedCopy
      : {
        itemId: selectedItem.id,
        canonicalCopy: contentVersionState.data.current?.canonicalCopy ?? "",
        variantCopy: contentVersionState.data.current?.variantCopy ?? "",
        variantOptions: [],
        selectedVariantIndex: null,
      }
    : null;
  const selectedCanEdit = Boolean(selectedItem && state.canManage && isContentEditable(selectedItem.status));
  const selectedPlatform = previewPlatform ?? selectedItem?.platform ?? null;
  const selectedPlatformTextLimit = selectedPlatform
    ? state.capabilities.find((capability) => capability.platform === selectedPlatform)?.maximumTextCharacters ?? null
    : null;
  const selectedVariantLength = countSocialCopyCharacters(selectedCopy?.variantCopy ?? "");
  const variantCopyExceedsPlatformLimit = exceedsSocialCopyLimit(selectedCopy?.variantCopy ?? "", selectedPlatformTextLimit);
  const selectedCanReview = Boolean(selectedItem && state.canReview && selectedItem.status === CONTENT_STATUS.inReview && (contentVersionState?.data?.canReview ?? true));
  useEffect(() => {
    if (pending) return;
    onCanManageChange(!hasError && state.canManage);
  }, [hasError, onCanManageChange, pending, state.canManage]);
  const currentApprovalRequest = contentVersionState && selectedItem && contentVersionState.itemId === selectedItem.id
    ? contentVersionState.data?.approval.history.find((request) => request.matchesCurrent) ?? null
    : null;
  const approvalNextSteps = selectedCanEdit && selectedItem && contentVersionState?.itemId === selectedItem.id && contentVersionState.data
    ? [
      !contentVersionState.data.current
        ? t("approvalSaveDraftFirst")
        : editorDirty || generatedCopy?.itemId === selectedItem.id
          ? t("approvalSaveChangesFirst")
          : null,
      contentVersionState.data.approval.mediaPending ? t("approvalMediaPending") : null,
      contentVersionState.data.approval.publisherProfileRequired && contentVersionState.data.approval.targetProfiles.length === 0
        ? t("noEligiblePublicationTargets")
        : contentVersionState.data.approval.publisherProfileRequired && !selectedSocialProfileId
          ? t("approvalChooseTarget")
          : null,
      currentApprovalRequest?.status === CONTENT_APPROVAL_STATUS.pending
        ? t("approvalVersionAlreadyInReview")
        : currentApprovalRequest
          ? t("approvalCreateNewVersion")
          : null,
    ].filter((step): step is string => Boolean(step))
    : [];
  const canOpenCalendarItem = useCallback((item: CalendarItem) => {
    return (state.canManage && (isContentEditable(item.status) || item.publicationStatus === "indeterminate" || item.publicationStatus === "failed"))
      || (state.canReview && item.status === CONTENT_STATUS.inReview);
  }, [state.canManage, state.canReview]);

  useEffect(() => {
    const now = Date.now();
    const activePublication = visibleItems.some((item) => item.publicationStatus === "processing" || (item.publicationStatus === "queued" && Date.parse(item.plannedAt) <= now));
    if (activePublication) {
      const interval = window.setInterval(() => setRefreshIndex((current) => current + 1), SOCIAL_PUBLICATION_POLL_INTERVAL_MILLISECONDS);
      return () => window.clearInterval(interval);
    }
    const nextQueuedPublicationAt = visibleItems.reduce<number | null>((nextAt, item) => {
      const plannedAt = Date.parse(item.plannedAt);
      return item.publicationStatus === "queued" && plannedAt > now && (nextAt === null || plannedAt < nextAt) ? plannedAt : nextAt;
    }, null);
    if (nextQueuedPublicationAt !== null) {
      const timeout = window.setTimeout(() => setRefreshIndex((current) => current + 1), Math.max(1_000, nextQueuedPublicationAt - now));
      return () => window.clearTimeout(timeout);
    }
  }, [visibleItems]);

  function changeMonth(monthDelta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + monthDelta, 1));
    setFormOpen(false);
    setStatusNotice("");
  }

  function selectCalendarItem(item: CalendarItem) {
    setSelectedItem(item);
    setContentVersionState(null);
    setGeneratedCopy(null);
    setApprovalNote("");
    setSelectedSocialProfileId("");
    setEditorDirty(false);
    setDiscardChangesPrompt(false);
    setApprovalMessage("");
    setPublicationReconciliationMessage("");
    setReconciliationOutcome(item.publicationStatus === "failed" ? "not_published" : "published");
    setReconciliationEvidence("");
    setExternalPostId("");
    setConfirmedNoPost(false);
    setContentReview(null);
    setPreviewPlatform(null);
  }

  useEffect(() => {
    function handleOpenCalendarItem(event: Event) {
      if (!(event instanceof CustomEvent) || !isRecord(event.detail)) return;
      const { itemId, brandId, platform, plannedAt, section } = event.detail;
      const publicationStatus = typeof event.detail.publicationStatus === "string" ? SOCIAL_PUBLICATION_JOB_STATUSES.find((item) => item === event.detail.publicationStatus) ?? "" : "";
      const selectedPlatform = typeof platform === "string" ? SOCIAL_PLATFORMS.find((item) => item === platform) : undefined;
      const timestamp = typeof plannedAt === "string" ? Date.parse(plannedAt) : Number.NaN;
      if (typeof itemId !== "string" || typeof brandId !== "string" || !selectedPlatform || !Number.isFinite(timestamp)) return;
      dashboardNavigationRef.current = true;
      onDashboardFiltersChange((current) => ({ ...current, brandId, platform: selectedPlatform }));
      setMonth(new Date(new Date(timestamp).getFullYear(), new Date(timestamp).getMonth(), 1));
      setStatusFilter(section === "approvals" ? CONTENT_STATUS.inReview : "");
      setPublicationFilter(publicationStatus);
      setViewMode(CALENDAR_VIEW_MODE.list);
      setDashboardOpenItemId(itemId);
    }
    window.addEventListener(WORKSPACE_UI_EVENTS.openCalendarItem, handleOpenCalendarItem);
    return () => window.removeEventListener(WORKSPACE_UI_EVENTS.openCalendarItem, handleOpenCalendarItem);
  }, [onDashboardFiltersChange]);

  useEffect(() => {
    function handleOpenCalendarList(event: Event) {
      if (!(event instanceof CustomEvent) || !isRecord(event.detail)) return;
      dashboardNavigationRef.current = true;
      const requestedStatus = event.detail.status;
      const status = typeof requestedStatus === "string" ? CONTENT_STATUSES.find((item) => item === requestedStatus) ?? "" : "";
      const requestedPublicationStatus = event.detail.publicationStatus;
      const publicationStatus = typeof requestedPublicationStatus === "string" ? SOCIAL_PUBLICATION_JOB_STATUSES.find((item) => item === requestedPublicationStatus) ?? "" : "";
      const requestedDate = typeof event.detail.plannedAt === "string" ? Date.parse(event.detail.plannedAt) : Number.NaN;
      const targetDate = Number.isFinite(requestedDate) ? new Date(requestedDate) : new Date();
      setMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
      setStatusFilter(status);
      setPublicationFilter(publicationStatus);
      setViewMode(CALENDAR_VIEW_MODE.list);
      setDashboardOpenItemId(null);
    }
    window.addEventListener(WORKSPACE_UI_EVENTS.openCalendarList, handleOpenCalendarList);
    return () => window.removeEventListener(WORKSPACE_UI_EVENTS.openCalendarList, handleOpenCalendarList);
  }, []);

  useEffect(() => {
    if (!dashboardOpenItemId || pending) return;
    const timer = window.setTimeout(() => {
      const item = visibleItems.find((candidate) => candidate.id === dashboardOpenItemId);
      if (item && canOpenCalendarItem(item)) selectCalendarItem(item);
      else if (hasError) setStatusNotice(t("loadError"));
      setDashboardOpenItemId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canOpenCalendarItem, dashboardOpenItemId, hasError, pending, state.canManage, state.canReview, t, visibleItems]);

  const openCampaignForm = useCallback((date: Date) => {
    const dateValue = toLocalDateInputValue(date);
    setSelectedDate(dateValue);
    setSelectedPlatforms(platformFilter ? [platformFilter] : [SOCIAL_PLATFORMS[0]]);
    setCampaignTitle("");
    setCampaignBrandId(brands.find((brand) => brand.isActive)?.id ?? "");
    setCampaignBrief("");
    setCampaignSchedules({});
    setCreateStep("details");
    setCampaignIdempotencyKey(crypto.randomUUID());
    setFormOpen(true);
    setCampaignFormError("");
    setStatusNotice("");
  }, [brands, platformFilter]);


  useEffect(() => {
    function syncCalendarSection() {
      const sectionId = window.location.hash.slice(1);
      if (sectionId === WORKSPACE_SECTION_IDS.approvals) {
        dashboardNavigationRef.current = false;
        setStatusFilter(CONTENT_STATUS.inReview);
        setPublicationFilter("");
        setViewMode(CALENDAR_VIEW_MODE.list);
      } else if (sectionId === WORKSPACE_SECTION_IDS.calendar) {
        if (dashboardNavigationRef.current) {
          dashboardNavigationRef.current = false;
          setViewMode(CALENDAR_VIEW_MODE.list);
          return;
        }
        setStatusFilter("");
        setPublicationFilter("");
        setViewMode(CALENDAR_VIEW_MODE.month);
      }
    }

    window.addEventListener("hashchange", syncCalendarSection);
    const initialSync = window.setTimeout(syncCalendarSection, 0);
    return () => {
      window.removeEventListener("hashchange", syncCalendarSection);
      window.clearTimeout(initialSync);
    };
  }, []);

  useEffect(() => {
    function handleCreateContentRequest() {
      if (!state.canManage || brands.length === 0) return;
      openCampaignForm(new Date());
    }

    window.addEventListener(WORKSPACE_UI_EVENTS.createContent, handleCreateContentRequest);
    return () => window.removeEventListener(WORKSPACE_UI_EVENTS.createContent, handleCreateContentRequest);
  }, [brands.length, openCampaignForm, state.canManage]);

  function togglePlatform(platform: SocialPlatform) {
    setSelectedPlatforms((current) => current.includes(platform)
      ? current.filter((selectedPlatform) => selectedPlatform !== platform)
      : SOCIAL_PLATFORMS.filter((availablePlatform) => current.includes(availablePlatform) || availablePlatform === platform));
  }

  function updateCampaignSchedule(platform: SocialPlatform, update: Partial<CampaignSchedule>) {
    setCampaignSchedules((current) => ({
      ...current,
      [platform]: {
        date: current[platform]?.date ?? selectedDate,
        time: current[platform]?.time ?? CALENDAR.defaultPlannedTime,
        ...update,
      },
    }));
  }

  function continueCampaignSetup() {
    const form = document.getElementById(CALENDAR_UI_IDS.newCampaignForm);
    if (form instanceof HTMLFormElement && !form.reportValidity()) return;
    if (selectedPlatforms.length === 0) {
      setCampaignFormError(t("selectAtLeastOneChannel"));
      return;
    }
    setCampaignFormError("");
    setCreateStep("schedule");
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const publications = selectedPlatforms.map((platform) => {
      const schedule = campaignSchedules[platform] ?? { date: selectedDate, time: CALENDAR.defaultPlannedTime };
      return { platform, schedule, localDateTime: new Date(`${schedule.date}T${schedule.time}`) };
    });
    if (publications.length === 0 || publications.some((publication) => Number.isNaN(publication.localDateTime.getTime())) || !timeZone) {
      setCampaignFormError(t("createError"));
      return;
    }
    const request = calendarCampaignCreateSchema.safeParse({
      brandId: campaignBrandId,
      idempotencyKey: campaignIdempotencyKey,
      title: campaignTitle,
      brief: campaignBrief,
      publications: publications.map(({ platform, localDateTime }) => ({ platform, plannedAt: localDateTime.toISOString(), timeZone })),
    });
    if (!request.success) {
      setCampaignFormError(t("createError"));
      return;
    }

    setBusy(true);
    setStatusNotice("");
    try {
      const response = await fetch(CAMPAIGN_API_PATHS.collection, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
      });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = calendarCampaignCreateResponseSchema.safeParse(payload);
      if (response.status === 409) {
        setCampaignIdempotencyKey(crypto.randomUUID());
        setCampaignFormError(t("campaignConflict"));
        return;
      }
      if (!response.ok || !parsed.success) throw new Error("Calendar campaign could not be created.");
      setFormOpen(false);
      setCampaignFormError("");
      setCampaignIdempotencyKey("");
      showFeedback("success", t("campaignCreated", { count: publications.length }));
      const firstPublication = parsed.data.data.publications[0];
      const firstSchedule = publications[0];
      if (firstPublication && firstSchedule) {
        setCampaignNextStep({
          itemId: firstPublication.id,
          brandId: campaignBrandId,
          platform: firstPublication.platform,
          plannedAt: firstSchedule.localDateTime.toISOString(),
        });
      }
      setCreateStep("details");
      setRefreshIndex((current) => current + 1);
    } catch {
      setCampaignFormError(t("createError"));
    } finally {
      setBusy(false);
    }
  }

  async function saveContentVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;
    const form = new FormData(event.currentTarget);
    const localDateTime = new Date(`${String(form.get("date") ?? "")}T${String(form.get("time") ?? "")}`);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (Number.isNaN(localDateTime.getTime()) || !timeZone) {
      setStatusNotice(t("contentSaveError"));
      return;
    }
    setBusy(true);
    setStatusNotice("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.versions(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: String(form.get(CALENDAR_FORM_FIELDS.brandId) ?? selectedItem.brandId),
          platform: String(form.get("platform") ?? selectedItem.platform),
          title: String(form.get("title") ?? ""),
          plannedAt: localDateTime.toISOString(),
          timeZone,
          expectedVersionNumber: contentVersionState?.data?.current?.versionNumber ?? 0,
          canonicalCopy: String(form.get("canonicalCopy") ?? ""),
          variantCopy: String(form.get("variantCopy") ?? ""),
        }),
      });
      if (response.status === 409) {
        setStatusNotice(t("versionConflict"));
        setContentRefreshIndex((current) => current + 1);
        return;
      }
      if (!response.ok) throw new Error("Calendar content could not be saved.");
      setSelectedItem(null);
      setEditorDirty(false);
      setDiscardChangesPrompt(false);
      setContentReview(null);
      showFeedback("success", t("contentSaved"));
      setRefreshIndex((current) => current + 1);
    } catch {
      setStatusNotice(t("contentSaveError"));
    } finally {
      setBusy(false);
    }
  }

  async function reviewSavedContent() {
    if (!selectedItem) return;
    setReviewingContent(true);
    setContentReview(null);
    setStatusNotice("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.reviewCopy(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (response.status === 503) {
        setStatusNotice(t("reviewUnavailable"));
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      const parsed = contentReviewResponseSchema.safeParse(payload);
      if (!response.ok || !parsed.success) throw new Error("Content review failed.");
      setContentReview(parsed.data.data);
    } catch {
      setStatusNotice(t("reviewError"));
    } finally {
      setReviewingContent(false);
    }
  }

  async function applyApprovalAction(action: typeof CONTENT_APPROVAL_ACTION[keyof typeof CONTENT_APPROVAL_ACTION]) {
    if (!selectedItem) return;
    setBusy(true);
    setApprovalMessage("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.approval(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === CONTENT_APPROVAL_ACTION.submit ? { socialProfileId: selectedSocialProfileId || undefined } : { note: approvalNote.trim() || null }) }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = contentApprovalActionResponseSchema.safeParse(payload);
      const errorCode = z.object({ code: z.string() }).safeParse(payload);
      if (response.status === 409 || (response.status === 422 && errorCode.success && errorCode.data.code === "CONTENT_APPROVAL_PUBLISHER_TEXT_LIMIT")) {
        const platform = t(`platforms.${selectedItem.platform}`);
        const knownMessage = errorCode.success && errorCode.data.code === "CONTENT_APPROVAL_PUBLISHER_CONNECTION_REQUIRED"
          ? t("approvalPublisherConnectionRequired", { platform })
          : errorCode.success && errorCode.data.code === "CONTENT_APPROVAL_PUBLISHER_MEDIA_UNSUPPORTED"
            ? t("approvalPublisherMediaUnsupported", { platform })
            : errorCode.success && errorCode.data.code === "CONTENT_APPROVAL_PUBLISHER_TEXT_LIMIT"
              ? t("approvalPublisherTextLimit", { platform })
              : t("approvalConflict");
        setApprovalMessage(knownMessage);
        setContentRefreshIndex((current) => current + 1);
        setRefreshIndex((current) => current + 1);
        return;
      }
      if (!response.ok || !parsed.success) throw new Error("Content approval action failed.");
      setSelectedItem({ ...selectedItem, status: parsed.data.data.itemStatus, publicationStatus: parsed.data.data.itemStatus === CONTENT_STATUS.scheduled ? "queued" : selectedItem.publicationStatus });
      setApprovalNote("");
      setApprovalMessage(action === CONTENT_APPROVAL_ACTION.submit ? t("approvalSubmitted") : parsed.data.data.kind === "partial" ? t("approvalProgress", { approved: parsed.data.data.approvedCount ?? 0, required: parsed.data.data.requiredApprovals ?? 0 }) : t("approvalDecisionSaved"));
      setContentRefreshIndex((current) => current + 1);
      setRefreshIndex((current) => current + 1);
    } catch {
      setApprovalMessage(t("approvalActionError"));
    } finally {
      setBusy(false);
    }
  }

  async function applyPublicationReconciliation() {
    if (!selectedItem || selectedItem.publicationStatus !== "indeterminate") return;
    const request = socialPublicationReconciliationRequestSchema.safeParse({
      outcome: reconciliationOutcome,
      evidence: reconciliationEvidence,
      ...(reconciliationOutcome === "published" ? { externalPostId } : {}),
      ...(reconciliationOutcome === "retry" ? { confirmedNoPost } : {}),
    });
    if (!request.success) return;
    setBusy(true);
    setPublicationReconciliationMessage("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.reconcilePublication(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
      });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = socialPublicationReconciliationResponseSchema.safeParse(payload);
      const errorPayload = z.object({ code: z.string() }).safeParse(payload);
      if (response.status === 409) {
        if (errorPayload.success && errorPayload.data.code === API_ERROR_CODES.socialPublicationRetryLimitReached) {
          setPublicationReconciliationMessage(t("publicationRetryLimitReached"));
          return;
        }
        setStatusNotice(t("publicationReconciliationConflict"));
        setSelectedItem(null);
        setContentVersionState(null);
        setRefreshIndex((current) => current + 1);
        return;
      }
      if (!response.ok || !parsed.success) throw new Error("Publication reconciliation failed.");
      const noticeKey = parsed.data.data.outcome === "published" ? "publicationMarkedPublished" : parsed.data.data.outcome === "retry" ? "publicationRetryQueued" : "publicationMarkedNotPublished";
      setStatusNotice(t(noticeKey));
      setSelectedItem(null);
      setContentVersionState(null);
      setRefreshIndex((current) => current + 1);
    } catch {
      setPublicationReconciliationMessage(t("publicationReconciliationError"));
    } finally {
      setBusy(false);
    }
  }

  async function generateCopyDraft(event: MouseEvent<HTMLButtonElement>) {
    if (!selectedItem) return;
    const form = event.currentTarget.form;
    const platform = form?.elements.namedItem(CALENDAR_FORM_FIELDS.platform);
    const brandField = form?.elements.namedItem(CALENDAR_FORM_FIELDS.brandId);
    const selectedPlatform = platform instanceof HTMLSelectElement ? platform.value : selectedItem.platform;
    const selectedBrandId = brandField instanceof HTMLSelectElement ? brandField.value : selectedItem.brandId;
    setGeneratingCopy(true);
    setStatusNotice("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.generateCopy(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId, locale, platform: selectedPlatform }),
      });
      if (response.status === 503) {
        setStatusNotice(t("generationUnavailable"));
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      const parsed = calendarCopyDraftResponseSchema.safeParse(payload);
      if (!response.ok || !parsed.success) throw new Error("Copy generation failed.");
      setGeneratedCopy({ itemId: selectedItem.id, ...parsed.data.data, selectedVariantIndex: 0 });
      setStatusNotice(t("copyGenerated"));
    } catch {
      setStatusNotice(t("generationError"));
    } finally {
      setGeneratingCopy(false);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  return (
    <section className="editorialCalendar" id={CALENDAR_UI_IDS.section} aria-labelledby={CALENDAR_UI_IDS.title}>
      <header className="editorialCalendar__header">
        <div>
          <p className="entryKicker">{statusFilter === CONTENT_STATUS.inReview ? t("approvalQueueEyebrow") : t("eyebrow")}</p>
          <h2 id={CALENDAR_UI_IDS.title}>{statusFilter === CONTENT_STATUS.inReview ? t("approvalQueueTitle") : t("title")}</h2>
          <p className="entryDescription">{statusFilter === CONTENT_STATUS.inReview ? t("approvalQueueDescription") : t("description")}</p>
        </div>
        {state.canManage && brands.length > 0 ? (
          <Button type="button" onClick={() => { const now = new Date(); const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth(); openCampaignForm(isCurrentMonth ? now : new Date(month.getFullYear(), month.getMonth(), 1)); }}>
            <CalendarPlus aria-hidden="true" size={17} />{t("newCampaign")}
          </Button>
        ) : null}
      </header>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open && !busy) { setFormOpen(false); setCampaignFormError(""); } }}>
        {formOpen && state.canManage ? (
          <DialogContent className="editorialCalendar__campaignDialog" aria-labelledby={CALENDAR_UI_IDS.createCampaignTitle} aria-describedby={CALENDAR_UI_IDS.createCampaignDescription}>
            <DialogHeader>
              <DialogTitle id={CALENDAR_UI_IDS.createCampaignTitle}>{t("createCampaignDialogTitle")}</DialogTitle>
              <DialogDescription id={CALENDAR_UI_IDS.createCampaignDescription}>{t("createCampaignDialogDescription")}</DialogDescription>
            </DialogHeader>
            <form className="editorialCalendar__form editorialCalendar__campaignForm" id={CALENDAR_UI_IDS.newCampaignForm} onSubmit={(event) => void createCampaign(event)}>
              <p className="editorialCalendar__wizardProgress" role="status">{t("createStepStatus", { step: createStep === "details" ? 1 : 2, total: 2 })}</p>
              {campaignFormError ? <p className="editorialCalendar__notice editorialCalendar__error" role="alert">{campaignFormError}</p> : null}
              {createStep === "details" ? <>
                <TextField id={CALENDAR_UI_IDS.campaignTitle} name="title" label={t("campaignTitle")} value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} maxLength={CONTENT_LIMITS.titleCharacters} required />
                <SelectField id={CALENDAR_UI_IDS.campaignBrand} name="brandId" label={t("brand")} value={campaignBrandId} onChange={(event) => setCampaignBrandId(event.target.value)} required>
                  {brands.filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </SelectField>
                <TextAreaField id={CALENDAR_UI_IDS.campaignBrief} name="brief" label={t("campaignBrief")} value={campaignBrief} onChange={(event) => setCampaignBrief(event.target.value)} maxLength={CONTENT_LIMITS.campaignBriefCharacters} required />
                <fieldset className="editorialCalendar__platformPicker">
                  <legend>{t("selectChannels")}</legend>
                  <div>{SOCIAL_PLATFORMS.map((platform) => {
                    const capability = state.capabilities.find((entry) => entry.platform === platform);
                    return <CheckboxField key={platform} id={CAMPAIGN_FORM_FIELDS.platformCheckboxId(platform)} name={CAMPAIGN_FORM_FIELDS.platforms} value={platform} label={t(`platforms.${platform}`)} description={t(`channelCapability.${capability?.publication ?? "connection_only"}`)} leadingIcon={<SocialPlatformIcon platform={platform} size={20} />} checked={selectedPlatforms.includes(platform)} onChange={() => togglePlatform(platform)} />;
                  })}</div>
                  <p className="editorialCalendar__channelNote">{t("channelPreparationNote")}</p>
                </fieldset>
                <DialogFooter className="editorialCalendar__formActions">
                  <Button type="button" disabled={busy} onClick={continueCampaignSetup}>{t("continueToSchedule")}</Button>
                  <DialogCancel disabled={busy}>{t("cancel")}</DialogCancel>
                </DialogFooter>
              </> : <>
                <section className="editorialCalendar__wizardStep" aria-labelledby="campaign-schedule-step-title">
                  <div><h3 id="campaign-schedule-step-title">{t("scheduleStepTitle")}</h3><p>{t("scheduleStepDescription")}</p></div>
                  <div className="editorialCalendar__publicationSchedules">
                    {selectedPlatforms.map((platform) => <fieldset className="editorialCalendar__publicationSchedule" key={platform}>
                      <legend>{t("channelSchedule", { platform: t(`platforms.${platform}`) })}</legend>
                      <DateField id={CAMPAIGN_FORM_FIELDS.publicationDate(platform)} label={t("date")} value={campaignSchedules[platform]?.date ?? selectedDate} onValueChange={(date) => updateCampaignSchedule(platform, { date })} required />
                      <TimeField id={CAMPAIGN_FORM_FIELDS.publicationTime(platform)} label={t("time")} value={campaignSchedules[platform]?.time ?? CALENDAR.defaultPlannedTime} onValueChange={(time) => updateCampaignSchedule(platform, { time })} required />
                    </fieldset>)}
                  </div>
                  <section className="editorialCalendar__campaignSummary" aria-label={t("campaignSummary")}>
                    <h3>{t("campaignSummary")}</h3>
                    <p><strong>{campaignTitle}</strong><span>{brands.find((brand) => brand.id === campaignBrandId)?.name ?? ""}</span></p>
                    <ul>{selectedPlatforms.map((platform) => {
                      const schedule = campaignSchedules[platform] ?? { date: selectedDate, time: CALENDAR.defaultPlannedTime };
                      const scheduledDate = new Date(`${schedule.date}T${schedule.time}`);
                      return <li key={platform}><strong>{t(`platforms.${platform}`)}</strong><span>{Number.isNaN(scheduledDate.getTime()) ? t("scheduleIncomplete") : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(scheduledDate)}</span></li>;
                    })}</ul>
                    <small>{t("localTime")}</small>
                  </section>
                </section>
                <DialogFooter className="editorialCalendar__formActions">
                  <Button appearance="quiet" type="button" disabled={busy} onClick={() => { setCampaignFormError(""); setCreateStep("details"); }}>{t("backToDetails")}</Button>
                  <DialogCancel disabled={busy}>{t("cancel")}</DialogCancel>
                  <Button type="submit" disabled={busy}>{busy ? t("saving") : t("createCampaign")}</Button>
                </DialogFooter>
              </>}
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <div className="editorialCalendar__toolbar" id={WORKSPACE_SECTION_IDS.approvals}>
        <div className="editorialCalendar__monthControls">
          <Button appearance="quiet" type="button" aria-label={t("previousMonth")} onClick={() => changeMonth(CALENDAR.previousMonthStep)}>
            <ArrowLeft aria-hidden="true" size={17} />
          </Button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <Button appearance="quiet" type="button" aria-label={t("nextMonth")} onClick={() => changeMonth(CALENDAR.nextMonthStep)}>
            <ArrowRight aria-hidden="true" size={17} />
          </Button>
          <Button appearance="quiet" type="button" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setFormOpen(false); }}>
            {t("today")}
          </Button>
        </div>
        <div className="editorialCalendar__filters" id={CALENDAR_UI_IDS.filters}>
          <SelectField id="calendar-status-filter" label={t("filterStatus")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">{t("allStatuses")}</option>
            {CONTENT_STATUSES.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
          </SelectField>
          <SelectField id="calendar-publication-status-filter" label={t("filterPublicationStatus")} value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)}>
            <option value="">{t("allPublicationStatuses")}</option>
            {SOCIAL_PUBLICATION_JOB_STATUSES.map((status) => <option key={status} value={status}>{t(`publicationStatuses.${status}`)}</option>)}
          </SelectField>
        </div>
      </div>

      <div className="editorialCalendar__viewControls" role="group" aria-label={t("calendarView")}>
        <Button appearance={viewMode === CALENDAR_VIEW_MODE.month ? "primary" : "quiet"} type="button" aria-pressed={viewMode === CALENDAR_VIEW_MODE.month} onClick={() => setViewMode(CALENDAR_VIEW_MODE.month)}>
          <CalendarDays aria-hidden="true" size={16} />{t("monthView")}
        </Button>
        <Button appearance={viewMode === CALENDAR_VIEW_MODE.list ? "primary" : "quiet"} type="button" aria-pressed={viewMode === CALENDAR_VIEW_MODE.list} onClick={() => setViewMode(CALENDAR_VIEW_MODE.list)}>
          <List aria-hidden="true" size={16} />{t("listView")}
        </Button>
      </div>
      <p className="editorialCalendar__timezone">{t("localTime")}</p>

      {notice ? <div className="editorialCalendar__notice" role="status"><p>{notice}</p>{campaignNextStep ? <div className="editorialCalendar__formActions"><span>{t("campaignNextStep")}</span><Button appearance="quiet" type="button" onClick={() => {
        window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENTS.openCalendarItem, { detail: campaignNextStep }));
        setCampaignNextStep(null);
      }}>{t("editFirstCampaignPost")}</Button></div> : null}</div> : null}
      {pending ? <p className="workspaceEmpty" role="status">{t("loading")}</p> : null}
      {hasError ? <div className="workspaceEmpty editorialCalendar__error" role="alert"><span>{t("loadError")}</span><Button appearance="quiet" type="button" onClick={() => setRefreshIndex((current) => current + 1)}>{t("retry")}</Button></div> : null}
      {viewMode === CALENDAR_VIEW_MODE.month && !pending && !hasError && visibleItems.length === 0 ? <p className="editorialCalendar__emptyMonth">{t("emptyMonth")}</p> : null}
      {!pending && state.truncated ? <p className="editorialCalendar__notice" role="status">{t("truncated")}</p> : null}

      <CalendarItemsView
        viewMode={viewMode}
        month={month}
        monthLabel={monthLabel}
        visibleItems={visibleItems}
        pending={pending}
        canManage={state.canManage}
        canOpenCalendarItem={canOpenCalendarItem}
        onSelectCalendarItem={selectCalendarItem}
        onOpenCampaignForm={openCampaignForm}
        onShowList={() => setViewMode(CALENDAR_VIEW_MODE.list)}
      />

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open && !busy && !generatingCopy) { if (editorDirty) setDiscardChangesPrompt(true); else { setSelectedItem(null); setContentVersionState(null); setGeneratedCopy(null); setApprovalNote(""); } } }}>
        {selectedItem ? <DialogContent aria-labelledby={CALENDAR_UI_IDS.editTitle} aria-describedby={CALENDAR_UI_IDS.editDescription}>
          <DialogHeader><DialogTitle id={CALENDAR_UI_IDS.editTitle}>{selectedItem.publicationStatus === "indeterminate" || selectedItem.publicationStatus === "failed" ? t("reconciliationTitle") : selectedCanReview ? t("reviewTitle") : t("editTitle")}</DialogTitle><DialogDescription id={CALENDAR_UI_IDS.editDescription}>{selectedItem.publicationStatus === "indeterminate" || selectedItem.publicationStatus === "failed" ? t("reconciliationDescription") : selectedCanReview ? t("reviewDescription") : t("editDescription")}</DialogDescription></DialogHeader>
          {editorDirty ? <p className="editorialCalendar__notice" role="status">{t("unsavedChanges")}</p> : null}
          {discardChangesPrompt ? <section className="editorialCalendar__notice" role="alert"><p>{t("discardChangesPrompt")}</p><div className="editorialCalendar__formActions"><Button appearance="quiet" type="button" onClick={() => setDiscardChangesPrompt(false)}>{t("keepEditing")}</Button><Button appearance="danger" type="button" onClick={() => { setSelectedItem(null); setContentVersionState(null); setGeneratedCopy(null); setApprovalNote(""); setEditorDirty(false); setDiscardChangesPrompt(false); }}>{t("discardChanges")}</Button></div></section> : null}
          {selectedItem.publicationStatus === "indeterminate" ? <p className="editorialCalendar__notice" role="alert">{t("publicationOutcomeUnknown")}</p> : null}
          {selectedItem.publicationStatus === "failed" ? <p className="editorialCalendar__notice" role="status">{t("publicationKnownFailed")}</p> : null}
          {selectedItem.publicationStatus === "processing" ? <p className="editorialCalendar__notice" role="status">{t("publicationInProgress")}</p> : null}
          {approvalNextSteps.length > 0 ? <section className="editorialCalendar__notice" role="status" aria-labelledby="calendar-approval-next-steps"><strong id="calendar-approval-next-steps">{t("approvalReadinessTitle")}</strong><ul>{approvalNextSteps.map((step) => <li key={step}>{step}</li>)}</ul></section> : null}
          {(selectedItem.publicationStatus === "indeterminate" || selectedItem.publicationStatus === "failed") && state.canManage ? <section className="editorialCalendar__editForm" aria-labelledby="calendar-reconciliation-title">
            <strong id="calendar-reconciliation-title">{t("reconciliationTitle")}</strong>
            <p>{t("reconciliationEvidenceHelp")}</p>
            <SelectField id="calendar-reconciliation-outcome" label={t("reconciliationOutcome")} value={reconciliationOutcome} onChange={(event) => { const value = event.target.value; setReconciliationOutcome(value === "published" || value === "retry" ? value : "not_published"); setConfirmedNoPost(false); }} disabled={busy}>
              <option value="published">{t("reconciliationOutcomes.published")}</option>
              <option value="not_published">{t("reconciliationOutcomes.not_published")}</option>
              <option value="retry">{t("reconciliationOutcomes.retry")}</option>
            </SelectField>
            {reconciliationOutcome === "published" ? <TextField id="calendar-reconciliation-post-id" label={t("externalPostId")} value={externalPostId} maxLength={SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumExternalPostIdCharacters} disabled={busy} required onChange={(event) => setExternalPostId(event.target.value)} /> : null}
            <TextAreaField id="calendar-reconciliation-evidence" label={t("reconciliationEvidence")} value={reconciliationEvidence} maxLength={SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.maximumEvidenceCharacters} disabled={busy} required onChange={(event) => setReconciliationEvidence(event.target.value)} />
            {reconciliationOutcome === "retry" ? <CheckboxField id="calendar-reconciliation-confirm-no-post" label={t("confirmNoPostRetry")} checked={confirmedNoPost} disabled={busy} onChange={(event) => setConfirmedNoPost(event.target.checked)} /> : null}
            {publicationReconciliationMessage ? <p className="editorialCalendar__notice" role="status">{publicationReconciliationMessage}</p> : null}
            <div className="editorialCalendar__formActions"><Button type="button" disabled={busy || reconciliationEvidence.trim().length < SOCIAL_PUBLICATION_RECONCILIATION_LIMITS.minimumEvidenceCharacters || (reconciliationOutcome === "published" && !externalPostId.trim()) || (reconciliationOutcome === "retry" && !confirmedNoPost)} onClick={() => void applyPublicationReconciliation()}>{busy ? t("saving") : t(reconciliationOutcome === "retry" ? "confirmAndRetryPublication" : "resolvePublication")}</Button></div>
          </section> : null}
          {contentVersionState?.itemId !== selectedItem.id ? <p className="workspaceEmpty" role="status">{t("loadingContent")}</p> : contentVersionState.error ? <div className="workspaceEmpty editorialCalendar__error" role="alert"><span>{t("contentLoadError")}</span><Button appearance="quiet" type="button" onClick={() => { setContentVersionState(null); setContentRefreshIndex((current) => current + 1); }}>{t("retry")}</Button></div> : contentVersionState.data ? <form className="editorialCalendar__editForm" onSubmit={(event) => selectedCanEdit ? void saveContentVersion(event) : event.preventDefault()} key={`${selectedItem.id}-${contentVersionState.data.current?.versionNumber ?? 0}`}>
            <TextField id="calendar-edit-idea-title" name="title" label={t("ideaTitle")} defaultValue={selectedItem.title} maxLength={CONTENT_LIMITS.titleCharacters} readOnly={!selectedCanEdit} required onChange={() => setEditorDirty(true)} />
            <SelectField id="calendar-edit-idea-brand" name={CALENDAR_FORM_FIELDS.brandId} label={t("brand")} defaultValue={selectedItem.brandId} disabled={Boolean(selectedItem.campaignId) || !selectedCanEdit} onChange={() => setEditorDirty(true)} required>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </SelectField>
            <SelectField id="calendar-edit-idea-platform" name={CALENDAR_FORM_FIELDS.platform} label={t("channel")} defaultValue={selectedItem.platform} onChange={(event) => { setPreviewPlatform(SOCIAL_PLATFORMS.find((platform) => platform === event.target.value) ?? selectedItem.platform); setEditorDirty(true); }} disabled={Boolean(selectedItem.campaignId) || !selectedCanEdit} required>
              {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{t(`platforms.${platform}`)}</option>)}
            </SelectField>
            <DateField id="calendar-edit-idea-date" name="date" label={t("date")} defaultValue={toLocalDateInputValue(new Date(selectedItem.plannedAt))} disabled={!selectedCanEdit} required onValueChange={() => setEditorDirty(true)} />
            <TimeField id="calendar-edit-idea-time" name="time" label={t("time")} defaultValue={new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(selectedItem.plannedAt))} disabled={!selectedCanEdit} required onValueChange={() => setEditorDirty(true)} />
            <div className="editorialCalendar__generationAction">
              <Button appearance="quiet" type="button" disabled={!selectedCanEdit || busy || generatingCopy} onClick={(event) => void generateCopyDraft(event)}>
                <WandSparkles aria-hidden="true" size={16} />{generatingCopy ? t("generatingCopy") : t("generateCopy")}
              </Button>
              <p>{t("generatedCopyReview")}</p>
            </div>
            <div className="editorialCalendar__generationAction">
              <Button appearance="quiet" type="button" disabled={!selectedCanEdit || busy || generatingCopy || reviewingContent || editorDirty || Boolean(generatedCopy?.itemId === selectedItem.id) || !contentVersionState.data.current} onClick={() => void reviewSavedContent()}>
                {reviewingContent ? t("reviewingContent") : t("reviewSavedContent")}
              </Button>
              <p>{t("reviewAdvisory")}</p>
            </div>
            {contentReview && contentReview.contentVersionId === contentVersionState.data.current?.id && !editorDirty ? <section className="editorialCalendar__versionHistory" aria-labelledby="calendar-content-review-title">
              <strong id="calendar-content-review-title">{t("reviewFindingsTitle", { version: contentReview.versionNumber, model: contentReview.model })}</strong>
              {contentReview.findings.length === 0 ? <p>{t("reviewNoFindings")}</p> : <ul>{contentReview.findings.map((finding, index) => <li key={index}>
                <strong>{t(`reviewSeverities.${finding.severity}`)} · {t(`reviewCategories.${finding.category}`)}</strong>
                {finding.excerpt ? <p>{finding.excerpt}</p> : null}<p>{finding.explanation}</p>{finding.suggestion ? <p>{t("reviewSuggestion", { suggestion: finding.suggestion })}</p> : null}
              </li>)}</ul>}
            </section> : null}
            <TextAreaField id={CALENDAR_UI_IDS.canonicalCopy} name="canonicalCopy" label={t("canonicalCopy")} value={selectedCopy?.canonicalCopy ?? ""} onChange={(event) => { setEditorDirty(true); setGeneratedCopy((current) => ({ itemId: selectedItem.id, canonicalCopy: event.target.value, variantCopy: current?.itemId === selectedItem.id ? current.variantCopy : selectedCopy?.variantCopy ?? "", variantOptions: current?.itemId === selectedItem.id ? current.variantOptions : [], selectedVariantIndex: current?.itemId === selectedItem.id ? current.selectedVariantIndex : null })); }} maxLength={CONTENT_LIMITS.canonicalCopyCharacters} readOnly={!selectedCanEdit} required />
            {selectedCopy?.variantOptions.length ? <div className="editorialCalendar__copyOptions" role="group" aria-label={t("generatedOptions")}>
              {selectedCopy.variantOptions.map((copy, index) => <Button
                key={`${index}-${copy}`}
                appearance={selectedCopy.selectedVariantIndex === index ? "primary" : "quiet"}
                className="editorialCalendar__copyOption"
                type="button"
                aria-pressed={selectedCopy.selectedVariantIndex === index}
                disabled={!selectedCanEdit || busy || generatingCopy}
                onClick={() => { setEditorDirty(true); setGeneratedCopy((current) => current?.itemId === selectedItem.id ? { ...current, variantCopy: copy, selectedVariantIndex: index } : current); }}
              ><span>{t("generatedOption", { index: index + 1 })}</span><small>{copy}</small></Button>)}
            </div> : null}
            <TextAreaField id={CALENDAR_UI_IDS.variantCopy} name="variantCopy" label={t("variantCopy")} value={selectedCopy?.variantCopy ?? ""} onChange={(event) => { setEditorDirty(true); setGeneratedCopy((current) => ({ itemId: selectedItem.id, canonicalCopy: current?.itemId === selectedItem.id ? current.canonicalCopy : selectedCopy?.canonicalCopy ?? "", variantCopy: event.target.value, variantOptions: current?.itemId === selectedItem.id ? current.variantOptions : [], selectedVariantIndex: null })); }} maxLength={selectedPlatformTextLimit ?? CONTENT_LIMITS.variantCopyCharacters} helpText={selectedPlatformTextLimit ? t("variantCopyLimit", { count: selectedVariantLength, maximum: selectedPlatformTextLimit, platform: t(`platforms.${selectedPlatform ?? selectedItem.platform}`) }) : undefined} readOnly={!selectedCanEdit} required />
            <section className="editorialCalendar__channelPreview" aria-label={t("previewTitle")}>
              <div><strong>{t("previewFor", { platform: t(`platforms.${previewPlatform ?? selectedItem.platform}`) })}</strong><span>{selectedItem.title}</span></div>
              <p>{selectedCopy?.variantCopy || t("previewEmpty")}</p>
              <small>{t("previewCharacters", { count: Array.from(selectedCopy?.variantCopy ?? "").length })}</small>
            </section>
            {contentVersionState.data.history.length > 0 ? <Disclosure className="editorialCalendar__historyDisclosure" title={t("versionHistory")}>
              <ol className="editorialCalendar__historyList">{contentVersionState.data.history.map((version) => <li key={version.versionNumber}>{t("versionEntry", { version: version.versionNumber, platform: t(`platforms.${version.platform}`), date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt)) })}</li>)}</ol>
            </Disclosure> : null}
            <ContentMediaPanel key={`${selectedItem.id}-${contentVersionState.data.current?.id ?? "new"}`} itemId={selectedItem.id} versionId={contentVersionState.data.current?.id ?? null} versionNumber={contentVersionState.data.current?.versionNumber ?? null} variantCopy={selectedCopy?.variantCopy ?? ""} platform={selectedItem.platform} />
            {contentVersionState.data.approval.history.length > 0 ? <Disclosure className="editorialCalendar__historyDisclosure" title={t("approvalHistory")}>
              <ol className="editorialCalendar__historyList">{contentVersionState.data.approval.history.map((request) => <li key={request.id}>{t(`approvalStatuses.${request.status}`, { version: request.versionNumber, name: request.submittedByName })}{request.targetProfile ? <p>{t("publicationTargetHistory", { name: request.targetProfile.displayName, handle: request.targetProfile.handle ? `@${request.targetProfile.handle}` : "" })}</p> : null}<p>{t("approvalProgress", { approved: request.decisions.filter((decision) => decision.decision === CONTENT_APPROVAL_STATUS.approved).length, required: request.requiredApprovals })}</p>{request.decisions.map((decision, index) => <p key={`${request.id}-${index}`}>{t(`approvalDecisions.${decision.decision}`, { name: decision.reviewerName })}{decision.note ? ` — ${decision.note}` : ""}</p>)}</li>)}</ol>
            </Disclosure> : null}
            {approvalMessage ? <p className="editorialCalendar__notice" role="status">{approvalMessage}</p> : null}
            {selectedCanEdit && contentVersionState.data.approval.publisherProfileRequired ? contentVersionState.data.approval.targetProfiles.length > 0 ? <SelectField id="calendar-publication-target" label={t("publicationTarget")} value={selectedSocialProfileId} onChange={(event) => setSelectedSocialProfileId(event.target.value)} disabled={busy || !contentVersionState.data.approval.canRequest || Boolean(currentApprovalRequest)} required>
              <option value="">{t("selectPublicationTarget")}</option>
              {contentVersionState.data.approval.targetProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}{profile.handle ? ` (@${profile.handle})` : ""}</option>)}
            </SelectField> : null : null}
            {selectedCanReview && currentApprovalRequest?.status === CONTENT_APPROVAL_STATUS.pending && currentApprovalRequest.matchesCurrent ? <div className="editorialCalendar__editForm">
              <TextAreaField id="calendar-approval-note" label={t("approvalNote")} value={approvalNote} maxLength={CONTENT_APPROVAL_LIMITS.maximumNoteCharacters} onChange={(event) => setApprovalNote(event.target.value)} />
              <div className="editorialCalendar__formActions"><Button type="button" disabled={busy} onClick={() => void applyApprovalAction(CONTENT_APPROVAL_ACTION.approve)}>{t("approveContent")}</Button><Button appearance="quiet" type="button" disabled={busy || !approvalNote.trim()} onClick={() => void applyApprovalAction(CONTENT_APPROVAL_ACTION.requestChanges)}>{t("requestChanges")}</Button><Button appearance="danger" type="button" disabled={busy || !approvalNote.trim()} onClick={() => void applyApprovalAction(CONTENT_APPROVAL_ACTION.reject)}>{t("rejectContent")}</Button></div>
            </div> : null}
            <DialogFooter className="editorialCalendar__formActions">
              {selectedCanEdit ? <>
                <Button type="submit" disabled={busy || generatingCopy || variantCopyExceedsPlatformLimit}>{busy ? t("saving") : t("saveDraft")}</Button>
                <Button appearance="quiet" type="button" disabled={busy || generatingCopy || variantCopyExceedsPlatformLimit || editorDirty || Boolean(generatedCopy?.itemId === selectedItem.id) || !contentVersionState.data.current || !contentVersionState.data.approval.canRequest || contentVersionState.data.approval.mediaPending || Boolean(currentApprovalRequest) || (contentVersionState.data.approval.publisherProfileRequired && !selectedSocialProfileId)} onClick={() => void applyApprovalAction(CONTENT_APPROVAL_ACTION.submit)}>{t("requestApproval")}</Button>
              </> : null}
              <DialogCancel disabled={busy || generatingCopy}>{t("cancel")}</DialogCancel>
            </DialogFooter>
          </form> : null}
        </DialogContent> : null}
      </Dialog>
    </section>
  );
}
