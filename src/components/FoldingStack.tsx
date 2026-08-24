import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Receipts that fold as they scroll.
 *
 * Each card is sliced into three panels along the creases it marks with `data-crease`. When a card
 * reaches the top of the screen it stays put and folds away from the reader — the foot first, then
 * the body — until only the header stub is left, which then scrolls off and the next receipt takes
 * its place. The fold is a function of scroll position, not an animation, so scrolling back down
 * unfolds it through exactly the same geometry.
 *
 * Two things fall out of folding *backwards* and stopping at 90°: a panel can never reach above its
 * own crease or below the height already reserved for it, so nothing needs clipping; and at 90° it
 * is edge-on, so it disappears without ever showing the back of the paper.
 *
 * Nothing here touches layout while you scroll. Each receipt keeps its natural height for good and
 * the stack moves them with transforms, because the height a fold gives up is exactly the scroll it
 * costs to fold — so the page is the same length either way, and the browser never has to reflow a
 * screen full of masked, filtered paper mid-gesture.
 */

/** Panels per card — two creases, so a stub, a body and a foot. */
const PANELS = 3
const FOLDS = PANELS - 1
/** Edge-on, and so invisible. */
const MAX_ANGLE = 90
/** Turns the paper early, so the height it gives up stays close to linear with the scroll. */
const ANGLE_EASE = 0.7
/** Share of the fold each crease gets; the remainder is the overlap that keeps the two continuous. */
const WINDOW = 0.62
/** Creases as fractions of the card, for a card that doesn't mark its own. */
const FALLBACK_CREASES = [0.3, 0.66]
/** How far the paper darkens as it turns away from the light. */
const SHADE = 0.18
/** Viewing distance. The stack reserves space from the same projection the browser draws with. */
const PERSPECTIVE = 1200
/** Horizontal inset of the card inside its full-width slice — the `mx-4` every receipt carries. */
const CARD_INSET = 16
/**
 * Room left below the last panel for the receipt's emboss. Every other panel is cut through solid
 * paper, but this one ends at the scalloped edge, and clipping flush with it sliced the shadow off
 * in a straight line right under the scallops.
 */
const EMBOSS_ROOM = 28
/** Frames to keep sampling after the last scroll event, so iOS momentum is followed to a stop. */
const COAST_FRAMES = 14

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const rad = (deg: number) => (deg * Math.PI) / 180
/** Where a point `y` below the card's top, lying `depth` behind it, lands on screen. */
const project = (y: number, depth: number) => (y * PERSPECTIVE) / (PERSPECTIVE + depth)

/** Angle of one crease at overall fold progress `p`. Crease 0 is the lowest, and folds first. */
function angleAt(p: number, order: number) {
  const start = FOLDS > 1 ? (order * (1 - WINDOW)) / (FOLDS - 1) : 0
  const t = clamp((p - start) / WINDOW, 0, 1)
  return MAX_ANGLE * Math.pow(t, ANGLE_EASE)
}

type Slot = {
  outer: HTMLDivElement | null
  pin: HTMLDivElement | null
  /** The clipping window for each panel, and the full card sitting behind it. */
  slices: (HTMLDivElement | null)[]
  papers: (HTMLDivElement | null)[]
  /** The paper below each crease, which turns as one piece. */
  groups: (HTMLDivElement | null)[]
  /** The shadow a turning flap casts on the paper it is hinged to. */
  creases: (HTMLDivElement | null)[]
  /** Natural height and the three panel heights, measured flat. */
  geom: { H: number; h: number[] } | null
  /** Where this receipt's section sits once the stack is laid out — fixed, so scrolling can't move it. */
  y: number
  /** Last frame's numbers, so a receipt that isn't moving isn't written to. */
  last: { shift: number; p: number }
}

const newSlot = (): Slot => ({
  outer: null,
  pin: null,
  slices: new Array(PANELS).fill(null),
  papers: new Array(PANELS).fill(null),
  groups: new Array(FOLDS).fill(null),
  creases: new Array(FOLDS).fill(null),
  geom: null,
  y: 0,
  last: { shift: NaN, p: NaN },
})

export interface FoldingItem {
  key: string
  node: ReactNode
}

export function FoldingStack({
  items,
  gap = 16,
  inset = 8,
}: {
  items: FoldingItem[]
  /** Space between one receipt and the next. */
  gap?: number
  /** How far below the top of the screen a receipt comes to rest while it folds. */
  inset?: number
}) {
  const slots = useRef<Slot[]>([])
  const slotAt = (i: number) => (slots.current[i] ??= newSlot())

  useLayoutEffect(() => {
    slots.current.length = items.length
    const list = slots.current
    const first = list[0]?.outer
    const scroller = first?.closest('[data-scroll]') as HTMLElement | null
    if (!first || !scroller) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /** Where a receipt comes to rest while it folds, measured from the scroller's own top. */
    let foldLine = 0

    /** Panel heights, read flat from the creases each card marks, and the fixed layout that follows. */
    function measure() {
      const scrollRect = scroller!.getBoundingClientRect()
      let y = first!.getBoundingClientRect().top - scrollRect.top + scroller!.scrollTop
      for (const s of list) {
        const paper = s.papers[0]
        if (!paper) continue
        const top = paper.getBoundingClientRect().top
        const H = paper.offsetHeight
        // `data-crease` marks an element's top edge; a value on it nudges the crease further down
        const marks = Array.from(paper.querySelectorAll<HTMLElement>('[data-crease]'))
          .map((el) => Math.round(el.getBoundingClientRect().top - top + (parseFloat(el.dataset.crease || '') || 0)))
          .filter((c) => c > 8 && c < H - 8)
        const creases = (marks.length >= FOLDS ? marks.slice(0, FOLDS) : FALLBACK_CREASES.map((f) => Math.round(H * f)))
          .slice(0, FOLDS)
          .sort((a, b) => a - b)
        s.geom = { H, h: [creases[0], creases[1] - creases[0], H - creases[1]] }
        s.y = y
        s.last = { shift: NaN, p: NaN }
        // the receipt keeps its full height for good; folding is paid for with transforms
        if (s.outer) s.outer.style.height = `${H}px`
        s.slices.forEach((el, i) => {
          if (el) el.style.height = `${s.geom!.h[i]}px`
        })
        s.papers.forEach((el, i) => {
          if (el && i > 0) el.style.top = `${-creases[i - 1]}px`
        })
        s.groups.forEach((el, i) => {
          if (el) el.style.top = `${s.geom!.h[i]}px`
        })
        y += H + gap
      }
      foldLine = parseFloat(getComputedStyle(scroller!).paddingTop || '0') + inset
    }

    /** Lay the whole stack out for one scroll position. Pure maths, then transforms — no reflow. */
    function apply(scrollTop: number) {
      // how far the folds above have pulled everything below up the page
      let shift = 0
      for (const s of list) {
        const g = s.geom
        if (!g || !s.pin) continue
        const stub = g.h[0]
        const distance = Math.max(g.H - stub, 1)
        const pin = reduce ? 0 : clamp(scrollTop + foldLine - (s.y + shift), 0, distance)
        const p = pin / distance

        // the body carries the foot with it, so the foot has to give way first
        const body = angleAt(p, 1)
        const foot = angleAt(p, 0)
        // where each fold's far edge ends up, so the stack knows what the receipt still covers
        const bodyEnd = { y: stub + g.h[1] * Math.cos(rad(body)), z: g.h[1] * Math.sin(rad(body)) }
        const footEnd = {
          y: bodyEnd.y + g.h[2] * Math.cos(rad(body + foot)),
          z: bodyEnd.z + g.h[2] * Math.sin(rad(body + foot)),
        }
        const visible = Math.max(stub, project(bodyEnd.y, bodyEnd.z), project(footEnd.y, footEnd.z))

        // a receipt nothing has changed for is left alone; usually only one is mid-fold
        if (shift !== s.last.shift || p !== s.last.p) {
          s.pin.style.transform = `translate3d(0, ${shift + pin}px, 0)`
          if (p !== s.last.p) {
            const turn = [body, Math.min(body + foot, MAX_ANGLE)]
            s.groups.forEach((el, i) => {
              if (el) el.style.transform = `rotateX(${-(i === 0 ? body : foot)}deg)`
            })
            // paper turned away from the light loses brightness; the foot is turned by both creases
            s.papers.forEach((el, i) => {
              if (el && i > 0) el.style.filter = `brightness(${1 - Math.sin(rad(turn[i - 1])) * SHADE})`
            })
            s.creases.forEach((el, i) => {
              if (el) el.style.opacity = `${Math.sin(rad(i === 0 ? body : foot))}`
            })
          }
          s.last = { shift, p }
        }

        shift += visible + pin - g.H
      }
    }

    /**
     * Sampled on a frame loop rather than straight off the scroll event: iOS Safari delivers those
     * in bursts while a flick is coasting, and a fold that only moves when one lands looks stepped.
     */
    let frame = 0
    let coast = 0
    const tick = () => {
      apply(scroller.scrollTop)
      frame = ++coast < COAST_FRAMES ? requestAnimationFrame(tick) : 0
    }
    const onScroll = () => {
      coast = 0
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const remeasure = () => {
      measure()
      apply(scroller.scrollTop)
    }

    remeasure()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(remeasure)
    list.forEach((s) => {
      if (s.papers[0]) ro.observe(s.papers[0])
    })
    window.addEventListener('resize', remeasure)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', remeasure)
    }
  }, [items, gap, inset])

  return (
    <>
      {items.map((item, i) => {
        /** One panel: a window on the card, with the whole card behind it pushed up into view. */
        const slice = (panel: number) => (
          <div
            ref={(el) => void (slotAt(i).slices[panel] = el)}
            // the paper below the first panel is a second and third look at the same receipt, so it
            // is hidden from assistive tech; the first panel carries the whole card in its DOM
            aria-hidden={panel > 0 || undefined}
            className="relative"
            style={{
              clipPath: panel === PANELS - 1 ? `inset(0px 0px -${EMBOSS_ROOM}px 0px)` : 'inset(0)',
              height: panel === 0 ? undefined : 0,
            }}
          >
            <div ref={(el) => void (slotAt(i).papers[panel] = el)} className="absolute inset-x-0 top-0">
              {item.node}
            </div>
            {panel < FOLDS && (
              <div
                ref={(el) => void (slotAt(i).creases[panel] = el)}
                aria-hidden
                className="pointer-events-none absolute bottom-0 h-4 opacity-0"
                style={{
                  left: CARD_INSET,
                  right: CARD_INSET,
                  background: 'linear-gradient(to top, rgba(24,20,16,0.22), rgba(24,20,16,0))',
                }}
              />
            )}
          </div>
        )
        /** Everything below a crease hangs off the panel above it, so one turn carries the rest. */
        const group = (index: number, children: ReactNode) => (
          <div
            ref={(el) => void (slotAt(i).groups[index] = el)}
            className="absolute inset-x-0 origin-top"
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          >
            {children}
          </div>
        )
        return (
          <div key={item.key} ref={(el) => void (slotAt(i).outer = el)} style={{ marginBottom: gap }}>
            <div
              ref={(el) => void (slotAt(i).pin = el)}
              style={{ perspective: `${PERSPECTIVE}px`, perspectiveOrigin: '50% 0', transformStyle: 'preserve-3d' }}
            >
              <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
                {slice(0)}
                {group(
                  0,
                  <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
                    {slice(1)}
                    {group(1, <div className="relative">{slice(2)}</div>)}
                  </div>,
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
