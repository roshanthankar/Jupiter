import { Screen } from '@/components/Screen'
import { CaseList } from '@/components/CaseSidebar'

/** Mobile counterpart of the desktop Cases sidebar — same UI, presented as a bottom sheet from Home. */
export function CasesSheet() {
  return (
    <Screen className="bg-white">
      <Screen.Content navInset={false} className="pt-4">
        <CaseList />
      </Screen.Content>
    </Screen>
  )
}
