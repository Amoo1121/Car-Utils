import { Star } from "lucide-react";
import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={["field", error ? "has-error" : "", className ?? ""].filter(Boolean).join(" ")}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <small className="field-error" role="alert">
          {error}
        </small>
      ) : hint ? (
        <small className="field-hint">{hint}</small>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  suffix?: ReactNode;
  prefix?: ReactNode;
  fieldClassName?: string;
};

export function TextField({ label, value, onChange, hint, error, suffix, prefix, fieldClassName, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field className={fieldClassName} error={error} hint={hint} htmlFor={inputId} label={label}>
      <div className={["input-wrap", suffix ? "has-suffix" : "", prefix ? "has-prefix" : ""].filter(Boolean).join(" ")}>
        {prefix && <span className="input-affix input-prefix">{prefix}</span>}
        <input
          aria-invalid={error ? true : undefined}
          id={inputId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
        {suffix && <span className="input-affix input-suffix">{suffix}</span>}
      </div>
    </Field>
  );
}

export function NumberField(props: Omit<TextFieldProps, "type" | "inputMode">) {
  return <TextField inputMode="decimal" min="0" step="any" type="number" {...props} />;
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  fieldClassName,
}: {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
  fieldClassName?: string;
}) {
  const id = useId();
  return (
    <Field className={fieldClassName} hint={hint} htmlFor={id} label={label}>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div aria-label={label} className={`segmented segmented-${size}`} role="radiogroup">
      {options.map((option) => (
        <button
          aria-checked={option.value === value}
          className={option.value === value ? "active" : ""}
          key={option.value}
          role="radio"
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  multiple = false,
}: {
  value: T | T[];
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; hint?: string }[];
  label: string;
  multiple?: boolean;
}) {
  const selected = new Set(Array.isArray(value) ? value : [value]);
  return (
    <div aria-label={label} className="chip-group" role={multiple ? "group" : "radiogroup"}>
      {options.map((option) => {
        const isSelected = selected.has(option.value);
        return (
          <button
            aria-checked={multiple ? undefined : isSelected}
            aria-pressed={multiple ? isSelected : undefined}
            className={isSelected ? "chip active" : "chip"}
            key={option.value}
            role={multiple ? undefined : "radio"}
            title={option.hint}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <label className="toggle-row" htmlFor={id}>
      <span className="toggle-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input checked={checked} className="toggle-input" id={id} role="switch" type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

export function StarRating({ value, onChange, label = "效果评分" }: { value: number; onChange: (value: number) => void; label?: string }) {
  return (
    <div aria-label={label} className="star-rating" role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          aria-checked={value === star}
          aria-label={`${star} 星`}
          className={star <= value ? "active" : ""}
          key={star}
          role="radio"
          type="button"
          onClick={() => onChange(value === star ? 0 : star)}
        >
          <Star size={22} />
        </button>
      ))}
    </div>
  );
}

const gaugePresets = [
  { value: 0, label: "空" },
  { value: 25, label: "¼" },
  { value: 50, label: "½" },
  { value: 75, label: "¾" },
  { value: 100, label: "满" },
];

/**
 * Fuel / battery level (0–100%). Type an exact number, drag the slider, or tap a common mark.
 * An empty value means "not recorded".
 */
export function GaugeField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
}) {
  const id = useId();
  const parsed = value.trim() === "" ? null : Number(value);
  const numeric = parsed != null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : null;

  function normalize() {
    if (parsed == null) return;
    if (!Number.isFinite(parsed)) onChange("");
    else if (parsed !== Math.round(Math.min(Math.max(parsed, 0), 100))) onChange(String(Math.round(Math.min(Math.max(parsed, 0), 100))));
  }

  return (
    <Field error={error} hint={hint} htmlFor={id} label={label}>
      <div className={numeric == null ? "gauge-field empty" : "gauge-field"}>
        <div className="gauge-input-row">
          <div className="input-wrap has-suffix">
            <input
              aria-invalid={error ? true : undefined}
              id={id}
              inputMode="numeric"
              max="100"
              min="0"
              placeholder="未记录"
              step="1"
              type="number"
              value={value}
              onBlur={normalize}
              onChange={(event) => onChange(event.target.value)}
            />
            <span className="input-affix input-suffix">%</span>
          </div>
          {value !== "" && (
            <button aria-label="清除刻度" className="link-button" type="button" onClick={() => onChange("")}>
              清除
            </button>
          )}
        </div>
        <input
          aria-label="拖动调整刻度"
          aria-valuetext={numeric == null ? "未记录" : `${numeric}%`}
          className="gauge-slider"
          max="100"
          min="0"
          step="1"
          style={{ "--gauge": `${numeric ?? 0}%` } as CSSProperties}
          tabIndex={-1}
          type="range"
          value={numeric ?? 0}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="gauge-presets" role="group" aria-label="常用刻度">
          {gaugePresets.map((preset) => (
            <button
              aria-pressed={numeric === preset.value}
              className={numeric === preset.value ? "active" : ""}
              key={preset.value}
              title={`${preset.value}%`}
              type="button"
              onClick={() => onChange(String(preset.value))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </Field>
  );
}
