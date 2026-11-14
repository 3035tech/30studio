import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, id, className = "", ...props }: TextFieldProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-[13px] font-semibold text-studio-dark" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-studio-text outline-none transition placeholder:text-slate-400 focus:border-studio-primary focus:ring-2 focus:ring-studio-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${error ? "border-red-600 focus:border-red-700 focus:ring-red-200" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        {...props}
      />
      {error && id ? <span className="text-xs text-red-700" id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  );
}

type FileFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string };

export function FileField({ label, error, id, className = "", ...props }: FileFieldProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-[13px] font-semibold text-studio-dark" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        className={`min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-studio-text file:mr-3 file:min-h-8 file:rounded file:border-0 file:bg-studio-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studio-primary disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        {...props}
      />
      {error && id ? <span className="text-xs text-red-700" id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  id: string;
  children: ReactNode;
};

export function SelectField({ label, id, children, className = "", ...props }: SelectFieldProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-[13px] font-semibold text-studio-dark" htmlFor={id}>{label}</label>
      <select id={id} className={`min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-studio-text outline-none focus:border-studio-primary focus:ring-2 focus:ring-studio-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`.trim()} {...props}>{children}</select>
    </div>
  );
}

type CheckboxFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function CheckboxField({ label, id, className = "", ...props }: CheckboxFieldProps) {
  return (
    <label className={`inline-flex min-h-10 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-studio-dark transition hover:border-studio-primary/50 has-[:checked]:border-studio-primary has-[:checked]:bg-studio-primary/5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-studio-primary ${className}`.trim()} htmlFor={id}>
      <input id={id} className="size-4 accent-studio-primary" type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  id: string;
  error?: string;
};

export function TextAreaField({ label, id, error, className = "", ...props }: TextAreaFieldProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-[13px] font-semibold text-studio-dark" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className={`min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-studio-text outline-none transition placeholder:text-slate-400 focus:border-studio-primary focus:ring-2 focus:ring-studio-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${error ? "border-red-600 focus:border-red-700 focus:ring-red-200" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? <span className="text-xs text-red-700" id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  );
}
