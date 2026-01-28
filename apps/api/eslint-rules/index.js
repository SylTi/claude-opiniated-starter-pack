/**
 * Local ESLint plugin for RLS-related rules.
 *
 * These rules help enforce safe database access patterns
 * that work correctly with Row-Level Security.
 */

import noUnsafeQueryBuilderWrites from './no-unsafe-query-builder-writes.js'

export default {
  rules: {
    'no-unsafe-query-builder-writes': noUnsafeQueryBuilderWrites,
  },
}
