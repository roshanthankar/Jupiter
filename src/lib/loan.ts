import { useSyncExternalStore } from 'react'

export type MoveRun = { resolved: number; done: boolean; unclear?: boolean }
export type CheckMode = 'normal' | 'unclear' | 'slow'
export type SaveMode = 'ok' | 'unknown' | 'failed'
export type UIVersion = 'v1' | 'v2'

export type Scenario =
  | 'main'
  | 'misunderstood'
  | 'unknown'
  | 'unclear'
  | 'slow'
  | 'failure'
  | 'paid'
  | 'homeReschedule'
  | 'homeEscalation'
  | 'homePaid'
  | 'flow2Start'
  | 'flow2Partial'
  | 'flow2Pending'
  | 'flow2Failed'
  | 'flow2Already'

/** Persistent state shared across screens (mock): money state + the assistant thread. */
export interface LoanState {
  rescheduledTo: number | null
  ref: string | null
  /** Account check */
  move: MoveRun | null
  checkMode: CheckMode
  slowPrompt: boolean
  /** "Ask for more time" */
  askMore: boolean
  askChoice: string | null
  /** Hand-off to the team */
  escalated: string | null
  escalationShowReply: boolean
  handoffIntro: string | null
  receiptExtra: string[][]
  /** Reschedule confirmation */
  moved: number | null
  saveMode: SaveMode
  saveOutcome: 'unknown' | 'failed' | null
  failCount: number
  /** Free text the assistant couldn't parse */
  freeText: string[]
  /** Auto-debit cleared while the conversation was open */
  paid: boolean
  /** Which case is loaded (drives the Flow 2 card variant) */
  scenario: Scenario
  /** Which UI version to render */
  version: UIVersion
  /** Design annotations overlay (V1 only) */
  annotations: boolean
  /** Bumps on every user action (drives the chat scroll) */
  events: number
}

const initial: LoanState = {
  rescheduledTo: null,
  ref: null,
  move: null,
  checkMode: 'normal',
  slowPrompt: false,
  askMore: false,
  askChoice: null,
  escalated: null,
  escalationShowReply: true,
  handoffIntro: null,
  receiptExtra: [],
  moved: null,
  saveMode: 'ok',
  saveOutcome: null,
  failCount: 0,
  freeText: [],
  paid: false,
  scenario: 'main',
  version: 'v1',
  annotations: false,
  events: 0,
}

let state: LoanState = { ...initial }
const listeners = new Set<() => void>()
const set = (patch: Partial<LoanState>, event = true) => {
  state = { ...state, ...patch, events: event ? state.events + 1 : state.events }
  listeners.forEach((l) => l())
}

type Updater<T> = T | ((prev: T) => T)
const resolve = <T,>(u: Updater<T>, prev: T): T => (typeof u === 'function' ? (u as (p: T) => T)(prev) : u)

export const MOVE_ASK = 'Move the due date'

export const loanStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  reset: () => set({ ...initial, version: state.version, annotations: state.annotations }),
  setVersion: (v: UIVersion) => set({ version: v }),
  setAnnotations: (v: boolean) => set({ annotations: v }),
  setMove: (u: Updater<MoveRun | null>, event = true) => set({ move: resolve(u, state.move) }, event),
  setSlowPrompt: (v: boolean) => set({ slowPrompt: v }, false),
  /** "Keep trying": rerun the check normally */
  keepTrying: () => set({ checkMode: 'normal', slowPrompt: false, move: { resolved: 0, done: false } }),
  askMore: () => set({ askMore: true }),
  /** Answer the time question (or skip) and hand off */
  answerAsk: (choice: string, reply: string) => set({ askChoice: choice, escalated: reply, escalationShowReply: true }),
  /** Hand off to the team */
  escalate: (ask: string, opts: { extra?: string[][]; showReply?: boolean; intro?: string | null; event?: boolean } = {}) =>
    set(
      {
        escalated: ask,
        receiptExtra: opts.extra ?? [],
        escalationShowReply: opts.showReply ?? true,
        handoffIntro: opts.intro ?? null,
      },
      opts.event ?? true,
    ),
  /** Confirm the new date; what happens next depends on saveMode */
  confirm(day: number) {
    if (state.saveMode === 'ok') {
      set({ moved: day, rescheduledTo: day, ref: `RSCH-4821-08${String(day).padStart(2, '0')}`, saveOutcome: null })
    } else if (state.saveMode === 'unknown') {
      set({ moved: day, saveOutcome: 'unknown' })
    } else {
      set({ moved: day, saveOutcome: 'failed', failCount: 1 })
    }
  },
  /** Clean failure: retry. The second failure escalates automatically. */
  retry() {
    const failCount = state.failCount + 1
    if (failCount >= 2) {
      set({
        failCount,
        escalated: MOVE_ASK,
        receiptExtra: [['Reschedule', 'Failed twice']],
        escalationShowReply: false,
        handoffIntro: 'It failed again, so I’ll pass this to the team.',
      })
    } else {
      set({ failCount })
    }
  },
  /** Free text the assistant can't parse. The second one escalates automatically. */
  sendFreeText(text: string) {
    const freeText = [...state.freeText, text]
    if (freeText.length >= 2) {
      set({
        freeText,
        escalated: `“${freeText[0]}”`,
        receiptExtra: [['Then', `“${text}”`]],
        escalationShowReply: false,
        handoffIntro: 'I’m still not getting it, so I’ll pass this to the team.',
      })
    } else {
      set({ freeText })
    }
  },
  markPaid: () => set({ paid: true }),

  /** Land directly on a state with the prior conversation in place (prototype navigation). */
  load(s: Scenario) {
    // the UI version is a viewing choice, not case state — it survives loading a case
    const base = { ...initial, scenario: s, version: state.version, annotations: state.annotations, events: state.events + 1 }
    const done: MoveRun = { resolved: 3, done: true }
    const reschedule = { moved: 12, rescheduledTo: 12, ref: '528463110084' }
    switch (s) {
      case 'main':
        state = base
        break
      case 'misunderstood':
        state = { ...base, freeText: ['can i pay half now and half next week'] }
        break
      case 'unknown':
        state = { ...base, move: done, moved: 12, saveMode: 'unknown', saveOutcome: 'unknown' }
        break
      case 'unclear':
        state = {
          ...base,
          checkMode: 'unclear',
          move: { resolved: 3, done: true, unclear: true },
          escalated: MOVE_ASK,
          receiptExtra: [['Eligibility', 'Couldn’t be confirmed']],
          escalationShowReply: false,
        }
        break
      case 'slow':
        state = { ...base, checkMode: 'slow', move: { resolved: 2, done: false }, slowPrompt: true }
        break
      case 'failure':
        state = { ...base, move: done, moved: 12, saveMode: 'failed', saveOutcome: 'failed', failCount: 1 }
        break
      case 'paid':
        state = { ...base, paid: true }
        break
      case 'homeReschedule':
        state = { ...base, move: done, ...reschedule }
        break
      case 'homeEscalation':
        state = { ...base, escalated: 'None of these work for me', escalationShowReply: true }
        break
      case 'homePaid':
        state = { ...base, paid: true }
        break
      case 'flow2Start':
      case 'flow2Partial':
      case 'flow2Pending':
      case 'flow2Failed':
      case 'flow2Already':
        state = base
        break
    }
    listeners.forEach((l) => l())
  },
}

export function useLoan(): LoanState {
  return useSyncExternalStore(loanStore.subscribe, loanStore.get, loanStore.get)
}
