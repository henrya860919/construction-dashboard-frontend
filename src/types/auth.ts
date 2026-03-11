/**
 * 登入／使用者相關型別
 */
export interface User {
  id: string
  email: string
  name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: User
}
