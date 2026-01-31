import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import { getPluginMigrationPaths } from '@saas/config/plugins/migrations'

/**
 * Database configuration.
 *
 * Plugin migrations are discovered via the @saas/config resolver.
 * This uses static loader maps and plugin.meta.json (no fs scanning).
 *
 * SPEC COMPLIANCE:
 * - No runtime fs scanning (uses @pkg/config loader maps)
 * - Resolver lives in @pkg/config (package that owns plugin deps)
 * - Migration discovery is metadata-driven (plugin.meta.json)
 */

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: [
          'database/migrations',
          // Plugin migrations - resolved from @pkg/config using plugin.meta.json
          ...getPluginMigrationPaths(),
        ],
      },
    },
  },
})

export default dbConfig
