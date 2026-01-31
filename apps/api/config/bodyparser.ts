import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  /**
   * The bodyparser middleware will parse the request body
   * for the following HTTP methods.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser
   */
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * Config for the JSON parser
   */
  json: {
    convertEmptyStringsToNull: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
    /**
     * Maximum JSON body size (pre-parse limit).
     *
     * This is the PRIMARY defense against oversized payloads - it rejects
     * requests before parsing into memory, preventing memory exhaustion.
     *
     * Routes with stricter limits (e.g., plugin config at 64KB) enforce
     * their limits post-parse via validatePluginConfigSize().
     *
     * The gap (64KB-1MB) allows memory consumption but is quickly released.
     * For truly strict per-route limits, consider a reverse proxy (nginx).
     */
    limit: '1mb',
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    /**
     * Enabling auto process allows bodyparser middleware to
     * move all uploaded files inside the tmp folder of your
     * operating system
     */
    autoProcess: true,
    convertEmptyStringsToNull: true,
    processManually: [],

    /**
     * Maximum limit of data to parse including all files
     * and fields
     */
    limit: '20mb',
    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig
