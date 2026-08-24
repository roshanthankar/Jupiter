import { motion } from 'framer-motion'
import { tapTransition } from '@/lib/motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  icon: LucideIcon
  badge?: number
}

export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly TabItem<K>[]
  active: K
  onChange: (key: K) => void
}) {
  return (
    <nav
      className="relative z-20 shrink-0 bg-ios-bg/92 shadow-[0_-0.5px_0_0_rgba(60,60,67,0.29)] backdrop-blur-xl"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div className="flex h-[49px] items-stretch">
        {tabs.map((t) => {
          const isActive = t.key === active
          const Icon = t.icon
          return (
            <motion.button
              key={t.key}
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={tapTransition}
              onClick={() => onChange(t.key)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-[3px] pt-[2px]',
                isActive ? 'text-ios-blue' : 'text-ios-gray',
              )}
            >
              <span className="relative">
                <Icon size={25} strokeWidth={isActive ? 2.3 : 1.9} fill={isActive ? 'currentColor' : 'none'} fillOpacity={0.18} />
                {t.badge ? (
                  <span className="absolute -right-3 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ios-red px-1 text-[11px] font-semibold leading-none text-white">
                    {t.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-medium leading-3 tracking-[0.1px]">{t.label}</span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
