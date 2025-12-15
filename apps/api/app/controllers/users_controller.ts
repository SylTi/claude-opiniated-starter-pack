import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class UsersController {
  async index({ response }: HttpContext): Promise<void> {
    const users = await User.query().select('id', 'email', 'fullName', 'createdAt', 'updatedAt')

    response.json({
      data: users,
    })
  }

  async show({ params, response }: HttpContext): Promise<void> {
    const user = await User.query()
      .select('id', 'email', 'fullName', 'createdAt', 'updatedAt')
      .where('id', params.id)
      .firstOrFail()

    response.json({
      data: user,
    })
  }
}
