import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'contexts/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
      ],
      exclude: [
        'app/layout.tsx',
        'app/globals.css',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 65,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@saas/plugins-core': path.resolve(__dirname, '../../packages/plugins-core/src/index.ts'),
      '@saas/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@plugins': path.resolve(__dirname, '../../plugins'),
    },
  },
})
