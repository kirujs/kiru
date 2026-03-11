import type { Signal } from "./base.js"

export type SignalSubscriber<T = unknown> = (value: T, prevValue?: T) => void

export type SignalValues<T extends readonly Signal<unknown>[]> = {
  [I in keyof T]: T[I] extends Signal<infer V>
    ? V extends Kiru.StatefulPromise<infer P>
      ? P
      : V
    : never
}
