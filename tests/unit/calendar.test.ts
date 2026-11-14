import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR } from "@/lib/constants";
import { getCalendarMonthBounds, getCalendarMonthDays, toLocalDateInputValue } from "@/lib/calendar";

test("calendar month grid contains six complete weeks from the locale week start", () => {
  const days = getCalendarMonthDays(2026, 10, CALENDAR.firstWeekday.pt);
  assert.equal(days.length, CALENDAR.weeksPerView * CALENDAR.daysPerWeek);
  assert.equal(days[0]?.getDay(), CALENDAR.firstWeekday.pt);
  assert.equal(toLocalDateInputValue(days[0]!), "2026-10-26");
  assert.equal(toLocalDateInputValue(days.at(-1)!), "2026-12-06");
});

test("calendar bounds are exclusive at the end and support Sunday-first locales", () => {
  const bounds = getCalendarMonthBounds(2026, 10, CALENDAR.firstWeekday.en);
  assert.equal(toLocalDateInputValue(bounds.start), "2026-11-01");
  assert.equal(toLocalDateInputValue(bounds.end), "2026-12-13");
});
