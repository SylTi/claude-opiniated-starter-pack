/**
 * User data factories for E2E tests
 */

let userCounter = 0

/**
 * Generate a unique test user
 */
export function createTestUser(overrides: Partial<TestUserData> = {}): TestUserData {
  userCounter++
  const timestamp = Date.now()
  return {
    email: `testuser${userCounter}_${timestamp}@example.com`,
    password: 'Password123!',
    passwordConfirmation: 'Password123!',
    fullName: `Test User ${userCounter}`,
    ...overrides,
  }
}

/**
 * Generate an admin user
 */
export function createAdminUser(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({
    email: `admin_${Date.now()}@example.com`,
    fullName: 'Admin User',
    role: 'admin',
    ...overrides,
  })
}

/**
 * Generate a tier1 subscriber
 */
export function createTier1User(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({
    email: `tier1_${Date.now()}@example.com`,
    fullName: 'Tier 1 User',
    subscriptionTier: 'tier1',
    ...overrides,
  })
}

/**
 * Generate a tier2 subscriber
 */
export function createTier2User(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({
    email: `tier2_${Date.now()}@example.com`,
    fullName: 'Tier 2 User',
    subscriptionTier: 'tier2',
    ...overrides,
  })
}

/**
 * Generate user with MFA enabled
 */
export function createMfaUser(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({
    email: `mfa_${Date.now()}@example.com`,
    fullName: 'MFA User',
    mfaEnabled: true,
    ...overrides,
  })
}

/**
 * Generate user with team
 */
export function createTeamUser(
  teamData: Partial<TestTeamData> = {},
  userOverrides: Partial<TestUserData> = {}
): { user: TestUserData; team: TestTeamData } {
  const user = createTier1User(userOverrides)
  const team: TestTeamData = {
    name: `Team ${Date.now()}`,
    slug: `team-${Date.now()}`,
    tier: 'tier1',
    ...teamData,
  }
  return { user, team }
}

/**
 * Test user data interface
 */
export interface TestUserData {
  email: string
  password: string
  passwordConfirmation?: string
  fullName?: string
  role?: 'user' | 'admin'
  subscriptionTier?: 'free' | 'tier1' | 'tier2'
  mfaEnabled?: boolean
  emailVerified?: boolean
  avatarUrl?: string
}

/**
 * Test team data interface
 */
export interface TestTeamData {
  name: string
  slug: string
  tier: 'tier1' | 'tier2'
}

/**
 * Validation test data
 */
export const INVALID_EMAILS = [
  'invalid',
  'invalid@',
  '@example.com',
  'invalid@.com',
  'invalid@example',
  'invalid @example.com',
]

export const INVALID_PASSWORDS = {
  tooShort: 'Pass1!',
  noUppercase: 'password123!',
  noLowercase: 'PASSWORD123!',
  noNumber: 'Password!',
}

export const VALID_PASSWORDS = ['Password123!', 'MySecurePass1!', 'Test@12345678']

/**
 * Reset user counter (useful for test isolation)
 */
export function resetUserCounter(): void {
  userCounter = 0
}
