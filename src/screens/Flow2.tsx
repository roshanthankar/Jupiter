import { useId, type ReactNode } from 'react'
import { useNav } from '@/lib/nav'
import { useLoan } from '@/lib/loan'
import { Screen } from '@/components/Screen'
import { SFSymbol } from '@/components/SFSymbol'
import { useFrame } from '@/components/PhoneFrame'
import { cn } from '@/lib/cn'
import { AnnotationPanel, Marker } from '@/components/Annotations'
import { FoldingStack } from '@/components/FoldingStack'
import { buildAssistantNotes } from './assistantNotes'
import { ReceiptCardV2 } from './Flow2V2'

/** Mock loan + payment context — replace with the real objects. */
export const loan = {
  emi: '₹4,500',
  bank: 'HDFC ••••5914',
  attempted: '03 Aug 2026, 11:04 AM',
  ref: 'Ref: 528463109774',
  nextDate: '03 Sep 2026',
  paidCount: '8 of 24',
  outstanding: '₹72,000 (16 × ₹4,500)',
}

export type Variant = 'paid' | 'partial' | 'pending' | 'failed' | 'already'

/** The loan's standing — same rows, same labels, wherever it is shown. */
/** What each pin on the V1 card is explaining. Order matches the pin numbers. */
export type Note = { label: string; text: string }
export const NOTES: Record<Variant, Note[]> = {
  paid: [
    { label: 'Status chip', text: 'Names the outcome so all five screens scan alike and the amount below can be just an amount.' },
    { label: '₹4,500', text: 'No verb, because the chip already said “successful” and saying it twice wastes the biggest text on the screen.' },
    { label: 'Time and reference', text: 'Small on purpose; nobody reads these today, they come back for them when a payment gets disputed.' },
    { label: 'Next instalment · Paid so far · Outstanding', text: 'Answers how far there is left to go, which “successful” alone never tells anyone.' },
    { label: 'Two-hour note', text: 'Warns that the loan page lags, so a user who checks in an hour is not confused into calling support.' },
    { label: 'Share and download', text: 'A loan payment gets used for tax and disputes, so the receipt has to be takeable.' },
    { label: 'No help link', text: 'Left out deliberately; nothing failed here, and offering help implies something did.' },
  ],
  partial: [
    { label: 'Status chip', text: 'Neither success nor failure, so it says exactly that instead of picking one.' },
    { label: '₹2,500 outstanding', text: 'Leads with what is left rather than what was paid, because that is the number the user does not already know.' },
    { label: 'No progress bar', text: 'A half-filled bar reads as progress and would imply a problem that is still open has been handled.' },
    { label: 'Two rows', text: 'Shows the working so the user can check the subtraction themselves rather than trust one figure.' },
    { label: '“Stays open until it’s paid in full”', text: 'The one fact most people get wrong: a part payment reduces the balance but does not complete the EMI.' },
    { label: 'Talk to a person', text: 'Someone who paid ₹2,000 of ₹4,500 is usually short, and without this the only option is the one they cannot take.' },
  ],
  pending: [
    { label: '“Payment pending”', text: 'Uses the word people know from their own bank, instead of describing what the app does not know.' },
    { label: 'Outstanding ₹4,500', text: 'Still owed, because the doubt is about the debit leaving the bank, not about the loan being credited.' },
    { label: '“may or may not have left HDFC ••••5914”', text: 'Says the uncomfortable truth plainly and names the account so the user knows where to check.' },
    { label: 'Timeframe with the instruction', text: 'Pairs when they will hear with what not to do, so the warning has a deadline attached.' },
    { label: 'Retry disabled', text: 'Locks the button rather than advising against it, because an anxious user will tap anyway and could pay twice.' },
    { label: 'Nothing promised about the bank', text: 'RBI reversal and compensation rules were cut, since they commit another institution and the blame lands here.' },
  ],
  failed: [
    { label: '“Payment failed”', text: 'The plain word, and the one Indian apps already use.' },
    { label: '“Nothing was debited from HDFC ••••5914”', text: 'Sits above the reason because where is my money is the first question, not why.' },
    { label: 'No invented reason', text: 'Names the source and moves to what works, rather than manufacturing a cause the gateway never gave.' },
    { label: 'Two retry paths', text: 'Same method or a different one, since a declined mandate usually needs the second.' },
    { label: 'One escape only', text: 'An earlier “need more time” link was cut; it pointed at a rescheduling flow this screen does not have.' },
  ],
  already: [
    { label: '“Already paid” chip', text: 'Marks this as a refusal, not a receipt, since the user is trying to pay something settled days ago.' },
    { label: 'Amount with the 3 August date', text: 'The date is what stops someone thinking they just paid twice.' },
    { label: 'Same rows as the successful screen', text: 'Once they know it was settled, they need what any paid EMI needs; repeating the old transaction adds nothing.' },
    { label: 'Prepayment offer', text: 'Answers where the money would have gone, instead of blocking them and leaving them to guess.' },
    { label: '“Talk to a person”', text: 'Same label on all four screens, so the route is learned once rather than relearned each time.' },
  ],
}

/** Pin number for the human route, per state. Pending annotates other things instead. */
const TALK_PIN: Partial<Record<Variant, number>> = { partial: 6, failed: 5, already: 5 }

export const STANDING: string[][] = [
  ['Next instalment', loan.nextDate],
  ['Paid so far', loan.paidCount],
  ['Outstanding', loan.outstanding],
]

const TITLE = 'Payments'

/** Each state names itself in the card header, with its own glyph. */
export const STATES: Record<Variant, { label: string; icon: string; color: string }> = {
  paid: { label: 'Payment successful', icon: 'checkmark.circle.fill', color: '#416a62' },
  partial: { label: 'Partial payment', icon: 'circle.lefthalf.filled', color: '#416a62' },
  failed: { label: 'Payment failed', icon: 'xmark.circle.fill', color: '#b42318' },
  pending: { label: 'Payment pending', icon: 'clock.fill', color: '#b45309' },
  already: { label: 'Already paid', icon: 'checkmark.seal.fill', color: '#416a62' },
}

/** Every state, in the order they queue up behind whichever one the case selected. */
const ORDER: Variant[] = ['paid', 'partial', 'pending', 'failed', 'already']

/**
 * EMI repayment. V1 is one card, the state the case selected. V2 puts every state on the screen as
 * paper, each receipt folding away as the next one comes up.
 */
export function Flow2() {
  const nav = useNav()
  const { hasSidebar, scenario, version } = { ...useFrame(), ...useLoan() }
  // Pushed → go back; loaded straight into this case → Home
  const goBack = () => (nav.stack.length > 1 ? nav.pop() : nav.reset('home'))
  const variant: Variant =
    scenario === 'flow2Partial'
      ? 'partial'
      : scenario === 'flow2Pending'
        ? 'pending'
        : scenario === 'flow2Failed'
          ? 'failed'
          : scenario === 'flow2Already'
            ? 'already'
            : 'paid'

  return (
    <Screen className="bg-canvas">
      <Screen.Content navInset={false} style={{ paddingTop: 'var(--sat)' }}>
        {/* Top bar — 16pt padding, same pattern as Home */}
        <header className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Back" onClick={goBack} className="-ml-1 -my-1 flex rounded-full p-1 active:opacity-60">
              <SFSymbol name="chevron.left" size={20} color="#30302f" />
            </button>
            <h1 className="font-sans text-[20px] font-bold leading-6 text-ink">{TITLE}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Filter" className="-m-1 flex rounded-full p-1 active:opacity-60">
              <SFSymbol name="line.3.horizontal.decrease" size={20} color="#30302f" />
            </button>
            {!hasSidebar && (
              <button type="button" aria-label="Cases" onClick={() => nav.present('cases')} className="-m-1 flex rounded-full p-1 active:opacity-60">
                <SFSymbol name="line.3.horizontal" size={20} color="#30302f" />
              </button>
            )}
          </div>
        </header>

        {/* On V2 the case picked in the sidebar leads and the other states follow it */}
        <div className="mt-4">
          {version === 'v1' ? (
            <ReceiptCard variant={variant} />
          ) : (
            <FoldingStack
              items={[variant, ...ORDER.filter((v) => v !== variant)].map((v) => ({ key: v, node: <ReceiptCardV2 variant={v} /> }))}
            />
          )}
        </div>
      </Screen.Content>
    </Screen>
  )
}

/* ------------------------------------------------------------------ */

function ReceiptCard({ variant }: { variant: Variant }) {
  const titleId = useId()
  return (
    <section className="mx-4 overflow-hidden rounded-lg border border-[#0000002E] bg-white" aria-labelledby={titleId}>
      {/* What happened */}
      <div className="relative flex items-center gap-2 border-b border-[#0000001F] px-4 py-3.5">
        <Marker n={1} className="right-3 top-1.5" />
        <SFSymbol name={STATES[variant].icon} size={18} color={STATES[variant].color} />
        <h2 id={titleId} className="text-[17px] font-semibold leading-[22px] text-ink">{STATES[variant].label}</h2>
      </div>

      {/* the paper folds along the header rule first */}
      <div data-crease className="px-4 pb-5 pt-5">
        {variant === 'paid' && <PaidBody />}
        {variant === 'partial' && <PartialBody />}
        {variant === 'pending' && <PendingBody />}
        {variant === 'failed' && <FailedBody />}
        {variant === 'already' && <AlreadyBody />}
        {/* Every state that could have gone wrong offers a human */}
        {variant !== 'paid' && (
          <div className="relative">
            {TALK_PIN[variant] !== undefined && <Marker n={TALK_PIN[variant]!} className="top-1" />}
            <TalkToPerson />
          </div>
        )}
      </div>
    </section>
  )
}

/* ---- the states ---- */

export function PaidBody() {
  return (
    <>
      <Hero amount={loan.emi} n={2} />
      <div className="relative">
        <Marker n={3} className="top-1" />
        <p className="mt-2 text-[15px] leading-5 text-ink2">{loan.attempted}</p>
        <p className="mt-1 text-[13px] leading-[18px] text-ink2">{loan.ref}</p>
      </div>
      <Rows rows={STANDING} n={4} />
      <Note n={5}>Your loan page can take up to 2 hours to show this.</Note>
      <div className="relative">
        <Marker n={6} className="top-2" />
        <Actions />
      </div>
      {/* pin 7 marks what is deliberately absent: no help link on a screen where nothing failed */}
      <div className="relative">
        <Marker n={7} className="-top-1" />
      </div>
    </>
  )
}

export function PartialBody() {
  return (
    <>
      <Hero amount="₹2,500 outstanding" n={2} />
      {/* pin 3 marks the progress bar that is deliberately not here */}
      <div className="relative">
        <Marker n={3} className="top-1" />
      </div>
      <p className="mt-2 text-[15px] leading-5 text-ink2">{loan.attempted}</p>
      <p className="mt-1 text-[13px] leading-[18px] text-ink2">{loan.ref}</p>
      <Rows
        n={4}
        rows={[
          ['Current instalment', loan.emi],
          ['Paid so far', '₹2,000'],
        ]}
      />
      <Note n={5}>This instalment stays open until it&rsquo;s paid in full.</Note>
      <PrimaryButton className="mt-4">Pay ₹2,500</PrimaryButton>
    </>
  )
}

export function PendingBody() {
  return (
    <>
      <Hero amount={`${loan.emi} outstanding`} n={2} />
      <p className="mt-2 text-[15px] leading-5 text-ink2">Attempted {loan.attempted}</p>
      <p className="relative mt-4 text-[15px] leading-[22px] text-ink">
        <Marker n={3} className="-top-2" />
        Your bank hasn&rsquo;t confirmed this payment. {loan.emi} may or may not have left {loan.bank}.
      </p>
      <Note className="mt-[30px]" n={4}>We&rsquo;ll text you within 30 minutes, either way. Don&rsquo;t try again until then, you could be charged twice.</Note>
      {/* The lock is the point: an ambiguous debit must not be retried until the bank answers */}
      <div className="relative">
        <Marker n={5} className="top-2" />
        <button
          type="button"
          disabled
          className="mt-4 block w-full rounded bg-ios-fill3 px-4 py-3 text-center text-base font-bold leading-6 text-ink2"
        >
          Try again · locked for 30 minutes
        </button>
      </div>
      {/* pin 6 marks the promises about the bank that were deliberately cut */}
      <div className="relative">
        <Marker n={6} className="-top-2" />
      </div>
    </>
  )
}

export function FailedBody() {
  return (
    <>
      <Hero amount={`${loan.emi} outstanding`} />
      <p className="mt-2 text-[15px] leading-5 text-ink2">Attempted {loan.attempted}</p>
      <p className="relative mt-4 text-[15px] leading-[22px] text-ink">
        <Marker n={2} className="-top-2" />
        Nothing was debited from {loan.bank}. Your balance is unchanged.
      </p>
      <Note className="mt-[30px]" n={3}>Your bank declined it. A different payment method usually works.</Note>
      <div className="relative">
        <Marker n={4} className="top-2" />
        <PrimaryButton className="mt-4">Try again</PrimaryButton>
        <SecondaryButton className="mt-2">Pay another way</SecondaryButton>
      </div>
    </>
  )
}

export function AlreadyBody() {
  return (
    <>
      <Hero amount={loan.emi} n={2} />
      <p className="mt-2 text-[15px] leading-5 text-ink2">{loan.attempted}</p>
      <p className="mt-1 text-[13px] leading-[18px] text-ink2">{loan.ref}</p>
      <Rows rows={STANDING} n={3} />
      <Actions tight />
      <Note>Your next EMI of {loan.emi} is due 3 September. You can pay it early, or put the money against your principal.</Note>
      <div className="relative">
        <Marker n={4} className="top-2" />
        <SecondaryButton className="mt-4">Pay September&rsquo;s EMI early</SecondaryButton>
      </div>
    </>
  )
}

/* ---- shared pieces ---- */

function Hero({ amount, n }: { amount: string; n?: number }) {
  return (
    <div className="relative">
      {n !== undefined && <Marker n={n} className="top-2" />}
      <p className="text-[32px] font-bold leading-9 tracking-[-0.5px] text-ink tabular-nums">{amount}</p>
    </div>
  )
}

/** Label–value rows with hairlines between them. */
function Rows({ rows, n }: { rows: string[][]; n?: number }) {
  return (
    <dl className="relative mt-6">
      {n !== undefined && <Marker n={n} className="-top-2" />}
      {rows.map(([label, value], i) => (
        <div key={label} className={cn('flex items-baseline justify-between gap-4 py-3.5', i > 0 ? 'border-t border-[#0000001F]' : 'pt-0')}>
          <dt className="text-[15px] leading-5 text-ink2">{label}</dt>
          <dd className="text-right text-[15px] leading-5 text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Explanatory line — same treatment wherever a state needs to say why. */
function Note({ children, className, n }: { children: ReactNode; className?: string; n?: number }) {
  return (
    <p data-crease className={cn('relative mt-4 flex items-start gap-2 text-[15px] leading-[22px] text-ink', className)}>
      {n !== undefined && <Marker n={n} className="-top-2" />}
      <SFSymbol name="info.circle.fill" size={12} color="rgb(60 60 67 / 0.6)" className="mt-[5px] shrink-0 opacity-60" />
      <span>{children}</span>
    </p>
  )
}

function PrimaryButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={cn('block w-full rounded bg-brand/12 px-4 py-3 text-center text-base font-bold leading-6 text-brand-text active:opacity-70', className)}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={cn('block w-full rounded border border-[#0000002E] bg-white px-4 py-3 text-center text-base font-bold leading-6 text-ink active:bg-ios-gray6', className)}
    >
      {children}
    </button>
  )
}

/** Share / download, with the leading rule set the same distance in every card. */
function Actions({ tight }: { tight?: boolean }) {
  return (
    <div className={cn('border-t border-[#0000001F]', tight ? 'mt-0.5' : 'mt-4')}>
      <ActionRow icon="square.and.arrow.up" label="Share receipt" />
      <ActionRow icon="square.and.arrow.down" label="Download PDF" border />
    </div>
  )
}

function ActionRow({ icon, label, border }: { icon: string; label: string; border?: boolean }) {
  return (
    <button type="button" className={cn('flex w-full items-center gap-3 py-3.5 text-left active:opacity-60', border && 'border-t border-[#0000001F]')}>
      <SFSymbol name={icon} size={18} color="#30302f" />
      <span className="text-[16px] font-medium leading-5 text-ink">{label}</span>
    </button>
  )
}

/** Every state can reach a human. */
export function TalkToPerson() {
  return (
    <button type="button" className="mt-4 flex w-full items-center justify-between gap-3 py-1 text-left active:opacity-60">
      <span className="text-[16px] font-medium leading-5 text-brand-text">Talk to a person</span>
      <SFSymbol name="chevron.right" size={12} color="#b54a41" />
    </button>
  )
}

/** The annotation list beside the phone, for whichever screen is on. */
export function FlowAnnotations() {
  const state = useLoan()
  const { scenario } = state
  if (!scenario.startsWith('flow2')) {
    // the assistant thread numbers its notes from what is currently on screen
    return <AnnotationPanel notes={buildAssistantNotes(state).notes} />
  }
  const variant: Variant =
    scenario === 'flow2Partial'
      ? 'partial'
      : scenario === 'flow2Pending'
        ? 'pending'
        : scenario === 'flow2Failed'
          ? 'failed'
          : scenario === 'flow2Already'
            ? 'already'
            : 'paid'
  return <AnnotationPanel notes={NOTES[variant].map((n, i) => ({ key: `${variant}-${i}`, ...n }))} />
}
