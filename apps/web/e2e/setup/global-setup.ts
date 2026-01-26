import { FullConfig } from '@playwright/test'
import { spawn } from 'child_process'
import path from 'path'

/**
 * Global setup for E2E tests
 * Runs once before all tests
 *
 * This ensures E2E tests are self-contained and don't depend on
 * external seed state - they create their own test data.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('Starting E2E test suite...')
  console.log(`Base URL: ${config.projects[0]?.use?.baseURL}`)

  // Seed the test database for E2E tests
  // This ensures E2E tests can run independently after integration tests
  await seedTestDatabase()

  // Verify environment
  const baseUrl = config.projects[0]?.use?.baseURL || 'http://localhost:3000'

  try {
    const response = await fetch(baseUrl)
    if (!response.ok) {
      console.warn(`Warning: Base URL ${baseUrl} returned status ${response.status}`)
    } else {
      console.log(`Server is running at ${baseUrl}`)
    }
  } catch {
    console.warn(`Warning: Could not connect to ${baseUrl}. Make sure the dev server is running.`)
  }
}

/**
 * Seed the test database with required E2E test data
 * This runs the test_data_seeder to ensure test users exist
 */
async function seedTestDatabase(): Promise<void> {
  console.log('Seeding E2E test database...')

  const apiDir = path.resolve(__dirname, '../../../api')

  return new Promise((resolve) => {
    const child = spawn(
      'node',
      ['ace', 'db:seed', '--files=database/seeders/test_data_seeder.ts'],
      {
        cwd: apiDir,
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
        stdio: 'inherit',
      }
    )

    child.on('close', (code) => {
      if (code === 0) {
        console.log('E2E test database seeded successfully')
      } else {
        console.error(`Warning: Seeder exited with code ${code}`)
        console.error('E2E tests may fail if test users do not exist')
      }
      // Always resolve - let tests attempt to run
      resolve()
    })

    child.on('error', (error) => {
      console.error('Warning: Failed to seed E2E test database:', error.message)
      console.error('E2E tests may fail if test users do not exist')
      resolve()
    })
  })
}

export default globalSetup
