import type { ComponentType } from 'react'
import type { ScreenName, ScreenProps } from './registry'
import { Home } from './Home'
import { LockScreen } from './LockScreen'
import { EmiOptions } from './EmiOptions'
import { CasesSheet } from './CasesSheet'
import { Flow2 } from './Flow2'

export type { ScreenName, ScreenParams, ScreenProps } from './registry'

/** name → component. Keys must match `ScreenParams` in registry.ts. */
export const SCREENS = {
  lock: LockScreen,
  home: Home,
  emiOptions: EmiOptions,
  cases: CasesSheet,
  flow2: Flow2,
} satisfies { [N in ScreenName]: ComponentType<ScreenProps<N>> }

/** Optional per-screen chrome settings. */
export const SCREEN_OPTIONS: Partial<Record<ScreenName, { statusBar?: 'light' | 'dark'; hideStatusTime?: boolean }>> = {
  lock: { statusBar: 'light', hideStatusTime: true },
}
