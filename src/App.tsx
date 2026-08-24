import { useEffect, useRef } from 'react'
import { PhoneFrame } from '@/components/PhoneFrame'
import { NavProvider, useNav } from '@/lib/nav'
import { Navigator } from '@/components/Navigator'
import { CaseSidebar } from '@/components/CaseSidebar'
import { FlowAnnotations } from '@/screens/Flow2'

function InitialRoute() {
  const nav = useNav()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    nav.push('emiOptions')
  }, [nav])
  return null
}

export default function App() {
  return (
    <NavProvider initial="home">
      <InitialRoute />
      <PhoneFrame sidebar={<CaseSidebar />} aside={<FlowAnnotations />}>
        <Navigator />
      </PhoneFrame>
    </NavProvider>
  )
}
