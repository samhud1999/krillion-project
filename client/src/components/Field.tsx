import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  trailing?: ReactNode;
  inputClassName?: string;
  /** React 19: ref is a plain prop */
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, error, trailing, id, className = '', inputClassName = '', ref, ...rest }: FieldProps) {
  const inputId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={inputId} className={['block', className].join(' ')}>
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-foam-muted">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal text-foam-faint">{hint}</span>}
      </span>
      <span className="relative block">
        <input
          id={inputId}
          ref={ref}
          aria-invalid={!!error || undefined}
          className={[
            'block h-14 w-full rounded-2xl border bg-white/6 px-4 text-lg text-foam placeholder:text-foam-faint outline-none transition-colors',
            error ? 'border-rose-400/70' : 'border-white/12 focus:border-sun-400',
            inputClassName,
          ].join(' ')}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-sm text-foam-faint">{trailing}</span>}
      </span>
      {error && <span className="mt-1.5 block text-sm text-rose-300">{error}</span>}
    </label>
  );
}
