import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLoan } from '@/lib/loan'
import { useFrame } from '@/components/PhoneFrame'
import { SFSymbol } from '@/components/SFSymbol'
import { cn } from '@/lib/cn'

/** Annotations document design intent. The repayment cards have two versions; only V1 is annotated. */
export function useAnnotations() {
  const { version, annotations, scenario } = useLoan()
  if (!annotations) return false
  return scenario.startsWith('flow2') ? version === 'v1' : true
}

/** Pin numbers, keyed, for threads whose numbering depends on what is on screen. */
const IndexContext = createContext<Record<string, number>>({})
export function AnnotationIndex({ index, children }: { index: Record<string, number>; children: ReactNode }) {
  return <IndexContext.Provider value={index}>{children}</IndexContext.Provider>
}

/**
 * Numbered pin tying a piece of the screen to an entry in the annotation panel.
 * The parent must be positioned; the pin sits at its right edge and takes no layout space.
 */
export function Marker({ n, k, className }: { n?: number; k?: string; className?: string }) {
  const on = useAnnotations()
  const index = useContext(IndexContext)
  const num = n ?? (k ? index[k] : undefined)
  if (!on || num === undefined) return null
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -top-1 right-0 z-20 flex size-[18px] items-center justify-center rounded-full bg-brand-text text-[11px] font-bold leading-none text-white shadow-[0_0_0_2px_#fff]',
        className,
      )}
    >
      {num}
    </span>
  )
}

export type PanelNote = { key: string; label: string; text: string }

/** The numbered list itself — the same content beside the phone and on it. */
function NoteList({ notes, className }: { notes: PanelNote[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {notes.map((note, i) => (
        <li key={note.key} className="flex gap-2.5">
          <span className="mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-text text-[11px] font-bold leading-none text-white">
            {i + 1}
          </span>
          <p className="text-[13px] leading-[18px] text-ink">
            <span className="block font-semibold">{note.label}</span>
            <span className="text-ink2">{note.text}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}

/**
 * The notes, numbered to match the pins. Beside the phone when there is room for a column; on a real
 * phone there isn't, so they become a sheet over the foot of the screen that can be folded away to
 * see what a pin is pointing at.
 */
export function AnnotationPanel({ notes }: { notes: PanelNote[] }) {
  const on = useAnnotations()
  const { embedded } = useFrame()
  const [open, setOpen] = useState(true)
  if (!on) return null

  if (!embedded) {
    return (
      <aside
        aria-label="Design annotations"
        className="absolute inset-x-0 bottom-0 z-[90] flex max-h-[46%] flex-col rounded-t-[18px] border-t border-[#0000001F] bg-white font-sans shadow-[0_-6px_20px_rgba(0,0,0,0.10)]"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex shrink-0 items-center justify-between px-4 py-3 text-left active:opacity-60"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink2">Annotations</span>
          <SFSymbol name={open ? 'chevron.down' : 'chevron.up'} size={12} color="rgb(60 60 67 / 0.6)" />
        </button>
        {open && (
          <NoteList notes={notes} className="min-h-0 overflow-y-auto px-4 pb-[calc(var(--sab)+16px)]" />
        )}
      </aside>
    )
  }

  // long note lists scroll, so keyboard users need to be able to focus and scroll them
  return (
    <aside
      aria-label="Design annotations"
      tabIndex={0}
      className="h-full w-[300px] overflow-y-auto border-l border-[#0000001F] bg-white px-4 py-5 font-sans">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink2">Annotations</p>
      <NoteList notes={notes} className="mt-3" />
    </aside>
  )
}
