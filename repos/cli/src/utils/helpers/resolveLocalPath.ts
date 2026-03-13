import path from 'path'
import hq from 'alias-hq'
import { homedir } from 'os'

const homeDir = homedir()
const aliases = hq.get(`webpack`)
const appRoot = aliases[`@ROOT`]

/**
 * Converts the local part of a volume string to an absolute path when needed
 * @param {string} vol - The volume string to check
 *
 * @returns {string} - Updated volume string
 */
export const resolveLocalPath = (location: string) => {
  if (location.startsWith(`~`))
    return path.resolve(path.join(homeDir, location.replace(`~`, '')))

  if (location === `.`) return appRoot

  if (location.startsWith(`./`))
    return path.resolve(path.join(`${appRoot}/`, location.replace(`./`, ``)))

  if (location.startsWith(`/`)) return location

  return path.resolve(path.join(appRoot, location))
}
