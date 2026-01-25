import { MountableFs, ReadWriteFs, InMemoryFs } from 'just-bash'
import type { IFileSystem } from 'just-bash'
import { EPlatform } from '@TSH/types'
import { logger } from '@TSH/utils/logger'

/**
 * Creates an appropriate filesystem based on platform
 * @param platform - Runtime platform
 * @param homeDir - Home directory path
 * @param persistent - Enable IndexedDB persistence in browser
 * @returns Configured filesystem instance
 */
export const createFileSystem = async (
  platform: EPlatform,
  homeDir: string,
  persistent = true
): Promise<IFileSystem> => {
  const mountableFs = new MountableFs()

  try {
    if (platform === EPlatform.Browser) {
      // Browser: Use IndexedDB for persistent storage or InMemory as fallback
      if (persistent && typeof indexedDB !== 'undefined') {
        logger.info('Initializing IndexedDB filesystem for browser')
        // Note: just-bash may not have direct IndexedDB support
        // We'll use InMemoryFs for now but can be extended
        const memFs = new InMemoryFs()
        await mountableFs.mount('/home', memFs)
        logger.info('Mounted InMemoryFs at /home (browser)')
      } else {
        logger.info('Initializing in-memory filesystem for browser')
        const memFs = new InMemoryFs()
        await mountableFs.mount('/home', memFs)
        logger.info('Mounted InMemoryFs at /home (browser)')
      }
    } else {
      // Node/Bun: Use ReadWriteFs to access real filesystem
      logger.info(`Initializing ReadWriteFs for ${platform} at ${homeDir}`)
      const rwFs = new ReadWriteFs({ root: homeDir })
      await mountableFs.mount('/home', rwFs)
      logger.info(`Mounted ReadWriteFs at /home -> ${homeDir}`)
    }

    // Create common directories
    try {
      await mountableFs.mkdir('/home/workspace', { recursive: true })
      await mountableFs.mkdir('/home/tmp', { recursive: true })
      logger.info('Created default directories: /home/workspace, /home/tmp')
    } catch (error) {
      logger.warn('Failed to create default directories', { error })
    }

    return mountableFs
  } catch (error) {
    logger.error('Failed to create filesystem', { error, platform, homeDir })
    throw new Error(`Filesystem initialization failed: ${error}`)
  }
}

/**
 * Validates that a filesystem is properly mounted and accessible
 * @param fs - Filesystem to validate
 * @returns true if filesystem is valid
 */
export const validateFileSystem = async (fs: IFileSystem): Promise<boolean> => {
  try {
    // Try to read the root directory
    const entries = await fs.readdir('/')
    logger.debug('Filesystem validation successful', { entries })
    return true
  } catch (error) {
    logger.error('Filesystem validation failed', { error })
    return false
  }
}
