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
  return location.startsWith(`~`)
    ? path.resolve(path.join(homeDir, location.replace(`~`, '')))
    : location === `.`
      ? appRoot
      : location.startsWith(`./`)
        ? path.resolve(path.join(`${appRoot}/`, location.replace(`./`, ``)))
        : location.startsWith(`/`)
          ? location
          : path.resolve(path.join(appRoot, location))
}
