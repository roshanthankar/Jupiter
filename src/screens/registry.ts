/**
 * The single source of truth for screen names and their params.
 *
 * To add a screen:
 *   1. Add `myScreen: undefined` (or `myScreen: { id: string }`) below.
 *   2. Create `src/screens/MyScreen.tsx` exporting a component.
 *   3. Register it in `src/screens/index.ts`.
 * Then `nav.push('myScreen', params)` is fully typed.
 */
export type ScreenParams = {
  lock: undefined
  home: undefined
  emiOptions: undefined
  cases: undefined
  flow2: undefined
}

export type ScreenName = keyof ScreenParams
export type ScreenProps<N extends ScreenName> = { params: ScreenParams[N] }
