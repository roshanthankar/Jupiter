import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Receipts that fold as they scroll.
 *
 * A folding card is sliced into three panels along the creases it marks with `data-crease`. When it
 * reaches the top of the screen it stays put and folds away from the reader — the foot first, then
 * the body — until only its header is left. The next receipt, arriving at scroll speed from below,
 * slides over that header and takes its place. The fold is a function of scroll position, not an
 * animation, so scrolling back down unfolds it through exactly the same geometry.
 *
 * The angles lead and the layout follows: the stack asks the paper how much of the screen it still
 * covers and puts the next receipt exactly one gap under that. Driving it the other way — holding
 * the height to scroll speed and solving back for the angles — keeps the gap constant to the pixel
 * but makes the paper snap: a panel loses height as `1 − cos`, so a linear height means the angle
 * has to jump the moment you start scrolling. Paper doesn't do that.
 *
 * Nothing here touches layout while you scroll. Each receipt keeps its natural height for good and
 * the stack moves them with transforms, because the height a fold gives up is exactly the scroll it
 * costs to fold — so the page is the same length either way, and the browser never has to reflow a
 * screen full of masked, filtered paper mid-gesture.
 */

/** Panels a folding card is cut into, and the creases it marks to divide them. */
const PANELS = 3
const CREASES = PANELS - 1
/** Edge-on, and so invisible. */
const MAX_ANGLE = 90
/** Turns the paper early, so a crease is well into its fold before the next one starts. */
const ANGLE_EASE = 0.7
/** Share of the fold each crease gets; the remainder is the overlap that keeps the two continuous. */
const WINDOW = 0.62
/** Creases as fractions of the card, for a card that doesn't mark its own. */
const FALLBACK_CREASES = [0.3, 0.66]
/** How far the paper darkens as it turns away from the light. */
const SHADE = 0.18
/** Viewing distance — the same value the browser is drawing the fold with. */
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
/** Flat until it reaches the top, panelled while it folds, then the header it folded down to. */
type Mode = 'flat' | 'fold' | 'stub'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const rad = (deg: number) => (deg * Math.PI) / 180
/** Where a point `y` below the card's top, lying `depth` behind it, lands on screen. */
const project = (y: number, depth: number) => (y * PERSPECTIVE) / (PERSPECTIVE + depth)

/** Angle of one crease at fold progress `q`. Crease 0 is the lowest, and folds first. */
function angleAt(q: number, order: number) {
  const start = CREASES > 1 ? (order * (1 - WINDOW)) / (CREASES - 1) : 0
  const t = clamp((q - start) / WINDOW, 0, 1)
  return MAX_ANGLE * Math.pow(t, ANGLE_EASE)
}

/** How much of the screen a card still covers, walking it crease by crease. */
function heightAt(h: number[], turn: number[]) {
  let y = 0
  let z = 0
  let tallest = 0
  for (let k = 0; k < PANELS; k++) {
    y += h[k] * Math.cos(rad(turn[k]))
    z += h[k] * Math.sin(rad(turn[k]))
    tallest = Math.max(tallest, project(y, z))
  }
  return tallest
}

type Slot = {
  section: HTMLDivElement | null
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
  /** Last frame's numbers, so a receipt that isn't moving isn't written to. */
  last: { shift: number; q: number }
}

const newSlot = (): Slot => ({
  section: null,
  pin: null,
  slices: new Array(PANELS).fill(null),
  papers: new Array(PANELS).fill(null),
  groups: new Array(CREASES).fill(null),
  creases: new Array(CREASES).fill(null),
  geom: null,
  last: { shift: NaN, q: NaN },
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
  const [modes, setModes] = useState<Mode[]>(() => items.map(() => 'flat' as Mode))
  const modesRef = useRef(modes)
  /** Re-runs the writes that a render just wiped, and puts the stack back where it was. */
  const relayout = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    slots.current.length = items.length
    const list = slots.current
    const first = list[0]?.section
    const scroller = first?.closest('[data-scroll]') as HTMLElement | null
    if (!first || !scroller) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /** Panel heights, read flat from the creases each card marks. Rects — so, not while scrolling. */
    function measure() {
      for (const s of list) {
        const paper = s.papers[0]
        if (!paper) continue
        const top = paper.getBoundingClientRect().top
        const H = paper.offsetHeight
        // `data-crease` marks an element's top edge; a value on it nudges the crease further down
        const marks = Array.from(paper.querySelectorAll<HTMLElement>('[data-crease]'))
          .map((el) => Math.round(el.getBoundingClientRect().top - top + (parseFloat(el.dataset.crease || '') || 0)))
          .filter((c) => c > 8 && c < H - 8)
        const creases = (marks.length >= CREASES ? marks.slice(0, CREASES) : FALLBACK_CREASES.map((f) => Math.round(H * f)))
          .slice(0, CREASES)
          .sort((a, b) => a - b)
        s.geom = { H, h: [creases[0], creases[1] - creases[0], H - creases[1]] }
      }
    }

    /**
     * The sizes a render can't carry, because React would reset them from the style prop. Runs after
     * every render, and only writes — the numbers all come from the last `measure`.
     */
    function layoutPanels() {
      for (const s of list) {
        const g = s.geom
        if (!g) continue
        // the receipt keeps its full height for good; folding is paid for with transforms
        if (s.section) s.section.style.height = `${g.H}px`
        s.slices.forEach((el, i) => {
          if (el) el.style.height = `${g.h[i]}px`
        })
        s.papers.forEach((el, i) => {
          if (el && i > 0) el.style.top = `${-g.h.slice(0, i).reduce((a, b) => a + b, 0)}px`
        })
        s.groups.forEach((el, i) => {
          if (el) el.style.top = `${g.h[i]}px`
        })
        s.last = { shift: NaN, q: NaN }
      }
    }

    /**
     * Lay the whole stack out for where it is right now. Two reads up front, then nothing but
     * transforms — neither of which dirties layout, so there is no reflow to thrash.
     */
    function apply() {
      const line = scroller!.getBoundingClientRect().top + inset
      // every section has a fixed height, so the first one's position places all of them
      let sectionTop = first!.getBoundingClientRect().top
      // how far the folds above have pulled everything below up the page
      let shift = 0
      const next: Mode[] = []
      let changed = false

      for (let i = 0; i < list.length; i++) {
        const s = list[i]
        const g = s.geom
        if (!g || !s.pin) {
          next.push(modesRef.current[i] ?? 'flat')
          continue
        }
        const stub = g.h[0]
        const distance = Math.max(g.H - stub, 1)
        const pin = reduce ? 0 : clamp(line - (sectionTop + shift), 0, distance)
        const q = pin / distance

        const mode: Mode = q <= 0 ? 'flat' : q >= 1 ? 'stub' : 'fold'
        next.push(mode)
        if (mode !== modesRef.current[i]) changed = true

        // the body carries the foot with it, so the foot has to give way first
        const foot = angleAt(q, 0)
        const body = angleAt(q, 1)
        // the header never turns; each crease below it adds to whatever the one above has turned
        const turn = [0, body, body + foot]
        const visible = Math.max(stub, heightAt(g.h, turn))

        // a receipt nothing has changed for is left alone; usually only one is mid-fold
        if (shift !== s.last.shift || q !== s.last.q) {
          s.pin.style.transform = `translate3d(0, ${shift + pin}px, 0)`
          if (q !== s.last.q) {
            const own = [body, foot]
            s.groups.forEach((el, j) => {
              if (el) el.style.transform = `rotateX(${-own[j]}deg)`
            })
            // paper turned from the light loses brightness, by however far it has turned in all
            s.papers.forEach((el, j) => {
              if (el) el.style.filter = `brightness(${1 - Math.sin(rad(Math.min(turn[j], MAX_ANGLE))) * SHADE})`
            })
            s.creases.forEach((el, j) => {
              if (el) el.style.opacity = `${Math.sin(rad(own[j]))}`
            })
          }
          s.last = { shift, q }
        }

        shift += visible + pin - g.H
        sectionTop += g.H + gap
      }

      if (changed) {
        modesRef.current = next
        setModes(next)
      }
    }

    relayout.current = () => {
      layoutPanels()
      apply()
    }

    /**
     * Sampled on a frame loop rather than straight off the scroll event: iOS Safari delivers those
     * in bursts while a flick is coasting, and a fold that only moves when one lands looks stepped.
     */
    let frame = 0
    let coast = 0
    const tick = () => {
      apply()
      frame = ++coast < COAST_FRAMES ? requestAnimationFrame(tick) : 0
    }
    const onScroll = () => {
      coast = 0
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const remeasure = () => {
      measure()
      relayout.current()
    }

    remeasure()
    // the receipts are set in Manrope; until it arrives they are laid out in a fallback and every
    // height here is the wrong one
    document.fonts?.ready.then(remeasure)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(remeasure)
    ro.observe(scroller)
    list.forEach((s) => {
      if (s.papers[0]) ro.observe(s.papers[0])
    })
    window.addEventListener('resize', remeasure)
    window.visualViewport?.addEventListener('resize', remeasure)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', remeasure)
      window.visualViewport?.removeEventListener('resize', remeasure)
    }
  }, [items, gap, inset])

  // a render resets every size written above, so they go back on before the browser paints
  useLayoutEffect(() => relayout.current())

  return (
    <>
      {items.map((item, i) => {
        const mode = modes[i] ?? 'flat'
        const folding = mode === 'fold'
        /** One panel: a window on the card, with the whole card behind it pushed up into view. */
        const slice = (panel: number) => (
          <div
            ref={(el) => void (slotAt(i).slices[panel] = el)}
            // the paper below the first panel is a second and third look at the same receipt, so it
            // is hidden from assistive tech; the first panel carries the whole card in its DOM
            aria-hidden={panel > 0 || undefined}
            className="relative"
            style={{
              // the clip flattens this subtree, which makes the slice the thing that actually paints
              // — so this is where a panel folded past upright has to be told to show nothing
              backfaceVisibility: 'hidden',
              clipPath:
                panel === 0 && mode === 'flat'
                  ? 'none'
                  : panel === PANELS - 1
                    ? `inset(0px 0px -${EMBOSS_ROOM}px 0px)`
                    : 'inset(0)',
            }}
          >
            <div ref={(el) => void (slotAt(i).papers[panel] = el)} className="absolute inset-x-0 top-0">
              {(panel === 0 || folding) && item.node}
            </div>
            {panel < CREASES && (
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
          <div key={item.key} ref={(el) => void (slotAt(i).section = el)} style={{ marginBottom: gap }}>
            <div
              ref={(el) => void (slotAt(i).pin = el)}
              // a 3D context costs a phone something to keep, so only the card using one has one
              style={
                folding
                  ? { perspective: `${PERSPECTIVE}px`, perspectiveOrigin: '50% 0', transformStyle: 'preserve-3d' }
                  : undefined
              }
            >
              <div className="relative" style={folding ? { transformStyle: 'preserve-3d' } : undefined}>
                {slice(0)}
                {group(
                  0,
                  <div className="relative" style={folding ? { transformStyle: 'preserve-3d' } : undefined}>
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
