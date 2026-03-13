import path from 'node:path'
import fs from 'node:fs/promises'
import Handlebars from 'handlebars'
import { paths } from '@TBE/utils/paths'
import { logger } from '@TBE/utils/logger'

/**
 * Template Service
 * Manages HTML email templates with Handlebars compilation and in-memory caching.
 * Templates are loaded from the `public/templates/` directory and cached for performance.
 *
 */
export class TemplatesService {
  #directory: string
  #cache: Map<string, Handlebars.TemplateDelegate> = new Map()

  constructor(directory?: string) {
    this.#directory = directory || path.join(paths.public, `templates`)
  }

  /**
   * Render a template with variables
   *
   * @param template - Name of the template file (without .html extension)
   * @param variables - Variables to interpolate in the template
   * @returns Rendered HTML string
   */
  render = async (template: string, variables: Record<string, any>): Promise<string> => {
    const cached = this.#cache.get(template)
    if (cached) return cached(variables)

    try {
      const location = path.join(this.#directory, `${template}.html`)
      const rawHtml = await fs.readFile(location, `utf-8`)
      const compiled = Handlebars.compile(rawHtml)
      this.#cache.set(template, compiled)

      logger.debug(`[TEMPLATE SERVICE] Compiled and cached template: ${template}`)

      return compiled(variables)
    } catch (error: any) {
      logger.error(`[TEMPLATE SERVICE] Failed to load template '${template}':`, error)
      throw new Error(`Could not render template '${template}': ${error.message}`)
    }
  }

  /**
   * Clear template cache
   * Useful for development or when templates are updated
   */
  reset(): void {
    this.#cache.clear()
    logger.debug(`[TEMPLATE SERVICE] Template cache cleared`)
  }

  /**
   * Clear specific template from cache
   */
  remove(template: string): void {
    this.#cache.delete(template)
    logger.debug(`[TEMPLATE SERVICE] Cleared template from cache: ${template}`)
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; templates: string[] } {
    return {
      size: this.#cache.size,
      templates: Array.from(this.#cache.keys()),
    }
  }
}

/**
 * Singleton template service instance
 */
export const templates = new TemplatesService()
