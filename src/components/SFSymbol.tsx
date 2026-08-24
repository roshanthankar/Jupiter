import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/**
 * Genuine SF Symbol, rendered by macOS (scripts/sf-symbol.swift → public/sf/<name>.png) and
 * shown as a tintable mask. Add a symbol:  swift scripts/sf-symbol.swift <name> 24 public/sf/<name>
 */
export function SFSymbol({
  name,
  size = 24,
  color = 'currentColor',
  label,
  className,
  style,
}: {
  name: string
  size?: number
  color?: string
  /** Accessible name; omit for purely decorative use */
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const url = `url(/sf/${name}.png)`
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
    />
  )
}
