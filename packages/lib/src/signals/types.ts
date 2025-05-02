import { type Signal } from "./base"

export type ReadonlySignal<T> = Signal<T> & {
  readonly value: T
}
export type SignalSubscriber = Kaioken.VNode | Function

export type CleanupInstance = {
  call?(): void
}
