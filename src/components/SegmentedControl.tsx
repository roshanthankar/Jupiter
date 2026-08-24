import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface Segment<K extends string = string> {
  key: K
  label: string
}

/**
 * iOS segmented control (UISegmentedControl): 32pt tall, 9pt radius track in systemFill,
 * white thumb with soft shadow, 13pt semibold labels, hairline separators between unselected segments.
 */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  className,
  id = 'segmented',
}: {
  segments: readonly Segment<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  /** Unique id per instance so thumbs don't animate between controls */
  id?: string
}) {
  const reduce = useReducedMotion()
  const selectedIndex = segments.findIndex((s) => s.key === value)
  return (
    <div
      role="tablist"
      className={cn('flex h-8 w-full rounded-[9px] bg-ios-fill3 p-[2px] font-sans', className)}
    >
      {segments.map((s, i) => {
        const selected = s.key === value
        // hide the separator next to the selected segment (iOS behaviour)
        const showSeparator = i > 0 && !selected && i - 1 !== selectedIndex
        return (
          <button
            key={s.key}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(s.key)}
            className="relative flex min-w-0 flex-1 items-center justify-center rounded-[7px] px-2 text-[13px] font-semibold leading-4 text-ink active:opacity-70"
          >
            {showSeparator && <span aria-hidden className="absolute left-0 top-1/2 h-[14px] w-px -translate-y-1/2 bg-[#3C3C43]/20" />}
            {selected && (
              <motion.span
                layoutId={`${id}-thumb`}
                aria-hidden
                className="absolute inset-0 rounded-[7px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]"
                transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
              />
            )}
            <span className="relative truncate">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
