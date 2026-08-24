import type { ReactNode } from 'react'
import { SFSymbol } from '@/components/SFSymbol'
import { Marker } from '@/components/Annotations'
import { cn } from '@/lib/cn'

/** Assistant avatar — brand-colour circle with the assistant glyph. */
export function AssistantAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <SFSymbol name="bubble.left.and.bubble.right.fill" size={Math.round(size * 0.5)} color="#fff" />
    </span>
  )
}

/**
 * Assistant chat bubble: avatar anchored bottom-left, card surface (white + hairline) with a small tail-side radius,
 * timestamp bottom-right.
 */
export function AssistantBubble({ time, children, className }: { time?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <span className="sr-only">Jupiter Assistant said:</span>
      <AssistantAvatar />
      <div className="min-w-0 flex-1 rounded-lg rounded-bl-[4px] border border-[#0000002E] bg-white px-4 py-3 text-[15px] leading-[22px] text-ink">
        {children}
        {time && <p className="mt-2 text-right text-[12px] leading-4 text-ink2">{time}</p>}
      </div>
    </div>
  )
}

/** User reply — right-aligned, quiet brand tint (the assistant's messages carry the weight). */
export function UserBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end', className)}>
      <span className="sr-only">You said:</span>
      <div className="max-w-[85%] rounded-lg rounded-br-[4px] bg-brand/12 px-4 py-3 text-[15px] leading-[22px] text-ink">{children}</div>
    </div>
  )
}

/** White-fill option CTA inside a bubble — same surface as the app card (white, hairline), 4pt radius like the tinted CTA. */
export function OptionCTA({
  title,
  detail,
  onPress,
  disabled,
  centered,
  pin,
}: {
  title: string
  detail?: string
  onPress?: () => void
  disabled?: boolean
  centered?: boolean
  /** annotation key, when this option is pinned */
  pin?: string
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        'relative block w-full rounded border border-[#0000002E] bg-white px-3.5 py-3 active:bg-ios-gray6 disabled:opacity-50',
        // title-only buttons centre by default; title + detail stay left-aligned
        (centered ?? !detail) ? 'text-center' : 'text-left',
      )}
    >
      {pin && <Marker k={pin} className="right-1 top-1" />}
      <span className="block text-[15px] font-semibold leading-5 text-brand-text">{title}</span>
      {detail && <span className="mt-0.5 block text-[13px] leading-[18px] text-ink2">{detail}</span>}
    </button>
  )
}

export function formatClock(d: Date) {
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}
