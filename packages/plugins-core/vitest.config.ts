import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'resolve-ts-over-js',
      enforce: 'pre',
      async resolveId(source, importer) {
        // Rewrite .js imports from src/ to .ts so vitest picks up source files
        // instead of stale compiled .js artifacts in src/
        if (importer && source.endsWith('.js') && source.includes('/src/')) {
          const tsPath = source.replace(/\.js$/, '.ts')
          const resolved = await this.resolve(tsPath, importer, { skipSelf: true })
          if (resolved) return resolved
        }
        return null
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
