import { cn } from '@/lib/cn'

/** Circular profile picture; falls back to initials when there is no image. */
export function Avatar({
  src,
  initials,
  size = 40,
  className,
}: {
  src?: string
  initials?: string
  size?: number
  className?: string
}) {
  if (src) {
    return (
      <img
        src={src}
        alt="Profile"
        draggable={false}
        className={cn('shrink-0 select-none rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ios-indigo to-ios-blue font-semibold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label="Profile"
    >
      {initials}
    </span>
  )
}
