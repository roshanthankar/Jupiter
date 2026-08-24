import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { notificationSpring, fadeTransition, tapTransition } from '@/lib/motion'
import { SYSTEM_FONT } from '@/lib/fonts'
import { cn } from '@/lib/cn'

export interface LockNotificationProps {
  /** App icon, 38×38 (e.g. <AppIcon size={38} />) */
  icon: ReactNode
  title: string
  body: string
  /** Relative time shown top-right, e.g. "now", "9:41 AM", "2m ago" */
  time?: string
  /**
   * Lock Screen appearance — iOS picks light/dark notification styling per wallpaper.
   * 'dark' = light text on a dark frosted card (for dark wallpapers).
   */
  tone?: 'dark' | 'light'
  onPress?: () => void
  className?: string
}

/**
 * iOS notification banner (Lock Screen / Notification Center), HIG metrics:
 * 16pt side insets, 26pt continuous-style radius, frosted material; 38pt app icon 14pt from the
 * left, vertically centred; text at 62pt; title SF Pro Text Semibold 15/20, body Regular 15/20
 * (primary), timestamp Footnote 13 (secondary) top-right; 14pt vertical padding.
 */
export function LockNotification({ icon, title, body, time = 'now', tone = 'dark', onPress, className }: LockNotificationProps) {
  const dark = tone === 'dark'
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onPress}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...(reduce ? fadeTransition : notificationSpring), delay: 0.35 }}
      whileTap={{ scale: 0.985, transition: tapTransition }}
      className={cn('relative block w-full overflow-hidden rounded-[26px] text-left', className)}
      style={{
        fontFamily: SYSTEM_FONT,
        // frosted material + hairline edge (white rim on dark, dark rim on light)
        boxShadow: dark
          ? 'inset 0 0 0 0.5px rgba(255,255,255,0.16), 0 8px 24px rgba(0,0,0,0.12)'
          : 'inset 0 0 0 0.5px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
      }}
    >
      {/* material: blur of the wallpaper + tint. Radius is set here too — Chrome won't clip a
          backdrop-filter to a rounded overflow-hidden parent. */}
      <span
        className="absolute inset-0 rounded-[26px]"
        style={{
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          background: dark ? 'rgba(60,60,67,0.36)' : 'rgba(255,255,255,0.62)',
        }}
      />
      <span className="relative flex items-center gap-[10px] py-[14px] pl-[14px] pr-[14px]">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn('flex-1 truncate text-[15px] font-semibold leading-5 tracking-[-0.23px]', dark ? 'text-white' : 'text-black')}
            >
              {title}
            </span>
            <span className={cn('shrink-0 text-[13px] leading-[18px]', dark ? 'text-[rgba(235,235,245,0.6)]' : 'text-[rgba(60,60,67,0.6)]')}>
              {time}
            </span>
          </span>
          <span className={cn('line-clamp-2 block text-[15px] leading-5 tracking-[-0.23px]', dark ? 'text-white' : 'text-black')}>
            {body}
          </span>
        </span>
      </span>
    </motion.button>
  )
}
