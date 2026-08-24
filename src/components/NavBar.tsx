import type { ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useNav, useScreenEntry } from '@/lib/nav'
import { useScrollY } from '@/components/Screen'
import { tapTransition } from '@/lib/motion'
import { cn } from '@/lib/cn'

interface NavBarProps {
  title?: string
  /** Title is shown large in the content (via <LargeTitle>); the inline one fades in on scroll. */
  large?: boolean
  left?: ReactNode
  right?: ReactNode
  /** false hides the back/cancel button; a string customises the back label. */
  back?: boolean | string
  /** Never show the blurred background (for hero screens). */
  transparent?: boolean
  /** Light foreground for dark backgrounds. */
  light?: boolean
  /** Background colour class used once content scrolls underneath. */
  bgClassName?: string
  className?: string
}

export function NavBar({
  title,
  large,
  left,
  right,
  back = true,
  transparent,
  light,
  bgClassName = 'bg-ios-grouped/85',
  className,
}: NavBarProps) {
  const { pop } = useNav()
  const { entry, index } = useScreenEntry()
  const fallback = useMotionValue(0)
  const scrollY = useScrollY() ?? fallback
  const bgOpacity = useTransform(scrollY, [0, 24], [0, 1])
  const titleOpacity = useTransform(scrollY, [28, 52], [0, 1])

  const isModal = entry.presentation === 'modal'
  const showBack = back !== false && entry.presentation === 'push' && index > 0
  const leading =
    left ??
    (showBack ? (
      <BackButton label={typeof back === 'string' ? back : 'Back'} onPress={pop} />
    ) : isModal && back !== false ? (
      <BarButton onPress={pop}>Cancel</BarButton>
    ) : null)

  return (
    <div
      className={cn('absolute inset-x-0 top-0 z-20', light ? 'text-white' : 'text-ios-label', className)}
      style={{ paddingTop: 'var(--sat)' }}
    >
      {!transparent && (
        <motion.div
          className={cn('absolute inset-0 backdrop-blur-xl shadow-[0_0.5px_0_0_rgba(60,60,67,0.29)]', bgClassName)}
          style={{ opacity: bgOpacity }}
        />
      )}
      <div className="relative flex h-11 items-center justify-between px-2">
        <div className="flex min-w-0 flex-1 items-center">{leading}</div>
        {title && (
          <motion.div
            className="pointer-events-none absolute inset-x-[72px] flex justify-center"
            style={{ opacity: large ? titleOpacity : 1 }}
          >
            <span className="truncate text-headline">{title}</span>
          </motion.div>
        )}
        <div className="flex flex-1 items-center justify-end">{right}</div>
      </div>
    </div>
  )
}

/** Text or icon button for the nav bar. */
export function BarButton({
  children,
  onPress,
  bold,
  destructive,
  disabled,
  className,
  label,
}: {
  children: ReactNode
  onPress?: () => void
  bold?: boolean
  destructive?: boolean
  disabled?: boolean
  className?: string
  /** Accessible name for icon-only buttons */
  label?: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ opacity: 0.35 }}
      transition={tapTransition}
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-11 min-w-11 items-center justify-center px-2 text-body disabled:opacity-35',
        destructive ? 'text-ios-red' : 'text-ios-blue',
        bold && 'font-semibold',
        className,
      )}
    >
      {children}
    </motion.button>
  )
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ opacity: 0.35 }}
      transition={tapTransition}
      onClick={onPress}
      className="flex h-11 items-center pl-1 pr-3 text-ios-blue"
    >
      <ChevronLeft size={28} strokeWidth={2.4} className="-ml-1" />
      <span className="-ml-0.5 truncate text-body">{label}</span>
    </motion.button>
  )
}
