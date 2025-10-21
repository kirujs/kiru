export const myStore = new (class<T> {
  #subscribers: Set<() => void>
  #value: T
  constructor(initial: T) {
    this.#value = initial
    this.#subscribers = new Set()
  }
  subscribe = (callback: () => void) => {
    this.#subscribers.add(callback)
    return () => this.#subscribers.delete(callback)
  }
  set = (next: T) => {
    this.#value = next
    this.#subscribers.forEach((fn) => fn())
  }
  get = () => {
    return this.#value
  }
})(0)
