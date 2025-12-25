import hash from '@adonisjs/core/services/hash'
import User, { type UserRole } from '#models/user'

interface CreateUserData {
  email: string
  password: string
  fullName?: string
  role?: UserRole
}

interface UpdateUserData {
  email?: string
  fullName?: string
  role?: UserRole
  avatarUrl?: string
  currentTeamId?: number | null
}

interface UserDTO {
  id: number
  email: string
  fullName: string | null
  role: UserRole
  emailVerified: boolean
  mfaEnabled: boolean
  avatarUrl: string | null
  currentTeamId: number | null
}

export default class UserService {
  /**
   * Create a new user
   * Password is hashed automatically by the User model's AuthFinder mixin
   */
  async createUser(data: CreateUserData): Promise<User> {
    const user = await User.create({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      fullName: data.fullName || null,
      role: data.role || 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    return user
  }

  /**
   * Update an existing user
   */
  async updateUser(userId: number, data: UpdateUserData): Promise<User | null> {
    const user = await User.find(userId)

    if (!user) {
      return null
    }

    if (data.email !== undefined) {
      user.email = data.email.toLowerCase().trim()
    }
    if (data.fullName !== undefined) {
      user.fullName = data.fullName
    }
    if (data.role !== undefined) {
      user.role = data.role
    }
    if (data.avatarUrl !== undefined) {
      user.avatarUrl = data.avatarUrl
    }
    if (data.currentTeamId !== undefined) {
      user.currentTeamId = data.currentTeamId
    }

    await user.save()
    return user
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(userId: number): Promise<boolean> {
    const user = await User.find(userId)

    if (!user) {
      return false
    }

    await user.delete()
    return true
  }

  /**
   * Find a user by ID
   */
  async findUserById(userId: number): Promise<User | null> {
    return User.find(userId)
  }

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return User.findBy('email', email.toLowerCase().trim())
  }

  /**
   * Update user password
   * New password is hashed automatically by the User model
   */
  async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    const user = await User.find(userId)

    if (!user) {
      return false
    }

    user.password = newPassword
    await user.save()
    return true
  }

  /**
   * Verify user password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) {
      return false
    }
    return hash.verify(user.password, password)
  }

  /**
   * Get all users (with pagination)
   */
  async getAllUsers(page: number = 1, limit: number = 20): Promise<User[]> {
    return User.query()
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
  }

  /**
   * Check if email is already in use
   */
  async isEmailTaken(email: string, excludeUserId?: number): Promise<boolean> {
    const query = User.query().where('email', email.toLowerCase().trim())

    if (excludeUserId) {
      query.whereNot('id', excludeUserId)
    }

    const user = await query.first()
    return user !== null
  }

  /**
   * Convert user to DTO (removes sensitive data)
   */
  toDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      avatarUrl: user.avatarUrl,
      currentTeamId: user.currentTeamId,
    }
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Sanitize user data for public output
   */
  sanitizeUserData<T extends Record<string, unknown>>(
    userData: T
  ): Omit<T, 'password' | 'mfaSecret' | 'mfaBackupCodes'> {
    const { password, mfaSecret, mfaBackupCodes, ...sanitized } = userData as Record<
      string,
      unknown
    >
    return sanitized as Omit<T, 'password' | 'mfaSecret' | 'mfaBackupCodes'>
  }
}
