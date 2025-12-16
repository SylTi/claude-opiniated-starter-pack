import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import User from '#models/user'

interface SeedUser {
  email: string
  password: string
  fullName: string
  role: 'admin' | 'user' | 'guest'
}

export default class extends BaseSeeder {
  async run(): Promise<void> {
    // Skip in production
    if (app.inProduction) {
      console.log('Skipping default users seeder in production')
      return
    }

    const adminPassword = env.get('SEED_ADMIN_PASSWORD')
    const userPassword = env.get('SEED_USER_PASSWORD')

    if (!adminPassword || !userPassword) {
      console.log(
        'Skipping seeder: SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set in .env.local'
      )
      return
    }

    const defaultUsers: SeedUser[] = [
      {
        email: 'admin@sylti.eu',
        password: adminPassword,
        fullName: 'Admin',
        role: 'admin',
      },
      {
        email: 'syl@sylti.eu',
        password: userPassword,
        fullName: 'Syl',
        role: 'user',
      },
    ]

    for (const userData of defaultUsers) {
      const existingUser = await User.findBy('email', userData.email)

      if (existingUser) {
        console.log(`User already exists: ${userData.email}`)
        continue
      }

      await User.create({
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
        emailVerified: true,
      })

      console.log(`User created: ${userData.email} (${userData.role})`)
    }
  }
}
