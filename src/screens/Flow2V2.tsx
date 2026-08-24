import {
  AlreadyBody,
  FailedBody,
  PaidBody,
  PartialBody,
  PendingBody,
  STATES,
  TalkToPerson,
  type Variant,
} from './Flow2'
import { SFSymbol } from '@/components/SFSymbol'
import { useId } from 'react'

/** Height of the header row, where the ticket is perforated. */
const TEAR_Y = 51
/** Radius of the circles punched out of each side at the tear. */
const NOTCH = 11
/** Radius of each bite along the scalloped bottom edge. */
const SCALLOP = 13

/**
 * V2 of the payments card: a ticket. The top edge is plain, the state header sits above a
 * perforation with a circle punched out of each side, and the receipt hangs below it, torn off
 * along a scalloped bottom edge.
 *
 * The shape is a composed CSS mask, so the cuts take out the element itself, which means the card
 * can carry no border — a border would be sliced open at every one — and its emboss has to come
 * from a drop-shadow filter on the wrapper, which follows the alpha shape and so pools inside each
 * cut the way a real punched hole would.
 */
export function ReceiptCardV2({ variant }: { variant: Variant }) {
  const titleId = useId()
  const cut = (x: string, y: string, r: number) =>
    `radial-gradient(circle ${r}px at ${x} ${y}, transparent ${r}px, #000 ${r + 0.5}px)`

  const layers = [cut('0', `${TEAR_Y}px`, NOTCH), cut('100%', `${TEAR_Y}px`, NOTCH), cut(`${SCALLOP}px`, '100%', SCALLOP)].join(', ')
  const mask = {
    WebkitMaskImage: layers,
    maskImage: layers,
    WebkitMaskSize: `100% 100%, 100% 100%, ${SCALLOP * 2}px 100%`,
    maskSize: `100% 100%, 100% 100%, ${SCALLOP * 2}px 100%`,
    WebkitMaskRepeat: 'no-repeat, no-repeat, repeat-x',
    maskRepeat: 'no-repeat, no-repeat, repeat-x',
    WebkitMaskComposite: 'source-in',
    maskComposite: 'intersect',
  } as const

  return (
    <div className="mx-4" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.10)) drop-shadow(0 6px 14px rgba(0,0,0,0.06))' }}>
      <section className="relative rounded-lg bg-white" style={mask} aria-labelledby={titleId}>
        {/* Stub: what happened */}
        <div className="flex items-center gap-2 px-4" style={{ height: TEAR_Y }}>
          <SFSymbol name={STATES[variant].icon} size={18} color={STATES[variant].color} />
          <h2 id={titleId} className="text-[17px] font-semibold leading-[22px] text-ink">
            {STATES[variant].label}
          </h2>
        </div>

        {/* Perforation, inset so it starts and ends at the notches. The crease clears them by a
            whisker, so the punched circles stay whole on the stub rather than being cut in half. */}
        <div
          data-crease={NOTCH + 2}
          aria-hidden
          className="absolute border-t border-dashed border-[#0000002E]"
          style={{ top: TEAR_Y, left: NOTCH + 4, right: NOTCH + 4 }}
        />

        {/* The receipt itself — extra bottom padding so the scalloped edge bites white, not text */}
        <div className="px-4 pb-8 pt-5">
          {variant === 'paid' && <PaidBody />}
          {variant === 'partial' && <PartialBody />}
          {variant === 'pending' && <PendingBody />}
          {variant === 'failed' && <FailedBody />}
          {variant === 'already' && <AlreadyBody />}
          {variant !== 'paid' && <TalkToPerson />}
        </div>
      </section>
    </div>
  )
}
