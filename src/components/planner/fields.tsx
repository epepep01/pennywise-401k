import { type ReactNode } from "react";

type FieldProps = {
  htmlFor: string;
  label: string;
  help?: ReactNode;
  error?: string;
  warning?: string;
  className: string;
  children: ReactNode;
};

export function Field({
  htmlFor,
  label,
  help,
  error,
  warning,
  className,
  children,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      <FieldFeedback id={htmlFor} help={help} error={error} warning={warning} />
    </div>
  );
}

export function fieldDescriptionIds(id: string, { help, error, warning }: { help?: ReactNode; error?: string; warning?: string }): string | undefined {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null, warning ? `${id}-warning` : null].filter(Boolean).join(" ") || undefined;
}

export function FieldFeedback({ id, help, error, warning }: { id: string; help?: ReactNode; error?: string; warning?: string }) {
  return <>
    {help && <span className="field-help" id={`${id}-help`}>{help}</span>}
    {error && <span className="field-error" role="alert" id={`${id}-error`}>{error}</span>}
    {warning && <span className="field-warning" role="status" id={`${id}-warning`}>{warning}</span>}
  </>;
}

type InputProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  className: string;
  controlClassName: string;
  help?: ReactNode;
  error?: string;
  warning?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  inputMode?: "decimal" | "numeric";
};

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  className,
  controlClassName,
  help,
  error,
  warning,
  min = 0,
  step = 0.01,
}: InputProps) {
  return (
    <Field
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      warning={warning}
      className={className}
    >
      <span className="money-control" data-invalid={Boolean(error)}>
        <span aria-hidden="true">$</span>
        <input
          id={id}
          className={controlClassName}
          type="number"
          min={min}
          step={step}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescriptionIds(id, { help, error, warning })}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </Field>
  );
}

export function PercentInput({
  id,
  label,
  value,
  onChange,
  className,
  controlClassName,
  help,
  error,
  warning,
  min = 0,
  max = 100,
  step = 1,
}: InputProps) {
  return (
    <Field
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      warning={warning}
      className={className}
    >
      <span className="percent-control" data-invalid={Boolean(error)}>
        <input
          id={id}
          className={controlClassName}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescriptionIds(id, { help, error, warning })}
          onChange={(event) => onChange(event.target.value)}
        />
        <span aria-hidden="true">%</span>
      </span>
    </Field>
  );
}

export function DateInput({
  id,
  label,
  value,
  onChange,
  className,
  controlClassName,
  help,
  error,
  warning,
}: Omit<InputProps, "min" | "max" | "step">) {
  return (
    <Field
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      warning={warning}
      className={className}
    >
      <input
        id={id}
        className={controlClassName}
        type="date"
        value={value}
        aria-invalid={Boolean(error)}
          aria-describedby={fieldDescriptionIds(id, { help, error, warning })}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
