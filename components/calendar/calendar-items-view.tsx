"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CALENDAR, CALENDAR_VIEW_MODE, CONTENT_STATUS, SOCIAL_PUBLICATION_JOB_STATUS, type CalendarViewMode, type Locale } from "@/lib/constants";
import { getCalendarMonthDays, toLocalDateInputValue } from "@/lib/calendar";
import type { CalendarItem } from "@/lib/validation/calendar";

type Props = {
  viewMode: CalendarViewMode;
  month: Date;
  monthLabel: string;
  visibleItems: CalendarItem[];
  pending: boolean;
  canManage: boolean;
  canOpenCalendarItem: (item: CalendarItem) => boolean;
  onSelectCalendarItem: (item: CalendarItem) => void;
  onOpenCampaignForm: (date: Date) => void;
  onShowList: () => void;
};

export function CalendarItemsView({
  viewMode, month, monthLabel, visibleItems, pending, canManage,
  canOpenCalendarItem, onSelectCalendarItem, onOpenCampaignForm, onShowList,
}: Props) {
  const t = useTranslations("calendar");
  const locale = useLocale() as Locale;
  function campaignPeriod(item: CalendarItem) {
    if (!item.campaignStartDate || !item.campaignEndDate) return t("campaign");
    const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
    return t("campaignPeriodTag", { start: formatDate(item.campaignStartDate), end: formatDate(item.campaignEndDate) });
  }
  const monthDays = getCalendarMonthDays(month.getFullYear(), month.getMonth(), CALENDAR.firstWeekday[locale]);
  const weekdayLabels = monthDays.slice(0, CALENDAR.daysPerWeek).map((date) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date));
  const today = toLocalDateInputValue(new Date());
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

  if (viewMode === CALENDAR_VIEW_MODE.list) {
    return <div className="editorialCalendar__list" aria-busy={pending}>
      {visibleItems.length === 0 && !pending ? <p className="editorialCalendar__emptyMonth">{t("emptyMonth")}</p> : null}
      {Array.from(eventsByDate.entries()).map(([dateKey, dayItems]) => <section className="editorialCalendar__listDay" key={dateKey}>
        <h3>{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(`${dateKey}T12:00:00`))}</h3>
        <ul>{dayItems.map((item) => <li key={item.id}>
          <span className="editorialCalendar__listTime">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.plannedAt))}</span>
          <Button appearance="quiet" type="button" className="editorialCalendar__listItem" disabled={!canOpenCalendarItem(item)} onClick={() => onSelectCalendarItem(item)} aria-label={item.publicationStatus === SOCIAL_PUBLICATION_JOB_STATUS.indeterminate ? t("reconcilePublication") : t(item.status === CONTENT_STATUS.inReview ? "reviewContent" : "editContent", { title: item.title })}>
            <strong>{item.title}</strong><span>{t("itemMeta", { brand: item.brandName, channel: t(`platforms.${item.platform}`) })}</span>
          </Button><span className="editorialCalendar__status">{t(`statuses.${item.status}`)}</span>
          {item.publicationStatus ? <span className="editorialCalendar__publicationStatus">{t(`publicationStatuses.${item.publicationStatus}`)}</span> : null}
          {item.campaignId ? <span className="editorialCalendar__campaignLabel">{campaignPeriod(item)}</span> : null}
        </li>)}</ul>
      </section>)}
    </div>;
  }

  return <>
    <p className="editorialCalendar__scrollHint">{t("monthScrollHint")}</p>
    <div className="editorialCalendar__viewport" aria-busy={pending}>
      <div className="editorialCalendar__grid" role="group" aria-label={monthLabel}>
        {weekdayLabels.map((weekday, index) => <div className="editorialCalendar__weekday" key={`${weekday}-${index}`}>{weekday}</div>)}
        {monthDays.map((date) => {
          const dateKey = toLocalDateInputValue(date);
          const allDayItems = eventsByDate.get(dateKey) ?? [];
          const dayItems = allDayItems.slice(0, CALENDAR.maximumVisibleItemsPerDay);
          const remainingCount = allDayItems.length - dayItems.length;
          const outsideMonth = date.getMonth() !== month.getMonth();
          return <article className={`editorialCalendar__day${outsideMonth ? " is-outside" : ""}${dateKey === today ? " is-today" : ""}`} key={dateKey} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date)}>
            <Button appearance="quiet" className="editorialCalendar__dayButton" type="button" disabled={!canManage || pending} aria-label={t("addCampaignOn", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) })} onClick={() => onOpenCampaignForm(date)}>
              <span>{date.getDate()}</span><Plus aria-hidden="true" size={14} />
            </Button>
            <ol className="editorialCalendar__items">
              {dayItems.map((item) => <li className="editorialCalendar__item" key={item.id}>
                <Button appearance="quiet" type="button" className="editorialCalendar__itemButton" disabled={!canOpenCalendarItem(item)} onClick={() => onSelectCalendarItem(item)} aria-label={item.publicationStatus === SOCIAL_PUBLICATION_JOB_STATUS.indeterminate ? t("reconcilePublication") : t(item.status === CONTENT_STATUS.inReview ? "reviewContent" : "editContent", { title: item.title })}>
                  <span className="editorialCalendar__itemTime">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.plannedAt))}</span>
                  <strong>{item.title}</strong>
                  {item.campaignId ? <span className="editorialCalendar__campaignLabel">{campaignPeriod(item)}</span> : null}
                  <span>{t("itemMeta", { brand: item.brandName, channel: t(`platforms.${item.platform}`) })}</span>
                  <span className="editorialCalendar__status">{t(`statuses.${item.status}`)}</span>
                  {item.publicationStatus ? <span className="editorialCalendar__publicationStatus">{t(`publicationStatuses.${item.publicationStatus}`)}</span> : null}
                </Button>
              </li>)}
            </ol>
            {remainingCount > 0 ? <Button appearance="quiet" type="button" className="editorialCalendar__more" onClick={onShowList}>{t("moreItems", { count: remainingCount })}</Button> : null}
          </article>;
        })}
      </div>
    </div>
  </>;
}
