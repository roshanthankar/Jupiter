import { loanStore, useLoan, type Scenario, type UIVersion } from '@/lib/loan'
import { useNav } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { useState } from 'react'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Toggle } from '@/components/List'

export type Case = { key: Scenario; label: string; where: 'thread' | 'home' | 'flow2' }
export const CASES: Case[] = [
  { key: 'main', label: 'Main path', where: 'thread' },
  { key: 'misunderstood', label: 'Misunderstood', where: 'thread' },
  { key: 'unknown', label: 'Unknown outcome', where: 'thread' },
  { key: 'unclear', label: 'Can’t determine eligibility', where: 'thread' },
  { key: 'slow', label: 'Check takes too long', where: 'thread' },
  { key: 'failure', label: 'Clean failure', where: 'thread' },
  { key: 'paid', label: 'Already paid', where: 'thread' },
  { key: 'homeReschedule', label: 'Home · after reschedule', where: 'home' },
  { key: 'homeEscalation', label: 'Home · after escalation', where: 'home' },
  { key: 'homePaid', label: 'Home · after payment', where: 'home' },
]

/** Flows in this project — the segmented control switches between them. */
export const CASE_GROUPS = [
  { key: 'emi', label: 'EMI assistant', cases: CASES },
  {
    key: 'flow2',
    label: 'EMI repayment',
    cases: [
      { key: 'flow2Start', label: 'Paid in full', where: 'flow2' },
      { key: 'flow2Partial', label: 'Partial payment', where: 'flow2' },
      { key: 'flow2Pending', label: 'Payment pending', where: 'flow2' },
      { key: 'flow2Failed', label: 'Payment failed', where: 'flow2' },
      { key: 'flow2Already', label: 'Already paid', where: 'flow2' },
    ] as Case[],
  },
] as const
type GroupKey = (typeof CASE_GROUPS)[number]['key']
let activeGroup: GroupKey = 'emi'

let activeCase: Scenario = 'main'
/** Load a case and land on it (thread cases open the conversation on top of Home). */
export function useGoToCase() {
  const nav = useNav()
  return (c: Case) => {
    loanStore.load(c.key)
    activeCase = c.key
    if (c.where === 'flow2') {
      nav.reset('flow2')
      return
    }
    nav.reset('home')
    if (c.where === 'thread') nav.push('emiOptions')
  }
}
export const getActiveCase = () => activeCase

/** The cases list — identical on the desktop sidebar and the mobile sheet. */
export function CaseList({ onPick }: { onPick?: () => void }) {
  const go = useGoToCase()
  const [, force] = useState(0)
  useLoan() // re-render on store changes
  const group = CASE_GROUPS.find((g) => g.key === activeGroup) ?? CASE_GROUPS[0]
  const { version, annotations } = useLoan()
  return (
    <div className="flex h-full flex-col px-3 py-5 font-sans">
      <SegmentedControl
        id="flows"
        segments={CASE_GROUPS.map((g) => ({ key: g.key, label: g.label }))}
        value={activeGroup}
        onChange={(k) => {
          activeGroup = k
          // land on the flow's first case rather than leaving the previous flow's screen up
          const first = CASE_GROUPS.find((g) => g.key === k)?.cases[0]
          if (first) go(first)
          force((n) => n + 1)
        }}
      />
      {activeGroup === 'emi' && (
        <p className="mt-3 px-2 text-[11px] leading-4 text-ink2">Cmd+R / Refresh tab to start the flow from the beginning.</p>
      )}
      {/* UI versions are only being explored for the repayment cards */}
      {activeGroup === 'flow2' && (
        <>
          <p className="mb-2 mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink2">UI version</p>
          <SegmentedControl
            id="version"
            segments={[
              { key: 'v1' as UIVersion, label: 'V1' },
              { key: 'v2' as UIVersion, label: 'V2' },
            ]}
            value={version}
            onChange={(v) => loanStore.setVersion(v)}
          />
          {/* V2 is the only version with an interaction, and it needs a scroll to show itself */}
          {version === 'v2' && (
            <p className="mt-3 px-2 text-[11px] leading-4 text-ink2">Scroll to view the interaction.</p>
          )}
        </>
      )}
      {/* annotations exist for both flows, but V2 of the repayment cards is deliberately unannotated */}
      {!(activeGroup === 'flow2' && version === 'v2') && (
        <label className="mt-4 flex items-center justify-between gap-3 px-2">
          <span className="text-[13px] leading-[18px] text-ink">Annotations</span>
          <Toggle size="small" value={annotations} onChange={(v) => loanStore.setAnnotations(v)} />
        </label>
      )}
      <p className="mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink2">Cases</p>
      <nav className="mt-2 flex flex-col gap-0.5">
        {group.cases.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              go(c)
              force((n) => n + 1)
              onPick?.()
            }}
            className={cn(
              'rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] active:opacity-70',
              getActiveCase() === c.key ? 'bg-canvas font-semibold text-brand-text' : 'text-ink hover:bg-canvas',
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <p className="mt-auto px-2 pt-6 text-[11px] leading-4 text-ink2">Prototype navigation. Each case opens with the prior conversation already in the thread.</p>
    </div>
  )
}

/** Prototype navigation (wide desktop only): land directly on any state with the prior thread in place. */
export function CaseSidebar() {
  return (
    <aside aria-label="Cases" className="h-full w-[240px] border-r border-[#0000001F] bg-white">
      <CaseList />
    </aside>
  )
}
