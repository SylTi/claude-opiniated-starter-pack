import { BaseSeeder } from '@adonisjs/lucid/seeders'
import AdminUserSeeder from './admin_user_seeder.js'
import TestDataSeeder from './test_data_seeder.js'

export default class DatabaseSeeder extends BaseSeeder {
  async run(): Promise<void> {
    await new AdminUserSeeder(this.client).run()
    await new TestDataSeeder(this.client).run()
  }
}
