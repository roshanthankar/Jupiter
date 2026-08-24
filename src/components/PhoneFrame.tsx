import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { MotionConfig } from 'framer-motion'
import { useClock, useElementSize, useMediaQuery, useWindowSize } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { SYSTEM_FONT } from '@/lib/fonts'

/** iPhone 17 Pro logical points. Design everything at 402 wide. */
export const DEVICE = {
  width: 402,
  height: 874,
  /** gap between the 2px outline and the screen */
  bezel: 6,
  screenRadius: 62,
  outline: 2,
  statusBar: 62,
  homeIndicator: 34,
  island: { width: 126, height: 37, top: 14 },
}

export interface FrameInfo {
  /** Current screen size in CSS px (frame size on desktop, viewport on phones). */
  width: number
  height: number
  /** Safe-area top in px — 62 in the desktop frame, env(safe-area-inset-top) on devices. */
  safeTop: number
  /** True when rendered inside the device outline (desktop). */
  embedded: boolean
  /** True when the Cases sidebar is visible (wide desktop windows) */
  hasSidebar: boolean
}

export type StatusBarStyle = 'light' | 'dark'
export interface StatusBarConfig {
  style: StatusBarStyle
  /** Show the clock on the left (hidden on the Lock Screen, where the big clock is). */
  time: boolean
}

const FrameContext = createContext<FrameInfo>({
  width: DEVICE.width,
  height: DEVICE.height,
  safeTop: DEVICE.statusBar,
  embedded: true,
  hasSidebar: false,
})
const StatusBarContext = createContext<(config: StatusBarConfig) => void>(() => {})

export const useFrame = () => useContext(FrameContext)
export const useSetStatusBar = () => useContext(StatusBarContext)

export function PhoneFrame({ children, sidebar, aside }: { children: ReactNode; sidebar?: ReactNode; aside?: ReactNode }) {
  // On narrow viewports (actual phones) we go edge-to-edge; otherwise we draw a device outline.
  const fullBleed = useMediaQuery('(max-width: 500px)')
  const [statusBar, setStatusBar] = useState<StatusBarConfig>({ style: 'dark', time: true })
  const screenRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(screenRef, { width: DEVICE.width, height: DEVICE.height })
  const win = useWindowSize()

  // Measure env(safe-area-inset-top) so JS animations can use it on real devices.
  const [envTop, setEnvTop] = useState(0)
  useLayoutEffect(() => {
    if (probeRef.current) setEnvTop(parseFloat(getComputedStyle(probeRef.current).paddingTop) || 0)
  }, [fullBleed, win.width, win.height])

  const showSidebar = !!sidebar && !fullBleed && win.width >= 900
  const ctx = useMemo<FrameInfo>(
    () => ({ ...size, safeTop: fullBleed ? envTop : DEVICE.statusBar, embedded: !fullBleed, hasSidebar: showSidebar }),
    [size, fullBleed, envTop, showSidebar],
  )

  if (fullBleed) {
    return (
      <FrameContext.Provider value={ctx}>
        <StatusBarContext.Provider value={setStatusBar}>
          <div
            ref={screenRef}
            className="fixed inset-0 overflow-hidden bg-ios-bg"
            style={
              {
                height: '100dvh',
                '--sat': 'env(safe-area-inset-top, 0px)',
                '--sab': 'env(safe-area-inset-bottom, 0px)',
              } as CSSProperties
            }
          >
            <div ref={probeRef} className="pointer-events-none absolute h-0 w-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />
            {children}
            {/* no room for a column beside the phone, so the notes sit over the foot of the screen */}
            {aside}
          </div>
        </StatusBarContext.Provider>
      </FrameContext.Provider>
    )
  }

  const edge = DEVICE.bezel + DEVICE.outline // outline + gap around the screen
  const outerW = DEVICE.width + edge * 2
  const outerH = DEVICE.height + edge * 2
  const outerRadius = DEVICE.screenRadius + edge
  const sidebarW = showSidebar ? 240 : 0
  const showAside = !!aside && !fullBleed && win.width >= 1200
  const asideW = showAside ? 300 : 0
  const scale = Math.min(1, (win.height - 64) / outerH, (win.width - sidebarW - asideW - 40) / outerW)

  return (
    <FrameContext.Provider value={ctx}>
      <StatusBarContext.Provider value={setStatusBar}>
        {/* Framer needs to know the frame is scaled so drag gestures track the pointer 1:1 */}
        <MotionConfig transformPagePoint={(p) => ({ x: p.x / scale, y: p.y / scale })}>
          {showSidebar && <div className="fixed inset-y-0 left-0 z-10">{sidebar}</div>}
          {showAside && <div className="fixed inset-y-0 right-0 z-10">{aside}</div>}
          <div className="fixed inset-y-0 flex flex-col items-center justify-center overflow-hidden bg-white" style={{ left: sidebarW, right: asideW }}>
            <div style={{ width: outerW * scale, height: outerH * scale }} className="relative">
              <div
                className="absolute left-0 top-0"
                style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              >
                {/* 2px device outline */}
                <div
                  className="pointer-events-none absolute inset-0 border-[#d1d1d6]"
                  style={{ borderRadius: outerRadius, borderWidth: DEVICE.outline }}
                />
                {/* Side buttons — Action, Volume ↑/↓ (left); Side button, Camera Control (right) */}
                <SideButton side="left" top={176} height={52} />
                <SideButton side="left" top={252} height={82} />
                <SideButton side="left" top={350} height={82} />
                <SideButton side="right" top={252} height={158} />
                <SideButton side="right" top={462} height={114} />
                {/* Screen */}
                <div
                  ref={screenRef}
                  className="absolute overflow-hidden bg-ios-bg"
                  style={
                    {
                      inset: edge,
                      borderRadius: DEVICE.screenRadius,
                      '--sat': `${DEVICE.statusBar}px`,
                      '--sab': `${DEVICE.homeIndicator}px`,
                    } as CSSProperties
                  }
                >
                  {children}
                  <StatusBar config={statusBar} />
                  <DynamicIsland />
                  <HomeIndicator />
                </div>
              </div>
            </div>
          </div>
        </MotionConfig>
      </StatusBarContext.Provider>
    </FrameContext.Provider>
  )
}

/* ---------------- Device chrome (desktop frame only) ---------------- */

function SideButton({ side, top, height }: { side: 'left' | 'right'; top: number; height: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute w-[3px] bg-[#e5e5ea]"
      style={{ top, height, [side]: -3, borderRadius: side === 'left' ? '2px 0 0 2px' : '0 2px 2px 0' }}
    />
  )
}

/**
 * Status bar built to Apple's Design Resources spec (Dynamic Island iPhones):
 * time = SF Pro Semibold 17 centred in a 54pt box 26pt from the left edge;
 * cellular 19.2×12.2, wifi 17.1×12.3, battery 27.3×13 with 5pt gaps, 26pt from the right edge;
 * everything vertically centred on the island.
 */
function StatusBar({ config }: { config: StatusBarConfig }) {
  const { style, time: showTime } = config
  const time = useClock()
  const centerY = DEVICE.island.top + DEVICE.island.height / 2
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-[100] transition-colors duration-300',
        style === 'light' ? 'text-white' : 'text-black',
      )}
      style={{ height: DEVICE.statusBar, fontFamily: SYSTEM_FONT }}
    >
      {showTime && (
        <span
          className="absolute flex h-[22px] w-[54px] items-center justify-center text-[17px] font-semibold tracking-[-0.4px]"
          style={{ left: 26, top: centerY - 11 }}
        >
          {time}
        </span>
      )}
      <div className="absolute flex h-[13px] items-center gap-[5px]" style={{ right: 26, top: centerY - 6.5 }}>
        <CellularIcon />
        <WifiIcon />
        <BatteryIcon />
      </div>
    </div>
  )
}

function DynamicIsland() {
  const { width, height, top } = DEVICE.island
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 z-[100] -translate-x-1/2 rounded-full"
      style={{ width, height, top, background: 'rgba(120,120,128,0.2)' }}
    />
  )
}

/**
 * Home indicator — adapts to the content beneath it like iOS: the pill is transparent and a
 * backdrop filter (blur → grayscale → invert → contrast) turns a dark backdrop white and a light
 * one black, with greys in between. See `.home-indicator` in index.css for the fallback.
 */
function HomeIndicator() {
  return (
    <div aria-hidden className="home-indicator pointer-events-none absolute bottom-[8px] left-1/2 z-[100] h-[5px] w-[144px] -translate-x-1/2 rounded-full" />
  )
}

function CellularIcon() {
  // 4 bars, 3pt wide, rx 1 — heights 4 / 6.75 / 9.5 / 12.2
  return (
    <svg width="19.2" height="12.2" viewBox="0 0 19.2 12.2" fill="currentColor" aria-hidden>
      <rect x="0" y="8.2" width="3" height="4" rx="1" />
      <rect x="5.4" y="5.45" width="3" height="6.75" rx="1" />
      <rect x="10.8" y="2.7" width="3" height="9.5" rx="1" />
      <rect x="16.2" y="0" width="3" height="12.2" rx="1" />
    </svg>
  )
}

function WifiIcon() {
  // SF Symbol "wifi": two 2.2pt arcs + a rounded wedge, all ±45° about the bottom centre (8.6, 12.3)
  return (
    <svg width="17.2" height="12.3" viewBox="0 0 17.2 12.3" aria-hidden>
      <path d="M0.68 4.38 A11.2 11.2 0 0 1 16.52 4.38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3.65 7.35 A7 7 0 0 1 13.55 7.35" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.6 12.3 L6.27 9.97 A3.3 3.3 0 0 1 10.93 9.97 Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function BatteryIcon() {
  // 25×13 outline at 35% (rx 4.3), 21×9 capacity fill (rx 2.5), 1.33×4.1 cap at 40%
  return (
    <svg width="27.3" height="13" viewBox="0 0 27.3 13" aria-hidden>
      <rect x="0.5" y="0.5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <rect x="2" y="2" width="21" height="9" rx="2.5" fill="currentColor" />
      <path d="M26 4.78 v3.44 a1.8 1.8 0 0 0 0 -3.44 z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}
