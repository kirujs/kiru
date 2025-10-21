export class CustomEvents {
  private constructor() {}

  static on<K extends keyof Kiru.CustomEvents & string>(
    type: K,
    callback: (event: CustomEvent<Kiru.CustomEvents[K]>) => void
  ) {
    window.addEventListener(type, callback as unknown as EventListener)
    return () =>
      window.removeEventListener(type, callback as unknown as EventListener)
  }

  static dispatch<K extends keyof Kiru.CustomEvents & string>(
    type: K,
    detail: Kiru.CustomEvents[K],
    target?: Element
  ) {
    ;(target || document).dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true })
    )
  }
}
