"use client";

import { Children, Fragment, isValidElement, useRef, useState, type FormEvent, type FormEventHandler, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

type ValidationMessageKey = "required" | "email" | "url" | "number" | "range" | "step" | "length" | "format";
type ValidationTranslator = (key: ValidationMessageKey) => string;
type ValidatedElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function setLocalizedValidationMessage(element: ValidatedElement, t: ValidationTranslator) {
  const validity = element.validity;
  element.setAttribute("aria-invalid", "true");
  if (validity.valueMissing) element.setCustomValidity(t("required"));
  else if (validity.typeMismatch && element instanceof HTMLInputElement && element.type === "email") element.setCustomValidity(t("email"));
  else if (validity.typeMismatch && element instanceof HTMLInputElement && element.type === "url") element.setCustomValidity(t("url"));
  else if (validity.badInput && element instanceof HTMLInputElement && element.type === "number") element.setCustomValidity(t("number"));
  else if (validity.rangeOverflow || validity.rangeUnderflow) element.setCustomValidity(t("range"));
  else if (validity.stepMismatch) element.setCustomValidity(t("step"));
  else if (validity.tooLong || validity.tooShort) element.setCustomValidity(t("length"));
  else if (validity.patternMismatch || validity.typeMismatch) element.setCustomValidity(t("format"));
}

function useFieldValidation() {
  const t = useTranslations("fields.validation");
  return {
    onInvalid: (event: FormEvent<ValidatedElement>) => setLocalizedValidationMessage(event.currentTarget, (key) => t(key)),
    onInput: (event: FormEvent<ValidatedElement>) => {
      event.currentTarget.setCustomValidity("");
      if (event.currentTarget.validity.valid) event.currentTarget.removeAttribute("aria-invalid");
      else event.currentTarget.setAttribute("aria-invalid", "true");
    },
  };
}

type FieldFeedbackProps = { error?: string; helpText?: string; id?: string; required?: boolean };

function FieldLabel({ id, label, required }: { id?: string; label: string; required?: boolean }) {
  return <label className="fieldControl__label" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="fieldControl__required"> *</span> : null}</label>;
}

function FieldFeedback({ error, helpText, id }: FieldFeedbackProps) {
  if (error) return <span className="fieldControl__error" id={id ? `${id}-error` : undefined} role="alert">{error}</span>;
  if (helpText) return <span className="fieldControl__description" id={id ? `${id}-description` : undefined}>{helpText}</span>;
  return null;
}

type TextInputType = "email" | "password" | "search" | "tel" | "text" | "url";

type BaseTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  label: string;
  error?: string;
  helpText?: string;
};

type TextFieldProps = Omit<BaseTextFieldProps, "type"> & { type?: TextInputType };

function BaseTextField({ label, error, helpText, id, className = "", required, onInvalid, onInput, ...props }: BaseTextFieldProps) {
  const validation = useFieldValidation();
  return (
    <div className="fieldControl">
      <FieldLabel id={id} label={label} required={required} />
      <input
        id={id}
        className={`fieldControl__input ${error ? "is-invalid" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? (id ? `${id}-error` : undefined) : helpText && id ? `${id}-description` : undefined}
        required={required}
        onInvalid={(event) => { validation.onInvalid(event); onInvalid?.(event); }}
        onInput={(event) => { validation.onInput(event); onInput?.(event); if (error) event.currentTarget.setAttribute("aria-invalid", "true"); }}
        {...props}
      />
      <FieldFeedback error={error} helpText={helpText} id={id} />
    </div>
  );
}

export function TextField(props: TextFieldProps) {
  return <BaseTextField {...props} />;
}

export function PasswordField({ label, error, helpText, id, className = "", required, disabled, onInvalid, onInput, ...props }: Omit<BaseTextFieldProps, "type">) {
  const t = useTranslations("auth");
  const validation = useFieldValidation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="fieldControl">
      <FieldLabel id={id} label={label} required={required} />
      <div className="passwordField__control">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`fieldControl__input ${error ? "is-invalid" : ""} passwordField__input ${className}`.trim()}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helpText ? `${id}-description` : undefined}
          required={required}
          disabled={disabled}
          onInvalid={(event) => { validation.onInvalid(event); onInvalid?.(event); }}
          onInput={(event) => { validation.onInput(event); onInput?.(event); if (error) event.currentTarget.setAttribute("aria-invalid", "true"); }}
          {...props}
        />
        <button
          type="button"
          className="passwordField__toggle"
          aria-label={t(visible ? "hidePassword" : "showPassword")}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
        </button>
      </div>
      <FieldFeedback error={error} helpText={helpText} id={id} />
    </div>
  );
}

type IntegerFieldProps = Omit<TextFieldProps, "type" | "step"> & { step?: never };

export function IntegerField(props: IntegerFieldProps) {
  return <BaseTextField {...props} type="number" step={1} inputMode="numeric" />;
}

type FileFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & { id: string; label: string; error?: string; helpText?: string };

export function FileField({ label, error, helpText, id, className = "", required, onInvalid, onInput, ...props }: FileFieldProps) {
  const validation = useFieldValidation();
  return (
    <div className="fieldControl">
      <FieldLabel id={id} label={label} required={required} />
      <input
        id={id}
        type="file"
        className={`fieldControl__file ${error ? "is-invalid" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helpText ? `${id}-description` : undefined}
        required={required}
        onInvalid={(event) => { validation.onInvalid(event); onInvalid?.(event); }}
        onInput={(event) => { validation.onInput(event); onInput?.(event); if (error) event.currentTarget.setAttribute("aria-invalid", "true"); }}
        {...props}
      />
      <FieldFeedback error={error} helpText={helpText} id={id} />
    </div>
  );
}

type SelectOptionProps = { value?: string; disabled?: boolean; children?: ReactNode; selected?: boolean };
type SelectChangeEvent = { target: { value: string } };
type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "onInvalid" | "children"> & {
  label: string;
  id: string;
  children: ReactNode;
  error?: string;
  helpText?: string;
  onChange?: (event: SelectChangeEvent) => void;
  onInvalid?: FormEventHandler<HTMLSelectElement>;
};

const EMPTY_SELECT_VALUE = "__30studio_empty_select_value__";

function collectSelectOptions(children: ReactNode): ReactElement<SelectOptionProps>[] {
  const options: ReactElement<SelectOptionProps>[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<SelectOptionProps>(child)) return;
    if (child.type === "option" && typeof child.props.value === "string") options.push(child);
    else if (child.type === Fragment) options.push(...collectSelectOptions(child.props.children));
  });
  return options;
}

export function SelectField({ label, id, children, className = "", error, helpText, required, onInvalid, onChange, value, defaultValue, name, disabled, ...props }: SelectFieldProps) {
  const validation = useFieldValidation();
  const options = collectSelectOptions(children);
  const firstValue = options.find((option) => option.props.selected)?.props.value ?? options[0]?.props.value ?? "";
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? firstValue));
  const [invalid, setInvalid] = useState(false);
  const [formError, setFormError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedValue = String(value ?? uncontrolledValue);
  const internalValue = selectedValue === "" ? EMPTY_SELECT_VALUE : selectedValue;

  return (
    <div className="fieldControl">
      <FieldLabel id={id} label={label} required={required} />
      <SelectPrimitive.Root
        value={internalValue}
        disabled={disabled}
        onValueChange={(nextValue) => {
          const next = nextValue === EMPTY_SELECT_VALUE ? "" : nextValue;
          if (value === undefined) setUncontrolledValue(next);
          setInvalid(false);
          setFormError("");
          onChange?.({ target: { value: next } });
        }}
      >
        <SelectPrimitive.Trigger ref={triggerRef} id={id} className={`fieldControl__select ${className}`.trim()} aria-invalid={Boolean(error) || invalid} aria-describedby={error ? `${id}-error` : helpText ? `${id}-description` : undefined}>
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon asChild><ChevronDown className="fieldControl__selectIcon" aria-hidden="true" size={17} /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="fieldControl__selectContent" position="popper" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
            <SelectPrimitive.Viewport className="fieldControl__selectViewport">
              {options.map((option, index) => {
                const optionValue = option.props.value ?? "";
                return <SelectPrimitive.Item className="fieldControl__selectItem" key={option.key ?? `${optionValue}-${index}`} value={optionValue === "" ? EMPTY_SELECT_VALUE : optionValue} disabled={option.props.disabled} textValue={typeof option.props.children === "string" ? option.props.children : undefined}>
                  <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator><Check aria-hidden="true" size={15} /></SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>;
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {name || required ? <select className="fieldControl__formSelect" aria-hidden="true" tabIndex={-1} name={name} value={selectedValue} required={required} disabled={disabled} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); validation.onInvalid(event); setFormError(event.currentTarget.validationMessage); setInvalid(true); onInvalid?.(event); triggerRef.current?.focus(); }} {...props}>{children}</select> : null}
      <FieldFeedback error={error ?? formError} helpText={helpText} id={id} />
    </div>
  );
}

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  label: string;
  leadingIcon?: ReactNode;
  description?: string;
};

export function CheckboxField({ label, id, className = "", leadingIcon, description, onInvalid, onInput, ...props }: CheckboxFieldProps) {
  const validation = useFieldValidation();
  return (
    <label className={`inline-flex min-h-10 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-studio-dark transition hover:border-studio-primary/50 has-[:checked]:border-studio-primary has-[:checked]:bg-studio-primary/5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-studio-primary ${className}`.trim()} htmlFor={id}>
      <input id={id} className="size-4 accent-studio-primary" type="checkbox" onInvalid={(event) => { validation.onInvalid(event); onInvalid?.(event); }} onInput={(event) => { validation.onInput(event); onInput?.(event); }} {...props} />
      {leadingIcon ? <span className="inline-grid size-5 shrink-0 place-items-center" aria-hidden="true">{leadingIcon}</span> : null}
      <span className={description ? "grid gap-0.5" : undefined}>
        <span>{label}</span>
        {description ? <span className="text-xs font-normal leading-tight text-studio-muted">{description}</span> : null}
      </span>
    </label>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  id: string;
  error?: string;
  helpText?: string;
};

export function TextAreaField({ label, id, error, helpText, className = "", required, onInvalid, onInput, ...props }: TextAreaFieldProps) {
  const validation = useFieldValidation();
  return (
    <div className="fieldControl">
      <FieldLabel id={id} label={label} required={required} />
      <textarea
        id={id}
        className={`fieldControl__textarea ${error ? "is-invalid" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helpText ? `${id}-description` : undefined}
        required={required}
        onInvalid={(event) => { validation.onInvalid(event); onInvalid?.(event); }}
        onInput={(event) => { validation.onInput(event); onInput?.(event); if (error) event.currentTarget.setAttribute("aria-invalid", "true"); }}
        {...props}
      />
      <FieldFeedback error={error} helpText={helpText} id={id} />
    </div>
  );
}
