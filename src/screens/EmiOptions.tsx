import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useNav } from '@/lib/nav'
import { MOVE_ASK, loanStore, useLoan, type MoveRun } from '@/lib/loan'
import { fadeTransition, notificationSpring, pushTransition } from '@/lib/motion'
import { Screen, useScrollY } from '@/components/Screen'
import { useFrame } from '@/components/PhoneFrame'
import { SFSymbol } from '@/components/SFSymbol'
import { Button } from '@/components/Button'
import { AssistantBubble, OptionCTA, UserBubble } from '@/components/Chat'
import { cn } from '@/lib/cn'
import { AnnotationIndex, Marker, useAnnotations } from '@/components/Annotations'
import { buildAssistantNotes, composerVisible } from './assistantNotes'

/** Mock loan context — replace with the real object. */
const loan = { product: 'Personal Loan', id: '4821', due: '₹4,736 due', overdue: '4 days overdue', lateFee: '₹236' }

const message = {
  intro: 'Here’s what I can do, and what I can’t.',
  options: [
    { key: 'move', title: 'Move the due date', detail: 'Up to 5 days. I can do this myself.' },
    { key: 'time', title: 'Ask for more time', detail: 'More than 5 days, or a payment break. Goes to the team.' },
  ],
  pay: 'Or pay ₹4,736 now',
  none: 'None of these work for me',
}

/** Free text the assistant can't parse: reflect back, offer the two things it can do. */
const misunderstood = {
  reflect: (text: string) => (/half|split|two part|2 part|instal/i.test(text) ? 'splitting the payment in two' : `“${text}”`),
  line: (reflect: string) => `I read that as ${reflect}, and I can’t set that up.`,
  can: 'What I can do is move the whole ₹4,736 to a later date, up to 5 days out.',
  ask: 'Did you mean something else?',
  composer: 'Message',
}

/** "Move the due date": the assistant checks the account in the open before promising anything. */
const moveCheck = {
  intro: 'Let me check your account first, so I don’t promise something I can’t do.',
  steps: [
    { label: 'Payment history', result: '11 of 12 EMIs paid on time' },
    { label: 'Account standing', result: 'No earlier reschedules' },
    { label: 'Can I move the date?', result: 'Yes, up to 5 days' },
  ],
  unclearResult: 'Couldn’t get a clear read',
  unclearLine: 'I couldn’t get a clear read on your eligibility, and I’m not going to guess with your money.',
  slow: 'This is taking longer than it should. Rather than keep you sitting here, want me to bring in someone from the team instead?',
  slowYes: 'Yes, talk to a person',
  slowKeep: 'Keep trying',
  cancel: 'Cancel',
  summary: 'Checked your account',
}
const STEP_MS = 1000
const SLOW_MS = 4000

/** The proposal: 8–12 August, nothing beyond; 12 preselected. */
const proposal = {
  days: [8, 9, 10, 11, 12],
  defaultDay: 12,
  intro: 'I can move it to 12 August. Pick a different day if that helps.',
  escape: 'Need longer than 12 August? I’ll pass it to the team.',
  escapeReply: 'I need longer than 12 August',
  consequences: [
    `The ${loan.lateFee} late fee already added stays.`,
    'The sooner this clears, the less likely it shows on your credit report.',
    'Miss it again and the fee keeps running.',
  ],
  button: (day: number) => `Move my due date to ${day} August`,
}

/** "Ask for more time": one question (time, not circumstances), skippable, then hand over. */
const askTime = {
  reply: 'Ask for more time',
  intro: 'That’s past what I can do on my own, so I’ll pass it to the team. What should I tell them?',
  question: 'How much longer do you need?',
  options: [
    { label: 'Around a week', ask: 'About a week' },
    { label: 'Two weeks', ask: 'About two weeks' },
    { label: 'Longer than that', ask: 'Longer than two weeks' },
    { label: 'Not sure', ask: 'More time, unsure how long' },
  ],
  skip: 'Skip this, just pass it on',
  skipReply: 'Just pass it on',
  skipAsk: 'More time',
}

/** Success state — neutral; type weight carries the state, the reference is not decoration. */
const success = {
  title: (day: number) => `Due date moved to ${day} August`,
  ref: (ref: string) => `Ref ${ref}`,
  unchanged: 'What hasn’t changed',
  rows: [
    ['Owed', '₹4,736 · incl. ₹236 late fee'],
    ['Status', 'Still overdue until it clears'],
    ['Credit', 'The sooner this clears, the less likely it shows on your credit report.'],
  ],
  remind: (day: number) => `Remind me on ${day - 2} August`,
  pay: 'Or pay ₹4,736 now',
}

/** Save failed ambiguously — the disabled control is the design. */
const unknown = {
  title: 'I don’t know if this went through',
  body: (day: number) => `Something broke while I was saving it. Your due date might now be ${day} August, or it might still be 3 August. I can’t tell yet.`,
  rows: [
    ['What’s happening', 'The team is checking now'],
    ['When you’ll know', 'An SMS within 30 minutes, either way'],
  ],
  warn: 'Don’t try again until you hear. You could end up with two changes on the account.',
  locked: 'Try again · locked for 30 minutes',
}

/** Save failed cleanly — outcome known, a retry is safe. */
const failure = {
  title: 'That didn’t go through',
  body: 'Nothing changed. Your due date is still 3 August.',
  retry: 'Try again',
  person: 'Talk to a person',
}

/** Auto-debit cleared while the conversation was open. Nothing owed, nothing shouting. */
const paidCopy = {
  title: 'Nothing’s owed',
  body: `Your auto-debit went through while we were talking. ${loan.due.replace(' due', '')} cleared at 11:04 today.`,
  // the clause that makes "nothing's owed" true, so it gets its own line rather than trailing
  fee: 'That covered the EMI and the ₹236 late fee.',
  ref: 'Ref 528463109811',
  sorry: 'Sorry for chasing you.',
  // the header carries the next date, so the bubble does not repeat it
  header: 'Next EMI 3 September',
}

const handoff = {
  intro: 'No problem. Someone from the team will pick this up.',
  passedOn: 'What I’ve passed on',
  receipt: (ask: string, extra: string[][]) => [
    ['Owed', '₹4,736 · incl. ₹236 late fee'],
    ['Overdue', '4 days · due 3 August'],
    ['Payment history', '11 of 12 EMIs on time'],
    ['Asked for', ask],
    ...extra,
  ],
  who: 'Priya, loans team',
  when: 'She’ll reply by 6:00 PM today.',
  failsafe: 'If she doesn’t, this comes back to me and I’ll chase it.',
  waitTitle: 'While you wait',
  wait: 'Your due date is still 3 August and the fee keeps running. Talking to Priya doesn’t pause it.',
  pay: 'Pay ₹4,736 now instead',
  noteLink: 'Add a note for Priya (optional)',
  prompt: 'Anything you’d like Priya to know before she looks?',
}
/** What the user asked for, as passed to the team */
const asks: Record<string, string> = {
  [message.none]: 'None of the options worked',
  [proposal.escapeReply]: 'Longer than 12 August',
  ...Object.fromEntries(askTime.options.map((o) => [o.label, o.ask])),
  [askTime.skipReply]: askTime.skipAsk,
  [moveCheck.slowYes]: MOVE_ASK,
}

/* ------------------------------------------------------------------ */

/** Fixed top bar: 16pt padding, 20×20 SF chevron at the left, centred title + subtitle; hairline on scroll. */
function TopBar({ onBack, subtitle }: { onBack: () => void; subtitle: string }) {
  const fallback = useMotionValue(0)
  const scrollY = useScrollY() ?? fallback
  const hairline = useTransform(scrollY, [0, 12], [0, 1])
  return (
    <header className="relative z-10 shrink-0 bg-canvas/92 backdrop-blur-xl" style={{ paddingTop: 'var(--sat)' }}>
      <div className="relative flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="absolute left-2 top-1/2 flex -translate-y-1/2 rounded-full p-2 active:opacity-60"
        >
          <SFSymbol name="chevron.left" size={20} color="#30302f" />
        </button>
        <div className="relative px-10 text-center">
          <Marker k="proposal.header" className="-right-2 top-0" />
          <Marker k="paid.header" className="-right-2 top-0" />
          <h1 className="text-[16px] font-semibold leading-5 text-ink">Jupiter Assistant</h1>
          <p className="mt-0.5 text-[13px] leading-[18px] text-ink2">{subtitle}</p>
        </div>
      </div>
      <motion.div className="absolute inset-x-0 bottom-0 h-px bg-[#0000001F]" style={{ opacity: hairline }} />
    </header>
  )
}

/** Label–value table: facts, scannable, none skimmable as a sentence. */
function FactTable({ rows, className }: { rows: string[][]; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-1.5 rounded-lg bg-canvas px-3.5 py-3 text-[13px] leading-[18px]', className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3">
          <dt className="w-[112px] shrink-0 text-ink2">{label}</dt>
          <dd className="min-w-0 flex-1 text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Accordion header row (chevron down when closed, up when open). */
function Disclosure({
  open,
  onToggle,
  icon,
  title,
}: {
  open: boolean
  onToggle: () => void
  icon?: React.ReactNode
  title: string
}) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-2.5 py-1 text-left active:opacity-60">
      {icon}
      <span className="flex-1 text-[15px] font-semibold leading-[22px] text-ink">{title}</span>
      <SFSymbol
        name="chevron.right"
        size={12}
        color="rgb(60 60 67 / 0.6)"
        className={cn('transition-transform duration-200 motion-reduce:transition-none', open ? '-rotate-90' : 'rotate-90')}
      />
    </button>
  )
}

function Collapse({ open, reduce, children }: { open: boolean; reduce: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="rows"
          className="overflow-hidden"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduce ? fadeTransition : pushTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const GREEN = '#416a62'
const WARN = '#b45309'

/** The three checks: expanded while running, collapsing into an accordion once done. */
function CheckList({ run, reduce }: { run: MoveRun; reduce: boolean }) {
  // Expanded while running; if the run already finished (re-entry), start collapsed, no layout jump.
  // With annotations on it stays open, otherwise the pins inside it would have nothing to point at.
  const annotated = useAnnotations()
  const [open, setOpen] = useState(!run.done || annotated)
  useEffect(() => {
    if (annotated) setOpen(true)
    else if (run.done) setOpen(false)
  }, [run.done, annotated])
  const showRows = !run.done || open

  const rows = (
    <ul className="relative flex flex-col gap-3">
      <Marker k="check.named" className="top-0" />
      {moveCheck.steps.map((s, i) => {
        const resolved = i < run.resolved
        const active = i === run.resolved && !run.done
        const unclear = resolved && i === 2 && run.unclear
        return (
          <li key={s.label} className="flex items-start gap-2.5">
            <span className="mt-[3px] flex size-4 shrink-0 items-center justify-center">
              {unclear ? (
                <SFSymbol name="exclamationmark.triangle.fill" size={16} color={WARN} />
              ) : resolved ? (
                <SFSymbol name="checkmark.circle.fill" size={16} color={GREEN} />
              ) : active ? (
                <span aria-hidden className="block size-4 animate-spin rounded-full border-2 border-[#416a62] border-t-transparent motion-reduce:animate-none" />
              ) : (
                <SFSymbol name="circle.dashed" size={16} color="rgb(60 60 67 / 0.6)" />
              )}
            </span>
            <span className="relative min-w-0 flex-1">
              {i === 0 && <Marker k="check.finding" className="top-[22px]" />}
              {i === 2 && <Marker k="slow.spinning" className="top-0" />}
              <span className={cn('block text-[15px] font-semibold leading-[22px]', resolved || active ? 'text-ink' : 'text-ink2')}>{s.label}</span>
              {resolved ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fadeTransition} className="block text-[13px] leading-[18px] text-ink2">
                  {unclear ? moveCheck.unclearResult : s.result}
                </motion.span>
              ) : active ? (
                <span className="block text-[13px] leading-[18px] text-ink2">Checking…</span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="mt-3">
      {run.done && (
        <motion.div className="relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fadeTransition}>
          <Marker k="check.collapse" className="top-1" />
          <Marker k="unclear.icon" className="left-4 right-auto top-1" />
          <Disclosure
            open={open}
            onToggle={() => setOpen((o) => !o)}
            title={moveCheck.summary}
            icon={
              run.unclear ? (
                <SFSymbol name="exclamationmark.triangle.fill" size={16} color={WARN} />
              ) : (
                <SFSymbol name="checkmark.circle.fill" size={16} color={GREEN} />
              )
            }
          />
        </motion.div>
      )}
      <Collapse open={showRows} reduce={reduce}>
        <div className={cn(run.done && 'pt-3')}>{rows}</div>
      </Collapse>
    </div>
  )
}

/** Context receipt — what the assistant hands to the team. Expandable; open by default. */
function Receipt({ ask, extra, reduce }: { ask: string; extra: string[][]; reduce: boolean }) {
  const annotated = useAnnotations()
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (annotated) setOpen(true)
  }, [annotated])
  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative flex w-full items-center gap-2 py-1 text-left active:opacity-60">
        <Marker k="esc.passed" className="top-0" />
        <span className="flex-1 font-semibold">{handoff.passedOn}</span>
        <SFSymbol
          name="chevron.right"
          size={12}
          color="rgb(60 60 67 / 0.6)"
          className={cn('transition-transform duration-200 motion-reduce:transition-none', open ? '-rotate-90' : 'rotate-90')}
        />
      </button>
      <Collapse open={open} reduce={reduce}>
        <div className="relative">
          <Marker k="esc.trigger" className="top-1" />
          <FactTable rows={handoff.receipt(ask, extra)} className="mt-1" />
        </div>
      </Collapse>
    </div>
  )
}

/** Optional note for the team — a plain link until tapped, then a text field. */
function NoteField() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 block py-1 text-left text-[15px] font-semibold leading-5 text-brand-text active:opacity-60">
        {handoff.noteLink}
      </button>
    )
  }
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-[13px] leading-[18px] text-ink2">Note for Priya (optional)</span>
      <textarea
        autoFocus
        rows={2}
        placeholder={handoff.prompt}
        className="block w-full resize-none rounded-lg border border-[#0000002E] bg-white px-3.5 py-3 text-[13px] leading-[18px] text-ink outline-none placeholder:text-ink2 focus:border-brand/70"
      />
    </label>
  )
}

/** Proposal: date chips, the escape line right under them, consequences in the card, primary button. */
function Proposal({ onEscape, onConfirm, disabled }: { onEscape: () => void; onConfirm: (day: number) => void; disabled?: boolean }) {
  const [day, setDay] = useState(proposal.defaultDay)
  return (
    <>
      <p>{proposal.intro}</p>
      <div role="radiogroup" aria-label="New due date" className="relative mt-3 flex flex-wrap gap-2">
        <Marker k="conf.chips" className="-top-2" />
        {proposal.days.map((d) => {
          const selected = d === day
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDay(d)}
              disabled={disabled}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold leading-[18px] active:opacity-70 disabled:opacity-50',
                selected ? 'border-brand/40 bg-brand/12 text-brand-text' : 'border-[#0000002E] bg-white text-ink',
              )}
            >
              {d} Aug
            </button>
          )
        })}
      </div>
      <span className="relative block">
        <Marker k="conf.escape" className="top-2" />
        <button type="button" onClick={onEscape} disabled={disabled} className="mt-3 block py-1 text-left text-[15px] font-semibold leading-5 text-brand-text active:opacity-60 disabled:text-ink2">
          {proposal.escape}
        </button>
      </span>
      <ul className="relative mt-3 flex flex-col gap-1 rounded-lg bg-canvas px-3.5 py-3">
        <Marker k="conf.consequences" className="-top-2" />
        {proposal.consequences.map((line) => (
          <li key={line} className="flex gap-2 text-[13px] leading-[18px] text-ink2">
            <span aria-hidden className="shrink-0">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <span className="relative block">
        <Marker k="conf.button" className="top-1" />
        <Button variant="brand" size="jupiter" block className="mt-3" disabled={disabled} onClick={() => onConfirm(day)}>
          {proposal.button(day)}
        </Button>
      </span>
    </>
  )
}

/** Text action — brand colour, semibold; dims when spent. */
function TextAction({
  children,
  onClick,
  disabled,
  quiet,
  pin,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  quiet?: boolean
  /** annotation key, when this action is pinned */
  pin?: string
}) {
  return (
    <span className="relative block">
      {pin && <Marker k={pin} className="top-2" />}
      <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'mt-3 block py-1 text-left text-[15px] font-semibold leading-5 active:opacity-60 disabled:text-ink2',
        quiet ? 'text-ink' : 'text-brand-text',
      )}
    >
        {children}
      </button>
    </span>
  )
}

/* ------------------------------------------------------------------ */

/** "See what I can do" — the assistant's options for the missed EMI, and everything that can follow. */
export function EmiOptions() {
  const nav = useNav()
  const reduce = !!useReducedMotion()
  const s = useLoan()
  const { height } = useFrame()
  const [draft, setDraft] = useState('')

  // Once a choice is sent the whole options card goes quiet (nothing should read as still tappable)
  const decided = !!s.move || !!s.escalated || !!s.moved || s.askMore || s.paid || s.freeText.length > 0
  const repairDecided = !!s.move || s.askMore || !!s.escalated

  // Run the checks one at a time; cancelling (move → null) stops the chain.
  useEffect(() => {
    const run = s.move
    if (!run || run.done) return
    if (s.checkMode === 'slow' && run.resolved >= 2) {
      if (s.slowPrompt) return
      const id = setTimeout(() => loanStore.setSlowPrompt(true), SLOW_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(
      () =>
        loanStore.setMove((m) => {
          if (!m) return m
          const next = m.resolved + 1
          if (s.checkMode === 'unclear' && next === moveCheck.steps.length) return { resolved: next, done: true, unclear: true }
          return next > moveCheck.steps.length ? { ...m, done: true } : { ...m, resolved: next }
        }, false),
      run.resolved < moveCheck.steps.length ? STEP_MS : STEP_MS / 2,
    )
    return () => clearTimeout(id)
  }, [s.move, s.checkMode, s.slowPrompt])

  // Eligibility unclear → hand over, with a row saying so
  useEffect(() => {
    if (s.move?.done && s.move.unclear && !s.escalated) {
      const id = setTimeout(
        () => loanStore.escalate(MOVE_ASK, { extra: [['Eligibility', 'Couldn’t be confirmed']], showReply: false, event: false }),
        700,
      )
      return () => clearTimeout(id)
    }
  }, [s.move, s.escalated])

  // Chat scroll: a fresh reply parks at the top of the view (new events only); re-entry lands on the latest one.
  const scrollRoot = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const landOnLatest = (behavior: ScrollBehavior) => {
    const replies = scrollRoot.current?.querySelectorAll<HTMLElement>('[data-reply]')
    const target = replies?.[replies.length - 1]
    const scroller = scrollRoot.current?.closest<HTMLElement>('[data-scroll]')
    if (!target || !scroller) return
    // deliberately not scrollIntoView: that also scrolls overflow-hidden ancestors (the device
    // frame), which drags the whole screen up under the status bar
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
    scroller.scrollTo({ top: Math.max(0, top), behavior })
  }
  useEffect(() => {
    if (mounted.current) landOnLatest(reduce ? 'auto' : 'smooth')
  }, [s.events, reduce])
  useEffect(() => {
    landOnLatest('auto')
    const id = setTimeout(() => landOnLatest('auto'), 500)
    mounted.current = true
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  const arrive = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? fadeTransition : notificationSpring,
  }

  const send = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    loanStore.sendFreeText(text)
    setDraft('')
  }

  const subtitle = s.paid
    ? paidCopy.header
    : `${loan.due} · ${s.rescheduledTo ? `${s.rescheduledTo} August` : loan.overdue}`

  const { index } = buildAssistantNotes(s)

  return (
    <AnnotationIndex index={index}>
    <Screen className="bg-canvas">
      <TopBar onBack={nav.pop} subtitle={subtitle} />
      <Screen.Content navInset={false} safeBottom={false}>
        <div ref={scrollRoot} className="flex flex-col gap-3 px-4 pb-6 pt-2">
          {/* ---- Options: gone once there is nothing left to decide ---- */}
          {!s.paid && (
          <AssistantBubble>
            <p className="relative">
              <Marker k="proposal.intro" className="-top-2" />
              {message.intro}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {message.options.map((o) => (
                <OptionCTA
                  key={o.key}
                  pin={o.key === 'move' ? 'proposal.limit' : 'proposal.more'}
                  title={o.title}
                  detail={o.detail}
                  onPress={o.key === 'move' ? () => loanStore.setMove({ resolved: 0, done: false }) : o.key === 'time' ? () => loanStore.askMore() : undefined}
                  disabled={decided}
                />
              ))}
            </div>
            <TextAction disabled={decided} pin="proposal.pay">
              {message.pay}
            </TextAction>
            <div className="mt-3 border-t border-[#0000001F]">
              <TextAction onClick={() => loanStore.escalate(message.none)} disabled={decided} pin="proposal.none">
                {message.none}
              </TextAction>
            </div>
          </AssistantBubble>
          )}

          {/* ---- Free text the assistant couldn't parse ---- */}
          {s.freeText.map((text, i) => (
            <motion.div key={`${i}-${text}`} className="flex flex-col gap-3" {...arrive}>
              <div data-reply className="scroll-mt-3">
                <UserBubble>{text}</UserBubble>
              </div>
              {i === 0 && (
                <AssistantBubble>
                  <p className="relative">
                    <Marker k="mis.reflect" className="-top-2" />
                    <Marker k="mis.limit" className="-bottom-2 top-auto" />
                    {misunderstood.line(misunderstood.reflect(text))}
                  </p>
                  <p className="relative mt-3">
                    <Marker k="mis.can" className="-top-2" />
                    {misunderstood.can}
                  </p>
                  <p className="mt-3">{misunderstood.ask}</p>
                  <div className="relative mt-3 flex flex-col gap-2">
                    <Marker k="mis.buttons" className="-top-2" />
                    {/* Repair goes straight to the checking state, not back to the proposal */}
                    <OptionCTA title="Move the due date" onPress={() => loanStore.setMove({ resolved: 0, done: false })} disabled={repairDecided} />
                    <OptionCTA title="Ask for more time" onPress={() => loanStore.askMore()} disabled={repairDecided} />
                  </div>
                </AssistantBubble>
              )}
            </motion.div>
          ))}

          {/* ---- Move the due date: the check, the proposal, and what the save did ---- */}
          {s.move && (
            <motion.div className="flex flex-col gap-3" {...arrive}>
              <div data-reply className="scroll-mt-3">
                <UserBubble>Move the due date</UserBubble>
              </div>
              <AssistantBubble>
                <p className="relative">
                  <Marker k="check.why" className="-top-2" />
                  {moveCheck.intro}
                </p>
                <CheckList run={s.move} reduce={reduce} />
                <div className="relative">
                  <Marker k="check.phone" className="top-1" />
                </div>
                <AnimatePresence initial={false}>
                  {!s.move.done && !s.slowPrompt && (
                    <motion.div key="cancel" className="overflow-hidden" exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={reduce ? fadeTransition : pushTransition}>
                      <TextAction quiet onClick={() => loanStore.setMove(null)}>{moveCheck.cancel}</TextAction>
                    </motion.div>
                  )}
                </AnimatePresence>
              </AssistantBubble>

              {/* Taking too long — a courtesy, not an error */}
              {s.slowPrompt && !s.move.done && (
                <motion.div {...arrive}>
                  <AssistantBubble>
                    <p className="relative">
                      <Marker k="slow.offer" className="-top-2" />
                      {moveCheck.slow}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <OptionCTA
                        title={moveCheck.slowYes}
                        onPress={() => loanStore.escalate(moveCheck.slowYes, { extra: [['Eligibility', 'Check didn’t finish']] })}
                        disabled={!!s.escalated}
                      />
                      <OptionCTA title={moveCheck.slowKeep} onPress={() => loanStore.keepTrying()} disabled={!!s.escalated} pin="slow.keep" />
                    </div>
                  </AssistantBubble>
                </motion.div>
              )}

              {/* Eligibility unclear */}
              {s.move.done && s.move.unclear && (
                <motion.div {...arrive}>
                  <AssistantBubble>
                    <p className="relative">
                      <Marker k="unclear.guess" className="-top-2" />
                      {moveCheck.unclearLine}
                    </p>
                  </AssistantBubble>
                </motion.div>
              )}

              {/* Proposal */}
              {s.move.done && !s.move.unclear && (
                <motion.div {...arrive} transition={{ ...arrive.transition, delay: reduce ? 0 : 0.3 }}>
                  <AssistantBubble>
                    <Proposal
                      onEscape={() => loanStore.escalate(proposal.escapeReply)}
                      onConfirm={(day) => loanStore.confirm(day)}
                      disabled={!!s.moved || !!s.escalated}
                    />
                  </AssistantBubble>
                </motion.div>
              )}

              {/* Save outcomes */}
              {s.moved && (
                <motion.div className="flex flex-col gap-3" {...arrive}>
                  <div data-reply className="scroll-mt-3">
                    <UserBubble>{proposal.button(s.moved)}</UserBubble>
                  </div>
                  {s.saveOutcome === null && s.ref && (
                    <AssistantBubble>
                      <p className="font-semibold">{success.title(s.moved)}</p>
                      <p className="mt-0.5 text-[13px] leading-[18px] text-ink2">{success.ref(s.ref)}</p>
                      <p className="mt-3 font-semibold">{success.unchanged}</p>
                      <FactTable rows={success.rows} className="mt-1" />
                      <Button variant="brand-tinted" size="jupiter" block className="mt-3">{success.remind(s.moved)}</Button>
                      <TextAction>{success.pay}</TextAction>
                    </AssistantBubble>
                  )}
                  {s.saveOutcome === 'unknown' && (
                    <AssistantBubble>
                      <p className="relative font-semibold">
                        <Marker k="unk.title" className="-top-2" />
                        {unknown.title}
                      </p>
                      <p className="relative mt-1">
                        <Marker k="unk.both" className="-top-1" />
                        {unknown.body(s.moved)}
                      </p>
                      <div className="relative">
                        <Marker k="unk.table" className="top-1" />
                        <FactTable rows={unknown.rows} className="mt-3" />
                      </div>
                      <p className="mt-3">{unknown.warn}</p>
                      <div className="mt-3">
                        <OptionCTA title={unknown.locked} centered disabled pin="unk.locked" />
                      </div>
                    </AssistantBubble>
                  )}
                  {s.saveOutcome === 'failed' && (
                    <AssistantBubble>
                      <p className="font-semibold">{failure.title}</p>
                      <p className="relative mt-1">
                        <Marker k="fail.state" className="-top-1" />
                        {failure.body}
                      </p>
                      <div className="relative mt-3">
                        <Marker k="fail.person" className="-top-2" />
                        <OptionCTA title={failure.retry} centered onPress={() => loanStore.retry()} disabled={!!s.escalated} />
                      </div>
                      <TextAction
                        onClick={() => loanStore.escalate(MOVE_ASK, { extra: [['Reschedule', 'Didn’t go through']], showReply: false })}
                        disabled={!!s.escalated}
                      >
                        {failure.person}
                      </TextAction>
                    </AssistantBubble>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ---- Ask for more time: one question, skippable, then hand over ---- */}
          {s.askMore && (
            <motion.div className="flex flex-col gap-3" {...arrive}>
              <div data-reply className="scroll-mt-3">
                <UserBubble>{askTime.reply}</UserBubble>
              </div>
              <AssistantBubble>
                <p>{askTime.intro}</p>
                <p className="mt-3 font-semibold">{askTime.question}</p>
                <div role="radiogroup" aria-label={askTime.question} className="mt-2 flex flex-wrap gap-2">
                  {askTime.options.map((o) => {
                    const selected = s.askChoice === o.label
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!!s.askChoice}
                        onClick={() => loanStore.answerAsk(o.label, o.label)}
                        className={cn(
                          'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold leading-[18px] active:opacity-70 disabled:opacity-50',
                          selected ? 'border-brand/40 bg-brand/12 text-brand-text disabled:opacity-100' : 'border-[#0000002E] bg-white text-ink',
                        )}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
                <TextAction onClick={() => loanStore.answerAsk('skip', askTime.skipReply)} disabled={!!s.askChoice}>
                  {askTime.skip}
                </TextAction>
              </AssistantBubble>
            </motion.div>
          )}

          {/* ---- Hand-off to the team ---- */}
          {s.escalated && (
            <motion.div className="flex flex-col gap-3" {...arrive}>
              {s.escalationShowReply && (
                <div data-reply className="scroll-mt-3">
                  <UserBubble>{s.escalated}</UserBubble>
                </div>
              )}
              <AssistantBubble>
                <p>{s.handoffIntro ?? handoff.intro}</p>
                <Receipt ask={asks[s.escalated] ?? s.escalated} extra={s.receiptExtra} reduce={reduce} />
                <p className="relative mt-3 flex items-center gap-2 font-semibold">
                  <Marker k="esc.priya" className="-top-2" />
                  <SFSymbol name="person.fill" size={12} color="rgb(60 60 67 / 0.6)" className="opacity-60" />
                  {handoff.who}
                </p>
                <p className="relative mt-0.5">
                  <Marker k="esc.failsafe" className="-bottom-1 top-auto" />
                  {handoff.when} {handoff.failsafe}
                </p>
                <p className="mt-3 flex items-center gap-2 font-semibold">
                  <SFSymbol name="clock.fill" size={12} color="rgb(60 60 67 / 0.6)" className="opacity-60" />
                  {handoff.waitTitle}
                </p>
                <p className="relative mt-0.5">
                  <Marker k="esc.wait" className="-top-1" />
                  {handoff.wait}
                </p>
                <div className="mt-3">
                  <OptionCTA title={handoff.pay} centered pin="esc.pay" />
                </div>
                <NoteField />
              </AssistantBubble>
            </motion.div>
          )}

          {/* ---- Already paid: nothing owed, nothing shouting ---- */}
          {s.paid && (
            <motion.div {...arrive}>
              <AssistantBubble>
                <p className="relative font-semibold">
                  <Marker k="paid.title" className="-top-2" />
                  {paidCopy.title}
                </p>
                <p className="mt-1">{paidCopy.body}</p>
                <p className="relative mt-1">
                  <Marker k="paid.covered" className="-top-1" />
                  {paidCopy.fee}
                </p>
                <p className="mt-1 text-[13px] leading-[18px] text-ink2">{paidCopy.ref}</p>
                {/* the apology is the most human line here, so it stands alone */}
                <p className="relative mt-3">
                  <Marker k="paid.sorry" className="-top-1" />
                  {paidCopy.sorry}
                </p>
              </AssistantBubble>
            </motion.div>
          )}

          {/* the composer note needs an anchor even on the screens where the composer is gone */}
          {!composerVisible(s) && (
            <div className="relative">
              <Marker k="composer" className="top-2" />
            </div>
          )}

          {/* Room below the thread so a fresh reply can always scroll to the top */}
          {decided && <div aria-hidden style={{ height: Math.round(height * 0.55) }} />}
        </div>
      </Screen.Content>

      {/* ---- Composer: only where free input can still change the outcome ---- */}
      {composerVisible(s) && (
        <form
          onSubmit={send}
          className="relative z-10 flex shrink-0 items-center gap-2 border-t border-[#0000001F] bg-canvas px-4 pt-2"
          style={{ paddingBottom: 'calc(var(--sab) + 8px)' }}
        >
          <Marker k="composer" className="right-1 top-0" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={misunderstood.composer}
            aria-label="Message"
            className="h-10 min-w-0 flex-1 rounded-full border border-[#0000002E] bg-white px-4 text-[15px] text-ink outline-none placeholder:text-ink2 focus:border-brand/70"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full active:opacity-60 disabled:opacity-40"
          >
            <SFSymbol name="arrow.up.circle.fill" size={32} color="#e36e64" />
          </button>
        </form>
      )}
    </Screen>
    </AnnotationIndex>
  )
}
