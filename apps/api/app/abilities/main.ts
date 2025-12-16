/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| Define abilities for authorization checks throughout the application.
|
*/

import User from '#models/user'
import { Bouncer } from '@adonisjs/bouncer'

/**
 * Check if user is an admin
 */
export const isAdmin = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can access admin panel
 */
export const accessAdminPanel = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can manage users
 */
export const manageUsers = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can edit their own profile
 */
export const editOwnProfile = Bouncer.ability((user: User, targetUser: User) => {
  return user.id === targetUser.id
})

/**
 * Check if user can view another user's profile
 */
export const viewUserProfile = Bouncer.ability((user: User, targetUser: User) => {
  return user.id === targetUser.id || user.role === 'admin'
})
