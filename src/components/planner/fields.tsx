import { useState, type ReactNode } from "react";

function DismissibleFieldError({ error }: { error: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <span className="field-error" role="alert">
      <span>{error}</span>
      <button
        className="message-dismiss"
        type="button"
        aria-label="Dismiss error message"
        onClick={() => setDismissed(true)}
      >
        x
      </button>
    </span>
  );
}

type FieldProps = {
  htmlFor: string;
  label: string;
  help?: ReactNode;
  error?: string;
  className: string;
  children: ReactNode;
};

export function Field({
  htmlFor,
  label,
  help,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <DismissibleFieldError key={error} error={error} />
      ) : help ? (
        <span className="field-help">{help}</span>
      ) : null}
    </div>
  );
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
  min = 0,
  step = 0.01,
}: InputProps) {
  return (
    <Field
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      className={className}
    >
      <span className="money-control">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          className={controlClassName}
          type="number"
          min={min}
          step={step}
          value={value}
          aria-invalid={Boolean(error)}
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
      className={className}
    >
      <span className="percent-control">
        <input
          id={id}
          className={controlClassName}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={Boolean(error)}
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
}: Omit<InputProps, "min" | "max" | "step">) {
  return (
    <Field
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      className={className}
    >
      <input
        id={id}
        className={controlClassName}
        type="date"
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
