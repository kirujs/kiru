const $ADMIN_SERVICE = Symbol.for("AdminService")

export class AdminService {
  [$ADMIN_SERVICE] = true
  static count = 0
  private constructor() {}

  static async getData() {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return { foo: "bar" }
  }
}
