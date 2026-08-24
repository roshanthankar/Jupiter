import type { LoanState } from '@/lib/loan'

export type Note = { key: string; label: string; text: string }

/**
 * Annotation groups for the assistant thread. A conversation shows several of these at once, so the
 * numbering is built from whatever is actually on screen rather than fixed per case.
 */
const GROUPS: Record<string, Note[]> = {
  proposal: [
    { key: 'proposal.header', label: 'Header carries the money', text: 'Amount and days overdue sit in the nav bar so the assistant never has to repeat them in a message.' },
    { key: 'proposal.intro', label: '“Here’s what I can do, and what I can’t”', text: 'Frames the whole conversation as bounded, so nothing later feels like a door closing unexpectedly.' },
    { key: 'proposal.limit', label: '“Up to 5 days. I can do this myself.”', text: 'States the limit before offering the help, which is what makes every handoff later read as fair rather than a bait-and-switch.' },
    { key: 'proposal.more', label: '“Ask for more time”', text: 'Merges two spec options that route to the same person, so the user never has to classify their own situation to get help.' },
    { key: 'proposal.pay', label: '“Or pay ₹4,736 now” in quiet text', text: 'They already declined this on the home card; it stays available but isn’t re-pitched.' },
    { key: 'proposal.none', label: '“None of these work for me”', text: 'A fixed escalation trigger, so it needs to look like a real choice rather than a dismissal.' },
  ],
  misunderstood: [
    { key: 'mis.reflect', label: '“I read that as splitting the payment in two”', text: 'Reflects back what it heard, so the correction reads as a correction rather than a refusal.' },
    { key: 'mis.limit', label: '“and I can’t set that up”', text: 'Says the limit plainly instead of hedging, so the user isn’t left rephrasing the same request.' },
    { key: 'mis.can', label: '“What I can do is…”', text: 'Redirects to what’s available before asking anything, so the dead end has an exit attached.' },
    { key: 'mis.buttons', label: 'Two buttons, no restart', text: 'Picking up mid-flow costs the user nothing; losing their place would be worse than the misread.' },
  ],
  checking: [
    { key: 'check.why', label: '“so I don’t promise something I can’t do”', text: 'Explains why it’s looking before it looks, framing the check as working for them rather than assessing them.' },
    { key: 'check.named', label: 'Three named checks', text: 'Shows what data is touched before it’s touched, which is the difference between disclosure and narration.' },
    { key: 'check.finding', label: 'Each step resolves to a finding', text: '“11 of 12 EMIs paid on time” proves the assistant actually looked and quietly tells an anxious person their record is good.' },
    { key: 'check.collapse', label: 'Collapses to “Checked your account”', text: 'The findings stay in the thread but stop competing once the offer arrives.' },
    { key: 'check.phone', label: 'This is the screen a phone call can’t do', text: 'An agent on a call can claim to have checked; only a screen can show it.' },
  ],
  slow: [
    { key: 'slow.spinning', label: 'Third step still spinning', text: 'Shows the delay honestly instead of hiding it behind a generic spinner.' },
    { key: 'slow.offer', label: '“Rather than keep you sitting here…”', text: 'The product anticipates its own slowness and offers a way out, which beats any error screen.' },
    { key: 'slow.keep', label: '“Keep trying” stays available', text: 'Escalation is offered, not forced.' },
  ],
  unclear: [
    { key: 'unclear.icon', label: 'Warning icon on the collapsed check', text: 'The same component carries a bad outcome, so the pattern holds instead of introducing a new one.' },
    { key: 'unclear.guess', label: '“I’m not going to guess with your money”', text: 'Explains the handoff as a decision rather than a failure, which is more reassuring than a generic error.' },
  ],
  confirmation: [
    { key: 'conf.chips', label: 'Chips stop at 12 August', text: 'The picker only offers what the assistant can actually deliver, so nothing shown is a maybe.' },
    { key: 'conf.escape', label: '“Need longer than 12 August? I’ll pass it to the team.”', text: 'Sits right where the limit bites, so someone doing date arithmetic finds the exit at the moment they need it.' },
    { key: 'conf.consequences', label: 'Three consequences before the button', text: 'Fee, credit, and what happens on a second miss, so the user approves with the cost in front of them.' },
    { key: 'conf.button', label: 'Button repeats the date', text: 'The action names exactly what it will do, and the next screen uses the same words.' },
  ],
  unknown: [
    { key: 'unk.title', label: '“I don’t know if this went through”', text: 'The honest headline; guessing either way is wrong in expensive ways.' },
    { key: 'unk.both', label: '“might now be 12 August, or it might still be 3 August”', text: 'Names both possibilities rather than picking the comfortable one.' },
    { key: 'unk.table', label: 'What’s happening / When you’ll know', text: 'Turns an unresolved state into something with a shape and an end time.' },
    { key: 'unk.locked', label: 'Retry locked for 30 minutes', text: 'An anxious user taps regardless of advice, so the control stops it rather than the copy asking nicely.' },
  ],
  failure: [
    { key: 'fail.state', label: '“Nothing changed. Your due date is still 3 August.”', text: 'Says exactly what state the account is in, so the user isn’t left wondering if something half-happened.' },
    { key: 'fail.person', label: 'Try again, then a person', text: 'Two attempts is the limit before a human takes over; nobody should loop with a bot about money.' },
  ],
  escalation: [
    { key: 'esc.passed', label: '“What I’ve passed on”', text: 'A visible record of the context, so the user never has to retell their situation to Priya.' },
    { key: 'esc.trigger', label: '“Eligibility, couldn’t be confirmed”', text: 'The receipt changes with the trigger, so the human sees why this arrived, not just that it did.' },
    { key: 'esc.priya', label: 'Priya, named, with a time', text: 'A named person and a specific hour beats “our team will get back to you shortly”.' },
    { key: 'esc.failsafe', label: '“If she doesn’t, this comes back to me and I’ll chase it”', text: 'The failsafe is what turns a deadline into a commitment.' },
    { key: 'esc.wait', label: '“While you wait… the fee keeps running”', text: 'The uncomfortable truth nobody else states; talking to a person doesn’t pause the clock.' },
    { key: 'esc.pay', label: 'Pay now, still offered', text: 'The one action that stops the fee stays available for someone who changes their mind after reading the above.' },
  ],
  paid: [
    { key: 'paid.title', label: '“Nothing’s owed”', text: 'Leads with the resolution, because the user’s belief is now wrong and correcting it is the whole job.' },
    { key: 'paid.covered', label: '“₹4,736 cleared… covered the EMI and the ₹236 late fee”', text: 'Names both components so “nothing’s owed” is provably true.' },
    { key: 'paid.sorry', label: '“Sorry for chasing you.”', text: 'The assistant owns acting on stale data instead of blaming the system.' },
    { key: 'paid.header', label: 'Header flips to “Next EMI 3 September”', text: 'The persistent state updates the moment the situation does.' },
  ],
  homeReschedule: [
    { key: 'home.resched', label: 'After reschedule', text: 'Amount stays large and “it stays marked overdue until you pay” stays visible, so a date change never reads as a resolution.' },
  ],
  homeEscalation: [
    { key: 'home.esc', label: 'After escalation', text: 'Leads with who has it rather than what’s owed, since a person taking over is the only thing that changed; no pay button, because the user just asked for help and shouldn’t be nagged.' },
  ],
  homePaid: [
    { key: 'home.paid', label: 'After payment', text: '“Nothing due until 3 September” is the headline and the amount drops to body weight, because nothing owed means nothing should be shouting.' },
  ],
}

/**
 * The composer is offered only where free input can still change the outcome. It goes away on the
 * terminal screens: already paid is resolved, the unknown state is deliberately locked, and the
 * escalation carries its own note field for Priya.
 */
export function composerVisible(s: LoanState) {
  return !s.paid && !s.escalated && s.saveOutcome !== 'unknown'
}

/**
 * The composer decision, stated for the state actually on screen. It sits at the foot of the
 * thread, so its note is appended last.
 */
function composerNote(s: LoanState): Note {
  const present = (text: string): Note => ({ key: 'composer', label: 'Composer present', text })
  const removed = (text: string): Note => ({ key: 'composer', label: 'Composer removed', text })
  if (s.paid) return removed('Nothing is owed and the conversation is closed.')
  if (s.move?.unclear) return removed('The assistant has said it won’t guess and handed over; nothing more it can do with a message.')
  if (s.escalated)
    return removed('Replaced by “Add a note for Priya”, so anything typed reaches the person who now owns the case rather than an assistant that has stepped back.')
  if (s.saveOutcome === 'unknown') return removed('The screen deliberately blocks action for 30 minutes; an open text box would undercut that.')
  if (s.saveOutcome === 'failed') return present('Something has gone wrong and the user may want to say something the buttons don’t cover.')
  if (s.freeText.length > 0) return present('This state only exists because free input exists, and the repair is likely to be another sentence rather than a tap.')
  return present('The three options are the fast path, not the only one; someone whose situation doesn’t fit a button can still say so.')
}

/** Which groups are on screen, in the order they appear down the thread. */
function activeGroups(s: LoanState): string[] {
  if (s.scenario === 'homeReschedule') return ['homeReschedule']
  if (s.scenario === 'homeEscalation') return ['homeEscalation']
  if (s.scenario === 'homePaid') return ['homePaid']

  const g: string[] = []
  if (!s.paid) g.push('proposal')
  if (s.freeText.length > 0) g.push('misunderstood')
  if (s.move) {
    g.push('checking')
    if (s.slowPrompt && !s.move.done) g.push('slow')
    if (s.move.done && s.move.unclear) g.push('unclear')
    if (s.move.done && !s.move.unclear) g.push('confirmation')
    if (s.moved && s.saveOutcome === 'unknown') g.push('unknown')
    if (s.moved && s.saveOutcome === 'failed') g.push('failure')
  }
  if (s.escalated) g.push('escalation')
  if (s.paid) g.push('paid')
  return g
}

/** The numbered list for the panel, and the key → number map the pins read. */
export function buildAssistantNotes(s: LoanState) {
  const groups = activeGroups(s)
  const home = groups.length === 1 && groups[0].startsWith('home')
  const notes = groups
    .flatMap((g) => GROUPS[g])
    // the collapsed summary does not exist until the check finishes
    .filter((note) => note.key !== 'check.collapse' || !!s.move?.done)
  // the Home cards have no thread, so no composer note
  if (!home) notes.push(composerNote(s))
  const index: Record<string, number> = {}
  notes.forEach((n, i) => (index[n.key] = i + 1))
  return { notes, index }
}
