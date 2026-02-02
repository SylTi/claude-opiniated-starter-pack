/**
 * Design Registry
 *
 * Singleton registry for the main-app design.
 * Only one design can be registered at a time.
 */

import type { AppDesign } from '../types/design.js'
import { isAppDesign } from '../types/design.js'

/**
 * Error thrown when design registration fails.
 */
export class DesignRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesignRegistrationError'
  }
}

/**
 * Error thrown when accessing design before registration.
 */
export class DesignNotRegisteredError extends Error {
  constructor() {
    super('No design registered. Ensure main-app plugin is loaded first.')
    this.name = 'DesignNotRegisteredError'
  }
}

/**
 * Design Registry class.
 * Manages the single main-app design.
 */
class DesignRegistry {
  private design: AppDesign | null = null
  private registeredAt: Date | null = null

  /**
   * Register a design.
   * Throws if a design is already registered.
   */
  register(design: AppDesign): void {
    if (!isAppDesign(design)) {
      throw new DesignRegistrationError(
        'Invalid design object. Must implement AppDesign interface with designId, displayName, appTokens(), and navBaseline().'
      )
    }

    if (this.design !== null) {
      throw new DesignRegistrationError(
        `Design already registered: "${this.design.designId}". ` +
          `Cannot register "${design.designId}". Only one main-app design is allowed.`
      )
    }

    this.design = design
    this.registeredAt = new Date()

    // Call onRegister hook if defined
    if (design.onRegister) {
      const result = design.onRegister()
      if (result instanceof Promise) {
        // Log warning - async onRegister should be awaited separately
        console.warn(
          `[DesignRegistry] Design "${design.designId}" has async onRegister. ` +
            `Consider awaiting it separately for proper initialization.`
        )
      }
    }

    console.log(`[DesignRegistry] Registered design: "${design.designId}"`)
  }

  /**
   * Get the registered design.
   * Throws if no design is registered.
   */
  get(): AppDesign {
    if (this.design === null) {
      throw new DesignNotRegisteredError()
    }
    return this.design
  }

  /**
   * Check if a design is registered.
   */
  has(): boolean {
    return this.design !== null
  }

  /**
   * Get registration timestamp.
   */
  getRegisteredAt(): Date | null {
    return this.registeredAt
  }

  /**
   * Get the design ID if registered.
   */
  getDesignId(): string | null {
    return this.design?.designId ?? null
  }

  /**
   * Clear the registry.
   * For testing purposes only.
   */
  clear(): void {
    this.design = null
    this.registeredAt = null
  }
}

/**
 * Global design registry instance.
 */
export const designRegistry = new DesignRegistry()
