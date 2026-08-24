import { useEffect, useMemo, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { useNav } from '@/lib/nav'
import { useFrame } from '@/components/PhoneFrame'
import { sheetTransition, tapTransition } from '@/lib/motion'
import { SYSTEM_FONT } from '@/lib/fonts'
import { LockNotification } from '@/components/LockNotification'
import { AppIcon } from '@/components/AppIcon'

/** Wallpaper (public/wallpapers/). Drop in another image and point this at it. */
const WALLPAPER = '/wallpapers/blue-teal-discs.jpg'

/** iOS 26 Lock Screen laid out at iPhone 17 Pro metrics (402×874, 62pt status bar). Tapping the notification opens the app. */
export function LockScreen() {
  const nav = useNav()
  const { height } = useFrame()
  const y = useMotionValue(0)
  const now = useNow()

  const reduce = useReducedMotion()
  const unlock = () => {
    // Lock Screen slides away as the app dissolves in; under Reduce Motion it simply dissolves.
    if (!reduce) animate(y, -height, sheetTransition)
    nav.reset('home')
  }

  return (
    <motion.div
      className="absolute inset-0 select-none overflow-hidden bg-black text-white"
      style={{ y, fontFamily: SYSTEM_FONT }}
    >
      {/* Wallpaper */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${WALLPAPER})` }} />

      {/* Lock glyph + date + clock — adaptive (white on dark, black on light) */}
      <AdaptiveHeader
        date={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        time={formatTime(now)}
      />

      {/* Notifications — stacked above the quick actions (iOS 16+ Lock Screen). 103 = 41 (button
          inset) + 50 (button) + 12 (gap). Tapping opens the app. */}
      <div className="absolute inset-x-4" style={{ bottom: 103 }}>
        <LockNotification
          icon={<AppIcon size={38} />}
          title="Your EMI didn’t go through"
          body="The payment due 3 August is still pending. Open Jupiter to pay it or move the date."
          time="now"
          onPress={unlock}
        />
      </div>

      {/* Quick actions — Liquid Glass flashlight / camera */}
      <GlassButton label="Flashlight" icon={FLASHLIGHT_ICON} iconSize={22} style={{ left: 27, bottom: 41 }} />
      <GlassButton label="Camera" icon={CAMERA_ICON} iconSize={24} style={{ right: 27, bottom: 41 }} />

    </motion.div>
  )
}

/* --------------------------------- bits --------------------------------- */

/** Heights/positions (pt) of the lock glyph, date and clock — iOS 26 default layout. */
const HEADER = { height: 240, glyphTop: 69, dateBaseline: 120, dateSize: 22, timeBaseline: 196, timeSize: 88 }
const MASK_SCALE = 3

/**
 * Lock glyph, date and clock rendered as a canvas mask over a backdrop filter, so their colour
 * follows the wallpaper: white over dark areas, black over light ones (threshold biased so that
 * only genuinely light backdrops flip to black, like iOS). The text is also emitted visually-hidden
 * for screen readers.
 */
function AdaptiveHeader({ date, time }: { date: string; time: string }) {
  const { width } = useFrame()
  const mask = useMemo(() => renderHeaderMask(width, date, time), [width, date, time])
  // blur → regional average; brightness(0.6) sets the flip point at ~0.83 luminance (only genuinely
  // light backdrops go black, as on iOS); contrast(20) makes it a clean step — never mid-grey text.
  const filter = 'blur(20px) grayscale(1) brightness(0.6) invert(1) contrast(20)'
  return (
    <>
      <h1 className="sr-only">
        {date}, {time}
      </h1>
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0"
        style={{
          width,
          height: HEADER.height,
          WebkitMaskImage: `url(${mask})`,
          maskImage: `url(${mask})`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          backdropFilter: filter,
          WebkitBackdropFilter: filter,
        }}
      />
    </>
  )
}

function renderHeaderMask(width: number, date: string, time: string): string {
  const c = document.createElement('canvas')
  c.width = width * MASK_SCALE
  c.height = HEADER.height * MASK_SCALE
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.scale(MASK_SCALE, MASK_SCALE)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const cx = width / 2

  // Lock glyph (SF Symbol lock.fill, 15×19)
  ctx.save()
  ctx.translate(cx - 7.5, HEADER.glyphTop)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D('M3.6 7.2V5.3a3.9 3.9 0 0 1 7.8 0v1.9'))
  ctx.fill(new Path2D('M3.6 7.2h7.8a2.6 2.6 0 0 1 2.6 2.6v5.6a2.6 2.6 0 0 1-2.6 2.6H3.6A2.6 2.6 0 0 1 1 15.4V9.8a2.6 2.6 0 0 1 2.6-2.6Z'))
  ctx.restore()

  // Date — SF Pro Semibold 22
  ctx.font = `600 ${HEADER.dateSize}px ${SYSTEM_FONT}`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-0.26px'
  ctx.fillText(date, cx, HEADER.dateBaseline)

  // Time — SF Pro Display Bold 88
  ctx.font = `700 ${HEADER.timeSize}px ${SYSTEM_FONT}`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-2.5px'
  ctx.fillText(time, cx, HEADER.timeBaseline)

  return c.toDataURL('image/png')
}


function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatTime(d: Date) {
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Lock Screen quick-action button — adaptive like iOS 26 Liquid Glass, with no JS sampling:
 *  - base layer: frosted blur of the wallpaper
 *  - wash layer: the backdrop's *inverted luminance* at low opacity → brightens the disc over dark
 *    areas, dims it over light ones
 *  - glyph: an SVG mask over `backdrop-filter: grayscale invert contrast` → white on dark, black on light
 */
function GlassButton({
  label,
  icon,
  iconSize,
  style,
}: {
  label: string
  /** SVG markup (24×24 viewBox) used as a mask */
  icon: string
  iconSize: number
  style: React.CSSProperties
}) {
  const mask = `url("data:image/svg+xml,${encodeURIComponent(icon)}")`
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      transition={tapTransition}
      className="absolute size-[50px] overflow-hidden rounded-full"
      style={{
        ...style,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 0 0 1px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.16)',
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{ backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)' }}
      />
      <span
        className="absolute inset-0 rounded-full"
        style={{ opacity: 0.24, backdropFilter: 'grayscale(1) invert(1)', WebkitBackdropFilter: 'grayscale(1) invert(1)' }}
      />
      <span
        className="absolute inset-0 m-auto"
        style={{
          width: iconSize,
          height: iconSize,
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          // same flip point as the clock (≈0.83 luminance), compensated for the 24% wash layer beneath
          backdropFilter: 'grayscale(1) brightness(0.74) invert(1) contrast(20)',
          WebkitBackdropFilter: 'grayscale(1) brightness(0.74) invert(1) contrast(20)',
        }}
      />
    </motion.button>
  )
}

// SF Symbol flashlight.off.fill
const FLASHLIGHT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M8 2.5h8a.8.8 0 0 1 .8.8v2.3H7.2V3.3a.8.8 0 0 1 .8-.8Z"/><path fill-rule="evenodd" d="M7.2 6.9h9.6v1.3L14.6 11v8.8a2.6 2.6 0 0 1-5.2 0V11L7.2 8.2V6.9Zm4.8 5.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>'
// SF Symbol camera.fill
const CAMERA_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path fill-rule="evenodd" d="M8.6 3.5a1 1 0 0 1 .8-.4h5.2a1 1 0 0 1 .8.4l1.1 1.5H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h2.5l1.1-1.5ZM12 17.3a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6Z"/><circle cx="12" cy="12.5" r="3.2"/></svg>'

