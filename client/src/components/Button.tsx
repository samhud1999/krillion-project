import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-sun-500 text-ink hover:bg-sun-400 active:bg-sun-600 shadow-[0_8px_30px_-10px_var(--sun-500)] disabled:bg-sun-500/40 disabled:text-ink/60 disabled:shadow-none',
  secondary: 'bg-white/10 text-foam hover:bg-white/15 active:bg-white/20 border border-white/10 disabled:opacity-40',
  ghost: 'bg-transparent text-foam-muted hover:text-foam hover:bg-white/8 disabled:opacity-40',
  danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25 disabled:opacity-40',
  success: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-40',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-base rounded-2xl gap-2',
  lg: 'h-14 px-6 text-lg rounded-2xl gap-2',
  xl: 'h-16 px-8 text-xl rounded-3xl gap-3',
};

export function Button({ variant = 'primary', size = 'md', block, loading, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-semibold select-none transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 min-w-[44px]',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block size-4 rounded-full border-2 border-current border-r-transparent animate-spin"
        />
      )}
      {children}
    </button>
  );
}
