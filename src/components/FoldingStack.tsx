import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Receipts that fold into a stack of headers as they scroll.
 *
 * Each receipt takes the screen in turn: it sits open at the top, folds away from the reader — the
 * foot first, then the body — down to its own header, and then that header moves up until it is gone
 * and the next receipt has arrived in its place, open. The last one never folds: it is where the
 * scrolling is going.
 *
 * Folding costs a receipt its height less its header, and leaving costs the header and the gap — so
 * a receipt costs exactly its own height plus the gap, the same as if it had simply scrolled past.
 * The page is the length it looks, and the fold is free.
 *
 * The whole thing hangs off one sticky anchor rather than sitting in the scroll flow, which is what
 * makes a header able to stay put. A card pinned by absorbing scroll can only stay where it is by
 * absorbing *all* of it, which freezes everything behind it — so the anchor holds the canvas still
 * and every receipt is placed inside it from the scroll position. A folded header's place never
 * changes, so nothing has to be written for it at all: it cannot drift, however busy the main thread
 * gets.
 *
 * The fold is a function of scroll position, not an animation, so scrolling back up unfolds it
 * through exactly the same geometry.
 */

/** Panels a folding card is cut into, and the creases it marks to divide them. */
const PANELS = 3
const CREASES = PANELS - 1
/** Edge-on, and so invisible. */
const MAX_ANGLE = 90
/** Turns the paper early, so a crease is well into its fold before the next one starts. */
const ANGLE_EASE = 0.7
/**
 * Share of the fold each crease gets; the remainder is the overlap. Generous, so the creases turn
 * together and the receipt foreshortens as a whole. Give them a window each and the fold is strictly
 * bottom-up: nothing but the foot moves for the first third, and on a card whose foot is half its
 * height that reads as the bottom being cut off rather than folded away.
 */
const WINDOW = 0.8
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
/** Breathing room under the last receipt once the scrolling has nowhere else to go. */
const TAIL_ROOM = 24
/** Frames to keep sampling after the last scroll event, so iOS momentum is followed to a stop. */
const COAST_FRAMES = 14

/** Open until it reaches the pile, panelled while it folds, then the header it folded down to. */
type Mode = 'flat' | 'fold' | 'stub' | 'gone'

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
  card: HTMLDivElement | null
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
  last: { y: number; q: number }
}

const newSlot = (): Slot => ({
  card: null,
  slices: new Array(PANELS).fill(null),
  papers: new Array(PANELS).fill(null),
  groups: new Array(CREASES).fill(null),
  creases: new Array(CREASES).fill(null),
  geom: null,
  last: { y: NaN, q: NaN },
})

export interface FoldingItem {
  key: string
  node: ReactNode
}

export function FoldingStack({
  items,
  gap = 16,
  inset = 16,
}: {
  items: FoldingItem[]
  /** Space between one receipt and the next, and between the headers once they have piled up. */
  gap?: number
  /** How far below the top of the canvas the pile starts. */
  inset?: number
}) {
  const frame = useRef<HTMLDivElement>(null)
  const slots = useRef<Slot[]>([])
  const slotAt = (i: number) => (slots.current[i] ??= newSlot())
  const [modes, setModes] = useState<Mode[]>(() => items.map(() => 'flat' as Mode))
  const modesRef = useRef(modes)
  /** Re-runs the writes that a render just wiped, and puts the stack back where it was. */
  const relayout = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    slots.current.length = items.length
    const list = slots.current
    const box = frame.current
    const scroller = box?.closest('[data-scroll]') as HTMLElement | null
    if (!box || !scroller) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const last = list.length - 1
    /** What the scroll is spent on: folding everything that folds, then reading the last receipt. */
    let plan = { folding: 0, tail: 0 }

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
     * The scroll this costs: enough to fold everything that folds, then enough to read the last
     * receipt under the pile if it doesn't already fit.
     */
    function budget() {
      let folding = 0
      for (let i = 0; i < list.length; i++) {
        const g = list[i].geom
        if (!g) continue
        if (i === last) {
          // by now every other receipt has gone, so this one has the canvas to itself
          const overflow = inset + g.H + TAIL_ROOM - scroller!.clientHeight
          return { folding, tail: Math.max(0, Math.round(overflow)) }
        }
        // fold it down to its header, then walk the header off the top
        folding += Math.max(g.H - g.h[0], 1) + g.h[0] + gap
      }
      return { folding, tail: 0 }
    }

    /**
     * The sizes a render can't carry, because React would reset them from the style prop. Runs after
     * every render, and only writes — the numbers all come from the last `measure`.
     */
    function layoutPanels() {
      for (const s of list) {
        const g = s.geom
        if (!g) continue
        s.slices.forEach((el, i) => {
          if (el) el.style.height = `${g.h[i]}px`
        })
        s.papers.forEach((el, i) => {
          if (el && i > 0) el.style.top = `${-g.h.slice(0, i).reduce((a, b) => a + b, 0)}px`
        })
        s.groups.forEach((el, i) => {
          if (el) el.style.top = `${g.h[i]}px`
        })
        s.last = { y: NaN, q: NaN }
      }
      plan = budget()
      // a scroll range is the content less one screenful, so the box has to carry that screenful too
      const pad = parseFloat(getComputedStyle(scroller!).paddingBottom || '0')
      box!.style.height = `${plan.folding + plan.tail + Math.max(0, scroller!.clientHeight - pad)}px`
    }

    /**
     * Place every receipt for where the scroll is. One read up front, then nothing but transforms —
     * neither of which dirties layout, so there is no reflow to thrash.
     */
    function apply() {
      // how far the canvas has been scrolled past; the anchor holds it still from here on
      const scrolled = reduce ? 0 : Math.max(0, scroller!.getBoundingClientRect().top - box!.getBoundingClientRect().top)
      const next: Mode[] = []
      let changed = false

      // each receipt folds where it stands and then walks off the top; both are fixed by the scroll
      const fold: number[] = []
      let gone = 0
      let spent = 0
      for (let i = 0; i < list.length; i++) {
        const g = list[i].geom
        // the last receipt is the destination, so it neither folds nor leaves
        const turning = !g || i === last ? 0 : Math.max(g.H - g.h[0], 1)
        const leaving = !g || i === last ? 0 : g.h[0] + gap
        fold.push(turning ? clamp((scrolled - spent) / turning, 0, 1) : 0)
        // it walks off at scroll speed, so the receipt behind it simply keeps coming
        gone += leaving ? clamp(scrolled - spent - turning, 0, leaving) : 0
        spent += turning + leaving
      }

      let y = -gone
      for (let i = 0; i < list.length; i++) {
        const s = list[i]
        const g = s.geom
        if (!g || !s.card) {
          next.push(modesRef.current[i] ?? 'flat')
          continue
        }
        const stub = g.h[0]
        const q = fold[i]
        const tail = i === last ? clamp(scrolled - spent, 0, plan.tail) : 0

        const foot = angleAt(q, 0)
        const body = angleAt(q, 1)
        // the header never turns; each crease below it adds to whatever the one above has turned
        const turn = [0, body, body + foot]
        const visible = q > 0 ? Math.max(stub, heightAt(g.h, turn)) : g.H

        const at = y - tail
        // once a header is off the top of the canvas there is nothing left of it to draw
        const mode: Mode = at + visible <= 0 ? 'gone' : q <= 0 ? 'flat' : q >= 1 ? 'stub' : 'fold'
        next.push(mode)
        if (mode !== modesRef.current[i]) changed = true

        if (at !== s.last.y || q !== s.last.q) {
          s.card.style.transform = `translate3d(0, ${at}px, 0)`
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
          s.last = { y: at, q }
        }

        y += visible + gap
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
    let raf = 0
    let coast = 0
    const tick = () => {
      apply()
      raf = ++coast < COAST_FRAMES ? requestAnimationFrame(tick) : 0
    }
    const onScroll = () => {
      coast = 0
      if (!raf) raf = requestAnimationFrame(tick)
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
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', remeasure)
      window.visualViewport?.removeEventListener('resize', remeasure)
    }
  }, [items, gap, inset])

  // a render resets every size written above, so they go back on before the browser paints
  useLayoutEffect(() => relayout.current())

  return (
    <div ref={frame} className="relative">
      {/* the canvas: held at the top of the screen, with every receipt placed inside it */}
      <div className="sticky h-0" style={{ top: inset }}>
        {items.map((item, i) => {
          const mode = modes[i] ?? 'flat'
          const turning = mode === 'fold'
          /** One panel: a window on the card, with the whole card behind it pushed up into view. */
          const slice = (panel: number) => (
            <div
              ref={(el) => void (slotAt(i).slices[panel] = el)}
              // the paper below the first panel is a second and third look at the same receipt, so
              // it is hidden from assistive tech; the first panel carries the whole card in its DOM
              aria-hidden={panel > 0 || undefined}
              className="relative"
              style={{
                // the clip flattens this subtree, which makes the slice the thing that actually
                // paints — so this is where a panel folded past upright shows nothing
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
                {(panel === 0 || turning) && item.node}
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
            <div
              key={item.key}
              ref={(el) => void (slotAt(i).card = el)}
              className="absolute inset-x-0 top-0"
              // the pile is in front, so the last receipt slides under it rather than over it
              style={{
                zIndex: items.length - i,
                // still in the DOM once it is off the top, so its height stays measurable
                ...(mode === 'gone' ? { visibility: 'hidden' as const } : null),
                ...(turning
                  ? { perspective: `${PERSPECTIVE}px`, perspectiveOrigin: '50% 0', transformStyle: 'preserve-3d' }
                  : null),
              }}
            >
              <div className="relative" style={turning ? { transformStyle: 'preserve-3d' } : undefined}>
                {slice(0)}
                {group(
                  0,
                  <div className="relative" style={turning ? { transformStyle: 'preserve-3d' } : undefined}>
                    {slice(1)}
                    {group(1, <div className="relative">{slice(2)}</div>)}
                  </div>,
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
