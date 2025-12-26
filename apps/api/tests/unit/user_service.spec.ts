import { test } from '@japa/runner'
import sinon from 'sinon'
import User from '#models/user'
import UserService from '#services/user_service'
import hash from '@adonisjs/core/services/hash'

/**
 * UNIT TESTS - Database MOCKED
 *
 * These tests do NOT use a real database.
 * All DB calls are mocked to test business logic in isolation.
 *
 * ⚠️ IMPORTANT: Never connect to a real DB in unit tests
 */

test.group('UserService (Unit - DB Mocked)', (group) => {
  let userService: UserService
  let sandbox: sinon.SinonSandbox

  group.each.setup(() => {
    sandbox = sinon.createSandbox()
    userService = new UserService()
  })

  group.each.teardown(() => {
    sandbox.restore()
  })

  // ==================== createUser() tests ====================

  test('createUser creates a new user with hashed password', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
      password: 'hashed_password',
    }

    const createStub = sandbox.stub(User, 'create').resolves(mockUser as unknown as User)

    const result = await userService.createUser({
      email: 'Test@Example.com',
      password: 'securePassword123',
      fullName: 'Test User',
    })

    assert.isTrue(createStub.calledOnce)
    const callArgs = createStub.firstCall.args[0] as Record<string, unknown>
    assert.equal(callArgs.email, 'test@example.com') // Email normalized to lowercase
    assert.equal(callArgs.password, 'securePassword123')
    assert.equal(callArgs.fullName, 'Test User')
    assert.equal(callArgs.role, 'user')
    assert.isFalse(callArgs.emailVerified)
    assert.isFalse(callArgs.mfaEnabled)
    assert.equal(result.id, 1)
  })

  test('createUser normalizes email to lowercase and trims whitespace', async ({ assert }) => {
    const mockUser = { id: 1, email: 'test@example.com' }
    const createStub = sandbox.stub(User, 'create').resolves(mockUser as unknown as User)

    await userService.createUser({
      email: '  TEST@EXAMPLE.COM  ',
      password: 'password123',
    })

    assert.isTrue(createStub.calledOnce)
    const callArgs = createStub.firstCall.args[0] as Record<string, unknown>
    assert.equal(callArgs.email, 'test@example.com')
  })

  test('createUser uses default role when not specified', async ({ assert }) => {
    const mockUser = { id: 1, role: 'user' }
    const createStub = sandbox.stub(User, 'create').resolves(mockUser as unknown as User)

    await userService.createUser({
      email: 'test@example.com',
      password: 'password123',
    })

    const callArgs = createStub.firstCall.args[0] as Record<string, unknown>
    assert.equal(callArgs.role, 'user')
  })

  test('createUser uses custom role when specified', async ({ assert }) => {
    const mockUser = { id: 1, role: 'admin' }
    const createStub = sandbox.stub(User, 'create').resolves(mockUser as unknown as User)

    await userService.createUser({
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    })

    const callArgs = createStub.firstCall.args[0] as Record<string, unknown>
    assert.equal(callArgs.role, 'admin')
  })

  test('createUser sets fullName to null when not provided', async ({ assert }) => {
    const mockUser = { id: 1, fullName: null }
    const createStub = sandbox.stub(User, 'create').resolves(mockUser as unknown as User)

    await userService.createUser({
      email: 'test@example.com',
      password: 'password123',
    })

    const callArgs = createStub.firstCall.args[0] as Record<string, unknown>
    assert.isNull(callArgs.fullName)
  })

  // ==================== updateUser() tests ====================

  test('updateUser updates user fields correctly', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'old@example.com',
      fullName: 'Old Name',
      role: 'user' as const,
      avatarUrl: null,
      currentTeamId: null,
      save: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    const result = await userService.updateUser(1, {
      email: 'new@example.com',
      fullName: 'New Name',
      role: 'admin',
      avatarUrl: 'https://example.com/avatar.png',
      currentTeamId: 5,
    })

    assert.isNotNull(result)
    assert.equal(mockUser.email, 'new@example.com')
    assert.equal(mockUser.fullName, 'New Name')
    assert.equal(mockUser.role, 'admin')
    assert.equal(mockUser.avatarUrl, 'https://example.com/avatar.png')
    assert.equal(mockUser.currentTeamId, 5)
    assert.isTrue(mockUser.save.calledOnce)
  })

  test('updateUser returns null when user not found', async ({ assert }) => {
    sandbox.stub(User, 'find').resolves(null)

    const result = await userService.updateUser(999, { fullName: 'New Name' })

    assert.isNull(result)
  })

  test('updateUser normalizes email to lowercase', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'old@example.com',
      save: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    await userService.updateUser(1, { email: '  NEW@EXAMPLE.COM  ' })

    assert.equal(mockUser.email, 'new@example.com')
  })

  test('updateUser only updates provided fields', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'original@example.com',
      fullName: 'Original Name',
      role: 'user',
      save: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    await userService.updateUser(1, { fullName: 'New Name' })

    assert.equal(mockUser.email, 'original@example.com') // Unchanged
    assert.equal(mockUser.fullName, 'New Name') // Changed
    assert.equal(mockUser.role, 'user') // Unchanged
  })

  test('updateUser can set currentTeamId to null', async ({ assert }) => {
    const mockUser = {
      id: 1,
      currentTeamId: 5,
      save: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    await userService.updateUser(1, { currentTeamId: null })

    assert.isNull(mockUser.currentTeamId)
  })

  // ==================== deleteUser() tests ====================

  test('deleteUser deletes existing user and returns true', async ({ assert }) => {
    const mockUser = {
      id: 1,
      delete: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    const result = await userService.deleteUser(1)

    assert.isTrue(result)
    assert.isTrue(mockUser.delete.calledOnce)
  })

  test('deleteUser returns false when user not found', async ({ assert }) => {
    sandbox.stub(User, 'find').resolves(null)

    const result = await userService.deleteUser(999)

    assert.isFalse(result)
  })

  // ==================== findUserById() tests ====================

  test('findUserById returns user when found', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    const result = await userService.findUserById(1)

    assert.isNotNull(result)
    assert.equal(result?.id, 1)
    assert.equal(result?.email, 'test@example.com')
  })

  test('findUserById returns null when user not found', async ({ assert }) => {
    sandbox.stub(User, 'find').resolves(null)

    const result = await userService.findUserById(999)

    assert.isNull(result)
  })

  // ==================== findUserByEmail() tests ====================

  test('findUserByEmail returns user when found', async ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
    }

    sandbox.stub(User, 'findBy').resolves(mockUser as unknown as User)

    const result = await userService.findUserByEmail('test@example.com')

    assert.isNotNull(result)
    assert.equal(result?.email, 'test@example.com')
  })

  test('findUserByEmail returns null when user not found', async ({ assert }) => {
    sandbox.stub(User, 'findBy').resolves(null)

    const result = await userService.findUserByEmail('nonexistent@example.com')

    assert.isNull(result)
  })

  test('findUserByEmail normalizes email before search', async ({ assert }) => {
    const findByStub = sandbox.stub(User, 'findBy').resolves(null)

    await userService.findUserByEmail('  TEST@EXAMPLE.COM  ')

    assert.isTrue(findByStub.calledOnce)
    assert.equal(findByStub.firstCall.args[1], 'test@example.com')
  })

  // ==================== updatePassword() tests ====================

  test('updatePassword updates user password and returns true', async ({ assert }) => {
    const mockUser = {
      id: 1,
      password: 'old_hashed_password',
      save: sandbox.stub().resolves(),
    }

    sandbox.stub(User, 'find').resolves(mockUser as unknown as User)

    const result = await userService.updatePassword(1, 'newSecurePassword123')

    assert.isTrue(result)
    assert.equal(mockUser.password, 'newSecurePassword123')
    assert.isTrue(mockUser.save.calledOnce)
  })

  test('updatePassword returns false when user not found', async ({ assert }) => {
    sandbox.stub(User, 'find').resolves(null)

    const result = await userService.updatePassword(999, 'newPassword')

    assert.isFalse(result)
  })

  // ==================== verifyPassword() tests ====================

  test('verifyPassword returns true for correct password', async ({ assert }) => {
    const mockUser = {
      id: 1,
      password: 'hashed_password',
    } as unknown as User

    sandbox.stub(hash, 'verify').resolves(true)

    const result = await userService.verifyPassword(mockUser, 'correctPassword')

    assert.isTrue(result)
  })

  test('verifyPassword returns false for incorrect password', async ({ assert }) => {
    const mockUser = {
      id: 1,
      password: 'hashed_password',
    } as unknown as User

    sandbox.stub(hash, 'verify').resolves(false)

    const result = await userService.verifyPassword(mockUser, 'wrongPassword')

    assert.isFalse(result)
  })

  test('verifyPassword returns false when user has no password', async ({ assert }) => {
    const mockUser = {
      id: 1,
      password: null,
    } as unknown as User

    const result = await userService.verifyPassword(mockUser, 'anyPassword')

    assert.isFalse(result)
  })

  // ==================== getAllUsers() tests ====================

  test('getAllUsers returns paginated users', async ({ assert }) => {
    const mockUsers = [
      { id: 1, email: 'user1@example.com' },
      { id: 2, email: 'user2@example.com' },
    ]

    const mockQueryBuilder = {
      orderBy: sandbox.stub().returnsThis(),
      offset: sandbox.stub().returnsThis(),
      limit: sandbox.stub().resolves(mockUsers),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    const result = await userService.getAllUsers(1, 20)

    assert.lengthOf(result, 2)
    assert.isTrue(mockQueryBuilder.orderBy.calledWith('created_at', 'desc'))
    assert.isTrue(mockQueryBuilder.offset.calledWith(0))
    assert.isTrue(mockQueryBuilder.limit.calledWith(20))
  })

  test('getAllUsers calculates correct offset for page 2', async ({ assert }) => {
    const mockQueryBuilder = {
      orderBy: sandbox.stub().returnsThis(),
      offset: sandbox.stub().returnsThis(),
      limit: sandbox.stub().resolves([]),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    await userService.getAllUsers(2, 10)

    assert.isTrue(mockQueryBuilder.offset.calledWith(10)) // (2-1) * 10
  })

  test('getAllUsers uses default pagination values', async ({ assert }) => {
    const mockQueryBuilder = {
      orderBy: sandbox.stub().returnsThis(),
      offset: sandbox.stub().returnsThis(),
      limit: sandbox.stub().resolves([]),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    await userService.getAllUsers()

    assert.isTrue(mockQueryBuilder.offset.calledWith(0))
    assert.isTrue(mockQueryBuilder.limit.calledWith(20))
  })

  // ==================== isEmailTaken() tests ====================

  test('isEmailTaken returns true when email is in use', async ({ assert }) => {
    const mockQueryBuilder = {
      where: sandbox.stub().returnsThis(),
      whereNot: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves({ id: 1, email: 'taken@example.com' }),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    const result = await userService.isEmailTaken('taken@example.com')

    assert.isTrue(result)
    assert.isTrue(mockQueryBuilder.where.calledWith('email', 'taken@example.com'))
  })

  test('isEmailTaken returns false when email is available', async ({ assert }) => {
    const mockQueryBuilder = {
      where: sandbox.stub().returnsThis(),
      whereNot: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves(null),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    const result = await userService.isEmailTaken('available@example.com')

    assert.isFalse(result)
  })

  test('isEmailTaken excludes specified user ID from check', async ({ assert }) => {
    const mockQueryBuilder = {
      where: sandbox.stub().returnsThis(),
      whereNot: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves(null),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    await userService.isEmailTaken('user@example.com', 5)

    assert.isTrue(mockQueryBuilder.whereNot.calledWith('id', 5))
  })

  test('isEmailTaken normalizes email before check', async ({ assert }) => {
    const mockQueryBuilder = {
      where: sandbox.stub().returnsThis(),
      whereNot: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves(null),
    }

    sandbox
      .stub(User, 'query')
      .returns(mockQueryBuilder as unknown as ReturnType<typeof User.query>)

    await userService.isEmailTaken('  USER@EXAMPLE.COM  ')

    assert.isTrue(mockQueryBuilder.where.calledWith('email', 'user@example.com'))
  })

  // ==================== toDTO() tests ====================

  test('toDTO converts user to DTO with correct fields', ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user' as const,
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: 'https://example.com/avatar.png',
      currentTeamId: 3,
      password: 'should_not_be_included',
      mfaSecret: 'should_not_be_included',
      createdAt: new Date(),
    } as unknown as User

    const dto = userService.toDTO(mockUser)

    assert.equal(dto.id, 1)
    assert.equal(dto.email, 'test@example.com')
    assert.equal(dto.fullName, 'Test User')
    assert.equal(dto.role, 'user')
    assert.isTrue(dto.emailVerified)
    assert.isFalse(dto.mfaEnabled)
    assert.equal(dto.avatarUrl, 'https://example.com/avatar.png')
    assert.equal(dto.currentTeamId, 3)
    assert.notProperty(dto, 'password')
    assert.notProperty(dto, 'mfaSecret')
    assert.notProperty(dto, 'createdAt')
  })

  test('toDTO handles null fullName and avatarUrl', ({ assert }) => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      fullName: null,
      role: 'user' as const,
      emailVerified: false,
      mfaEnabled: false,
      avatarUrl: null,
      currentTeamId: null,
    } as unknown as User

    const dto = userService.toDTO(mockUser)

    assert.isNull(dto.fullName)
    assert.isNull(dto.avatarUrl)
    assert.isNull(dto.currentTeamId)
  })

  // ==================== validateEmail() tests ====================

  test('validateEmail accepts valid email formats', ({ assert }) => {
    const validEmails = [
      'simple@example.com',
      'very.common@example.com',
      'disposable.style.email.with+symbol@example.com',
      'other.email-with-hyphen@example.com',
      'fully-qualified-domain@example.com',
      'user.name+tag+sorting@example.com',
      'x@example.com',
      'example-indeed@strange-example.com',
      'example@s.example',
      'user@subdomain.example.com',
    ]

    for (const email of validEmails) {
      assert.isTrue(userService.validateEmail(email), `${email} should be valid`)
    }
  })

  test('validateEmail rejects invalid email formats', ({ assert }) => {
    const invalidEmails = [
      'invalid',
      'test@',
      '@example.com',
      'test @example.com',
      'test@ example.com',
      '',
      'test',
      '@',
      'test@@example.com',
    ]

    for (const email of invalidEmails) {
      assert.isFalse(userService.validateEmail(email), `${email} should be invalid`)
    }
  })

  // ==================== sanitizeUserData() tests ====================

  test('sanitizeUserData removes password from user data', ({ assert }) => {
    const userData = {
      id: 1,
      email: 'test@example.com',
      password: 'secret123',
      fullName: 'Test User',
    }

    const sanitized = userService.sanitizeUserData(userData)

    assert.notProperty(sanitized, 'password')
    assert.property(sanitized, 'email')
    assert.property(sanitized, 'id')
    assert.property(sanitized, 'fullName')
  })

  test('sanitizeUserData removes mfaSecret from user data', ({ assert }) => {
    const userData = {
      id: 1,
      email: 'test@example.com',
      mfaSecret: 'secret_mfa_key',
      fullName: 'Test User',
    }

    const sanitized = userService.sanitizeUserData(userData)

    assert.notProperty(sanitized, 'mfaSecret')
    assert.property(sanitized, 'email')
  })

  test('sanitizeUserData removes mfaBackupCodes from user data', ({ assert }) => {
    const userData = {
      id: 1,
      email: 'test@example.com',
      mfaBackupCodes: '["code1", "code2"]',
      fullName: 'Test User',
    }

    const sanitized = userService.sanitizeUserData(userData)

    assert.notProperty(sanitized, 'mfaBackupCodes')
    assert.property(sanitized, 'email')
  })

  test('sanitizeUserData removes all sensitive fields at once', ({ assert }) => {
    const userData = {
      id: 1,
      email: 'test@example.com',
      password: 'secret123',
      mfaSecret: 'secret_mfa_key',
      mfaBackupCodes: '["code1", "code2"]',
      fullName: 'Test User',
      role: 'user',
    }

    const sanitized = userService.sanitizeUserData(userData)

    assert.notProperty(sanitized, 'password')
    assert.notProperty(sanitized, 'mfaSecret')
    assert.notProperty(sanitized, 'mfaBackupCodes')
    assert.property(sanitized, 'id')
    assert.property(sanitized, 'email')
    assert.property(sanitized, 'fullName')
    assert.property(sanitized, 'role')
  })

  test('sanitizeUserData handles data without sensitive fields', ({ assert }) => {
    const userData = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
    }

    const sanitized = userService.sanitizeUserData(userData)

    assert.deepEqual(sanitized, userData)
  })
})
