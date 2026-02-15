import type { TTask } from '@TRL/types'

export const logout: TTask = {
  name: `logout`,
  alias: [`lo`],
  description: `Remove stored credentials`,
  example: `tdsk-agent logout`,
  action: async ({ auth, renderer }) => {
    auth.logout()
    renderer.renderSuccess(`Logged out`)
  },
}
