import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

const sessionConfig = defineConfig({
  enabled: true,
  cookieName: 'adonis-session',

  /**
   * When set to true, the session id cookie will be deleted
   * once the user closes the browser.
   */
  clearWithBrowser: false,

  /**
   * Define how long to keep the session data alive without
   * any activity.
   */
  age: '2h',

  /**
   * Configuration for session cookie and the
   * cookie store
   *
   * Note: sameSite 'lax' is required for OAuth flows which use cross-site redirects.
   * 'strict' would prevent the session cookie from being sent on OAuth callback redirects.
   * 'lax' still provides CSRF protection for POST/PUT/DELETE requests while allowing
   * top-level navigation (GET redirects) from external sites.
   */
  cookie: {
    path: '/',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
    // In dev, explicitly set domain to localhost for cross-port cookie sharing
    ...(app.inProduction ? {} : { domain: 'localhost' }),
  },

  /**
   * The store to use. Make sure to validate the environment
   * variable in order to infer the store name without any
   * errors.
   */
  store: env.get('SESSION_DRIVER'),

  /**
   * List of configured stores. Refer documentation to see
   * list of available stores and their config.
   */
  stores: {
    cookie: stores.cookie(),
  },
})

export default sessionConfig
