import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { toggleSpring } from '@/lib/motion'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ----------------------------- ListGroup ---------------------------- */

export function ListGroup({
  header,
  footer,
  children,
  className,
  inset = true,
}: {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Inset-grouped (rounded, margins) vs. edge-to-edge plain list */
  inset?: boolean
}) {
  return (
    <section className={cn(inset && 'mx-4', 'mb-[22px]', className)}>
      {header && <h3 className="mb-[7px] px-4 text-footnote uppercase text-ios-label2">{header}</h3>}
      <div className={cn('ios-list overflow-hidden bg-ios-grouped2', inset && 'rounded-ios')}>{children}</div>
      {footer && <p className="mt-[7px] px-4 text-footnote text-ios-label2">{footer}</p>}
    </section>
  )
}

/* ------------------------------ ListRow ----------------------------- */

interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Secondary text on the right (grey). */
  detail?: ReactNode
  /** Leading icon — wrapped in a coloured rounded square. */
  icon?: ReactNode
  iconBg?: string
  /** Custom leading element (e.g. an Avatar) rendered as-is. */
  leading?: ReactNode
  /** Trailing control (Toggle, Badge…). */
  accessory?: ReactNode
  /** Force chevron on/off. Default: shown when pressable and there is no accessory. */
  chevron?: boolean
  /** Shows a blue checkmark (for selection lists). */
  selected?: boolean
  destructive?: boolean
  centered?: boolean
  onPress?: () => void
  className?: string
}

export function ListRow({
  title,
  subtitle,
  detail,
  icon,
  iconBg = 'bg-ios-blue',
  leading,
  accessory,
  chevron,
  selected,
  destructive,
  centered,
  onPress,
  className,
}: ListRowProps) {
  const interactive = !!onPress
  const showChevron = chevron ?? (interactive && !accessory && selected === undefined && !centered)
  const sepInset = icon || leading ? '60px' : '16px'
  const inner = (
    <>
      {leading}
      {icon && (
        <span className={cn('flex size-[29px] shrink-0 items-center justify-center rounded-[7px] text-white [&>svg]:size-[18px]', iconBg)}>
          {icon}
        </span>
      )}
      <div className={cn('min-w-0 flex-1', centered && 'text-center')}>
        <div className={cn('truncate text-body', destructive ? 'text-ios-red' : centered ? 'text-ios-blue' : 'text-ios-label')}>{title}</div>
        {subtitle && <div className="truncate text-footnote text-ios-label2">{subtitle}</div>}
      </div>
      {detail !== undefined && <span className="shrink-0 text-body text-ios-label2">{detail}</span>}
      {accessory}
      {selected !== undefined && (
        <Check size={20} strokeWidth={2.6} className={cn('shrink-0 text-ios-blue transition-opacity', selected ? 'opacity-100' : 'opacity-0')} />
      )}
      {showChevron && <ChevronRight size={18} strokeWidth={2.5} className="-mr-1 shrink-0 text-ios-gray3" />}
    </>
  )
  const cls = cn(
    'relative flex w-full items-center gap-3 bg-ios-grouped2 px-4 text-left',
    subtitle ? 'min-h-[58px] py-2' : 'min-h-[44px]',
    interactive && 'transition-colors duration-75 active:bg-ios-gray5',
    className,
  )
  const style = { '--sep-inset': sepInset } as CSSProperties

  return interactive ? (
    <button type="button" onClick={onPress} className={cls} style={style}>
      {inner}
    </button>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  )
}

/* ----------------------------- TextField ---------------------------- */

export function TextField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn('flex min-h-[44px] items-center gap-3 bg-ios-grouped2 px-4', className)}>
      {label && <span className="w-[100px] shrink-0 text-body text-ios-label">{label}</span>}
      <input
        className="h-full min-w-0 flex-1 bg-transparent py-[11px] text-body text-ios-label outline-none placeholder:text-ios-label3"
        {...props}
      />
    </label>
  )
}

/* ------------------------------- Toggle ----------------------------- */

export function Toggle({
  value,
  onChange,
  disabled,
  size = 'default',
}: {
  value: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
  /** 'default' is the iOS UISwitch size; 'small' suits dense controls outside the app UI */
  size?: 'default' | 'small'
}) {
  const small = size === 'small'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!value)
      }}
      className={cn(
        'relative flex shrink-0 items-center rounded-full p-[2px] transition-colors duration-200',
        small ? 'h-[22px] w-[38px]' : 'h-[31px] w-[51px]',
        value ? 'bg-ios-green' : 'bg-ios-fill',
        disabled && 'opacity-50',
      )}
    >
      <motion.span
        layout
        transition={toggleSpring}
        className={cn(
          'block rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_1px_1px_rgba(0,0,0,.16)]',
          small ? 'size-[18px]' : 'size-[27px]',
          value ? 'ml-auto' : 'ml-0',
        )}
      />
    </button>
  )
}

/* ------------------------------- Badge ------------------------------ */

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold', className)}>
      {children}
    </span>
  )
}
