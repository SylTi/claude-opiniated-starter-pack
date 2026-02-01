import env from '#start/env'
import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    // In development, allow any localhost origin (dynamic ports)
    // Must return the actual origin string for credentials to work
    if (process.env.NODE_ENV !== 'production') {
      if (requestOrigin && requestOrigin.match(/^http:\/\/localhost:\d+$/)) {
        return requestOrigin
      }
    }
    // In production, only allow configured FRONTEND_URL
    const frontendUrl = env.get('FRONTEND_URL')
    if (requestOrigin === frontendUrl) {
      return frontendUrl
    }
    return false
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
