import { type InputHTMLAttributes, type SelectHTMLAttributes, useId } from 'react';

const inputClass =
  'mt-1.5 block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:outline-none aria-[invalid=true]:ring-red-400';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[];
  hint?: string;
}

export function Field({ label, errors, hint, ...input }: FieldProps) {
  const id = useId();
  const invalid = Boolean(errors?.length);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} aria-invalid={invalid} aria-describedby={`${id}-msg`} className={inputClass} {...input} />
      <FieldMessage id={`${id}-msg`} errors={errors} hint={hint} />
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  errors?: string[];
  hint?: string;
}

export function SelectField({ label, errors, hint, children, ...select }: SelectProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(errors?.length)} aria-describedby={`${id}-msg`} className={inputClass} {...select}>
        {children}
      </select>
      <FieldMessage id={`${id}-msg`} errors={errors} hint={hint} />
    </div>
  );
}

function FieldMessage({ id, errors, hint }: { id: string; errors?: string[]; hint?: string }) {
  if (errors?.length) {
    return (
      <p id={id} className="mt-1 text-sm text-red-700">
        {errors.join(' ')}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1 text-sm text-slate-500">
      {hint}
    </p>
  ) : null;
}
