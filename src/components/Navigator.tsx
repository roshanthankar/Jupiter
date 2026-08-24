import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion'
import { ScreenEntryContext, useNav, type NavAction, type Presentation, type StackEntry } from '@/lib/nav'
import { SCREENS, SCREEN_OPTIONS } from '@/screens'
import { useFrame, useSetStatusBar } from '@/components/PhoneFrame'
import {
  POP_PROGRESS_THRESHOLD,
  POP_VELOCITY_THRESHOLD,
  fadeTransition,
  pushTransition,
  sheetDismissTransition,
  sheetTransition,
  snapSpring,
} from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * Renders the navigation stack with iOS-style transitions:
 *  - push:  slide in from the right, previous screen parallaxes left + dims; edge-swipe to go back
 *  - sheet: bottom sheet over a dim backdrop; drag the grabber to dismiss
 *  - modal: full-screen card from the bottom; the screen beneath scales back
 */
export function Navigator() {
  const { stack, lastAction } = useNav()
  const setStatusBar = useSetStatusBar()

  // Status bar colour follows the top-most non-sheet screen; anything inside a card modal forces light.
  const topIdx = stack.length - 1 - [...stack].reverse().findIndex((e) => e.presentation !== 'sheet')
  const top = stack[topIdx] ?? stack[0]
  const inModalChain = stack.slice(0, topIdx + 1).some((e) => e.presentation === 'modal')
  useLayoutEffect(() => {
    const opts = SCREEN_OPTIONS[top.name]
    setStatusBar({ style: inModalChain ? 'light' : (opts?.statusBar ?? 'dark'), time: !opts?.hideStatusTime })
  }, [top, inModalChain, setStatusBar])

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <AnimatePresence initial={false} custom={lastAction}>
        {stack.map((entry, i) => (
          <ScreenLayer
            key={entry.key}
            entry={entry}
            index={i}
            action={lastAction}
            coveredBy={stack[i + 1]?.presentation ?? null}
            inModal={stack.slice(0, i).some((e) => e.presentation === 'modal')}
          />
        ))}
      </AnimatePresence>
    </main>
  )
}

interface LayerProps {
  entry: StackEntry
  index: number
  action: NavAction
  coveredBy: Presentation | null
  inModal: boolean
}

function ScreenLayer({ entry, index, action, coveredBy, inModal }: LayerProps) {
  const Component = SCREENS[entry.name] as ComponentType<{ params: unknown }>
  const ctx = useMemo(() => ({ entry, index, inModal }), [entry, index, inModal])
  const content = (
    <ScreenEntryContext.Provider value={ctx}>
      <Component params={entry.params} />
    </ScreenEntryContext.Provider>
  )
  if (entry.presentation === 'sheet') return <SheetLayer>{content}</SheetLayer>
  if (entry.presentation === 'modal') return <ModalLayer coveredBy={coveredBy}>{content}</ModalLayer>
  return (
    <PushLayer index={index} action={action} coveredBy={coveredBy} inModal={inModal}>
      {content}
    </PushLayer>
  )
}

/** Dark overlay laid over a screen while something sits on top of it. */
function Dim({ opacity }: { opacity: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[60] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={pushTransition}
    />
  )
}

function useModalTop() {
  const { safeTop } = useFrame()
  return Math.max(12, safeTop + 10)
}

/* ------------------------------- push ------------------------------- */

function PushLayer({
  index,
  action,
  coveredBy,
  inModal,
  children,
}: {
  index: number
  action: NavAction
  coveredBy: Presentation | null
  inModal: boolean
  children: ReactNode
}) {
  const { pop } = useNav()
  const { width, safeTop } = useFrame()
  const modalTop = useModalTop()
  const x = useMotionValue(0)
  const dragControls = useDragControls()
  const canGoBack = index > 0

  const target =
    coveredBy === 'push'
      ? { x: -width * 0.3, y: 0, scale: 1, opacity: 1, borderRadius: inModal ? 12 : 0 }
      : coveredBy === 'modal'
        ? { x: 0, y: Math.max(2, safeTop), scale: 0.92, opacity: 1, borderRadius: 12 }
        : { x: 0, y: 0, scale: 1, opacity: 1, borderRadius: inModal ? 12 : 0 }

  const reduce = useReducedMotion()
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > width * POP_PROGRESS_THRESHOLD || info.velocity.x > POP_VELOCITY_THRESHOLD) pop()
    else animate(x, 0, snapSpring)
  }

  return (
    <motion.div
      className={cn('isolate absolute inset-x-0 bottom-0 overflow-hidden bg-ios-bg', inModal ? 'rounded-t-[12px]' : '')}
      style={{ x, top: inModal ? modalTop : 0, transformOrigin: '50% 0%' }}
      custom={action}
      variants={{
        // Reduce Motion: slides become cross-dissolves (HIG)
        exit: (a: NavAction) =>
          a === 'reset' || reduce
            ? { opacity: 0, transition: fadeTransition }
            : { x: width, opacity: 1, transition: pushTransition },
      }}
      initial={action === 'reset' || reduce ? { opacity: 0, x: 0 } : { x: width, opacity: 1 }}
      animate={reduce ? { ...target, x: 0, y: 0, scale: 1 } : target}
      exit="exit"
      transition={reduce ? fadeTransition : pushTransition}
      drag={canGoBack ? 'x' : false}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ left: 0, right: width }}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <div className="h-full" style={inModal ? ({ '--sat': '0px' } as CSSProperties) : undefined}>
        {children}
      </div>
      <Dim opacity={coveredBy === 'push' ? 0.12 : coveredBy === 'modal' ? 0.35 : 0} />
      {canGoBack && (
        <div
          className="absolute inset-y-0 left-0 z-[70] w-6 touch-none"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden
        />
      )}
    </motion.div>
  )
}

/* ------------------------------- sheet ------------------------------ */

function SheetLayer({ children }: { children: ReactNode }) {
  const { pop } = useNav()
  const { height } = useFrame()
  const y = useMotionValue(0)
  const dragControls = useDragControls()
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelH, setPanelH] = useState(height)
  useLayoutEffect(() => {
    if (panelRef.current) setPanelH(panelRef.current.offsetHeight)
  }, [])

  const reduce = useReducedMotion()
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > panelH * POP_PROGRESS_THRESHOLD || info.velocity.y > POP_VELOCITY_THRESHOLD) pop()
    else animate(y, 0, snapSpring)
  }

  return (
    <div className="isolate absolute inset-0" style={{ '--sat': '10px' } as CSSProperties}>
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fadeTransition}
        onClick={pop}
      />
      <motion.div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[92%] flex-col overflow-hidden rounded-t-[14px] bg-ios-grouped shadow-[0_-8px_40px_rgba(0,0,0,.18)]"
        style={{ y }}
        initial={reduce ? { opacity: 0, y: 0 } : { y: '100%' }}
        animate={reduce ? { opacity: 1, y: 0 } : { y: 0 }}
        exit={reduce ? { opacity: 0, transition: fadeTransition } : { y: panelH, transition: sheetDismissTransition }}
        transition={reduce ? fadeTransition : sheetTransition}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: panelH }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        {/* Grabber — also the drag handle */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex h-7 cursor-grab touch-none items-start justify-center pt-[6px] active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="h-[5px] w-9 rounded-full bg-ios-gray3" />
        </div>
        {children}
      </motion.div>
    </div>
  )
}

/* ------------------------------- modal ------------------------------ */

function ModalLayer({ coveredBy, children }: { coveredBy: Presentation | null; children: ReactNode }) {
  const { width } = useFrame()
  const modalTop = useModalTop()
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="isolate absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[12px] bg-ios-bg shadow-[0_-10px_40px_rgba(0,0,0,.35)]"
      style={{ top: modalTop, transformOrigin: '50% 0%' }}
      initial={reduce ? { opacity: 0, y: 0, x: 0 } : { y: '100%', x: 0 }}
      animate={
        reduce
          ? { opacity: 1, y: 0, x: 0, scale: 1 }
          : { y: 0, x: coveredBy === 'push' ? -width * 0.3 : 0, scale: coveredBy === 'modal' ? 0.94 : 1 }
      }
      exit={reduce ? { opacity: 0, transition: fadeTransition } : { y: '100%', transition: sheetDismissTransition }}
      transition={reduce ? fadeTransition : sheetTransition}
    >
      <div className="h-full" style={{ '--sat': '0px' } as CSSProperties}>
        {children}
      </div>
      <Dim opacity={coveredBy === 'push' ? 0.12 : coveredBy === 'modal' ? 0.3 : 0} />
    </motion.div>
  )
}
