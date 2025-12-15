export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiErrorResponse {
  error: string
  message: string
  errors?: Array<{
    field: string
    message: string
    rule: string
  }>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}
