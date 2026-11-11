import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'glass' | 'solid' | 'outline';
}

const PAD = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' };
const TONE = {
  glass: 'glass',
  solid: 'bg-creek-900/90 border border-white/10',
  outline: 'border border-white/15',
};

export function Card({ children, padding = 'md', tone = 'glass', className = '', ...rest }: CardProps) {
  return (
    <div className={['rounded-3xl', TONE[tone], PAD[padding], className].join(' ')} {...rest}>
      {children}
    </div>
  );
}
