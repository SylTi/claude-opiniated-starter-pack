import { configApp } from '@adonisjs/eslint-config'
import rlsPlugin from './eslint-rules/index.js'

const baseConfig = configApp()

export default [
  ...baseConfig,
  {
    plugins: {
      rls: rlsPlugin,
    },
    rules: {
      // Warn when query builder .update() or .delete() is used without explicit client
      // This helps catch potential RLS bypass issues at lint time.
      // See: apps/api/eslint-rules/no-unsafe-query-builder-writes.js
      'rls/no-unsafe-query-builder-writes': 'warn',
    },
  },
]
