import { defineConfig, stores } from '@adonisjs/limiter'
import type { InferLimiters } from '@adonisjs/limiter/types'

const limiterConfig = defineConfig({
  /**
   * The default store to use for rate limiting.
   * Using memory store - suitable for single-instance deployments.
   * For multi-instance deployments, use Redis.
   */
  default: 'memory' as const,

  stores: {
    /**
     * Memory store for rate limiting.
     * Suitable for single-instance or testing.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
