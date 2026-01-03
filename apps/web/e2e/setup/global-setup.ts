import { FullConfig } from '@playwright/test'

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('Starting E2E test suite...')
  console.log(`Base URL: ${config.projects[0]?.use?.baseURL}`)

  // Verify environment
  const baseUrl = config.projects[0]?.use?.baseURL || 'http://localhost:3000'

  try {
    const response = await fetch(baseUrl)
    if (!response.ok) {
      console.warn(`Warning: Base URL ${baseUrl} returned status ${response.status}`)
    } else {
      console.log(`Server is running at ${baseUrl}`)
    }
  } catch (error) {
    console.warn(`Warning: Could not connect to ${baseUrl}. Make sure the dev server is running.`)
  }

  // Add any global setup logic here
  // Examples:
  // - Seed test database
  // - Create test users
  // - Set up authentication tokens
  // - Configure feature flags
}

export default globalSetup
