import { nav } from '@TTH/services/nav'
import { closeSidebar } from '@TTH/actions/sidebar/toggleSidebar'

export const goToOrgs = () => {
  closeSidebar()
  nav.orgs()
}
