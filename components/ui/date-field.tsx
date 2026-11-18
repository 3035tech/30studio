"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCancel, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DateFieldProps = {
  id: string;
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string;
  max?: string;
};

const WEEKDAY_REFERENCE_SUNDAY = Date.UTC(2024, 0, 7);

function dateFromIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null;
}

function isoFromDate(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function todayIso(): string {
  const today = new Date();
  return isoFromDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
}

export function DateField({ id, label, name, value, defaultValue = "", onValueChange, required, disabled, error, min, max }: DateFieldProps) {
  const locale = useLocale();
  const t = useTranslations("fields.datePicker");
  const tValidation = useTranslations("fields.validation");
  const controlled = value !== undefined;
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(dateFromIso(value ?? defaultValue) ?? new Date()));
  const [focusedValue, setFocusedValue] = useState(() => value ?? defaultValue ?? todayIso());
  const currentValue = controlled ? value : selectedValue;
  const selectedDate = dateFromIso(currentValue ?? "");
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }), [locale]);
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }), [locale]);

  const today = todayIso();
  const weekStart = locale.startsWith("en") ? 0 : 1;
  const weekdays = Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(WEEKDAY_REFERENCE_SUNDAY + ((weekStart + index) % 7) * 24 * 60 * 60 * 1000)));
  const firstWeekdayOffset = (visibleMonth.getUTCDay() - weekStart + 7) % 7;
  const dayCount = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekdayOffset + dayCount) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekdayOffset + 1;
    return day > 0 && day <= dayCount ? new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), day)) : null;
  });

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-day-${focusedValue}`)?.focus();
  }, [focusedValue, id, open, visibleMonth]);

  function chooseDate(date: Date) {
    const nextValue = isoFromDate(date);
    const displayInput = document.getElementById(id);
    if (displayInput instanceof HTMLInputElement) {
      displayInput.setCustomValidity("");
      if (!error) displayInput.removeAttribute("aria-invalid");
    }
    if (!controlled) setSelectedValue(nextValue);
    setFocusedValue(nextValue);
    onValueChange?.(nextValue);
    setVisibleMonth(monthStart(date));
    setOpen(false);
  }

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  function openCalendar() {
    const initialFocus = selectedDate ?? dateFromIso(today) ?? new Date();
    setFocusedValue(isoFromDate(initialFocus));
    setVisibleMonth(monthStart(initialFocus));
    setOpen(true);
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let nextDate = new Date(date);
    let direction = 1;
    const weekdayOffset = (date.getUTCDay() - weekStart + 7) % 7;
    if (event.key === "ArrowLeft") { nextDate.setUTCDate(nextDate.getUTCDate() - 1); direction = -1; }
    else if (event.key === "ArrowRight") nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    else if (event.key === "ArrowUp") { nextDate.setUTCDate(nextDate.getUTCDate() - 7); direction = -1; }
    else if (event.key === "ArrowDown") nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    else if (event.key === "Home") { nextDate.setUTCDate(nextDate.getUTCDate() - weekdayOffset); direction = -1; }
    else if (event.key === "End") nextDate.setUTCDate(nextDate.getUTCDate() + (6 - weekdayOffset));
    else if (event.key === "PageUp" || event.key === "PageDown") {
      direction = event.key === "PageUp" ? -1 : 1;
      const monthOffset = direction * (event.shiftKey ? 12 : 1);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + monthOffset;
      const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
      nextDate = new Date(Date.UTC(year, month, day));
    } else return;

    event.preventDefault();
    for (let attempt = 0; attempt < 366 && isOutOfRange(nextDate); attempt += 1) nextDate.setUTCDate(nextDate.getUTCDate() + direction);
    if (isOutOfRange(nextDate)) return;
    const nextValue = isoFromDate(nextDate);
    setFocusedValue(nextValue);
    setVisibleMonth(monthStart(nextDate));
  }

  function isOutOfRange(date: Date) {
    const isoDate = isoFromDate(date);
    return (min !== undefined && isoDate < min) || (max !== undefined && isoDate > max);
  }

  return <div className="fieldControl dateField">
    <label className="fieldControl__label" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="fieldControl__required"> *</span> : null}</label>
    {name ? <input type="hidden" name={name} value={currentValue ?? ""} disabled={disabled} /> : null}
    <div className={`dateField__control${error ? " is-invalid" : ""}`}>
      <input
        id={id}
        className="dateField__input"
        type="text"
        value={selectedDate ? dateFormatter.format(selectedDate) : ""}
        placeholder={t("placeholder")}
        readOnly
        required={required}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={openCalendar}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCalendar(); } }}
        onInvalid={(event) => {
          event.currentTarget.setAttribute("aria-invalid", "true");
          if (event.currentTarget.validity.valueMissing) event.currentTarget.setCustomValidity(tValidation("required"));
        }}
        onInput={(event) => event.currentTarget.setCustomValidity("")}
      />
      {!required && currentValue ? <Button type="button" appearance="quiet" className="dateField__trigger" aria-label={t("clear")} disabled={disabled} onClick={() => { if (!controlled) setSelectedValue(""); onValueChange?.(""); }}><X aria-hidden="true" size={17} /></Button> : null}
      <Button type="button" appearance="quiet" className="dateField__trigger" aria-label={t("open", { label })} disabled={disabled} onClick={openCalendar}><CalendarDays aria-hidden="true" size={18} /></Button>
    </div>
    {error ? <span className="fieldControl__error" id={`${id}-error`} role="alert">{error}</span> : null}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="datePicker" aria-describedby={`${id}-calendar-description`} onOpenAutoFocus={(event) => {
        const dayButton = document.getElementById(`${id}-day-${focusedValue}`);
        if (dayButton && !dayButton.hasAttribute("disabled")) { event.preventDefault(); dayButton.focus(); }
      }}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription id={`${id}-calendar-description`}>{selectedDate ? dateFormatter.format(selectedDate) : t("chooseDate")}</DialogDescription>
        </DialogHeader>
        <div className="datePicker__header">
          <Button type="button" appearance="quiet" aria-label={t("previousMonth")} onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" size={18} /></Button>
          <h3 aria-live="polite">{monthFormatter.format(visibleMonth)}</h3>
          <Button type="button" appearance="quiet" aria-label={t("nextMonth")} onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" size={18} /></Button>
        </div>
        <div className="datePicker__grid" role="group" aria-label={monthFormatter.format(visibleMonth)}>
          {weekdays.map((weekday, index) => <span className="datePicker__weekday" aria-hidden="true" key={`${weekday}-${index}`}>{weekday}</span>)}
          {days.map((date, index) => date ? <div className="datePicker__cell" key={isoFromDate(date)}><button
            id={`${id}-day-${isoFromDate(date)}`}
            className="datePicker__day"
            type="button"
            disabled={disabled || isOutOfRange(date)}
            tabIndex={isoFromDate(date) === focusedValue ? 0 : -1}
            aria-label={dateFormatter.format(date)}
            aria-pressed={isoFromDate(date) === currentValue}
            aria-current={isoFromDate(date) === today ? "date" : undefined}
            onClick={() => chooseDate(date)}
            onKeyDown={(event) => handleDayKeyDown(event, date)}
          >{date.getUTCDate()}</button></div> : <span aria-hidden="true" className="datePicker__day datePicker__day--empty" key={`empty-${index}`} />)}
        </div>
        <DialogFooter><DialogCancel /></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
