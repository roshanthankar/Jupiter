import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { tapTransition } from '@/lib/motion'
import { cn } from '@/lib/cn'

type Variant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'brand' | 'brand-tinted'
type Size = 'lg' | 'md' | 'sm' | 'jupiter'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  /** Full width */
  block?: boolean
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

const variants: Record<Variant, string> = {
  filled: 'bg-ios-blue text-white',
  tinted: 'bg-ios-blue/15 text-ios-blue',
  gray: 'bg-ios-fill3 text-ios-label',
  plain: 'bg-transparent text-ios-blue',
  destructive: 'bg-ios-red text-white',
  // #e36e64 gives white text only 3.1:1; brand-text is 5.2:1
  brand: 'bg-brand-text text-white',
  'brand-tinted': 'bg-brand/12 text-brand-text',
}

const sizes: Record<Size, string> = {
  lg: 'h-[50px] rounded-[14px] px-5 text-headline',
  md: 'h-10 rounded-[12px] px-4 text-[15px] font-semibold',
  sm: 'h-[30px] rounded-full px-3.5 text-[14px] font-semibold',
  /** jupiter.money CTA: px-4 py-3, 4pt radius, 16px bold */
  jupiter: 'rounded px-4 py-3 text-base font-bold leading-6',
}

export function Button({
  variant = 'filled',
  size = 'lg',
  block,
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97, opacity: 0.85 }}
      transition={tapTransition}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap disabled:opacity-40',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </motion.button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block size-[18px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-80', className)}
      aria-label="Loading"
    />
  )
}
