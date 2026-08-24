import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * Jupiter app icon (public/app-icon.png). iOS masks app icons with a continuous ~22.4% corner
 * radius; we approximate with border-radius.
 */
export function AppIcon({ size = 38, className }: { size?: number; className?: string }) {
  return (
    <img
      src={asset('app-icon.png')}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('block shrink-0 select-none object-cover', className)}
      style={{ width: size, height: size, borderRadius: size * 0.224 }}
    />
  )
}
