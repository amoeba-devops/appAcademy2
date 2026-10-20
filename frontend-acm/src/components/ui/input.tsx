import * as React from 'react';
import { NumericInput } from './numeric-input';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const Component = type === 'number' ? NumericInput : 'input';
    return (
      <Component
        type={type}
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-[var(--gray-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
