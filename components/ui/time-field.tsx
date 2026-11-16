"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type TimeFieldProps = {
  id: string;
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

function timeIsValid(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return Boolean(match);
}

function maskTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function TimeField({ id, label, name, value, defaultValue = "", onValueChange, required, disabled }: TimeFieldProps) {
  const t = useTranslations("fields.timeField");
  const tValidation = useTranslations("fields.validation");
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const currentValue = controlled ? value : internalValue;

  function changeValue(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  return <div className="fieldControl timeField">
    <label className="fieldControl__label" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="fieldControl__required"> *</span> : null}</label>
    {name ? <input type="hidden" name={name} value={currentValue} disabled={disabled} /> : null}
    <input
      id={id}
      className="fieldControl__input timeField__input"
      type="text"
      value={currentValue}
      placeholder={t("placeholder")}
      inputMode="numeric"
      pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
      maxLength={5}
      required={required}
      disabled={disabled}
      onInvalid={(event) => {
        event.currentTarget.setAttribute("aria-invalid", "true");
        if (event.currentTarget.validity.valueMissing) event.currentTarget.setCustomValidity(tValidation("required"));
        else if (event.currentTarget.validity.patternMismatch) event.currentTarget.setCustomValidity(t("invalid"));
      }}
      onChange={(event) => {
        const nextValue = maskTime(event.target.value);
        const valid = timeIsValid(nextValue);
        event.currentTarget.setCustomValidity(nextValue && !valid ? t("invalid") : "");
        if (valid || (!required && !nextValue)) event.currentTarget.removeAttribute("aria-invalid");
        else event.currentTarget.setAttribute("aria-invalid", "true");
        changeValue(nextValue);
      }}
    />
  </div>;
}
