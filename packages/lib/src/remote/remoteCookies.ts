import type { KiruSetCookie } from "./action.js"

export type RemoteCookieDefaults = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
  path?: string
}

export type RemoteCookieSetOptions = Partial<KiruSetCookie>

/** Mutable cookie bag for one action handler invocation. */
export class RemoteCookies {
  static defaults: RemoteCookieDefaults = {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  }

  readonly #pending = new Map<string, KiruSetCookie>()

  set(name: string, value: string, options?: RemoteCookieSetOptions): void {
    const d = RemoteCookies.defaults
    this.#pending.set(name, {
      name,
      value,
      path: options?.path ?? d.path ?? "/",
      maxAge: options?.maxAge,
      expires: options?.expires,
      httpOnly: options?.httpOnly ?? d.httpOnly,
      secure: options?.secure ?? d.secure,
      sameSite: options?.sameSite ?? d.sameSite,
    })
  }

  get(name: string): string | undefined {
    return this.#pending.get(name)?.value
  }

  delete(name: string): void {
    const d = RemoteCookies.defaults
    this.#pending.set(name, {
      name,
      value: "",
      path: d.path ?? "/",
      maxAge: 0,
      httpOnly: d.httpOnly,
      secure: d.secure,
      sameSite: d.sameSite,
    })
  }

  toSetCookieList(): KiruSetCookie[] {
    return [...this.#pending.values()]
  }
}
