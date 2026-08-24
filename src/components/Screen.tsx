import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'
import { cn } from '@/lib/cn'

const ScrollContext = createContext<MotionValue<number> | null>(null)
/** Scroll offset of the nearest <Screen.Content>, as a MotionValue (no re-renders). */
export const useScrollY = () => useContext(ScrollContext)

/**
 * Root of every screen: a full-height flex column.
 * Put a <NavBar> first, then <Screen.Content> for the scrolling body.
 */
export function Screen({ children, className }: { children?: ReactNode; className?: string }) {
  const scrollY = useMotionValue(0)
  // Default to the grouped background unless the caller supplies their own bg-* class.
  const hasBg = /(^|\s)bg-/.test(className ?? '')
  return (
    <ScrollContext.Provider value={scrollY}>
      <div className={cn('relative flex h-full min-h-0 flex-col text-ios-label', !hasBg && 'bg-ios-grouped', className)}>
        {children}
      </div>
    </ScrollContext.Provider>
  )
}

interface ContentProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Pad the top so content starts below the NavBar (default true). */
  navInset?: boolean
  /** Pad the bottom for the home indicator (default true; set false inside tabs). */
  safeBottom?: boolean
}

function Content({ children, className, style, navInset = true, safeBottom = true }: ContentProps) {
  const scrollY = useScrollY()
  return (
    <div
      data-scroll
      className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}
      style={{
        paddingTop: navInset ? 'calc(var(--sat) + 44px)' : undefined,
        paddingBottom: safeBottom ? 'calc(var(--sab) + 24px)' : 24,
        ...style,
      }}
      onScroll={(e) => scrollY?.set(e.currentTarget.scrollTop)}
    >
      {children}
    </div>
  )
}
Screen.Content = Content

/** Sticky footer area (e.g. a primary button) that respects the home indicator. */
function Footer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('shrink-0 border-t border-ios-separator/50 bg-ios-grouped/90 px-4 pt-3 backdrop-blur-xl', className)}
      style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}
    >
      {children}
    </div>
  )
}
Screen.Footer = Footer

/** iOS large title — place as the first child of <Screen.Content>. */
export function LargeTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('px-4 pb-2 pt-1 text-largetitle text-ios-label', className)}>{children}</h1>
}
