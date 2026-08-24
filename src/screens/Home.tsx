import { useNav } from '@/lib/nav'
import { useLoan } from '@/lib/loan'
import { useFrame } from '@/components/PhoneFrame'
import { Screen } from '@/components/Screen'
import { SFSymbol } from '@/components/SFSymbol'
import { AnnotationIndex, Marker } from '@/components/Annotations'
import { buildAssistantNotes } from './assistantNotes'
import { cn } from '@/lib/cn'

/** Mock data for the missed EMI — replace with the real object. */
const emi = {
  label: 'Missed EMI',
  ago: '4 days ago',
  amount: '₹4,736',
  lateFee: 'includes ₹236 late fee',
  message: 'Your auto-debit didn’t go through.',
  pay: 'Pay ₹4,736',
  more: 'Need more time?',
  view: 'View conversation',
  from: 'Jupiter Assistant',
  paidRef: '528463109811',
}

export function Home() {
  const nav = useNav()
  const { hasSidebar } = useFrame()
  const state = useLoan()
  return (
    <AnnotationIndex index={buildAssistantNotes(state).index}>
    <Screen className="bg-canvas">
      <Screen.Content navInset={false} style={{ paddingTop: 'var(--sat)' }}>
        {/* Top bar — 16pt padding on all sides, directly below the status bar */}
        <header className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {/* Cases menu — only when the desktop sidebar isn't showing */}
            {!hasSidebar && (
              <button type="button" aria-label="Cases" onClick={() => nav.present('cases')} className="-m-1 flex rounded-full p-1 active:opacity-60">
                <SFSymbol name="line.3.horizontal" size={20} color="#30302f" />
              </button>
            )}
            <h1 className="font-sans text-[20px] font-bold leading-6 text-ink">Home</h1>
          </div>
          <button type="button" aria-label="Profile" className="-m-1 flex rounded-full p-1 active:opacity-60">
            <SFSymbol name="person.crop.circle.fill" size={24} color="#30302f" />
          </button>
        </header>

        {/* 16pt gap between the top bar and the card */}
        <div className="mt-4">
          <EmiPendingCard />
        </div>
      </Screen.Content>
      <Screen.StatusCover />
    </Screen>
    </AnnotationIndex>
  )
}

/**
 * Persistent card states. Type weight carries status: large while money is owed, quiet once it is
 * not. Only the missed and rescheduled cards lead with the amount.
 */
function EmiPendingCard() {
  const nav = useNav()
  const { rescheduledTo, ref, escalated, paid } = useLoan()
  const variant = paid ? 'paid' : escalated ? 'escalation' : rescheduledTo ? 'reschedule' : 'missed'

  // Paid: nothing is owed, so nothing is emphasised. The absence of a big number is the message.
  if (variant === 'paid') {
    return (
      <Card pin="home.paid">
        <CardLabel>EMI paid · 7 August</CardLabel>
        <p className="mt-2 text-[17px] font-semibold leading-[22px] text-ink">Nothing due until 3 September</p>
        <p className="mt-1 text-[15px] leading-6 text-ink2">₹4,736 paid, late fee included</p>
        <Ref value={emi.paidRef} />
      </Card>
    )
  }

  // Waiting on the team: the conversation is the only action, so no tint and no pay button.
  if (variant === 'escalation') {
    return (
      <Card pin="home.esc">
        <CardLabel>Waiting on the loans team</CardLabel>
        {/* label and first line are one thought, like the assistant's bubbles */}
        <p className="mt-1 text-[15px] leading-6 text-ink">
          Priya has your request to move the date. She&rsquo;ll reply by 6:00 PM today, and if she doesn&rsquo;t, we&rsquo;ll chase it.
        </p>
        <p className="mt-3 text-[15px] leading-6 text-ink">₹4,736 is still due, and the late fee is still running.</p>
        <AssistantLink label="Open the conversation" onPress={() => nav.push('emiOptions')} className="mt-4" />
      </Card>
    )
  }

  // Money is owed: the amount leads.
  const rescheduled = variant === 'reschedule'
  return (
    <Card pin={rescheduled ? 'home.resched' : undefined}>
      <CardLabel>{rescheduled ? `EMI · due ${rescheduledTo} August` : `${emi.label} · ${emi.ago}`}</CardLabel>
      <p className="mt-2 text-[28px] font-bold leading-8 tracking-[-0.3px] text-ink tabular-nums">{emi.amount}</p>
      <p className="mt-1 text-[15px] leading-5 text-ink2">{emi.lateFee}</p>
      {/* the date is already in the label above, so this line carries only what it costs */}
      <p className="mt-5 text-[15px] leading-6 text-ink">
        {rescheduled ? 'It stays marked overdue until you pay.' : emi.message}
      </p>
      {rescheduled && ref && <Ref value={ref} />}

      <button
        type="button"
        className="mt-4 block w-full rounded bg-brand/12 px-4 py-3 text-center text-base font-bold leading-6 text-brand-text active:opacity-70"
      >
        {emi.pay}
      </button>
      <AssistantLink
        label={rescheduled ? emi.view : emi.more}
        onPress={() => nav.push('emiOptions')}
        className="mt-2"
      />
    </Card>
  )
}

function Card({ children, pin }: { children: React.ReactNode; pin?: string }) {
  return (
    <section className="relative mx-4 rounded-lg border border-[#0000002E] bg-white p-4" aria-labelledby="emi-title">
      {pin && <Marker k={pin} className="right-3 top-3" />}
      {children}
    </section>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 id="emi-title" className="text-[15px] font-semibold leading-5 text-ink">
      {children}
    </h2>
  )
}

function Ref({ value }: { value: string }) {
  return <p className="mt-3 text-[13px] leading-[18px] text-ink2">Ref {value}</p>
}

/** The route into the assistant thread. */
function AssistantLink({ label, onPress, className }: { label: string; onPress: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn('flex w-full items-center gap-3 rounded border border-[#0000002E] bg-white px-4 py-3 text-left active:bg-ios-gray6', className)}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-5 text-brand-text">{label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[18px] text-ink2">
          <SFSymbol name="bubble.left.and.bubble.right.fill" size={12} color="rgb(60 60 67 / 0.6)" className="opacity-60" />
          {emi.from}
        </span>
      </span>
      <SFSymbol name="chevron.right" size={12} color="rgb(60 60 67 / 0.6)" />
    </button>
  )
}

