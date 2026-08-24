import type { Transition } from 'framer-motion'
export { useReducedMotion } from 'framer-motion'

/**
 * Motion system — aligned with Apple's HIG (Motion) and UIKit's system transitions.
 *
 *  Purposeful & brief   system durations: push/pop 0.35 s, sheets & modals 0.5 s in / 0.4 s out,
 *                       cross-dissolve 0.25 s, tap feedback 0.1 s.
 *  Consistent           one easing family: UIKit's navigation curve for slides, critically-damped
 *                       springs (bounce 0) for sheets/modals and gesture settle.
 *  Optional             every transition has a Reduce Motion fallback — slides/scales become
 *                       cross-dissolves (see Navigator, LockScreen, LockNotification); use
 *                       `useReducedMotion()` when adding new motion.
 *  Honest feedback      controls respond immediately (≤ 0.1 s) and proportionally (slight
 *                       scale / dim), never bounce for decoration.
 */
export const IOS_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1] // UIKit push/pop curve

export const durations = { push: 0.35, sheet: 0.5, sheetDismiss: 0.4, dissolve: 0.25, tap: 0.1 } as const

/** UINavigationController push / pop */
export const pushTransition: Transition = { duration: durations.push, ease: IOS_EASE }
/** Sheet / card-modal present (UISheetPresentationController-style spring) */
export const sheetTransition: Transition = { type: 'spring', duration: durations.sheet, bounce: 0 }
/** Sheet / card-modal dismiss — a touch quicker than present */
export const sheetDismissTransition: Transition = { type: 'spring', duration: durations.sheetDismiss, bounce: 0 }
/** Cross-dissolve — stack reset/replace, and the Reduce Motion fallback for everything else */
export const fadeTransition: Transition = { duration: durations.dissolve, ease: 'easeInOut' }
/** Settle after an interactive gesture is released short of its threshold */
export const snapSpring: Transition = { type: 'spring', duration: 0.35, bounce: 0 }
/** Pressed-state feedback */
export const tapTransition: Transition = { duration: durations.tap, ease: 'easeOut' }
/** UISwitch-like knob */
export const toggleSpring: Transition = { type: 'spring', duration: 0.3, bounce: 0.1 }
/** Lock Screen notification arrival */
export const notificationSpring: Transition = { type: 'spring', duration: 0.45, bounce: 0.15 }

/** Interactive pop: complete when past half the width or flicked (UIKit-like thresholds). */
export const POP_PROGRESS_THRESHOLD = 0.5
export const POP_VELOCITY_THRESHOLD = 300
