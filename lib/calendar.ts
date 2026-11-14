import { CALENDAR } from "@/lib/constants";

export function getCalendarMonthDays(year: number, monthIndex: number, weekStartsOn: number) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const leadingDays = (firstOfMonth.getDay() - weekStartsOn + CALENDAR.daysPerWeek) % CALENDAR.daysPerWeek;
  const gridStart = new Date(year, monthIndex, 1 - leadingDays);
  return Array.from({ length: CALENDAR.weeksPerView * CALENDAR.daysPerWeek }, (_, index) => (
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
  ));
}

export function getCalendarMonthBounds(year: number, monthIndex: number, weekStartsOn: number) {
  const days = getCalendarMonthDays(year, monthIndex, weekStartsOn);
  const firstDay = days[0];
  const lastDay = days.at(-1);
  if (!firstDay || !lastDay) throw new Error("Calendar grid could not be created.");
  return {
    start: new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()),
    end: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1),
  };
}

export function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
