export function ref<T>(initialValue: T): Kiru.RefObject<T>
export function ref<T>(initialValue: T | null): Kiru.RefObject<T | null>
export function ref<T = undefined>(): Kiru.RefObject<T | undefined>
export function ref<T>(initialValue?: T | null) {
  return { current: initialValue }
}
