"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CALENDAR, CALENDAR_API_PATHS, CALENDAR_QUERY_PARAMETERS, CALENDAR_UI_IDS, CALENDAR_VIEW_MODE, CONTENT_EDITABLE_STATUSES, CONTENT_LIMITS, CONTENT_STATUSES, SOCIAL_PLATFORMS, type CalendarViewMode, type ContentStatus, type Locale } from "@/lib/constants";
import { getCalendarMonthBounds, getCalendarMonthDays, toLocalDateInputValue } from "@/lib/calendar";
import type { BrandListItem } from "@/lib/validation/brands";
import { calendarContentVersionResponseSchema, calendarResponseSchema, type CalendarItem } from "@/lib/validation/calendar";

type CalendarState = {
  requestKey: string;
  items: CalendarItem[];
  truncated: boolean;
  canManage: boolean;
  error: boolean;
};

const INITIAL_STATE: CalendarState = { requestKey: "", items: [], truncated: false, canManage: false, error: false };
const EMPTY_BRANDS: readonly BrandListItem[] = [];
const EMPTY_ITEMS: CalendarItem[] = [];

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function isContentEditable(status: ContentStatus) {
  return CONTENT_EDITABLE_STATUSES.some((editableStatus) => editableStatus === status);
}

export function EditorialCalendar({ brands = EMPTY_BRANDS }: { brands: readonly BrandListItem[] }) {
  const t = useTranslations("calendar");
  const locale = useLocale() as Locale;
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [brandFilter, setBrandFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<CalendarViewMode>(CALENDAR_VIEW_MODE.month);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [contentVersionState, setContentVersionState] = useState<{
    itemId: string;
    data: ReturnType<typeof calendarContentVersionResponseSchema.parse>["data"] | null;
    error: boolean;
  } | null>(null);
  const [contentRefreshIndex, setContentRefreshIndex] = useState(0);
  const [state, setState] = useState(INITIAL_STATE);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  const monthDays = getCalendarMonthDays(month.getFullYear(), month.getMonth(), CALENDAR.firstWeekday[locale]);
  const bounds = getCalendarMonthBounds(month.getFullYear(), month.getMonth(), CALENDAR.firstWeekday[locale]);
  const requestKey = [getMonthKey(month), brandFilter, platformFilter, statusFilter, refreshIndex].join(":");
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
        setState({ requestKey, items: parsed.data.data, truncated: parsed.data.truncated, canManage: parsed.data.canManage, error: false });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ requestKey, items: [], truncated: false, canManage: false, error: true });
      }
    };
    void load();
    return () => controller.abort();
  }, [brandFilter, end, platformFilter, requestKey, start, statusFilter]);

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
        setContentVersionState({ itemId: selectedItem.id, data: parsed.data.data, error: false });
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
  const eventsByDate = useMemo(() => {
    const events = new Map<string, CalendarItem[]>();
    for (const item of visibleItems) {
      const date = toLocalDateInputValue(new Date(item.plannedAt));
      const dayItems = events.get(date);
      if (dayItems) dayItems.push(item);
      else events.set(date, [item]);
    }
    return events;
  }, [visibleItems]);

  function changeMonth(monthDelta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + monthDelta, 1));
    setFormOpen(false);
    setNotice("");
  }

  function openIdeaForm(date: Date) {
    setSelectedDate(toLocalDateInputValue(date));
    setFormOpen(true);
    setNotice("");
  }

  async function createIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const localDateTime = new Date(`${String(form.get("date") ?? "")}T${String(form.get("time") ?? "")}`);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (Number.isNaN(localDateTime.getTime()) || !timeZone) {
      setNotice(t("createError"));
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.collection, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: String(form.get("brandId") ?? ""),
          platform: String(form.get("platform") ?? ""),
          title: String(form.get("title") ?? ""),
          plannedAt: localDateTime.toISOString(),
          timeZone,
        }),
      });
      if (!response.ok) throw new Error("Calendar idea could not be created.");
      setFormOpen(false);
      setNotice(t("created"));
      setRefreshIndex((current) => current + 1);
    } catch {
      setNotice(t("createError"));
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
      setNotice(t("contentSaveError"));
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(CALENDAR_API_PATHS.versions(selectedItem.id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: String(form.get("brandId") ?? ""),
          platform: String(form.get("platform") ?? ""),
          title: String(form.get("title") ?? ""),
          plannedAt: localDateTime.toISOString(),
          timeZone,
          canonicalCopy: String(form.get("canonicalCopy") ?? ""),
          variantCopy: String(form.get("variantCopy") ?? ""),
        }),
      });
      if (!response.ok) throw new Error("Calendar content could not be saved.");
      setSelectedItem(null);
      setNotice(t("contentSaved"));
      setRefreshIndex((current) => current + 1);
    } catch {
      setNotice(t("contentSaveError"));
    } finally {
      setBusy(false);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const weekdayLabels = Array.from({ length: CALENDAR.daysPerWeek }, (_, index) => {
    const weekday = CALENDAR.firstWeekday[locale] + index;
    const referenceDate = new Date(2023, 0, 1 + weekday);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(referenceDate);
  });
  const today = toLocalDateInputValue(new Date());

  return (
    <section className="editorialCalendar" id={CALENDAR_UI_IDS.section} aria-labelledby={CALENDAR_UI_IDS.title}>
      <header className="editorialCalendar__header">
        <div>
          <p className="entryKicker">{t("eyebrow")}</p>
          <h2 id={CALENDAR_UI_IDS.title}>{t("title")}</h2>
          <p className="entryDescription">{t("description")}</p>
        </div>
        {state.canManage && brands.length > 0 ? (
          <Button type="button" onClick={() => openIdeaForm(new Date(month.getFullYear(), month.getMonth(), 1))}>
            <CalendarPlus aria-hidden="true" size={17} />{t("newIdea")}
          </Button>
        ) : null}
      </header>

      {formOpen && state.canManage ? (
        <form className="editorialCalendar__form" id={CALENDAR_UI_IDS.newIdeaForm} onSubmit={(event) => void createIdea(event)}>
          <TextField id="calendar-idea-title" name="title" label={t("ideaTitle")} maxLength={CONTENT_LIMITS.titleCharacters} required />
          <SelectField id="calendar-idea-brand" name="brandId" label={t("brand")} defaultValue={brands[0]?.id ?? ""} required>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </SelectField>
          <SelectField id="calendar-idea-platform" name="platform" label={t("channel")} defaultValue={SOCIAL_PLATFORMS[0]} required>
            {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{t(`platforms.${platform}`)}</option>)}
          </SelectField>
          <TextField id="calendar-idea-date" name="date" label={t("date")} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} required />
          <TextField id="calendar-idea-time" name="time" label={t("time")} type="time" defaultValue={CALENDAR.defaultPlannedTime} required />
          <div className="editorialCalendar__formActions">
            <Button type="submit" disabled={busy}>{busy ? t("saving") : t("saveIdea")}</Button>
            <Button appearance="quiet" type="button" disabled={busy} onClick={() => setFormOpen(false)}>{t("cancel")}</Button>
          </div>
        </form>
      ) : null}

      <div className="editorialCalendar__toolbar" id={CALENDAR_UI_IDS.filters}>
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
        <div className="editorialCalendar__filters">
          <SelectField id="calendar-brand-filter" label={t("filterBrand")} value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
            <option value="">{t("allBrands")}</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </SelectField>
          <SelectField id="calendar-platform-filter" label={t("filterChannel")} value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
            <option value="">{t("allChannels")}</option>
            {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{t(`platforms.${platform}`)}</option>)}
          </SelectField>
          <SelectField id="calendar-status-filter" label={t("filterStatus")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">{t("allStatuses")}</option>
            {CONTENT_STATUSES.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
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

      {notice ? <p className="editorialCalendar__notice" role="status">{notice}</p> : null}
      {pending ? <p className="workspaceEmpty" role="status">{t("loading")}</p> : null}
      {hasError ? <div className="workspaceEmpty editorialCalendar__error" role="alert"><span>{t("loadError")}</span><Button appearance="quiet" type="button" onClick={() => setRefreshIndex((current) => current + 1)}>{t("retry")}</Button></div> : null}
      {!pending && !hasError && visibleItems.length === 0 ? <p className="editorialCalendar__emptyMonth">{t("emptyMonth")}</p> : null}
      {!pending && state.truncated ? <p className="editorialCalendar__notice" role="status">{t("truncated")}</p> : null}

      {viewMode === CALENDAR_VIEW_MODE.month ? <div className="editorialCalendar__viewport" aria-busy={pending}>
        <div className="editorialCalendar__grid" role="group" aria-label={monthLabel}>
          {weekdayLabels.map((weekday, index) => <div className="editorialCalendar__weekday" key={`${weekday}-${index}`}>{weekday}</div>)}
          {monthDays.map((date) => {
            const dateKey = toLocalDateInputValue(date);
            const allDayItems = eventsByDate.get(dateKey) ?? [];
            const dayItems = allDayItems.slice(0, CALENDAR.maximumVisibleItemsPerDay);
            const remainingCount = allDayItems.length - dayItems.length;
            const outsideMonth = date.getMonth() !== month.getMonth();
            return (
              <article className={`editorialCalendar__day${outsideMonth ? " is-outside" : ""}${dateKey === today ? " is-today" : ""}`} key={dateKey} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date)}>
                <Button appearance="quiet" className="editorialCalendar__dayButton" type="button" disabled={!state.canManage || pending} aria-label={t("addIdeaOn", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) })} onClick={() => openIdeaForm(date)}>
                  <span>{date.getDate()}</span><Plus aria-hidden="true" size={14} />
                </Button>
                <ol className="editorialCalendar__items">
                  {dayItems.map((item) => (
                    <li className="editorialCalendar__item" key={item.id}>
                      <button type="button" className="editorialCalendar__itemButton" disabled={!state.canManage || !isContentEditable(item.status)} onClick={() => setSelectedItem(item)} aria-label={t("editContent", { title: item.title })}>
                      <span className="editorialCalendar__itemTime">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.plannedAt))}</span>
                      <strong>{item.title}</strong>
                      <span>{t("itemMeta", { brand: item.brandName, channel: t(`platforms.${item.platform}`) })}</span>
                      <span className="editorialCalendar__status">{t(`statuses.${item.status}`)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {remainingCount > 0 ? <button type="button" className="editorialCalendar__more" onClick={() => setViewMode(CALENDAR_VIEW_MODE.list)}>{t("moreItems", { count: remainingCount })}</button> : null}
              </article>
            );
          })}
        </div>
      </div> : <div className="editorialCalendar__list" aria-busy={pending}>
        {visibleItems.length === 0 && !pending ? <p className="editorialCalendar__emptyMonth">{t("emptyMonth")}</p> : null}
        {Array.from(eventsByDate.entries()).map(([dateKey, dayItems]) => <section className="editorialCalendar__listDay" key={dateKey}>
          <h3>{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(`${dateKey}T12:00:00`))}</h3>
          <ul>{dayItems.map((item) => <li key={item.id}>
            <span className="editorialCalendar__listTime">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.plannedAt))}</span>
            <button type="button" className="editorialCalendar__listItem" disabled={!state.canManage || !isContentEditable(item.status)} onClick={() => setSelectedItem(item)} aria-label={t("editContent", { title: item.title })}>
              <strong>{item.title}</strong><span>{t("itemMeta", { brand: item.brandName, channel: t(`platforms.${item.platform}`) })}</span>
            </button><span className="editorialCalendar__status">{t(`statuses.${item.status}`)}</span>
          </li>)}</ul>
        </section>)}
      </div>}

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open && !busy) { setSelectedItem(null); setContentVersionState(null); } }}>
        {selectedItem ? <DialogContent aria-labelledby={CALENDAR_UI_IDS.editTitle} aria-describedby={CALENDAR_UI_IDS.editDescription}>
          <DialogHeader><DialogTitle id={CALENDAR_UI_IDS.editTitle}>{t("editTitle")}</DialogTitle><DialogDescription id={CALENDAR_UI_IDS.editDescription}>{t("editDescription")}</DialogDescription></DialogHeader>
          {contentVersionState?.itemId !== selectedItem.id ? <p className="workspaceEmpty" role="status">{t("loadingContent")}</p> : contentVersionState.error ? <div className="workspaceEmpty editorialCalendar__error" role="alert"><span>{t("contentLoadError")}</span><Button appearance="quiet" type="button" onClick={() => { setContentVersionState(null); setContentRefreshIndex((current) => current + 1); }}>{t("retry")}</Button></div> : contentVersionState.data ? <form className="editorialCalendar__editForm" onSubmit={(event) => void saveContentVersion(event)} key={`${selectedItem.id}-${contentVersionState.data.current?.versionNumber ?? 0}`}>
            <TextField id="calendar-edit-idea-title" name="title" label={t("ideaTitle")} defaultValue={selectedItem.title} maxLength={CONTENT_LIMITS.titleCharacters} required />
            <SelectField id="calendar-edit-idea-brand" name="brandId" label={t("brand")} defaultValue={selectedItem.brandId} required>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </SelectField>
            <SelectField id="calendar-edit-idea-platform" name="platform" label={t("channel")} defaultValue={selectedItem.platform} required>
              {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{t(`platforms.${platform}`)}</option>)}
            </SelectField>
            <TextField id="calendar-edit-idea-date" name="date" label={t("date")} type="date" defaultValue={toLocalDateInputValue(new Date(selectedItem.plannedAt))} required />
            <TextField id="calendar-edit-idea-time" name="time" label={t("time")} type="time" defaultValue={new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(selectedItem.plannedAt))} required />
            <TextAreaField id={CALENDAR_UI_IDS.canonicalCopy} name="canonicalCopy" label={t("canonicalCopy")} defaultValue={contentVersionState.data.current?.canonicalCopy ?? ""} maxLength={CONTENT_LIMITS.canonicalCopyCharacters} required />
            <TextAreaField id={CALENDAR_UI_IDS.variantCopy} name="variantCopy" label={t("variantCopy")} defaultValue={contentVersionState.data.current?.variantCopy ?? ""} maxLength={CONTENT_LIMITS.variantCopyCharacters} required />
            {contentVersionState.data.history.length > 0 ? <div className="editorialCalendar__versionHistory"><strong>{t("versionHistory")}</strong><ol>{contentVersionState.data.history.map((version) => <li key={version.versionNumber}>{t("versionEntry", { version: version.versionNumber, platform: t(`platforms.${version.platform}`), date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt)) })}</li>)}</ol></div> : null}
            <div className="editorialCalendar__formActions"><Button type="submit" disabled={busy}>{busy ? t("saving") : t("saveDraft")}</Button><Button appearance="quiet" type="button" disabled={busy} onClick={() => { setSelectedItem(null); setContentVersionState(null); }}>{t("cancel")}</Button></div>
          </form> : null}
        </DialogContent> : null}
      </Dialog>
    </section>
  );
}
