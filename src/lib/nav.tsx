import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ScreenName, ScreenParams } from '@/screens/registry'

export type Presentation = 'push' | 'sheet' | 'modal'
export type NavAction = 'push' | 'pop' | 'reset'

export interface StackEntry<N extends ScreenName = ScreenName> {
  key: number
  name: N
  params: ScreenParams[N]
  presentation: Presentation
}

/** Params are optional when the screen declares `undefined`, required otherwise. */
type ParamsArg<N extends ScreenName> = undefined extends ScreenParams[N]
  ? [params?: ScreenParams[N]]
  : [params: ScreenParams[N]]

export interface Nav {
  stack: StackEntry[]
  lastAction: NavAction
  /** iOS navigation push — slides in from the right. */
  push<N extends ScreenName>(name: N, ...args: ParamsArg<N>): void
  /** Bottom sheet over the current screen (content-sized, drag to dismiss). */
  present<N extends ScreenName>(name: N, ...args: ParamsArg<N>): void
  /** Full-screen card modal; the screen beneath scales back. */
  presentModal<N extends ScreenName>(name: N, ...args: ParamsArg<N>): void
  /** Go back one step (pops pushes, sheets and modals alike). */
  pop(): void
  /** Alias of pop(), reads better for sheets/modals. */
  dismiss(): void
  /** Pop until the most recent `name` is on top. No-op if not in the stack. */
  popTo(name: ScreenName): void
  /** Pop everything except the root screen. */
  popToRoot(): void
  /** Swap the top screen in place (cross-fade). */
  replace<N extends ScreenName>(name: N, ...args: ParamsArg<N>): void
  /** Throw the whole stack away and start at `name` (cross-fade). */
  reset<N extends ScreenName>(name: N, ...args: ParamsArg<N>): void
}

interface NavState {
  stack: StackEntry[]
  lastAction: NavAction
}

const NavContext = createContext<Nav | null>(null)

let nextKey = 1
const entry = (name: ScreenName, params: unknown, presentation: Presentation): StackEntry => ({
  key: nextKey++,
  name,
  params: params as ScreenParams[ScreenName],
  presentation,
})

export function NavProvider<N extends ScreenName>({
  initial,
  initialParams,
  children,
}: {
  initial: N
  initialParams?: ScreenParams[N]
  children: ReactNode
}) {
  const [state, setState] = useState<NavState>(() => ({
    stack: [entry(initial, initialParams, 'push')],
    lastAction: 'push',
  }))

  const add = useCallback((name: ScreenName, params: unknown, presentation: Presentation) => {
    setState((s) => ({ stack: [...s.stack, entry(name, params, presentation)], lastAction: 'push' }))
  }, [])

  const pop = useCallback(() => {
    setState((s) => (s.stack.length > 1 ? { stack: s.stack.slice(0, -1), lastAction: 'pop' } : s))
  }, [])

  const api = useMemo<Nav>(
    () => ({
      stack: state.stack,
      lastAction: state.lastAction,
      push: (name, ...args) => add(name, args[0], 'push'),
      present: (name, ...args) => add(name, args[0], 'sheet'),
      presentModal: (name, ...args) => add(name, args[0], 'modal'),
      pop,
      dismiss: pop,
      popTo: (name) =>
        setState((s) => {
          const i = s.stack.map((e) => e.name).lastIndexOf(name)
          if (i < 0 || i === s.stack.length - 1) return s
          return { stack: s.stack.slice(0, i + 1), lastAction: 'pop' }
        }),
      popToRoot: () =>
        setState((s) => (s.stack.length > 1 ? { stack: s.stack.slice(0, 1), lastAction: 'pop' } : s)),
      replace: (name, ...args) =>
        setState((s) => {
          const top = s.stack[s.stack.length - 1]
          return {
            stack: [...s.stack.slice(0, -1), entry(name, args[0], top.presentation)],
            lastAction: 'reset',
          }
        }),
      reset: (name, ...args) => setState({ stack: [entry(name, args[0], 'push')], lastAction: 'reset' }),
    }),
    [state, add, pop],
  )

  // Desktop nicety: Esc goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pop])

  return <NavContext.Provider value={api}>{children}</NavContext.Provider>
}

export function useNav(): Nav {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>')
  return ctx
}

/* ---- Per-screen context: lets NavBar know if it can go back, etc. ---- */

export interface ScreenEntryInfo {
  entry: StackEntry
  index: number
  /** True when this screen lives inside a card modal (affects insets). */
  inModal: boolean
}

export const ScreenEntryContext = createContext<ScreenEntryInfo | null>(null)

export function useScreenEntry(): ScreenEntryInfo {
  const ctx = useContext(ScreenEntryContext)
  if (!ctx) throw new Error('useScreenEntry must be used inside a screen rendered by <Navigator>')
  return ctx
}
