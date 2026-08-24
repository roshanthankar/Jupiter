import { PhoneFrame } from '@/components/PhoneFrame'
import { NavProvider } from '@/lib/nav'
import { Navigator } from '@/components/Navigator'
import { CaseSidebar } from '@/components/CaseSidebar'
import { FlowAnnotations } from '@/screens/Flow2'

export default function App() {
  return (
    <NavProvider initial="lock">
      <PhoneFrame sidebar={<CaseSidebar />} aside={<FlowAnnotations />}>
        <Navigator />
      </PhoneFrame>
    </NavProvider>
  )
}
