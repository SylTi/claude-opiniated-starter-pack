/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Application name and URL
  |----------------------------------------------------------
  */
  APP_NAME: Env.schema.string.optional(),
  APP_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  // Optional app user credentials (non-superuser for RLS enforcement in tests)
  DB_APP_USER: Env.schema.string.optional(),
  DB_APP_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie'] as const),

  /*
  |----------------------------------------------------------
  | Variables for OAuth providers
  |----------------------------------------------------------
  */
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  GOOGLE_CALLBACK_URL: Env.schema.string.optional(),

  GITHUB_CLIENT_ID: Env.schema.string.optional(),
  GITHUB_CLIENT_SECRET: Env.schema.string.optional(),
  GITHUB_CALLBACK_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for frontend URL (for redirects)
  |----------------------------------------------------------
  */
  FRONTEND_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for seed users (development only)
  |----------------------------------------------------------
  */
  SEED_ADMIN_PASSWORD: Env.schema.string.optional(),
  SEED_USER_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for Resend email service
  |----------------------------------------------------------
  */
  RESEND_API_KEY: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for Stripe payment provider
  |----------------------------------------------------------
  */
  STRIPE_SECRET_KEY: Env.schema.string.optional(),
  STRIPE_WEBHOOK_SECRET: Env.schema.string.optional(),
  STRIPE_PUBLISHABLE_KEY: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for signed user cookie (middleware optimization)
  |----------------------------------------------------------
  */
  USER_COOKIE_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for at-rest encryption (secrets, SSO configs)
  |----------------------------------------------------------
  | ENCRYPTION_MASTER_KEY: Dedicated key for encrypting sensitive data at rest.
  | - Must be at least 32 characters (or 32 bytes base64-encoded)
  | - Falls back to APP_KEY if not set
  | - For key rotation, use comma-separated keys: "newKey,oldKey"
  |   The first key is used for encryption, all keys are tried for decryption.
  */
  ENCRYPTION_MASTER_KEY: Env.schema.string.optional(),
})
