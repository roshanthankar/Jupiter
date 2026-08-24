import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/cn'

/** Stamp-pad ink (the check-mark green). */
const INK = '#416a62'

/**
 * Rubber "PAID" stamp: sawtooth ring, double rule, oblique lettering, and worn ink — punched onto
 * the surface with a quick impact and a small settle.
 */
export function PaidStamp({
  size = 118,
  label = 'PAID',
  angle = -14,
  className,
  delay = 0.35,
}: {
  size?: number
  label?: string
  /** Resting rotation, in degrees */
  angle?: number
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  // Outer band: rounded bumps outside, clean circle inside (evenodd cuts the middle out).
  const ring = useMemo(() => `${bumps(100, 100, 95, 4.5, 30)} ${circle(100, 100, 84)}`, [])

  return (
    <motion.div
      aria-label={`${label} in full`}
      role="img"
      className={cn('pointer-events-none select-none', className)}
      style={{ width: size, height: size }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: angle - 9, filter: 'blur(5px)' }}
      animate={
        reduce
          ? { opacity: 1, scale: 1, rotate: angle, filter: 'blur(0px)' }
          : {
              opacity: [0, 0.55, 1, 1, 1],
              scale: [2.4, 1.5, 0.955, 1.018, 1],
              rotate: [angle - 9, angle - 4, angle, angle, angle],
              filter: ['blur(5px)', 'blur(2px)', 'blur(0px)', 'blur(0px)', 'blur(0px)'],
            }
      }
      transition={
        reduce
          ? { duration: 0.3, delay }
          : {
              duration: 0.62,
              delay,
              // fast fall, hard contact, soft settle
              times: [0, 0.42, 0.62, 0.82, 1],
              ease: [0.22, 0.9, 0.24, 1],
            }
      }
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden>
        <defs>
          {/* Worn ink: fine speckle over larger dry patches, used as a mask. */}
          <filter id={`${uid}-ink`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            {/* chips: coarse flecks lifted off the paper */}
            <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="3" seed="11" result="chips" />
            <feColorMatrix
              in="chips"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      1.05 0 0 0 -0.6"
              result="chipsA"
            />
            {/* scratches: stretched horizontally, the way a die drags */}
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.5" numOctaves="2" seed="23" result="streak" />
            <feColorMatrix
              in="streak"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      1.5 0 0 0 -0.86"
              result="streakA"
            />
            {/* dry patches: where the pad barely touched */}
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="dry" />
            <feColorMatrix
              in="dry"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      1.6 0 0 0 -1.06"
              result="dryA"
            />
            <feComposite in="chipsA" in2="streakA" operator="over" result="ink1" />
            <feComposite in="ink1" in2="dryA" operator="over" result="ink" />
            <feGaussianBlur in="ink" stdDeviation="0.3" />
          </filter>

          {/* white = printed, black = where the pad ran dry */}
          <mask id={`${uid}-worn`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
            <rect width="200" height="200" fill="#fff" />
            <rect width="200" height="200" filter={`url(#${uid}-ink)`} />
          </mask>
        </defs>

        <g mask={`url(#${uid}-worn)`} fill={INK} stroke={INK} filter={`url(#${uid}-soft)`}>
          {/* bumped band */}
          <path d={ring} fillRule="evenodd" stroke="none" />
          {/* thin rule */}
          <circle cx="100" cy="100" r="76" fill="none" strokeWidth="3.4" />
          {/* inner rule, broken left and right the way the die is cut */}
          <path d={arc(100, 100, 58, 200, 340)} fill="none" strokeWidth="4.6" strokeLinecap="round" />
          <path d={arc(100, 100, 58, 20, 160)} fill="none" strokeWidth="4.6" strokeLinecap="round" />
          {/* the word, cut on a slant the way stamp dies are */}
          <text
            x="100"
            y="104"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Manrope, -apple-system, Helvetica, sans-serif"
            fontSize="64"
            fontWeight="800"
            letterSpacing="1"
            textLength="132"
            lengthAdjust="spacingAndGlyphs"
            strokeWidth="3.5"
            strokeLinejoin="round"
            paintOrder="stroke"
            transform="rotate(-5 100 100) skewX(-11)"
          >
            {label}
          </text>
        </g>
      </svg>
    </motion.div>
  )
}

/** Rounded bumps: r(θ) = R + A·cos(nθ), sampled densely so the teeth read soft, not spiky. */
function bumps(cx: number, cy: number, R: number, amp: number, lobes: number, steps = 480) {
  const pts: string[] = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2
    const r = R + amp * Math.cos(lobes * a)
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
}

/** Arc between two angles (degrees), as a stroked path. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a0))
  const y0 = cy + r * Math.sin(rad(a0))
  const x1 = cx + r * Math.cos(rad(a1))
  const y1 = cy + r * Math.sin(rad(a1))
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** Circle as a path, so it can be combined into one evenodd shape. */
function circle(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`
}
