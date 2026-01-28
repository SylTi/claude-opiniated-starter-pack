import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  // Use postgres (admin) connection by default
  // RLS is enforced at the API middleware level, not at the DB connection level
  // This allows test fixtures to be created without RLS restrictions
  // Production with Supabase uses different roles handled by Supabase
  connection: 'postgres',
  connections: {
    // Admin connection (superuser) - used for migrations and admin operations
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
        paths: ['database/migrations'],
      },
    },
    // App connection (non-superuser) - used for tests to enforce RLS
    // Falls back to postgres credentials if app_user not configured
    postgres_app: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_APP_USER') || env.get('DB_USER'),
        password: env.get('DB_APP_PASSWORD') || env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
