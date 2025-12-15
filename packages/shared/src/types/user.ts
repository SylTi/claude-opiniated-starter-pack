export interface UserDTO {
  id: number
  email: string
  fullName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateUserDTO {
  email: string
  password: string
  fullName?: string
}

export interface UpdateUserDTO {
  email?: string
  fullName?: string
}

export interface LoginDTO {
  email: string
  password: string
}
