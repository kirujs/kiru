export interface User {
  id: string
  email: string
}

interface UserInternal {
  id: string
  email: string
  password: string
}

abstract class UserService {
  static users: UserInternal[] = [
    { id: crypto.randomUUID(), email: "admin@example.com", password: "admin" },
  ]

  static async login(email: string, password: string): Promise<User | null> {
    const user = this.users.find(
      (user) => user.email === email && user.password === password
    )
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
    }
  }
}

export default UserService
